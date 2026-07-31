/* ==================== OmniHub 模型排行榜数据层 ====================
 * Leaderboard.get(board) → Promise<rows>
 * 三级数据源：①Store 缓存（24h 内直接用）②BackendConfig.leaderboard(board)（Neon/KV 缓存）
 * ③内嵌 FALLBACK 静态数据（标注「离线参考数据」badge，rows._offline = true）
 * 行结构：{rank, id, name, provider, score, display}
 *  - score   数值分数或价格（性价比榜为 元/百万 tokens）
 *  - display 展示文本（如「89.3」或「¥4.2/M」）
 */
const Leaderboard = (() => {
  'use strict';

  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时

  /* 六榜单定义（顺序即排行榜页横向滑动顺序） */
  var BOARDS = [
    { id: 'overall',   zh: '综合',   en: 'Overall' },
    { id: 'coding',    zh: '代码',   en: 'Coding' },
    { id: 'longctx',   zh: '长文本', en: 'Long Context' },
    { id: 'reasoning', zh: '推理',   en: 'Reasoning' },
    { id: 'value',     zh: '性价比', en: 'Value' },
    { id: 'chinese',   zh: '中文',   en: 'Chinese' }
  ];

  /* 内嵌离线参考数据（六榜单各 Top10，大致量级分数） */
  var FALLBACK = {
    overall: [
      { id: 'gpt-4o',             name: 'GPT-4o',             provider: 'OpenAI',    score: 89.3 },
      { id: 'claude-sonnet-3.7',  name: 'Claude 3.7 Sonnet',  provider: 'Anthropic', score: 88.7 },
      { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro',     provider: 'Google',    score: 88.1 },
      { id: 'deepseek-v4-pro',    name: 'DeepSeek V4 Pro',    provider: 'DeepSeek',  score: 86.5 },
      { id: 'kimi-k2',            name: 'Kimi K2',            provider: 'Kimi',      score: 85.2 },
      { id: 'qwen3-max',          name: 'Qwen3-Max',          provider: '通义千问',  score: 84.6 },
      { id: 'llama-4-maverick',   name: 'Llama 4 Maverick',   provider: 'Meta',      score: 83.1 },
      { id: 'mistral-large-3',    name: 'Mistral Large 3',    provider: 'Mistral',   score: 81.4 },
      { id: 'grok-4',             name: 'Grok 4',             provider: 'xAI',       score: 83.8 },
      { id: 'glm-5.2',            name: 'GLM-5.2',            provider: '智谱AI',    score: 82.6 }
    ],
    coding: [
      { id: 'claude-sonnet-3.7',  name: 'Claude 3.7 Sonnet',  provider: 'Anthropic', score: 62.3 },
      { id: 'gpt-4o',             name: 'GPT-4o',             provider: 'OpenAI',    score: 58.9 },
      { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro',     provider: 'Google',    score: 57.6 },
      { id: 'deepseek-v4-pro',    name: 'DeepSeek V4 Pro',    provider: 'DeepSeek',  score: 56.8 },
      { id: 'kimi-k2.7-code',     name: 'Kimi K2.7 Code',     provider: 'Kimi',      score: 55.4 },
      { id: 'qwen3-max',          name: 'Qwen3-Max',          provider: '通义千问',  score: 54.1 },
      { id: 'grok-code-fast-1',   name: 'Grok Code Fast 1',   provider: 'xAI',       score: 52.7 },
      { id: 'glm-5.2',            name: 'GLM-5.2',            provider: '智谱AI',    score: 51.9 },
      { id: 'codestral-latest',   name: 'Codestral',          provider: 'Mistral',   score: 50.2 },
      { id: 'llama-4-maverick',   name: 'Llama 4 Maverick',   provider: 'Meta',      score: 48.6 }
    ],
    longctx: [
      { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro',     provider: 'Google',    score: 91.5 },
      { id: 'gpt-4.1',            name: 'GPT-4.1',            provider: 'OpenAI',    score: 88.2 },
      { id: 'claude-sonnet-3.7',  name: 'Claude 3.7 Sonnet',  provider: 'Anthropic', score: 86.4 },
      { id: 'qwen-long',          name: '通义千问 Long',      provider: '通义千问',  score: 85.7 },
      { id: 'kimi-k2',            name: 'Kimi K2',            provider: 'Kimi',      score: 84.9 },
      { id: 'glm-4-long',         name: 'GLM-4 Long',         provider: '智谱AI',    score: 83.3 },
      { id: 'minimax-m3',         name: 'MiniMax-M3',         provider: 'MiniMax',   score: 82.8 },
      { id: 'mimo-v2.5-pro',      name: 'MiMo v2.5 Pro',      provider: '小米 MiMo', score: 81.6 },
      { id: 'deepseek-v4-pro',    name: 'DeepSeek V4 Pro',    provider: 'DeepSeek',  score: 80.4 },
      { id: 'grok-4-fast',        name: 'Grok 4 Fast',        provider: 'xAI',       score: 79.2 }
    ],
    reasoning: [
      { id: 'o3',                 name: 'o3',                 provider: 'OpenAI',    score: 87.5 },
      { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro',     provider: 'Google',    score: 86.8 },
      { id: 'claude-opus-4-5',    name: 'Claude Opus 4.5',    provider: 'Anthropic', score: 85.1 },
      { id: 'deepseek-r1',        name: 'DeepSeek R1',        provider: 'DeepSeek',  score: 84.3 },
      { id: 'qwen3-max',          name: 'Qwen3-Max',          provider: '通义千问',  score: 82.6 },
      { id: 'grok-4',             name: 'Grok 4',             provider: 'xAI',       score: 82.1 },
      { id: 'glm-5.2',            name: 'GLM-5.2',            provider: '智谱AI',    score: 80.7 },
      { id: 'kimi-k3',            name: 'Kimi K3',            provider: 'Kimi',      score: 80.2 },
      { id: 'mimo-v2.5-pro',      name: 'MiMo v2.5 Pro',      provider: '小米 MiMo', score: 78.9 },
      { id: 'llama-4-maverick',   name: 'Llama 4 Maverick',   provider: 'Meta',      score: 76.3 }
    ],
    value: [
      { id: 'deepseek-v4-flash',  name: 'DeepSeek V4 Flash',  provider: 'DeepSeek',  score: 0.8 },
      { id: 'glm-4.7-flash',      name: 'GLM-4.7-Flash',      provider: '智谱AI',    score: 1.0 },
      { id: 'qwen-turbo',         name: '通义千问 Turbo',     provider: '通义千问',  score: 1.2 },
      { id: 'gemini-2.5-flash',   name: 'Gemini 2.5 Flash',   provider: 'Google',    score: 2.1 },
      { id: 'gpt-4o-mini',        name: 'GPT-4o Mini',        provider: 'OpenAI',    score: 2.5 },
      { id: 'doubao-lite',        name: 'Doubao Lite',        provider: '火山引擎',  score: 1.6 },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'Groq', score: 2.9 },
      { id: 'mistral-small-4',    name: 'Mistral Small 4',    provider: 'Mistral',   score: 3.4 },
      { id: 'kimi-k2.6',          name: 'Kimi K2.6',          provider: 'Kimi',      score: 4.0 },
      { id: 'claude-haiku-4.5',   name: 'Claude Haiku 4.5',   provider: 'Anthropic', score: 5.2 }
    ],
    chinese: [
      { id: 'qwen3-max',          name: 'Qwen3-Max',          provider: '通义千问',  score: 90.2 },
      { id: 'deepseek-v4-pro',    name: 'DeepSeek V4 Pro',    provider: 'DeepSeek',  score: 89.6 },
      { id: 'kimi-k3',            name: 'Kimi K3',            provider: 'Kimi',      score: 88.4 },
      { id: 'glm-5.2',            name: 'GLM-5.2',            provider: '智谱AI',    score: 87.1 },
      { id: 'ernie-4.5-turbo',    name: 'ERNIE 4.5 Turbo',    provider: '文心一言',  score: 85.8 },
      { id: 'doubao-2.1-pro',     name: 'Doubao 2.1 Pro',     provider: '火山引擎',  score: 85.2 },
      { id: 'hunyuan-turbos',     name: '混元-TurboS',        provider: '腾讯混元',  score: 84.5 },
      { id: 'spark-max',          name: '星火 Max',           provider: '讯飞星火',  score: 82.7 },
      { id: 'minimax-m3',         name: 'MiniMax-M3',         provider: 'MiniMax',   score: 82.1 },
      { id: 'SenseChat-5',        name: '日日新 SenseChat 5', provider: '商汤',      score: 80.6 }
    ]
  };

  /* 性价比榜的 display 为价格文本，其余榜单为分数文本 */
  function normalizeRow(board, r, idx) {
    var score = typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0;
    var display = r.display;
    if (!display) {
      display = (board === 'value') ? ('¥' + score + '/M') : String(score);
    }
    return {
      rank: r.rank || (idx + 1),
      id: r.id || '',
      name: r.name || r.id || '—',
      provider: r.provider || '',
      score: score,
      display: display
    };
  }

  function normalizeRows(board, arr) {
    var out = [];
    if (!arr || !arr.length) return out;
    for (var i = 0; i < arr.length && i < 10; i++) {
      if (arr[i]) out.push(normalizeRow(board, arr[i], i));
    }
    return out;
  }

  /* 离线参考数据：附 badge 标记（_offline = true） */
  function fallbackRows(board) {
    var rows = normalizeRows(board, FALLBACK[board] || []);
    rows._offline = true;
    return rows;
  }

  /* Store 运行时默认值：Store.state.leaderboard = { board: {ts, rows, offline} } */
  function readCache(board) {
    try {
      if (!Store.state.leaderboard) return null;
      var c = Store.state.leaderboard[board];
      if (!c || !c.rows || !c.rows.length) return null;
      if (!c.ts || (Date.now() - c.ts) >= CACHE_TTL) return null;
      return c;
    } catch (e) { return null; }
  }

  function writeCache(board, rows, offline) {
    try {
      if (!Store.state.leaderboard) Store.state.leaderboard = {};
      Store.state.leaderboard[board] = { ts: Date.now(), rows: rows, offline: !!offline };
      Store.save();
    } catch (e) { /* 缓存失败不影响主流程 */ }
  }

  /* 拉取远端（Neon/KV 缓存 payload）：兼容 {rows:[...]} 或直接数组 */
  function fetchRemote(board) {
    if (typeof BackendConfig === 'undefined' || !BackendConfig.leaderboard) {
      return Promise.reject(new Error('BackendConfig 不可用'));
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 8000);
    return fetch(BackendConfig.leaderboard(board), { signal: ctrl.signal }).then(function(res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(json) {
      var arr = null;
      if (json && json.rows) arr = json.rows;
      else if (json && json.data) arr = json.data;
      else if (Object.prototype.toString.call(json) === '[object Array]') arr = json;
      var rows = normalizeRows(board, arr);
      if (!rows.length) throw new Error('empty payload');
      return rows;
    }).catch(function(e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /* 主入口：缓存 → 远端 → 离线兜底 */
  function get(board) {
    if (!board) board = 'overall';
    var cached = readCache(board);
    if (cached) {
      var rows = normalizeRows(board, cached.rows);
      rows._offline = !!cached.offline;
      return Promise.resolve(rows);
    }
    return fetchRemote(board).then(function(rows) {
      rows._offline = false;
      writeCache(board, rows, false);
      return rows;
    }).catch(function() {
      var off = fallbackRows(board);
      writeCache(board, off, true); // 离线数据也短缓存，避免频繁探测失败端点
      return off;
    });
  }

  /* 强制刷新（忽略缓存） */
  function refresh(board) {
    try {
      if (Store.state.leaderboard && Store.state.leaderboard[board]) {
        delete Store.state.leaderboard[board];
        Store.save();
      }
    } catch (e) { /* ignore */ }
    return get(board);
  }

  return { BOARDS: BOARDS, get: get, refresh: refresh, FALLBACK: FALLBACK };
})();
