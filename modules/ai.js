// modules/ai.js - Tự Động Định Vị Bước 2 & 3, Tìm Kiếm Google & 9Router AI (< 300 dòng)
const fs = require('fs');
const path = require('path');
const { call9RouterVision, parseRouterReply } = require('./router9');
const { SCREENSHOTS_DIR, openScreenshotsFolder, safeCapturePage, handleUploadScreenshotOnline } = require('./capture');
const { notifyTelegramStep } = require('./telegram');

let isScanning = false;
const IGNORED_DOMAINS = ['link4m', 'traffic120', 'yeumoney', 'link1s', 'layma', 'megaurl', 'google', 'cloudflare', 'recaptcha', 'facebook', 'youtube', 'zefoy'];

function isIgnoredDomain(d) {
  if (!d) return true;
  const s = d.toLowerCase();
  return IGNORED_DOMAINS.some(ig => s.includes(ig));
}

function autoClickGoogleResult(googleWv, domains, addLog, preferFirst = false, origKeyword = '', targetDomainStr = '') {
  if (!googleWv) return;
  const list = (Array.isArray(domains) ? domains : [domains])
    .filter(Boolean)
    .map(d => d.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\*+/g, '').trim())
    .filter(d => d.length >= 3 && !isIgnoredDomain(d));

  const kws = new Set();
  list.forEach(t => {
    kws.add(t);
    t.split(/[\.\-_]/).forEach(p => { if (p.length >= 3 && !/^(com|net|org|vn|tv|site|in)$/i.test(p)) kws.add(p); });
  });
  const kwArr = Array.from(kws).filter(k => k && k.length >= 3);
  const cleanDomain = (targetDomainStr || list[0] || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/\*+/g, '').trim();

  let attempts = 0, clicked = false, refined1 = false, refined2 = false;
  const timer = setInterval(async () => {
    attempts++;
    if (attempts > 75 || clicked) { clearInterval(timer); return; }
    try {
      if (!googleWv || typeof googleWv.executeJavaScript !== 'function') { clearInterval(timer); return; }
      if (typeof googleWv.isLoading === 'function' && googleWv.isLoading()) return;

      if (attempts === 6 && !refined1 && origKeyword && cleanDomain) {
        refined1 = true; attempts = 0;
        const q2 = `${origKeyword} ${cleanDomain}`;
        if (addLog) addLog(`[Bước 4 - Google]: Trang 1 lệch vùng miền, đang tinh chỉnh: "${q2}"...`, 'action');
        googleWv.loadURL(`https://www.google.com/search?q=${encodeURIComponent(q2)}`);
        return;
      }
      if (attempts === 10 && !refined2 && cleanDomain) {
        refined2 = true; attempts = 0;
        if (addLog) addLog(`[Bước 4 - Google]: Tìm thẳng tên miền trên Google: "${cleanDomain}"...`, 'action');
        googleWv.loadURL(`https://www.google.com/search?q=${encodeURIComponent(cleanDomain)}`);
        return;
      }

      const res = await googleWv.executeJavaScript(`
        (() => {
          try {
            if (!window.location.href.includes('/search')) return { ok: false };
            const arr = ${JSON.stringify(kwArr)};
            const sel = ['#rso a[jsname="UWckNb"]', '#rso .g a[href]', '#rso a[href]', 'div.g a[href]', '#search a[href]'];
            const allLinks = Array.from(document.querySelectorAll(sel.join(', ')));
            const candidates = [], seen = new Set();

            for (const a of allLinks) {
              let h = (a.getAttribute('href') || a.href || '').trim();
              if (!h || h.startsWith('javascript:') || h.startsWith('#')) continue;
              let real = h;
              try {
                const u = new URL(h, window.location.origin);
                if (u.hostname.includes('google.') && (u.pathname === '/goto' || u.pathname === '/url')) {
                  const q = u.searchParams.get('q') || u.searchParams.get('url') || '';
                  if (q.startsWith('http')) real = q;
                }
                if (real.includes('google.') || real.includes('youtube.com')) continue;
              } catch (_) { continue; }
              if (a.closest('.uEierd, [data-text-ad]')) continue;
              if (seen.has(real)) continue;
              seen.add(real);
              candidates.push({ a, real });
            }
            if (candidates.length === 0) return { ok: false };

            let chosen = null;
            if (arr && arr.length > 0) {
              for (const cand of candidates) {
                const u = cand.real.toLowerCase();
                if (arr.some(k => u.includes(k))) { chosen = cand; break; }
              }
            }
            if (!chosen && arr.length === 0 && candidates.length > 0) chosen = candidates[0];

            if (chosen) {
              const { a, real } = chosen;
              a.target = '_self';
              const r = a.getBoundingClientRect();
              const x = Math.max(10, Math.round(r.left + r.width / 2));
              const y = Math.max(10, Math.round(r.top + r.height / 2));
              ['mouseenter', 'mousedown', 'mouseup', 'click'].forEach(e => {
                try { a.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })); } catch (_) {}
              });
              if (typeof a.click === 'function') try { a.click(); } catch (_) {}
              setTimeout(() => { if (window.location.href.includes('/search')) window.location.href = real; }, 60);
              return { ok: true, url: real, x, y };
            }
            return { ok: false };
          } catch (_) { return { ok: false }; }
        })()
      `).catch(() => null);

      if (res?.ok) {
        clicked = true; clearInterval(timer);
        if (addLog) addLog(`[Bước 4 - Bấm link tên miền]: Đã nhấp vào web đích: ${res.url}`, 'success');
        notifyTelegramStep(`📸 <b>[Bước 4/6] Đã vào website đích:</b>\n🌐 <code>${res.url}</code>`);

        try {
          if (res.x && res.y) {
            googleWv.sendInputEvent({ type: 'mouseMove', x: res.x, y: res.y });
            setTimeout(() => {
              googleWv.sendInputEvent({ type: 'mouseDown', x: res.x, y: res.y, button: 'left', clickCount: 1 });
              setTimeout(() => { googleWv.sendInputEvent({ type: 'mouseUp', x: res.x, y: res.y, button: 'left', clickCount: 1 }); }, 50);
            }, 60);
          }
        } catch (_) {}

        setTimeout(() => {
          try {
            const curU = (googleWv.getURL ? googleWv.getURL() : '').toLowerCase();
            if (curU.includes('google.') && res.url) {
              googleWv.loadURL(res.url, { httpReferrer: 'https://www.google.com/' });
            }
          } catch (_) {}
        }, 350);
      }
    } catch (_) {}
  }, 250);
}

function handleDirectTargetSearch(targetUrl, addLog, createTab, appTabs, appSwitchTab, setTargetDomain) {
  if (typeof createTab !== 'function') return;
  try {
    const targetObj = new URL(targetUrl);
    const cleanDomain = targetObj.hostname.replace(/^www\.|^m\./i, '');
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanDomain)}`;
    if (addLog) addLog(`[Google Search]: Đang tìm "${cleanDomain}" trên Google...`, 'action');
    notifyTelegramStep(`🔎 <b>[Google Search]</b> Tìm kiếm <code>${cleanDomain}</code> trên Google...`);
    if (typeof setTargetDomain === 'function') setTargetDomain(cleanDomain);
    const newTabId = createTab(searchUrl, `Google: ${cleanDomain}`, true);
    if (newTabId && typeof appSwitchTab === 'function') setTimeout(() => appSwitchTab(newTabId), 150);
    setTimeout(() => {
      const gTab = Array.isArray(appTabs) ? appTabs.find(t => t.id === newTabId) : null;
      if (gTab && gTab.webview) {
        autoClickGoogleResult(gTab.webview, [cleanDomain, targetUrl], addLog, true, cleanDomain, cleanDomain);
        setTimeout(() => {
          try {
            const curU = (gTab.webview.getURL ? gTab.webview.getURL() : '').toLowerCase();
            if (curU.includes('google.') && targetUrl) {
              gTab.webview.loadURL(targetUrl, { httpReferrer: 'https://www.google.com/' });
            }
          } catch (_) {}
        }, 4000);
      }
    }, 1000);
  } catch (e) {
    if (addLog) addLog(`Lỗi xử lý link: ${e.message}`, 'error');
  }
}

async function handleAIScanNow(webview, addLog, createTab, executeOnActiveTab, copyCodeFn, appTabs, appSwitchTab, setTargetDomain, manualTargetUrl = '') {
  if (!webview || isScanning) return;
  isScanning = true;
  if (addLog) addLog('[Bước 2 - Cuộn & Cap]: Đang cuộn xuống phần Bước 3...', 'action');

  try {
    try {
      await webview.executeJavaScript(`
        (() => {
          try {
            const allEls = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, li, strong, b, div, section'));
            const step2 = allEls.find(el => /(?:bước|buoc|step)\\s*2\\b/i.test((el.innerText || '').trim()));
            const step3 = allEls.find(el => /(?:bước|buoc|step)\\s*3\\b/i.test((el.innerText || '').trim()));
            const targetEl = step2 || step3;
            let dest = 680;
            if (targetEl) {
              const cur = window.scrollY || 0;
              dest = Math.max(0, cur + targetEl.getBoundingClientRect().top - 40);
            }
            window.scrollTo({ top: dest, behavior: 'smooth' });
            return { ok: true, top: dest };
          } catch (e) { window.scrollBy(0, 150); return { ok: true }; }
        })()
      `).catch(() => null);
      await new Promise(r => setTimeout(r, 1200));
    } catch (_) {}

    let domKeyword = '', domDomain = '';
    try {
      const domData = await webview.executeJavaScript(`
        (() => {
          try {
            const curHost = window.location.hostname.toLowerCase();
            const b = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ');
            const mKw = b.match(/(?:bước|buoc)\\s*2[^\\w]*?(?:gõ|tìm|từ\\s*khóa|copy)?\\s*[:：]?\\s*["'“]?([^"'”\\n\\r\\.]{3,50}?)(?=(?:bước|buoc)\\s*3|\\.|$)/i);
            const mDm = b.match(/(?:bước|buoc)\\s*3[^\\w]*?(?:bấm|nhấp|vào)?\\s*(?:website|trang\\s*web|web)?\\s*[:：]?\\s*([a-zA-Z0-9\\-\\.\\*]+\\.[a-zA-Z]{2,})/i);
            const rawKw = mKw ? mKw[1].replace(/gõ tìm từ khóa|tìm từ khóa/gi, '').trim() : '';
            let rawDm = mDm ? mDm[1].replace(/\\*+/g, '').trim() : '';
            if (rawDm && rawDm.toLowerCase().includes(curHost)) rawDm = '';
            // Nếu từ khóa Bước 2 là một domain (ví dụ m.aamanufacturing.in) thì đó chính là domain đích thật
            if (!rawDm && rawKw && /^[a-zA-Z0-9\\-\\.]+\\.[a-zA-Z]{2,}$/.test(rawKw) && !rawKw.toLowerCase().includes(curHost)) {
              rawDm = rawKw;
            }
            return { kw: rawKw, dm: rawDm };
          } catch (_) { return { kw: '', dm: '' }; }
        })()
      `).catch(() => null);
      if (domData?.kw && !isIgnoredDomain(domData.kw)) domKeyword = domData.kw;
      if (domData?.dm && !isIgnoredDomain(domData.dm)) domDomain = domData.dm;
    } catch (_) {}

    let nativeImg = await safeCapturePage(webview);
    let targetKeyword = domKeyword, targetDomain = domDomain, targetLink = '';
    if (manualTargetUrl) { targetLink = manualTargetUrl; targetDomain = new URL(manualTargetUrl).hostname; }

    if (nativeImg && !nativeImg.isEmpty()) {
      const pngBuf = nativeImg.toPNG();
      if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
      const d = new Date();
      const savedFile = `screenshot_b3_${d.getHours()}h${d.getMinutes()}m${d.getSeconds()}s.png`;
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, savedFile), pngBuf);
      if (addLog) addLog(`[Bước 2 - Cap màn hình]: Đã chụp ảnh nhiệm vụ (${savedFile})`, 'info');
      notifyTelegramStep(`📸 <b>[Bước 2/6] Đã chụp ảnh nhiệm vụ</b>`, pngBuf);

      if (!manualTargetUrl) {
        try {
          if (addLog) addLog('[Bước 3 - AI Phân tích]: Đang nhờ 9Router AI đọc từ khóa & website...', 'action');
          const base64Uri = 'data:image/png;base64,' + pngBuf.toString('base64');
          const promptVision = `Bạn là chuyên gia phân tích nhiệm vụ vượt link. Hãy trích xuất:
1. "keyword": Từ khóa cần tìm kiếm trên Google ở Bước 2.
2. "domain": Tên miền website đích ở Bước 3.
QUAN TRỌNG: Dưới dòng Bước 3 luôn có HÌNH ẢNH MINH HỌA KẾT QUẢ GOOGLE. Hãy đọc tên miền đầy đủ từ trong hình ảnh minh họa đó (ví dụ: taksimbet216.com, aamanufacturing.in, tylenhacai100.tv). Tuyệt đối không lấy tên miền trang rút gọn link4m!
Trả về duy nhất JSON thuần: {"keyword": "...", "domain": "..."}`;
          const routerReply = await call9RouterVision(base64Uri, promptVision);
          if (routerReply) {
            const parsed = parseRouterReply(routerReply, domDomain);
            if (parsed.keyword && !isIgnoredDomain(parsed.keyword)) targetKeyword = parsed.keyword;
            if (parsed.domain && !isIgnoredDomain(parsed.domain)) targetDomain = parsed.domain;
            if (parsed.url && !isIgnoredDomain(parsed.url)) targetLink = parsed.url;
            if (addLog) addLog(`[Bước 3 - AI]: Từ khóa: "${targetKeyword || '(không)'}" | Web: "${targetDomain}"`, 'success');
          }
        } catch (rErr) { if (addLog) addLog(`9Router: ${rErr.message}`, 'warn'); }
      }
    }

    if (!targetDomain && domDomain && !isIgnoredDomain(domDomain)) {
      targetLink = domDomain.startsWith('http') ? domDomain : `https://${domDomain}`;
      targetDomain = domDomain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    }

    // Nếu từ khóa Bước 2 có dạng tên miền (như m.aamanufacturing.in) thì gán sang targetDomain nếu targetDomain rỗng
    if (!targetDomain && targetKeyword && /^[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$/.test(targetKeyword) && !isIgnoredDomain(targetKeyword)) {
      targetDomain = targetKeyword;
    }

    if (targetKeyword || targetDomain || targetLink) {
      const cleanDomain = (targetDomain || targetLink || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/\*+/g, '').trim();
      const searchQuery = (cleanDomain && !isIgnoredDomain(cleanDomain)) ? cleanDomain : targetKeyword;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      if (addLog) addLog(`[Bước 4 - Google Search]: Nhập "${searchQuery}" trên Google...`, 'action');
      notifyTelegramStep(`🔎 <b>[Bước 3/6] Nhận diện nhiệm vụ:</b>\n🔑 Từ khóa Google: <code>${searchQuery}</code>\n🌐 Website đích: <code>${cleanDomain}</code>\n<i>Đang mở Google tìm kiếm trên màn hình...</i>`);
      if (typeof setTargetDomain === 'function') setTargetDomain(cleanDomain);

      const newTabId = (typeof createTab === 'function') ? createTab(searchUrl, `Google: ${searchQuery}`, true) : null;
      if (newTabId && typeof appSwitchTab === 'function') setTimeout(() => appSwitchTab(newTabId), 150);
      setTimeout(() => {
        const gTab = Array.isArray(appTabs) ? appTabs.find(t => t.id === newTabId) : null;
        const gWv = gTab ? gTab.webview : webview;
        if (gWv) autoClickGoogleResult(gWv, [cleanDomain, targetLink], addLog, !targetKeyword, targetKeyword, cleanDomain);
      }, 200);
    } else {
      if (addLog) addLog('Chưa phát hiện được link website đích trên trang.', 'warn');
    }
  } finally {
    setTimeout(() => { isScanning = false; }, 4000);
  }
}

module.exports = {
  openScreenshotsFolder,
  handleUploadScreenshotOnline,
  autoClickGoogleResult,
  handleDirectTargetSearch,
  handleAIScanNow
};
