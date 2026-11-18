// test-google-capture.js - Test capture trang qua webview giống app chính
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Giống hệt main.js
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');
app.commandLine.appendSwitch('lang', 'vi-VN,vi,en-US,en');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SHOT_DIR = path.join(__dirname, 'screenshots');
const TARGET_URL = 'https://link4m.net/go/PMJ3J';
const RUN_MS = 60000; // chạy automation 60s

let shotIdx = 0;
async function captureOnce(win, tag) {
  try {
    const b64 = await win.webContents.executeJavaScript(`
      (async () => {
        const w = document.getElementById('wv');
        const native = await w.capturePage();
        return native.toPNG().toString('base64');
      })()
    `);
    if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
    const d = new Date();
    const file = path.join(SHOT_DIR, `link4m_${tag}_${String(shotIdx++).padStart(2, '0')}_${d.getHours()}h${d.getMinutes()}m${d.getSeconds()}s.png`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('[CAPTURE]', tag, '->', file);
    return file;
  } catch (e) {
    console.error('[CAPTURE] Error:', e.message);
    return null;
  }
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    show: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webviewTag: true }
  });

  win.webContents.on('console-message', (e, level, message) => {
    const m = typeof message === 'string' ? message : '';
    if (m.startsWith('TESTCAPTURE') || m.startsWith('__AUTO_GET_CODE__')) console.log('[guest]', m.slice(0, 300));
  });

  win.loadFile('test-google.html');

  const start = Date.now();
  const shotTimes = [8000, 20000, 35000, 50000]; // chụp theo mốc
  let shotPtr = 0;

  const iv = setInterval(async () => {
    const elapsed = Date.now() - start;
    if (shotPtr < shotTimes.length && elapsed >= shotTimes[shotPtr]) {
      const tag = `t${Math.round(elapsed / 1000)}s`;
      await captureOnce(win, tag);
      // đọc trạng thái trang lúc chụp
      try {
        const st = await win.webContents.executeJavaScript(`
          (async () => {
            const w = document.getElementById('wv');
            return await w.executeJavaScript(\`({ url: location.href, title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 400) })\`).catch(e => ({ err: String(e) }));
          })()
        `);
        console.log('[STATE]', JSON.stringify(st));
      } catch (_) {}
      shotPtr++;
    }
    if (elapsed >= RUN_MS) {
      clearInterval(iv);
      await captureOnce(win, 'final');
      setTimeout(() => app.quit(), 500);
    }
  }, 1000);
});
