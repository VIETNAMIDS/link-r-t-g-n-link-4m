// guest-preload.js - Con trỏ ảo sống động, Click OS-Level, Lướt mượt & Lấy mã (< 300 dòng)
(function() {
  if (window.__AUTO_GET_CODE_INITIALIZED__) return;
  window.__AUTO_GET_CODE_INITIALIZED__ = true;
  const _realLog = (window.console && typeof window.console.log === 'function') ? window.console.log.bind(window.console) : () => {};
  function sendHost(type, payload = {}) { try { _realLog('__AUTO_GET_CODE__:' + JSON.stringify({ type, ...payload, time: new Date().toLocaleTimeString() })); } catch (_) {} }
  try { Object.defineProperty(window.console, 'log', { configurable: true, enumerable: true, get: () => _realLog, set: () => {} }); } catch (_) {}

  // 1. Giả lập Chrome Desktop x64 thật 100%, vô hiệu hóa ontouchstart để widget traffic dùng click chuẩn
  try {
    try { delete Object.getPrototypeOf(navigator).webdriver; } catch (_) {}
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true, enumerable: true });
    window.chrome = window.chrome || { app: { isInstalled: false }, runtime: { connect: () => {}, sendMessage: () => {}, id: undefined } };
    const plugArr = Object.assign(Object.create(PluginArray.prototype), { length: 5, item: (i) => plugArr[i] || null, namedItem: (n) => plugArr[n] || null });
    ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'].forEach((n, i) => { plugArr[i] = plugArr[n] = Object.assign(Object.create(Plugin.prototype), { name: n, filename: 'internal-pdf-viewer', length: 1 }); });
    Object.defineProperty(navigator, 'plugins', { get: () => plugArr, configurable: true });
    [['languages', ['vi-VN', 'vi', 'en-US', 'en']], ['language', 'vi-VN'], ['hardwareConcurrency', 8], ['deviceMemory', 8], ['platform', 'Win32'], ['vendor', 'Google Inc.'], ['maxTouchPoints', 0]].forEach(([k, v]) => Object.defineProperty(navigator, k, { get: () => v, configurable: true }));
    delete window.process; delete window.Buffer; delete window.setImmediate; delete window.global;
    try { delete window.ontouchstart; delete document.ontouchstart; if (document.documentElement) delete document.documentElement.ontouchstart; } catch (_) {}
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.hasFocus = () => true;
    ['blur', 'focusout', 'visibilitychange'].forEach(e => window.addEventListener(e, ev => ev.stopImmediatePropagation(), true));
  } catch (_) {}

  // 2. Con trỏ chuột ảo sắc nét hiển thị trực tiếp trên màn hình & hiệu ứng click thật
  let cursorEl = null, rippleEl = null, curCursorX = 140, curCursorY = 220;
  function ensureVisualCursor() {
    const parent = document.body || document.documentElement;
    if (cursorEl || !parent) return;
    cursorEl = document.createElement('div'); cursorEl.id = '__visual_cursor__';
    cursorEl.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="filter:drop-shadow(2px 3px 4px rgba(0,0,0,0.65))"><path d="M4 3l14 10-7 1.5-4 6.5L4 3z" fill="#ff2222" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`;
    cursorEl.setAttribute('style', `position:fixed;top:0;left:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1);transform:translate3d(${curCursorX}px,${curCursorY}px,0);will-change:transform;`);
    rippleEl = document.createElement('div'); rippleEl.id = '__visual_ripple__';
    rippleEl.setAttribute('style', 'position:fixed;width:42px;height:42px;border-radius:50%;border:3px solid #ff2222;background:rgba(255,34,34,0.3);z-index:2147483646;pointer-events:none;opacity:0;transform:translate(-50%,-50%) scale(0.2);transition:all 0.45s ease-out;');
    parent.appendChild(cursorEl); parent.appendChild(rippleEl);
  }
  function moveCursor(x, y) { ensureVisualCursor(); curCursorX = x; curCursorY = y; if (cursorEl) cursorEl.style.transform = `translate3d(${x - 4}px, ${y - 3}px, 0)`; }
  function moveAndClickCursor(x, y) {
    ensureVisualCursor(); moveCursor(x, y);
    setTimeout(() => {
      if (!rippleEl) return;
      rippleEl.style.transition = 'none'; rippleEl.style.left = `${x}px`; rippleEl.style.top = `${y}px`;
      rippleEl.style.transform = 'translate(-50%, -50%) scale(0.2)'; rippleEl.style.opacity = '1';
      setTimeout(() => { rippleEl.style.transition = 'all 0.45s ease-out'; rippleEl.style.transform = 'translate(-50%, -50%) scale(1.9)'; rippleEl.style.opacity = '0'; }, 30);
    }, 380);
  }

  // 3. Hook Clipboard bắt mã
  try {
    if (navigator.clipboard?.writeText) {
      const orig = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (txt) => {
        const c = (txt || '').trim();
        if (c.length >= 4 && c.length <= 32 && !c.includes('http') && !c.includes(' ') && !/^\d{5,6}$/.test(c)) {
          foundCode = c; sendHost('code_detected', { code: c, source: 'clipboard' });
        }
        return orig(txt);
      };
    }
  } catch (_) {}

  let foundCode = null, lastCountdown = null, isCounting = false, lastClickTime = 0, latestCountdownSec = null;
  let isHumanBusy = false, lastHumanActionTime = 0, googleClicked = false, hasClickedOtherArticle = false, lastScrollLog = 0;
  const ALL_KWS = ['lấy mã', 'lay ma', 'l4m', 'link4m', 'layma4u', 'lấy code', 'lay code', 'lấy mã ngay', 'bấm vào đây để lấy mã', 'click lấy mã', 'nhấp vào đây để lấy mã', 'get code', 'get token', 'traffic120s', 'traffic123', 'traffic-user', 'tìm mã', 'bấm lấy mã', 'bước 2', 'buoc 2', 'step 2', 'tiếp tục', 'tiep tuc', 'click here to continue', '(2/2)', '2/2', 'trang tiếp', 'get link', 'continue', 'xác nhận lấy mã'];
  const OTHER_LINK_REQ_REGEX = /(?:click|nhấp|bấm)\s*(?:vào)?\s*(?:[^\.\n]{0,25})?(?:link|bài\s*viết|liên\s*kết|trang)\s*(?:bất\s*kỳ|khác).*?(?:lấy\s*mã|lấy\s*code|tiếp\s*tục|mã)/i;

  function isShortlinkPage() {
    const u = (window.location.href || '').toLowerCase();
    return u.includes('/go/') || u.includes('/link/') || u.includes('link4m') || u.includes('vuotlink') || u.includes('traffic120') || u.includes('layma.') || u.includes('yeumoney') || u.includes('link1s');
  }
  function getAllDocs() {
    const docs = [document]; document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) docs.push(f.contentDocument); } catch (_) {} }); return docs;
  }
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = window.getComputedStyle(el);
    return r.width >= 5 && r.height >= 5 && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05;
  }
  function humanScrollStep(distance, durationMs = 280) {
    return new Promise(resolve => {
      const startY = window.scrollY || window.pageYOffset, startTime = performance.now();
      function step(now) {
        const p = Math.min((now - startTime) / durationMs, 1);
        window.scrollTo(0, startY + distance * (0.5 - Math.cos(p * Math.PI) / 2));
        if (p < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // Click chuột thật cấp OS kèm con trỏ ảo & kích hoạt toàn bộ sự kiện Mouse/Touch/Pointer
  async function triggerClick(targetEl, label = 'Nút') {
    if (!targetEl) return false;
    const now = Date.now();
    if (now - lastClickTime < 2400) return false;
    lastClickTime = now; isHumanBusy = true;
    try {
      try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      await new Promise(r => setTimeout(r, 220));
      const r = targetEl.getBoundingClientRect(), x = Math.max(10, Math.min(window.innerWidth - 10, Math.round(r.left + r.width / 2))), y = Math.max(10, Math.min(window.innerHeight - 10, Math.round(r.top + r.height / 2)));
      moveAndClickCursor(x, y); sendHost('request_real_click', { x, y, label });
      await new Promise(r => setTimeout(r, 380));
      ['pointerdown', 'pointerup', 'mouseenter', 'mousedown', 'mouseup', 'click'].forEach(e => {
        try { targetEl.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })); } catch (_) {}
      });
      try {
        const touch = new Touch({ identifier: Date.now(), target: targetEl, clientX: x, clientY: y, screenX: x, screenY: y, pageX: x + window.scrollX, pageY: y + window.scrollY });
        targetEl.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [touch], bubbles: true, cancelable: true, view: window }));
      } catch (_) {}
      if (typeof targetEl.click === 'function') targetEl.click();
      targetEl.querySelectorAll('button, a, img, input, span').forEach(sub => { try { sub.click(); } catch (_) {} });
      sendHost('btn_clicked', { text: label, x, y }); return true;
    } catch (e) {
      sendHost('btn_click_failed', { text: label, error: e.message }); return false;
    } finally { setTimeout(() => { isHumanBusy = false; }, 800); }
  }

  // Nhận diện phần tử Nút Lấy Mã trên trang đích
  function findTargetElement() {
    for (const doc of getAllDocs()) {
      const selList = ['#traffic-button-no', '[class*="traffic-button"]', '[id*="traffic-button"]', '#traffic_code', '#layma', '[id*="layma"]', '.btn-traffic', '[id*="getcode"]', '[id*="get-code"]', '[id*="l4m"]', '[class*="l4m"]', '[id*="traffic"]', '[class*="traffic"]', '[id*="lay-ma"]', '[class*="lay-ma"]', '#sys-action-box button', '[id*="action-box"] button'];
      for (const sel of selList) {
        for (const el of doc.querySelectorAll(sel)) {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (isVisible(el) && !OTHER_LINK_REQ_REGEX.test(txt)) return el;
        }
      }
      for (const img of doc.querySelectorAll('img[src*="icon-x64"], img[src*="traffic"], img[src*="l4m"], img[src*="layma"]')) {
        const pBtn = img.closest('button, a, div[role="button"], [onclick], div');
        if (pBtn && isVisible(pBtn)) return pBtn;
      }
      for (const el of doc.querySelectorAll('button, a, input, div, span, p, b, strong, center, label, [class*="btn"], [class*="button"], [id*="btn"], [id*="button"], [onclick], [role="button"]')) {
        if (!isVisible(el) || el.closest('header, .site-header, .navbar-top, .breadcrumb')) continue;
        const txt = (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (OTHER_LINK_REQ_REGEX.test(txt)) continue;
        if (txt.length < 50 && ALL_KWS.some(kw => txt.includes(kw))) return el.closest('button, a, [onclick], [role="button"]') || el;
      }
    }
    return null;
  }

  function scanAndClickButton() {
    if (isHumanBusy || isCounting || isShortlinkPage()) return false;
    const tgt = findTargetElement();
    if (tgt) {
      const r = tgt.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) {
        triggerClick(tgt, (tgt.innerText || tgt.value || tgt.id || 'Nút lấy mã').trim().slice(0, 40)); return true;
      }
    }
    return false;
  }

  function scanAndClickStep2Button() {
    for (const doc of getAllDocs()) {
      for (const el of doc.querySelectorAll('button, a, input, div, span, [class*="btn"], #traffic-button-no, [class*="traffic-button"]')) {
        if (!isVisible(el)) continue;
        const txt = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
        if (ALL_KWS.slice(18).some(kw => txt.includes(kw)) || txt.includes('lấy mã') || txt.includes('lay ma')) {
          sendHost('step2_btn_clicked', { text: (el.innerText || el.value || 'Bước 2').trim().slice(0, 40) });
          triggerClick(el, 'Bước 2 lấy mã'); return true;
        }
      }
    }
    return false;
  }

  function scanCountdown() {
    let currentSec = null, displayText = '';
    for (const doc of getAllDocs()) {
      if (currentSec !== null) break;
      for (const el of doc.querySelectorAll('#traffic-button-no, [class*="traffic-button"], [id*="traffic"], button, a, [class*="btn"], #countdown, .countdown, #timer, .timer, #time, #giay, .second, [id*="time"]')) {
        const txt = (el.innerText || el.textContent || el.value || '').trim();
        const sm = txt.match(/(?:lấy\s*mã\s*sau|sau|chờ|đợi|wait)\s*[:：]?\s*(\d{1,3})\s*(?:s|giây)?/i) || txt.match(/\b(\d{1,3})\s*(?:s|giây)\b/i);
        if (sm && parseInt(sm[1], 10) <= 300) { currentSec = parseInt(sm[1], 10); displayText = currentSec + 's'; break; }
      }
      if (currentSec !== null) break;
      const bTxt = (doc.body ? doc.body.innerText : '').replace(/\s+/g, ' ');
      const m = bTxt.match(/(?:lấy\s*mã\s*sau|vui\s*lòng\s*chờ|chờ|đợi|wait|sau)\s*[:：]?\s*(\d{1,3})\s*(?:s|giây)?(?:\s*\(([\d\/]+)\))?/i) || bTxt.match(/(\d{1,3})\s*(?:s|giây)\s*(?:nữa|\.\.\.)/i);
      if (m && parseInt(m[1], 10) <= 300) { currentSec = parseInt(m[1], 10); displayText = m[2] ? currentSec + 's (' + m[2] + ')' : currentSec + 's'; break; }
    }
    if (currentSec !== null) {
      latestCountdownSec = currentSec; isCounting = currentSec > 0;
      if (currentSec === 0 && lastCountdown > 0) {
        sendHost('countdown', { seconds: 0, text: 'Hết giờ! Đang bấm lấy mã...' });
        setTimeout(() => { scanAndClickStep2Button(); scanForCode(); }, 350);
      }
      if (currentSec !== lastCountdown) { lastCountdown = currentSec; sendHost('countdown', { seconds: currentSec, text: displayText || (currentSec + 's') }); }
      return currentSec;
    }
    isCounting = false; return null;
  }

  // Chỉ khi trang web YÊU CẦU "Vui lòng click vào link bất kỳ để lấy MÃ" mới bấm sang bài viết khác
  async function checkClickOtherArticleRequired() {
    if (hasClickedOtherArticle || isHumanBusy || foundCode || isShortlinkPage() || isCounting) return false;
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('google.') || host.includes('bing.')) return false;
    const bTxt = (document.body ? document.body.innerText : '').toLowerCase();
    if (!OTHER_LINK_REQ_REGEX.test(bTxt)) return false;
    const tgt = findTargetElement();
    if (tgt && isVisible(tgt)) return false;

    const curPath = window.location.pathname.replace(/\/$/, '') || '/';
    const allLinks = Array.from(document.querySelectorAll('a[href]')), candidates = [];
    for (const a of allLinks) {
      try {
        const h = (a.getAttribute('href') || a.href || '').trim();
        if (!h || h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('tel:')) continue;
        const u = new URL(a.href, window.location.origin), p = u.pathname.replace(/\/$/, '') || '/';
        if (u.hostname !== window.location.hostname || p === curPath || p === '/' || !isVisible(a) || /\.(png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(p)) continue;
        const txt = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt.length >= 3 && !/đăng nhập|đăng ký|login|register/i.test(txt)) candidates.push({ el: a, txt, href: a.href });
      } catch (_) {}
    }
    if (candidates.length > 0) {
      hasClickedOtherArticle = true;
      const chosen = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
      sendHost('other_article_clicked', { text: chosen.txt.slice(0, 40), url: chosen.href });
      await triggerClick(chosen.el, 'Link: ' + chosen.txt.slice(0, 30));
      setTimeout(() => { try { if (window.location.pathname.replace(/\/$/, '') === curPath) window.location.href = chosen.href; } catch (_) {} }, 900);
      return true;
    }
    return false;
  }

  // Bắt mã trên Website đích
  function scanForCode() {
    const host = (window.location.hostname || '').toLowerCase();
    if (foundCode || host.includes('google.') || host.includes('bing.') || isShortlinkPage()) return foundCode;
    for (const doc of getAllDocs()) {
      for (const el of doc.querySelectorAll('#traffic-button-no, [class*="traffic-button"], [id*="traffic"], [id*="action-box"], .code, #code, [id*="code"], div, p, span, b, strong')) {
        const txt = (el.innerText || el.textContent || '').trim();
        const m = txt.match(/(?:mã|code|mã\s*km|token)\s*[:：]\s*([a-zA-Z0-9_\-]{4,30})/i) || txt.match(/\b([a-zA-Z0-9]{6,16})\b/);
        if (m && !/đăng|nhập|ký|login|traffic|google|youtube|click|lấy|bấm/i.test(m[1])) {
          foundCode = m[1]; sendHost('code_detected', { code: foundCode, text: txt.slice(0, 50) }); return foundCode;
        }
      }
    }
    return null;
  }

  // Tự động lướt xuống cuối trang đích tìm nút mã (Bước 5)
  async function handleAutoScroll() {
    if (isHumanBusy || isShortlinkPage()) return;
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('google.') || host.includes('bing.')) return;
    const now = Date.now();
    ensureVisualCursor();
    const cx = Math.round(window.innerWidth / 2 + Math.sin(now / 450) * 45), cy = Math.round(Math.min(window.innerHeight - 80, 260 + Math.cos(now / 550) * 25));
    moveCursor(cx, cy);

    if (isCounting) {
      if (now - lastHumanActionTime < 2200) return;
      lastHumanActionTime = now;
      const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight, curY = window.scrollY || window.pageYOffset;
      if (curY >= maxScroll - 120) await humanScrollStep(-140, 380);
      else await humanScrollStep(120, 380);
      return;
    }

    const targetEl = findTargetElement();
    if (targetEl && isVisible(targetEl)) {
      const r = targetEl.getBoundingClientRect(), inView = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      if (inView) { await triggerClick(targetEl, (targetEl.innerText || targetEl.value || targetEl.id || 'Nút lấy mã').trim().slice(0, 40)); return; }
      try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      return;
    }

    if (await checkClickOtherArticleRequired()) return;

    if (now - lastScrollLog > 4500) { lastScrollLog = now; sendHost('scrolling_down'); }
    if (now - lastHumanActionTime < 380) return;
    lastHumanActionTime = now;
    const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight, curY = window.scrollY || window.pageYOffset;
    if (curY < maxScroll - 30) await humanScrollStep(Math.round(320 + Math.random() * 140), 300);
  }

  function checkGoogleTarget() {
    if (googleClicked || !location.hostname.includes('google.') || !location.href.includes('/search')) return;
    const tgt = (window.__TARGET_DOMAIN__ || '').toLowerCase().replace(/^https?:\/\/|\/.*$|\*/g, '').trim();
    if (!tgt || tgt.length < 3) return;
    const cands = [];
    document.querySelectorAll('#rso a[jsname="UWckNb"], #rso .g a[href], #rso a[href], div.g a[href], #search a[href]').forEach(a => {
      let h = (a.getAttribute('href') || a.href || '').trim();
      if (!h.startsWith('http') || h.includes('google.') || h.includes('youtube.') || a.closest('.uEierd')) return;
      try {
        const u = new URL(h, window.location.origin);
        if (u.hostname.includes('google.') && (u.pathname === '/goto' || u.pathname === '/url')) {
          const q = u.searchParams.get('q') || u.searchParams.get('url') || '';
          if (q.startsWith('http')) h = q;
        }
      } catch (_) {}
      if (!cands.some(c => c.real === h)) cands.push({ a, real: h });
    });
    const chosen = cands.find(c => c.real.toLowerCase().includes(tgt));
    if (chosen) {
      googleClicked = true; sendHost('google_target_clicked', { target: tgt, url: chosen.real });
      chosen.a.target = '_self';
      ['mouseenter', 'mousedown', 'mouseup', 'click'].forEach(e => { try { chosen.a.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true, view: window })); } catch (_) {} });
      if (typeof chosen.a.click === 'function') chosen.a.click();
      setTimeout(() => { if (location.href.includes('/search')) location.href = chosen.real; }, 400);
    }
  }

  if (document.body) ensureVisualCursor(); else document.addEventListener('DOMContentLoaded', ensureVisualCursor);
  setInterval(() => { ensureVisualCursor(); scanCountdown(); scanAndClickButton(); scanForCode(); handleAutoScroll(); checkGoogleTarget(); }, 250);
  window.addEventListener('message', (e) => {
    if (e.data?.type === '__SET_CONFIG__') {
      window.__AUTO_CONFIG__ = Object.assign(window.__AUTO_CONFIG__ || {}, e.data.config);
      if (e.data.targetDomain) window.__TARGET_DOMAIN__ = e.data.targetDomain;
    }
  });
  sendHost('guest_ready', { url: window.location.href });
})();
