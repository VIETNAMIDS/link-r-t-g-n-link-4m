// modules/telegram.js - Liên kết Telegram Bot vào Desktop App (< 300 dòng)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let currentChatId = process.env.TELEGRAM_DEFAULT_CHAT_ID || '';
let lastUpdateId = 0, isPolling = false;
let pendingBypass = { url: '', awaitingDomain: false };
let appCallbacks = { onBypass: null, addLog: null };

async function tgCall(method, body = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error(`[Telegram ${method} error]:`, e.message);
    return null;
  }
}

async function sendTelegramMessage(text, extra = {}) {
  if (!currentChatId) return null;
  return tgCall('sendMessage', {
    chat_id: currentChatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra
  });
}

async function sendTelegramPhoto(photoBuffer, caption = '') {
  if (!currentChatId || !photoBuffer) return null;
  try {
    const fd = new FormData();
    fd.append('chat_id', String(currentChatId));
    fd.append('photo', new Blob([photoBuffer], { type: 'image/png' }), 'screenshot.png');
    if (caption) fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd });
    return await res.json();
  } catch (e) {
    console.error('[Telegram sendPhoto error]:', e.message);
    return null;
  }
}

async function handleUpdate(up) {
  const cb = up.callback_query;
  if (cb) {
    const cid = cb.message?.chat?.id;
    if (cid) currentChatId = String(cid);
    const data = cb.data || '';
    if (data === 'tg_bypass_auto') {
      await tgCall('answerCallbackQuery', { callback_query_id: cb.id, text: 'Đang mở tab trên app...' });
      if (pendingBypass.url && appCallbacks.onBypass) appCallbacks.onBypass(pendingBypass.url, '');
    } else if (data === 'tg_bypass_web') {
      pendingBypass.awaitingDomain = true;
      await tgCall('answerCallbackQuery', { callback_query_id: cb.id });
      await sendTelegramMessage(`🌐 <b>CHẾ ĐỘ WEBSITE</b>\n\nLink: <code>${pendingBypass.url}</code>\n\n👉 <i>Vui lòng nhập tên miền website đích (ví dụ: tylekeovn.com):</i>`);
    } else if (data === 'tg_bypass_cancel') {
      pendingBypass = { url: '', awaitingDomain: false };
      await tgCall('answerCallbackQuery', { callback_query_id: cb.id, text: 'Đã hủy!' });
      await tgCall('editMessageText', { chat_id: cid, message_id: cb.message.message_id, text: '❌ Đã hủy yêu cầu vượt link.' });
    }
    return;
  }

  const msg = up.message;
  if (!msg || !msg.text) return;
  currentChatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (pendingBypass.awaitingDomain && pendingBypass.url) {
    pendingBypass.awaitingDomain = false;
    const tgt = text.replace(/^https?:\/\/|\/.*$/g, '').trim();
    if (appCallbacks.addLog) appCallbacks.addLog(`[Telegram]: Nhận domain đích "${tgt}" cho link: ${pendingBypass.url}`, 'info');
    await sendTelegramMessage(`🌐 <b>ĐÃ CẬP NHẬT WEBSITE ĐÍCH:</b> <code>${tgt}</code>\n💻 <i>Đang mở tab trên màn hình app và bắt đầu...</i>`);
    if (appCallbacks.onBypass) appCallbacks.onBypass(pendingBypass.url, tgt);
    return;
  }

  if (text.startsWith('/vuotlink') || text.startsWith('/bypass')) {
    const parts = text.split(/\s+/), u = parts[1], dom = parts[2] || '';
    if (u && u.startsWith('http')) {
      pendingBypass.url = u;
      await sendTelegramMessage(`🚀 <b>BẮT ĐẦU VƯỢT LINK!</b>\n🔗 <code>${u}</code>\n💻 <i>Đang mở tab trên app máy tính...</i>`);
      if (appCallbacks.onBypass) appCallbacks.onBypass(u, dom);
      return;
    }
  }

  const mUrl = text.match(/(https?:\/\/[^\s]+)/i);
  if (mUrl) {
    pendingBypass.url = mUrl[1];
    pendingBypass.awaitingDomain = false;
    await sendTelegramMessage(
      `🚀 <b>ĐÃ NHẬN LINK VƯỢT!</b>\n` +
      `🔗 <code>${pendingBypass.url}</code>\n` +
      `💻 <i>Đang tự động mở tab trên màn hình app và bắt đầu quy trình...</i>`
    );
    if (appCallbacks.onBypass) appCallbacks.onBypass(pendingBypass.url, '');
    return;
  }

  if (text === '/start' || text === '/help' || text === '/ping') {
    await sendTelegramMessage(
      `👋 <b>RuaxBonz Vượt Link Desktop App</b>\n\n` +
      `💻 Ứng dụng Desktop đang mở trực tiếp trên màn hình máy tính.\n` +
      `🚀 Bạn chỉ cần gửi link rút gọn (link4m, traffic...) vào đây, app sẽ tự động mở tab, vượt link trên màn hình, chụp ảnh từng bước (chuyển trang, bấm nút lấy mã) và gửi mã về đây cho bạn!`
    );
  }
}

async function pollLoop() {
  if (isPolling) return;
  isPolling = true;
  try {
    const res = await tgCall('getUpdates', { offset: lastUpdateId + 1, timeout: 15 });
    if (res?.ok && Array.isArray(res.result)) {
      for (const up of res.result) {
        lastUpdateId = up.update_id;
        await handleUpdate(up);
      }
    }
  } catch (err) {
    console.error('[Telegram Polling Loop Error]:', err.message);
  } finally {
    isPolling = false;
    setTimeout(pollLoop, 800);
  }
}

function initTelegramIntegration({ onBypass, addLog }) {
  appCallbacks = { onBypass, addLog };
  tgCall('getMe').then(res => {
    if (res?.ok) {
      if (addLog) addLog(`[Telegram Bot]: Đã kết nối @${res.result.username} thành công.`, 'success');
      sendTelegramMessage(`🟢 <b>RuaxBonz Desktop App</b> đã kết nối Telegram thành công và sẵn sàng nhận link!`);
      pollLoop();
    } else {
      if (addLog) addLog('[Telegram Bot]: Không thể kết nối Bot Token!', 'warn');
    }
  });
}

function notifyTelegramStep(caption, photoBuffer = null) {
  if (photoBuffer) sendTelegramPhoto(photoBuffer, caption);
  else sendTelegramMessage(caption);
}

function notifyTelegramCode(code, photoBuffer = null) {
  const text = `🎉🎉🎉 <b>VƯỢT LINK THÀNH CÔNG!</b>\n\n🔑 <b>MÃ XÁC NHẬN CỦA BẠN:</b>\n<code>${code}</code>\n\n<i>👉 Nhấn vào mã ở trên để tự động copy!</i>`;
  if (photoBuffer) sendTelegramPhoto(photoBuffer, text);
  else sendTelegramMessage(text);
}

module.exports = {
  initTelegramIntegration,
  notifyTelegramStep,
  notifyTelegramCode,
  sendTelegramMessage,
  sendTelegramPhoto
};
