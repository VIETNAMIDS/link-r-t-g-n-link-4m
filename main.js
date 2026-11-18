require('dotenv').config();
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const WEBVIEW_PARTITION = 'persist:real_chrome_profile';

// 1. Tắt toàn bộ cờ báo hiệu Automation / Bot của Chromium từ nhân Blink C++
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process');
app.commandLine.appendSwitch('lang', 'vi-VN,vi,en-US,en');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

// 2. Thiết lập User-Agent mặc định chuẩn Google Chrome 131 Desktop x64
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// 3. Tăng giới hạn EventEmitter cho WebContents tránh cảnh báo bộ nhớ khi mở nhiều tab
app.on('web-contents-created', (event, contents) => {
  try { contents.setMaxListeners(50); } catch (_) {}
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true // Kích hoạt thẻ <webview> nhúng Chromium độc lập
    },
    autoHideMenuBar: true,
    title: 'Browser Automation Desktop App'
  });

  try { win.webContents.setMaxListeners(50); } catch (_) {}
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 3 && !message.includes('reCAPTCHA') && !message.includes('doubleclick') && !message.includes('favicon') && !message.includes('Security Warning') && !message.includes('deprecated')) {
      console.error(`[App Error]: ${message} (${sourceId}:${line})`);
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  const cachePath = path.join(app.getPath('userData'), 'adblocker-engine.bin');
  ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
    path: cachePath,
    read: fs.promises.readFile,
    write: fs.promises.writeFile
  }).then(blocker => {
    blocker.enableBlockingInSession(session.fromPartition(WEBVIEW_PARTITION));
    console.log('[AdBlock] Đã bật bộ lọc quảng cáo cho các webview.');
  }).catch(error => {
    console.error('[AdBlock] Không tải được bộ lọc quảng cáo:', error);
  }).finally(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
