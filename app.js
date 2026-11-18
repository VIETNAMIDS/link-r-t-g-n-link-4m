// app.js - Trung tâm điều phối chính của ứng dụng RuaxBonz Vượt Link (< 300 dòng)
require('dotenv').config();
const { tabs, getActiveTabId, getActiveWebview, executeOnActiveTab, createTab, switchTab, setOnGuestEvent, setOnTabLoaded, initBrowserControls } = require('./modules/tabs');
const { state, syncConfigToWebview, handleVuotLinkGuestEvent, checkAndAutoRunAI, initVuotLinkControls } = require('./modules/vuotlink');
const { handleDirectTargetSearch } = require('./modules/ai');
const { initTelegramIntegration } = require('./modules/telegram');

const logContainer = document.getElementById('log-container');
const btnSoundToggle = document.getElementById('btn-sound-toggle');

let sessionSeconds = 0;
setInterval(() => {
  sessionSeconds++;
  const m = String(Math.floor(sessionSeconds / 60)).padStart(2, '0');
  const s = String(sessionSeconds % 60).padStart(2, '0');
  const timerText = document.getElementById('timer-text');
  if (timerText) timerText.textContent = `${m}:${s}`;
}, 1000);

function addLog(msg, type = 'info') {
  if (!logContainer) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  initBrowserControls(addLog);
  initVuotLinkControls(executeOnActiveTab, tabs, addLog, switchTab, getActiveTabId, createTab);

  setOnGuestEvent((tabId, payload) => {
    handleVuotLinkGuestEvent(tabId, payload, getActiveTabId(), addLog);
    if (payload.type === 'guest_ready') {
      const cur = tabs.find(t => t.id === tabId);
      if (cur) syncConfigToWebview(cur.webview);
    }
  });

  setOnTabLoaded((webview) => {
    syncConfigToWebview(webview);
    checkAndAutoRunAI(webview, addLog, executeOnActiveTab);
  });

  // Tích hợp Telegram Bot chạy trực tiếp trong ứng dụng Desktop
  initTelegramIntegration({
    onBypass: (url, targetDomain) => {
      addLog(`[Telegram]: Nhận link từ Telegram: ${url}`, 'action');
      if (targetDomain) state.targetDomain = targetDomain;

      const isShort = /link4m|vuotlink|traffic120|layma\.|link1s|yeumoney|megaurl|yeulink|\/go\/|\/link\//i.test(url);
      if (!isShort) {
        addLog('[Telegram]: Link web lấy mã -> Tìm kiếm Google trước để vào trang có Referer...', 'info');
        handleDirectTargetSearch(url, addLog, createTab, tabs, switchTab, (dm) => { state.targetDomain = dm; });
      } else {
        createTab(url, 'Link Rút Gọn', true);
      }
    },
    addLog
  });

  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    if (logContainer) logContainer.innerHTML = '';
  });

  btnSoundToggle?.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    btnSoundToggle.innerHTML = state.soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    addLog(`Âm thanh thông báo: ${state.soundEnabled ? 'BẬT' : 'TẮT'}`, 'info');
  });

  createTab('https://www.google.com', 'Google Tìm kiếm', true);
  addLog('Hệ thống Desktop App & Telegram Bot đã sẵn sàng hoạt động.', 'success');
});
