// modules/vuotlink.js - Logic tính năng Vượt Link & Tự Động Lấy Mã (< 300 dòng)
const { storage } = require('./storage');
const { handleAIScanNow, handleDirectTargetSearch, openScreenshotsFolder, handleUploadScreenshotOnline } = require('./ai');
const { safeCapturePage } = require('./capture');
const { notifyTelegramStep, notifyTelegramCode } = require('./telegram');

let electronClipboard = null;
try { const { clipboard } = require('electron'); electronClipboard = clipboard; } catch (_) {}

const state = {
  bypass: true, scroll: true, autoClick: true, delaySeconds: 3, soundEnabled: true, lastCode: '', targetDomain: ''
};

let appTabs = [], appSwitchTab = null, appGetActiveTabId = null, appCreateTab = null, appExecuteOnActiveTab = null;
let lastAnalyzedUrl = '', aiScanTimeout = null, isScanPending = false;
let manualShortlinkWebview = null, manualShortlinkOrigin = '', manualTargetUrl = '';
const captchaPausedTabs = new Set();

function normalizeWebUrl(val) {
  const t = (val || '').trim();
  if (!t) return '';
  const c = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { const u = new URL(c); return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? u.href : null; } catch (_) { return null; }
}

function playSuccessChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

function autoNavigateNextOrFillCode(code, addLog) {
  if (!code || !appTabs || appTabs.length <= 1) return;
  const curId = appGetActiveTabId ? appGetActiveTabId() : null;
  const shortTab = appTabs.find(t => {
    const u = (t.webview?.getURL ? t.webview.getURL() : '').toLowerCase();
    return t.id !== curId && /link4m|vuotlink|traffic120|layma|link1s|yeumoney/i.test(u);
  });
  if (shortTab?.webview) {
    if (addLog) addLog('Đang tự động điền mã vào trang rút gọn ngầm...', 'action');
    shortTab.webview.executeJavaScript(`
      (() => {
        const inps = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea, input[name*="code"], input[id*="code"], input[placeholder*="mã"], input[placeholder*="code"]'));
        for (const inp of inps) {
          if (inp.offsetParent !== null) {
            inp.focus(); inp.value = ${JSON.stringify(code)};
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(() => {
              const subBtn = document.querySelector('button[type="submit"], input[type="submit"], button.btn-primary, [onclick*="submit"], [onclick*="check"]');
              if (subBtn) subBtn.click();
            }, 300);
            return true;
          }
        }
        return false;
      })()
    `).catch(() => {});
  }
}

async function copyCodeToClipboard(code, addLog) {
  if (!code || /^\d{5,6}$/.test(code)) return;
  state.lastCode = code;
  const codeResultVal = document.getElementById('code-result-val');
  const autoStatusText = document.getElementById('auto-status-text');
  const autoTimerText = document.getElementById('auto-timer-text');
  const copyNotify = document.getElementById('copy-notify');

  if (codeResultVal) codeResultVal.textContent = code;
  if (electronClipboard) { try { electronClipboard.writeText(code); } catch (_) {} }
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).catch(() => {});
  if (autoStatusText) { autoStatusText.textContent = 'Hoàn thành!'; autoStatusText.className = 'status-val text-success'; }
  if (autoTimerText) { autoTimerText.textContent = 'Đã lấy mã'; autoTimerText.className = 'status-val text-warning'; }
  if (copyNotify) copyNotify.classList.add('show');
  playSuccessChime();

  if (addLog) addLog(`ĐÃ BẮT ĐƯỢC MÃ THÀNH CÔNG: ${code}`, 'success');

  // Chụp ảnh bằng chứng có mã gửi về Telegram
  let shotBuf = null;
  try {
    const curId = appGetActiveTabId ? appGetActiveTabId() : null;
    const curTab = appTabs.find(t => t.id === curId);
    if (curTab?.webview) {
      const nativeImg = await safeCapturePage(curTab.webview);
      if (nativeImg && !nativeImg.isEmpty()) shotBuf = nativeImg.toPNG();
    }
  } catch (_) {}
  notifyTelegramCode(code, shotBuf);

  autoNavigateNextOrFillCode(code, addLog);
}

function setTargetDomain(domain) {
  state.targetDomain = domain || '';
  appTabs.forEach(t => syncConfigToWebview(t.webview));
}

function syncConfigToWebview(webview) {
  if (!webview || typeof webview.executeJavaScript !== 'function') return;
  try { if (typeof webview.isLoading === 'function' && webview.isLoading()) return; } catch (_) {}
  const cfg = { autoClick: state.autoClick, autoScroll: state.scroll, delaySeconds: state.delaySeconds, bypass: state.bypass };
  const targetScript = `window.__TARGET_DOMAIN__ = ${JSON.stringify(state.targetDomain)};`;
  webview.executeJavaScript(`
    try { window.__AUTO_CONFIG__ = Object.assign(window.__AUTO_CONFIG__ || {}, ${JSON.stringify(cfg)}); ${targetScript} } catch (_) {}
  `).catch(() => {});
}

function handleVuotLinkGuestEvent(tabId, data, activeTabId, addLog) {
  const autoStatusText = document.getElementById('auto-status-text');
  const autoTimerText = document.getElementById('auto-timer-text');

  if (data.type === 'captcha_detected') {
    captchaPausedTabs.add(tabId);
    if (addLog) addLog('Phát hiện CAPTCHA. Hãy tự xác minh để tiếp tục.', 'warn');
  } else if (data.type === 'btn_found') {
    if (addLog) addLog(`[Bước 6 - Tìm mã]: Thấy nút "${data.text}"`, 'info');
  } else if (data.type === 'btn_clicked') {
    if (addLog) addLog(`[Bước 6 - Bấm tìm mã]: Đã click vào "${data.text || 'Nút lấy mã'}"`, 'action');
    notifyTelegramStep(`⏱️ <b>[Bước 5/6] Đã bấm nút lấy mã:</b>\n<i>Đang chờ đếm ngược trên màn hình...</i>`);
  } else if (data.type === 'scrolling_down') {
    if (addLog) addLog('[Bước 5 - Lướt xuống]: Đang lướt xuống cuối trang đích tìm nút mã...', 'info');
  } else if (data.type === 'countdown') {
    if (autoTimerText) autoTimerText.textContent = data.text;
    if (autoStatusText) { autoStatusText.textContent = `[Bước 7] Đếm ngược ${data.text}...`; autoStatusText.className = 'status-val text-cyan'; }
    if (data.seconds === 60 || data.seconds === 30 || data.seconds === 10) {
      notifyTelegramStep(`⏱️ <b>[Bước 5/6] Đang đếm ngược:</b> <code>${data.seconds}s</code>...`);
    }
  } else if (data.type === 'other_article_clicked') {
    if (addLog) addLog(`[Bước 8 - Bấm link khác]: Đã nhấp sang bài viết khác: ${data.text || data.url}`, 'action');
    setTimeout(async () => {
      const cur = appTabs.find(t => t.id === tabId);
      if (cur?.webview) {
        const shot = await safeCapturePage(cur.webview);
        notifyTelegramStep(`📸 <b>[Bước 8 - Chuyển sang bài viết khác]</b>\n📄 <code>${data.text || data.url}</code>\n<i>Đang lướt xuống cuối bài để bấm nút lấy mã...</i>`, shot ? shot.toPNG() : null);
      }
    }, 1800);
  } else if (data.type === 'step2_btn_clicked') {
    if (addLog) addLog(`[Bước 9 - Bấm nút lấy mã]: Đã click vào nút "${data.text || 'Bước 2'}"`, 'action');
    setTimeout(async () => {
      const cur = appTabs.find(t => t.id === tabId);
      if (cur?.webview) {
        const shot = await safeCapturePage(cur.webview);
        notifyTelegramStep(`📸 <b>[Bước 9 - Bấm nút lấy mã]</b> Đã click "${data.text || 'Bước 2'}"!\n<i>Đang chờ mã xác nhận hiển thị...</i>`, shot ? shot.toPNG() : null);
      }
    }, 600);
  } else if (data.type === 'code_detected') {
    if (data.code && data.code.trim().length >= 4) {
      copyCodeToClipboard(data.code.trim(), addLog);
    }
  } else if (data.type === 'request_real_click') {
    const cur = appTabs.find(t => t.id === tabId);
    if (cur?.webview) {
      const { x, y, label } = data;
      if (addLog) addLog(`[Chuột thật]: Đang click thật vào "${label || 'Nút'}" tại (${x}, ${y})`, 'action');
      try {
        cur.webview.sendInputEvent({ type: 'mouseMove', x, y });
        setTimeout(() => {
          cur.webview.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
          setTimeout(() => { cur.webview.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); }, 60);
        }, 120);
      } catch (_) {}
    }
  } else if (data.type === 'google_target_clicked') {
    if (addLog) addLog(`[Bước 4 - Bấm link tên miền]: Đã nhấp vào website đích: ${data.target}`, 'success');
  }
}

function checkAndAutoRunAI(webview, addLog, executeOnActiveTab, force = false) {
  if (!webview || isScanPending) return;
  const owningTab = appTabs.find(t => t.webview === webview);
  if (owningTab && captchaPausedTabs.has(owningTab.id)) return;
  const url = (webview.getURL ? webview.getURL() : webview.src || '').toLowerCase();
  if (!url || !url.startsWith('http') || (url === lastAnalyzedUrl && !force)) return;
  if (url.includes('google.') || url.includes('bing.')) return;

  const isShortlink = force || /link4m|vuotlink|traffic120|traffic123|layma\.|layma4u|link1s|yeumoney|megaurl|yeulink|\/(?:go|link|links)\/[a-zA-Z0-9_\-]+/i.test(url);
  if (isShortlink) {
    lastAnalyzedUrl = url; isScanPending = true;
    if (aiScanTimeout) clearTimeout(aiScanTimeout);
    if (addLog) addLog('[Bước 1 - Link rút gọn]: Đã vào trang rút gọn, chờ 4s...', 'info');

    aiScanTimeout = setTimeout(async () => {
      try {
        const curId = appGetActiveTabId ? appGetActiveTabId() : null;
        const curTab = Array.isArray(appTabs) ? appTabs.find(t => t.id === curId) : null;
        if (curTab && curTab.webview !== webview) return;

        // Chụp ảnh Bước 1 gửi Telegram
        try {
          const shot1 = await safeCapturePage(webview);
          if (shot1 && !shot1.isEmpty()) notifyTelegramStep(`📸 <b>[Bước 1/6] Đã mở link rút gọn</b>\n🔗 <code>${url}</code>`, shot1.toPNG());
        } catch (_) {}

        if (addLog) addLog('[Bước 1]: Bắt đầu chụp màn hình Bước 2 & 3...', 'action');
        handleAIScanNow(webview, addLog, appCreateTab, executeOnActiveTab, copyCodeToClipboard, appTabs, appSwitchTab, setTargetDomain, manualTargetUrl);
      } finally { isScanPending = false; }
    }, 4000);
  }
}

function initVuotLinkControls(executeOnActiveTab, tabs, addLog, switchTab, getActiveTabId, createTab) {
  appTabs = tabs; appSwitchTab = switchTab; appGetActiveTabId = getActiveTabId;
  appCreateTab = createTab; appExecuteOnActiveTab = executeOnActiveTab;

  const shortlinkInput = document.getElementById('shortlink-url-input');
  const targetWebsiteInput = document.getElementById('target-website-url-input');
  const startLinkButton = document.getElementById('btn-start-link-flow');

  const startLinkFlow = () => {
    const shortlinkValue = shortlinkInput ? shortlinkInput.value.trim() : '';
    const targetValue = targetWebsiteInput ? targetWebsiteInput.value.trim() : '';
    const raw = shortlinkValue || targetValue;
    if (!raw) return;

    const submittedUrl = normalizeWebUrl(raw);
    if (!submittedUrl) return;

    const isShort = /link4m|vuotlink|traffic120|layma\.|link1s|yeumoney|megaurl|yeulink|\/go\/|\/link\//i.test(submittedUrl);
    if (targetValue || !isShort) {
      manualTargetUrl = '';
      handleDirectTargetSearch(submittedUrl, addLog, appCreateTab, appTabs, appSwitchTab, setTargetDomain);
      return;
    }

    manualTargetUrl = ''; setTargetDomain(''); lastAnalyzedUrl = '';
    const activeTabId = appGetActiveTabId ? appGetActiveTabId() : null;
    const activeTab = appTabs.find(t => t.id === activeTabId);
    if (activeTab?.webview) activeTab.webview.loadURL(submittedUrl);
    else if (typeof appCreateTab === 'function') appCreateTab(submittedUrl, 'Link rút gọn', true);
    if (addLog) addLog(`Đang mở link rút gọn: ${submittedUrl}`, 'action');
  };

  startLinkButton?.addEventListener('click', startLinkFlow);
  [shortlinkInput, targetWebsiteInput].forEach(inp => {
    inp?.addEventListener('keydown', e => { if (e.key === 'Enter') startLinkFlow(); });
  });

  document.getElementById('btn-step2')?.addEventListener('click', async () => {
    try {
      await executeOnActiveTab(() => {
        document.querySelectorAll('button, a, div[role="button"], input[type="button"]').forEach(b => {
          const t = (b.innerText || b.value || '').toLowerCase();
          if (t.includes('bước 2') || t.includes('tiếp tục') || t.includes('step 2')) b.click();
        });
      });
    } catch (_) {}
  });

  document.getElementById('btn-ai-scan-now')?.addEventListener('click', async () => {
    const curId = appGetActiveTabId ? appGetActiveTabId() : null;
    const curTab = appTabs.find(t => t.id === curId);
    const wv = curTab?.webview || (appTabs.length > 0 ? appTabs[0].webview : null);
    await handleAIScanNow(wv, addLog, appCreateTab, executeOnActiveTab, copyCodeToClipboard, appTabs, appSwitchTab, setTargetDomain, manualTargetUrl);
  });

  document.getElementById('btn-open-screenshots')?.addEventListener('click', () => openScreenshotsFolder(addLog));
  document.getElementById('btn-upload-online')?.addEventListener('click', async () => {
    const curId = appGetActiveTabId ? appGetActiveTabId() : null;
    const curTab = appTabs.find(t => t.id === curId);
    await handleUploadScreenshotOnline(curTab?.webview, addLog);
  });
  document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const val = document.getElementById('code-result-val')?.textContent.trim();
    if (val && val !== 'Chờ lấy mã...') copyCodeToClipboard(val, addLog);
  });

  const toggleBypass = document.getElementById('toggle-bypass'), toggleScroll = document.getElementById('toggle-scroll');
  toggleBypass?.addEventListener('click', () => {
    state.bypass = !state.bypass; toggleBypass.classList.toggle('active', state.bypass);
    const v = toggleBypass.querySelector('.val'); if (v) v.textContent = state.bypass ? 'BẬT' : 'TẮT';
    appTabs.forEach(t => syncConfigToWebview(t.webview));
    if (addLog) addLog(`Bypass: ${state.bypass ? 'BẬT' : 'TẮT'}`, 'info');
  });
  toggleScroll?.addEventListener('click', () => {
    state.scroll = !state.scroll; toggleScroll.classList.toggle('active', state.scroll);
    const v = toggleScroll.querySelector('.val'); if (v) v.textContent = state.scroll ? 'BẬT' : 'TẮT';
    appTabs.forEach(t => syncConfigToWebview(t.webview));
    if (addLog) addLog(`Tự động Scroll: ${state.scroll ? 'BẬT' : 'TẮT'}`, 'info');
  });
}

module.exports = {
  state,
  syncConfigToWebview,
  copyCodeToClipboard,
  handleVuotLinkGuestEvent,
  checkAndAutoRunAI,
  initVuotLinkControls
};
