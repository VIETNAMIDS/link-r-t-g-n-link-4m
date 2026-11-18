// modules/capture.js - Chụp ảnh webview an toàn & Upload online
const { clipboard, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { call9RouterVision } = require('./router9');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

function openScreenshotsFolder(addLog) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  shell.openPath(SCREENSHOTS_DIR);
  if (addLog) addLog('Đã mở thư mục ảnh: ' + SCREENSHOTS_DIR, 'info');
}

// Upload ảnh lên cloud lấy link công khai miễn phí
async function uploadImageOnline(pngBuffer) {
  try {
    const apiKey = process.env.FREEIMAGE_API_KEY;
    if (!apiKey) return null;
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('action', 'upload');
    formData.append('source', pngBuffer.toString('base64'));
    formData.append('format', 'json');
    const res = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const d = await res.json();
      if (d?.image?.url) return d.image.url;
    }
  } catch (_) {}
  return null;
}

// Chụp ảnh webview an toàn chống triệt để lỗi UnknownVizError của Chromium GPU
async function safeCapturePage(webview, rect = null) {
  if (!webview || !webview.isConnected) return null;
  try {
    if (typeof webview.isCrashed === 'function' && webview.isCrashed()) return null;
    const style = window.getComputedStyle ? window.getComputedStyle(webview) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return null;
    const bounds = webview.getBoundingClientRect ? webview.getBoundingClientRect() : null;
    if (bounds && (bounds.width < 50 || bounds.height < 50)) return null;

    if (typeof webview.isLoading === 'function' && webview.isLoading()) {
      await new Promise(r => setTimeout(r, 600));
      if (typeof webview.isLoading === 'function' && webview.isLoading()) return null;
    }
    if (typeof webview.isWaitingForResponse === 'function' && webview.isWaitingForResponse()) {
      await new Promise(r => setTimeout(r, 300));
    }
    await new Promise(r => setTimeout(r, 120));

    let full = null;
    try {
      full = await webview.capturePage();
    } catch (_) {
      return null;
    }
    if (!full || full.isEmpty()) return null;

    if (rect && rect.width > 20 && rect.height > 20) {
      try {
        const size = full.getSize();
        const rx = Math.max(0, Math.min(size.width - 20, Math.floor(rect.x || 0)));
        const ry = Math.max(0, Math.min(size.height - 20, Math.floor(rect.y || 0)));
        const rw = Math.max(20, Math.min(size.width - rx, Math.floor(rect.width)));
        const rh = Math.max(20, Math.min(size.height - ry, Math.floor(rect.height)));
        return full.crop({ x: rx, y: ry, width: rw, height: rh });
      } catch (_) {
        return full;
      }
    }
    return full;
  } catch (_) {
    return null;
  }
}

async function handleUploadScreenshotOnline(webview, addLog) {
  if (!webview) return;
  if (addLog) addLog('Đang chụp màn hình & upload lấy link online...', 'action');
  try {
    const nativeImg = await safeCapturePage(webview);
    if (!nativeImg) {
      if (addLog) addLog('Không thể chụp ảnh webview lúc này', 'warn');
      return null;
    }
    const onlineUrl = await uploadImageOnline(nativeImg.toPNG());
    if (!onlineUrl) {
      if (addLog) addLog('Upload ảnh thất bại; chưa có link để copy.', 'warn');
      return null;
    }

    try {
      clipboard.writeText(onlineUrl);
      if (addLog) addLog(`[Link Ảnh]: ${onlineUrl} (Đã copy link!)`, 'success');
    } catch (err) {
      if (addLog) addLog(`Upload ảnh thành công nhưng không copy được link: ${err.message}`, 'warn');
    }

    try {
      if (addLog) addLog('Đang gửi ảnh sang 9Router AI phân tích...', 'action');
      const routerReply = await call9RouterVision(onlineUrl);
      if (routerReply && addLog) addLog(`[9Router Trả Lời]: ${routerReply}`, 'success');
    } catch (e) { if (addLog) addLog(`9Router: ${e.message}`, 'warn'); }
    return onlineUrl;
  } catch (err) {
    if (addLog) addLog(`Lỗi chụp hoặc upload ảnh: ${err.message}`, 'warn');
    return null;
  }
}

module.exports = {
  SCREENSHOTS_DIR,
  openScreenshotsFolder,
  uploadImageOnline,
  safeCapturePage,
  handleUploadScreenshotOnline
};
