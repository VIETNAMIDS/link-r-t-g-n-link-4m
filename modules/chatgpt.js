// modules/chatgpt.js - Tự động điền lệnh, gửi, đọc câu trả lời & tìm Google từ ChatGPT
function automateChatGPTSession(wv, promptText, onReply, addLog) {
  if (!wv) return;
  if (addLog) addLog('Đang chuẩn bị dán lệnh tự động vào ChatGPT...', 'action');

  let step = 'injecting', attempts = 0, sendAttempts = 0;
  const pollTimer = setInterval(async () => {
    attempts++;
    if (attempts > 80) { clearInterval(pollTimer); return; }

    try {
      if (step === 'injecting') {
        const res = await wv.executeJavaScript(`
          (() => {
            const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label="Đóng"]');
            if (closeBtn) closeBtn.click();

            const area = document.querySelector('#prompt-textarea, div[contenteditable="true"], textarea');
            if (!area) return { ready: false };

            area.focus();
            try {
              document.execCommand('selectAll', false, null);
              document.execCommand('insertText', false, ${JSON.stringify(promptText)});
            } catch (_) {}

            if (area.tagName === 'TEXTAREA' && area.value !== ${JSON.stringify(promptText)}) {
              area.value = ${JSON.stringify(promptText)};
              area.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (area.getAttribute('contenteditable') === 'true' && (!area.innerText || !area.innerText.trim())) {
              area.innerHTML = '<p>' + ${JSON.stringify(promptText)} + '</p>';
              area.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }));
            }
            const hasText = !!(area.innerText?.trim() || area.value?.trim());
            return { ready: hasText };
          })()
        `);

        if (res?.ready) {
          step = 'sending';
          if (addLog) addLog('Đã điền câu lệnh vào ChatGPT! Đang tự động bấm Gửi...', 'info');
        }
      } else if (step === 'sending') {
        sendAttempts++;
        // Thử gửi bằng phím cứng Chromium OS-level Return
        try {
          wv.focus();
          wv.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
          wv.sendInputEvent({ type: 'char', keyCode: 'Return' });
          wv.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
        } catch (_) {}

        // Thử click nút Send và phát sự kiện Pointer/Mouse
        const sendRes = await wv.executeJavaScript(`
          (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"], button[aria-label*="Gửi"]') ||
              btns.find(b => !b.disabled && (b.querySelector('svg path') || b.className.includes('rounded-full')) && !b.getAttribute('aria-label')?.includes('Voice'));

            if (sendBtn && !sendBtn.disabled) {
              ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(e => {
                sendBtn.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true, view: window }));
              });
              if (typeof sendBtn.click === 'function') sendBtn.click();
            }

            const area = document.querySelector('#prompt-textarea, div[contenteditable="true"], textarea');
            if (area) {
              area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }

            const isTyping = document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]') !== null;
            const userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
            const isSent = isTyping || userMsgs.length > 0 || (area && !area.innerText?.trim() && !area.value?.trim());
            return { isSent };
          })()
        `);

        if (sendRes?.isSent || sendAttempts >= 8) {
          step = 'waiting_reply';
          if (addLog) addLog('Đã gửi câu hỏi lên ChatGPT! Đang chờ câu trả lời...', 'action');
        }
      } else if (step === 'waiting_reply') {
        const status = await wv.executeJavaScript(`
          (() => {
            const isTyping = document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]') !== null;
            const msgs = Array.from(document.querySelectorAll('[data-message-author-role="assistant"], .markdown'));
            const last = msgs[msgs.length - 1];
            const text = last ? (last.innerText || '').trim() : '';
            return { isTyping, text, count: msgs.length };
          })()
        `);

        if (status && status.count > 0 && !status.isTyping && status.text.length > 5) {
          clearInterval(pollTimer);
          step = 'done';
          if (addLog) addLog(`[ChatGPT Đã Trả Lời]: ${status.text.slice(0, 100)}...`, 'success');
          if (typeof onReply === 'function') onReply(status.text);
        }
      }
    } catch (_) {}
  }, 700);
}

function handleChatGptReply(reply, addLog, createTab, appTabs, autoClickGoogleResult, domKeyword, domDomain) {
  if (!reply) return;
  let kw = '', dm = '', pg = '';

  const mKw = reply.match(/(?:từ\s*khóa|keyword|bước\s*2|tìm)\s*[:：]?\s*["'“]?([^\n\r"”|]+)/i);
  if (mKw) kw = mKw[1].replace(/gõ tìm từ khóa|tìm từ khóa/gi, '').trim();

  const mDm = reply.match(/(?:website|web|link|trang|bước\s*3)\s*[:：]?\s*([a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,})/i) ||
             reply.match(/\b([a-zA-Z0-9\-\.]+\.(?:com|net|vn|tv|site|org|top|info|live|cc))\b/i);
  if (mDm) dm = (mDm[1] || mDm[0]).trim();

  const mPg = reply.match(/(?:trang|page)\s*(\d+)/i);
  if (mPg) pg = mPg[1];

  const finalKw = kw || domKeyword;
  const finalDm = dm || domDomain;

  if (finalKw) {
    if (addLog) addLog(`[ChatGPT Nhận Diện]: Từ khóa: "${finalKw}" | Web: "${finalDm}"`, 'success');
    let startParam = pg && parseInt(pg, 10) > 1 ? `&start=${(parseInt(pg, 10) - 1) * 10}` : '';
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalKw)}${startParam}`;
    const gTabId = typeof createTab === 'function' ? createTab(searchUrl, `Google: ${finalKw}`, true) : null;
    setTimeout(() => {
      const gTab = Array.isArray(appTabs) ? appTabs.find(t => t.id === gTabId) : null;
      if (gTab && gTab.webview && typeof autoClickGoogleResult === 'function') {
        autoClickGoogleResult(gTab.webview, [finalDm, domDomain], addLog);
      }
    }, 800);
  }
}

module.exports = { automateChatGPTSession, handleChatGptReply };
