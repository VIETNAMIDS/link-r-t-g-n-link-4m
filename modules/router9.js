// modules/router9.js - Gọi AI 9Router phân tích ảnh lấy từ khóa Google & link website (< 300 dòng)
const LOCAL_ENDPOINT = process.env.ROUTER9_LOCAL_ENDPOINT || 'http://127.0.0.1:20128/v1/chat/completions';
const TUNNEL_ENDPOINT = process.env.ROUTER9_TUNNEL_ENDPOINT || 'https://pbfh9h5l-20128.asse.devtunnels.ms/v1/chat/completions';
const ROUTER_KEY = process.env.ROUTER9_API_KEY || '';
const ROUTER_MODELS = ['ag/gemini-3.8-flash', 'gc/gemini-2.5-flash', 'ag/gemini-3.7-flash-medium'];

const IGNORED = ['link4m', 'traffic120', 'yeumoney', 'link1s', 'layma', 'megaurl', 'google', 'cloudflare'];
function isBadDomain(d) { return !d || IGNORED.some(x => d.toLowerCase().includes(x)); }

async function requestAI(endpoint, imageInput, prompt, model = ROUTER_MODELS[0], timeoutMs = 15000) {
  const p = prompt || 'Hãy đọc ảnh hướng dẫn và trả về JSON gồm: {"keyword": "...", "domain": "..."}. Chỉ trả về duy nhất chuỗi JSON thuần.';
  const imgPayload = { url: imageInput };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ROUTER_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: [{ type: 'text', text: p }, { type: 'image_url', image_url: imgPayload }] }]
    })
  });

  if (!res.ok) throw new Error(`[${res.status}]: ${await res.text()}`);
  const text = await res.text();
  let content = '';
  if (text.includes('data: ')) {
    text.split('\n').forEach(line => {
      const t = line.trim();
      if (t.startsWith('data: ') && !t.includes('[DONE]')) {
        try {
          const j = JSON.parse(t.slice(6));
          content += j.choices?.[0]?.delta?.content || j.choices?.[0]?.message?.content || '';
        } catch (_) {}
      }
    });
  } else {
    try { const j = JSON.parse(text); content = j.choices?.[0]?.message?.content || ''; } catch (_) { content = text; }
  }
  return content.trim();
}

async function call9RouterVision(imageInput, prompt) {
  for (const m of ROUTER_MODELS) {
    try {
      const reply = await requestAI(LOCAL_ENDPOINT, imageInput, prompt, m, 12000);
      if (reply) return reply;
    } catch (_) {}
  }

  try {
    const reply = await requestAI(TUNNEL_ENDPOINT, imageInput, prompt, ROUTER_MODELS[0], 12000);
    if (reply) return reply;
  } catch (errTunnel) {
    throw new Error(`9Router không phản hồi: ${errTunnel.message}`);
  }
}

function parseRouterReply(reply, fallbackDomain = '') {
  const safeFallback = isBadDomain(fallbackDomain) ? '' : fallbackDomain;
  if (!reply) return { url: safeFallback, domain: safeFallback, keyword: '' };
  let url = '', domain = '', keyword = '';
  const cleanLink = value => typeof value === 'string' ? value.trim().replace(/\*+/g, '') : '';

  try {
    const jsonM = reply.match(/\{[\s\S]*?\}/);
    if (jsonM) {
      const obj = JSON.parse(jsonM[0]);
      domain = cleanLink(obj.domain || obj.website);
      url = cleanLink(obj.url);
      keyword = typeof obj.keyword === 'string' ? obj.keyword.trim() : '';
      if (domain && !domain.includes('.')) { if (!keyword) keyword = domain; domain = ''; }
      if (domain && !url) url = domain.startsWith('http') ? domain : `https://${domain}`;
    }
  } catch (_) {}

  if (isBadDomain(domain)) domain = '';
  if (isBadDomain(url)) url = '';
  if (isBadDomain(keyword)) keyword = '';

  if (!keyword) {
    const mKw = reply.match(/(?:từ\s*khóa|keyword|bước\s*2|tìm)\s*[:：]?\s*["'“]?([^"'”\n\r|]+)/i);
    if (mKw) {
      const cand = mKw[1].replace(/gõ tìm từ khóa|tìm từ khóa/gi, '').trim();
      if (!isBadDomain(cand)) keyword = cand;
    }
  }

  const normalizedReply = reply.replace(/\*+/g, '');
  if (!domain) {
    const mUrl = normalizedReply.match(/(https?:\/\/[^\s\n\r`"'>]+)/i);
    if (mUrl && !isBadDomain(mUrl[1])) {
      url = mUrl[1].trim();
      try { domain = new URL(url).hostname; } catch (_) { domain = url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim(); }
    }
  }

  if (!domain) {
    const mDom = normalizedReply.match(/\b([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?:\/[^\s\n\r`"'>]*)?)/i);
    if (mDom && !isBadDomain(mDom[1])) {
      const raw = mDom[1].trim();
      url = raw.startsWith('http') ? raw : `https://${raw}`;
      domain = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
    }
  }

  return {
    keyword: keyword || '',
    url: domain ? (url || `https://${domain}`) : safeFallback,
    domain: domain || safeFallback
  };
}

module.exports = { call9RouterVision, parseRouterReply };
