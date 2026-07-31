// Neon SQL-over-HTTP client.
// NOTE: Cloudflare Workers do not support `import ... from 'https://...'`,
// so the esm.sh @neondatabase/serverless import is replaced by this minimal
// client targeting the same Neon serverless /sql HTTP endpoint the driver uses.
async function neonRaw(env, text, params = []) {
  const u = new URL(env.NEON_DATABASE_URL);
  const res = await fetch(`https://${u.hostname}/sql`, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': env.NEON_DATABASE_URL,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: text, params }),
  });
  if (!res.ok) {
    throw new Error('neon http ' + res.status + ': ' + (await res.text()).slice(0, 300));
  }
  return res.json(); // {fields, rows, command, rowCount}
}

function neon(env) {
  // tagged-template compatible: await sql`SELECT ... WHERE x = ${v}`
  return async (strings, ...values) => {
    const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? '$' + (i + 1) : ''), '');
    return neonRaw(env, text, values); // {rows, rowCount, command, fields}
  };
}

const VERSION = '8.2';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const FETCH_TIMEOUT_MS = 20000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function isTextual(contentType) {
  if (!contentType) return true; // assume text when unknown
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith('text/') ||
    ct.includes('json') ||
    ct.includes('xml') ||
    ct.includes('html') ||
    ct.includes('javascript') ||
    ct.includes('ecmascript')
  );
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function makeAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

// ---------------- /fetch ----------------
async function handleFetch(request, env, ctx) {
  const isGet = request.method === 'GET';
  let url, method, headers, body;

  try {
    if (isGet) {
      url = new URL(request.url).searchParams.get('url');
      if (!url) return jsonResponse({ ok: false, error: 'missing url query param' });
    } else {
      const payload = await request.json();
      url = payload.url;
      method = payload.method;
      headers = payload.headers;
      body = payload.body;
      if (!url) return jsonResponse({ ok: false, error: 'missing url in body' });
    }
  } catch (e) {
    return jsonResponse({ ok: false, error: 'bad request: ' + e.message });
  }

  const cacheKey = isGet ? 'fetch:' + (await sha256Hex(url)) : null;
  if (cacheKey) {
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) return jsonResponse(cached);
  }

  const { signal, cancel } = makeAbortSignal(FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: isGet ? 'GET' : (method || 'GET'),
      headers: { 'User-Agent': UA, ...(isGet ? {} : (headers || {})) },
      body: isGet ? undefined : body,
      redirect: 'follow',
      signal,
    });
    const contentType = upstream.headers.get('content-type') || '';
    const finalUrl = upstream.url;

    if (isTextual(contentType)) {
      const text = await upstream.text();
      const result = { ok: true, status: upstream.status, contentType, finalUrl, text };
      if (isGet && upstream.status === 200) {
        ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 600 }));
      }
      return jsonResponse(result);
    }

    // binary: base64 encode, capped at MAX_BYTES
    const reader = upstream.body.getReader();
    const chunks = [];
    let total = 0;
    let truncated = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { truncated = true; break; }
      chunks.push(value);
    }
    try { await reader.cancel(); } catch (_) {}
    if (truncated) {
      return jsonResponse({ ok: false, error: 'response too large (>8MB)', status: upstream.status, contentType, finalUrl });
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
    // chunked base64 to avoid call-stack issues
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
    }
    const result = {
      ok: true,
      status: upstream.status,
      contentType,
      finalUrl,
      text: btoa(binary),
      encoding: 'base64',
    };
    if (isGet && upstream.status === 200) {
      ctx.waitUntil(env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 600 }));
    }
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message ? e.message : e) });
  } finally {
    cancel();
  }
}

// ---------------- /probe ----------------
function classifyKind(contentType, text) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.startsWith('text/') || ct.includes('xml') || ct.includes('javascript')) {
    const t = text.trimStart();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { JSON.parse(t); return 'json'; } catch (_) { return 'other'; }
    }
    if (/<\s*html|<\s*!doctype\s+html/i.test(t.slice(0, 512))) return 'html';
    return 'other';
  }
  if (!ct) {
    const t = text.trimStart();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { JSON.parse(t); return 'json'; } catch (_) { return 'other'; }
    }
    if (/<\s*html|<\s*!doctype\s+html/i.test(t.slice(0, 512))) return 'html';
  }
  return 'other';
}

async function handleProbe(request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return jsonResponse({ ok: false, error: 'missing url query param' });

  const { signal, cancel } = makeAbortSignal(FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal,
    });
    const contentType = upstream.headers.get('content-type') || '';
    const finalUrl = upstream.url;

    if (!isTextual(contentType)) {
      return jsonResponse({ ok: true, status: upstream.status, contentType, finalUrl, kind: 'other' });
    }

    const text = await upstream.text();
    const kind = classifyKind(contentType, text);
    const result = { ok: true, status: upstream.status, contentType, finalUrl, kind };

    if (kind === 'html') {
      const m = text.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (m) result.title = m[1].trim();
      const links = new Set();
      const attrRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
      let am;
      while ((am = attrRe.exec(text)) !== null && links.size < 20) {
        const raw = am[1];
        if (/\.json($|[?#])/i.test(raw) || /\/json\//i.test(raw)) {
          try { links.add(new URL(raw, finalUrl).href); } catch (_) {}
        }
      }
      result.jsonLinks = Array.from(links).slice(0, 20);
    }
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e && e.message ? e.message : e) });
  } finally {
    cancel();
  }
}

// ---------------- /leaderboard ----------------
async function handleLeaderboard(request, env, ctx) {
  const board = new URL(request.url).searchParams.get('board');
  if (!board) return jsonResponse({ ok: false, error: 'missing board query param' }, 400);

  const kvKey = 'leaderboard:' + board;
  const cached = await env.CACHE.get(kvKey, 'json');
  if (cached) return jsonResponse(cached);

  try {
    const sql = neon(env);
    const { rows } = await sql`SELECT payload FROM leaderboard_cache WHERE board = ${board} LIMIT 1`;
    if (rows.length > 0) {
      const payload = rows[0].payload;
      const result = { ok: true, board, payload };
      ctx.waitUntil(env.CACHE.put(kvKey, JSON.stringify(result), { expirationTtl: 86400 }));
      return jsonResponse(result);
    }
  } catch (e) {
    return jsonResponse({ ok: false, error: 'db error: ' + e.message }, 404);
  }
  return jsonResponse({ ok: false, error: 'not found' }, 404);
}

// ---------------- /sources/official ----------------
async function handleSourcesOfficial(env, ctx) {
  const kvKey = 'sources:official';
  const cached = await env.CACHE.get(kvKey, 'json');
  if (cached) return jsonResponse(cached);

  try {
    const sql = neon(env);
    const { rows } = await sql`
      SELECT id, name, url, stype, format, payload, imports
      FROM official_sources
      WHERE enabled = true
      ORDER BY imports DESC
      LIMIT 100`;
    const sources = rows.map((r) => ({ ...r, imports: Number(r.imports) }));
    const result = { ok: true, sources };
    ctx.waitUntil(env.CACHE.put(kvKey, JSON.stringify(result), { expirationTtl: 3600 }));
    return jsonResponse(result);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'db error: ' + e.message }, 500);
  }
}

// ---------------- /sources/report ----------------
async function handleSourcesReport(request, env, ctx) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = new Date();
  const bucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;
  const rlKey = `rl:${ip}:${bucket}`;

  const count = parseInt((await env.CACHE.get(rlKey)) || '0', 10);
  if (count >= 30) {
    return jsonResponse({ ok: false, error: 'rate limit exceeded (30/min per IP)' }, 429);
  }
  ctx.waitUntil(env.CACHE.put(rlKey, String(count + 1), { expirationTtl: 120 }));

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid JSON body' }, 400);
  }
  const { url, ok, meta } = payload || {};
  if (!url || typeof ok !== 'boolean') {
    return jsonResponse({ ok: false, error: 'body must include url (string) and ok (boolean)' }, 400);
  }

  try {
    const sql = neon(env);
    await sql`INSERT INTO import_stats (source_url, ok, meta) VALUES (${url}, ${ok}, ${meta ? JSON.stringify(meta) : null})`;
    const updated = await sql`UPDATE official_sources SET imports = imports + 1 WHERE url = ${url}`;
    return jsonResponse({ ok: true, updated: updated.rowCount ?? null });
  } catch (e) {
    return jsonResponse({ ok: false, error: 'db error: ' + e.message }, 500);
  }
}

// ---------------- entry ----------------
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ ok: true, worker: 'omnihub-proxy', version: VERSION, ts: Date.now() });
      }
      if (path === '/fetch' && (request.method === 'GET' || request.method === 'POST')) {
        return await handleFetch(request, env, ctx);
      }
      if (path === '/probe' && request.method === 'GET') {
        return await handleProbe(request);
      }
      if (path === '/leaderboard' && request.method === 'GET') {
        return await handleLeaderboard(request, env, ctx);
      }
      if (path === '/sources/official' && request.method === 'GET') {
        return await handleSourcesOfficial(env, ctx);
      }
      if (path === '/sources/report' && request.method === 'POST') {
        return await handleSourcesReport(request, env, ctx);
      }
      return jsonResponse({ ok: false, error: 'not found' }, 404);
    } catch (e) {
      return jsonResponse({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  },
};
