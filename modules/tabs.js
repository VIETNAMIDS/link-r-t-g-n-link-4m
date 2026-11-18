// modules/tabs.js - Quản lý Tabs, Webview & Điều hướng
const path = require('path');

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let lastNewWinTime = 0;

const tabsContainer = document.getElementById('tabs-container');
const webviewsContainer = document.getElementById('webviews-container');
const emptyStateView = document.getElementById('empty-state-view');
const browserUrlDisplay = document.getElementById('browser-url-display');
const totalTabsText = document.getElementById('total-tabs-text');
const browserStatusBadge = document.getElementById('browser-status-badge');

let onGuestEventCallback = null;
let onTabLoadedCallback = null;

function setOnGuestEvent(cb) { onGuestEventCallback = cb; }
function setOnTabLoaded(cb) { onTabLoadedCallback = cb; }
function getActiveTabId() { return activeTabId; }

function getActiveWebview() {
  if (!activeTabId) return null;
  const t = tabs.find(tab => tab.id === activeTabId);
  return t ? t.webview : null;
}

async function executeOnActiveTab(func, args = []) {
  const wv = getActiveWebview();
  if (!wv || typeof wv.executeJavaScript !== 'function') return [{ result: null }];
  const script = `try { (${func.toString()})(...${JSON.stringify(args)}) } catch (_) { null; }`;
  try {
    const result = await wv.executeJavaScript(script).catch(() => null);
    return [{ result }];
  } catch (_) {
    return [{ result: null }];
  }
}

function updateTabCount() {
  if (totalTabsText) totalTabsText.textContent = `${tabs.length} tab`;
}

function createTab(url = 'https://google.com', title = 'Trang mới', activate = true) {
  tabCounter++;
  const tabId = `tab-${Date.now()}-${tabCounter}`;
  if (emptyStateView) emptyStateView.style.display = 'none';

  const tabEl = document.createElement('div');
  tabEl.className = 'tab-item';
  tabEl.id = `btn-${tabId}`;
  tabEl.innerHTML = `
    <i class="fa-solid fa-globe"></i>
    <span class="tab-title">${title}</span>
    <span class="tab-close" title="Đóng tab"><i class="fa-solid fa-xmark"></i></span>
  `;
  tabEl.addEventListener('click', (e) => {
    if (!e.target.closest('.tab-close')) switchTab(tabId);
  });
  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });
  tabsContainer.appendChild(tabEl);

  const webview = document.createElement('webview');
  webview.id = `wv-${tabId}`;
  webview.className = 'webview-tab-content';

  // Thiết lập đầy đủ thuộc tính cấu hình chuẩn trước khi gắn vào DOM và nạp URL
  webview.setAttribute('partition', 'persist:real_chrome_profile');
  const realChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  webview.setAttribute('useragent', realChromeUA);
  webview.setAttribute('preload', path.join(__dirname, '..', 'guest-preload.js'));
  webview.setAttribute('allowpopups', 'true');
  webview.setAttribute('webpreferences', 'contextIsolation=false, nodeIntegration=false, nativeWindowOpen=true, nodeIntegrationInSubFrames=true, webSecurity=false');
  webviewsContainer.appendChild(webview);

  // Gán URL sau khi webview đã được khởi tạo trong DOM
  webview.src = url;

  webview.addEventListener('did-start-loading', () => {
    if (activeTabId === tabId && browserStatusBadge) browserStatusBadge.textContent = 'Đang tải...';
  });

  webview.addEventListener('dom-ready', () => {
    const u = (webview.getURL ? webview.getURL() : '').toLowerCase();
    if (u.includes('google.') || u.includes('bing.')) return;
    if (onTabLoadedCallback) onTabLoadedCallback(webview);
  });

  webview.addEventListener('did-stop-loading', () => {
    const pageTitle = webview.getTitle() || 'Không có tiêu đề';
    tabEl.querySelector('.tab-title').textContent = pageTitle;
    if (activeTabId === tabId) {
      if (browserStatusBadge) browserStatusBadge.textContent = 'Hoạt động';
      if (browserUrlDisplay) { try { browserUrlDisplay.value = webview.getURL(); } catch (_) {} }
    }
  });

  webview.addEventListener('did-navigate', (e) => {
    if (activeTabId === tabId && browserUrlDisplay) browserUrlDisplay.value = e.url;
  });

  webview.addEventListener('console-message', (e) => {
    const msg = e.message;
    if (typeof msg === 'string' && msg.startsWith('__AUTO_GET_CODE__:')) {
      try {
        const payload = JSON.parse(msg.substring('__AUTO_GET_CODE__:'.length));
        if (onGuestEventCallback) onGuestEventCallback(tabId, payload);
      } catch (err) {}
    }
  });

  // Lọc popup rác & chống tràn tab khi trang rút gọn link mở cửa sổ mới
  webview.addEventListener('new-window', (e) => {
    const now = Date.now();
    const u = (e.url || '').toLowerCase();
    if (!u || u.startsWith('about:') || u.startsWith('javascript:')) return;
    if (u.includes('doubleclick') || u.includes('adnxs') || u.includes('popads') || u.includes('adsterra') || u.includes('shopee') || u.includes('lazada') || u.includes('criteo')) return;
    if (now - lastNewWinTime < 1500 && tabs.length >= 4) return;
    lastNewWinTime = now;
    createTab(e.url, 'Nhiệm vụ', true);
  });

  tabs.push({ id: tabId, tabEl, webview });
  updateTabCount();
  if (activate) switchTab(tabId);
  return tabId;
}

function switchTab(tabId) {
  activeTabId = tabId;
  tabs.forEach(t => {
    const isActive = t.id === tabId;
    t.tabEl.classList.toggle('active', isActive);
    t.webview.classList.toggle('active', isActive);
    if (isActive && browserUrlDisplay) {
      try { browserUrlDisplay.value = t.webview.getURL() || t.webview.src; } catch (e) {}
    }
  });
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const { tabEl, webview } = tabs[index];
  tabEl.remove();
  webview.remove();
  tabs.splice(index, 1);
  updateTabCount();

  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      switchTab(tabs[Math.max(0, index - 1)].id);
    } else {
      activeTabId = null;
      if (emptyStateView) emptyStateView.style.display = 'flex';
      if (browserUrlDisplay) browserUrlDisplay.value = 'about:blank';
      if (browserStatusBadge) browserStatusBadge.textContent = 'Sẵn sàng';
    }
  }
}

function initBrowserControls(addLog) {
  document.getElementById('btn-add-tab')?.addEventListener('click', () => createTab('https://www.google.com', 'Google Tìm kiếm', true));
  document.getElementById('btn-back')?.addEventListener('click', () => {
    const wv = getActiveWebview();
    if (wv && wv.canGoBack()) wv.goBack();
  });
  document.getElementById('btn-forward')?.addEventListener('click', () => {
    const wv = getActiveWebview();
    if (wv && wv.canGoForward()) wv.goForward();
  });
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    const wv = getActiveWebview();
    if (wv) wv.reload();
  });

  browserUrlDisplay?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      let url = browserUrlDisplay.value.trim();
      if (!url) return;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = (url.includes('.') && !url.includes(' ')) ? 'https://' + url : 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
      const cur = tabs.find(t => t.id === activeTabId);
      if (cur) {
        cur.webview.loadURL(url).catch(err => {
          if (err.message && (err.message.includes('ERR_ABORTED') || err.message.includes('(-3)'))) return;
          console.warn('loadURL:', err.message);
        });
      } else {
        createTab(url, 'Trang đích', true);
      }
      if (addLog) addLog(`Điều hướng tới: ${url}`, 'info');
    }
  });
}

module.exports = {
  tabs,
  getActiveTabId,
  getActiveWebview,
  executeOnActiveTab,
  createTab,
  switchTab,
  closeTab,
  setOnGuestEvent,
  setOnTabLoaded,
  initBrowserControls
};
