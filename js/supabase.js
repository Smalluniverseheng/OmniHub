/* ==================== OmniHub SB · Supabase 云服务 ====================
 * 全局单例 SB（与 UMD 的 window.supabase 区分）。
 * 与 aiBeta / AI-admin 管理后台共用同一 Supabase 数据库：
 * 后台修改的会员等级 / 配额，这里登录或刷新会员信息即生效。
 * SDK（supabase-js v2 UMD）由 index.html 引入（jsdelivr，失败回退 unpkg），
 * SDK 加载失败时全部云功能优雅降级，本地功能零影响。
 * API Key 用「登录密码派生密钥」PBKDF2(10万次,SHA-256) + AES-GCM(每行独立 IV)
 * 加密后上传；密码与派生密钥只缓存于内存，不落盘。
 */
const SB = (() => {
  'use strict';

  const SUPABASE_URL = 'https://mxvxlgjzeboktufumxbp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_WzUzAQK5cOEsn7QwFB2cAw_ubIkG7RJ';
  const GATEWAY = 'https://ai-gateway.1829487897.workers.dev';
  const PUSH_DEBOUNCE = 2000;   // Store.save 触发推送的防抖

  let client = null;      // supabase client（懒创建）
  let sdkFailed = false;  // SDK 加载/初始化失败标记
  let pwCache = null;     // 登录密码（仅内存，用于派生加密密钥）
  let encKey = null;      // 本会话派生的 AES-GCM 密钥缓存
  let encSalt = null;     // 本会话加密随机盐（每行 IV 独立随机）
  const dkCache = {};     // 解密用派生密钥缓存（按 salt）
  let pushTimer = null;
  let suppress = false;   // 同步自身写本地时抑制再次调度（防循环）

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function nowIso() { return new Date().toISOString(); }

  /* ---------- 懒初始化：SDK 不存在则返回 false（优雅降级） ---------- */
  function ready() {
    if (client) return true;
    if (sdkFailed) return false;
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return true;
      } catch (e) { sdkFailed = true; }
    }
    return false;
  }

  /* ---------- 错误翻译：常见认证/网络/服务端错误 → 中文 ---------- */
  function errMsg(e) {
    const m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    if (/Invalid login credentials/i.test(m)) return '邮箱或密码错误';
    if (/User already registered/i.test(m)) return '该邮箱已注册，请直接登录';
    if (/Email not confirmed/i.test(m)) return '邮箱未验证，请先查收验证邮件';
    if (/at least 6 characters/i.test(m)) return '密码至少 6 位';
    if (/Unable to validate email address|invalid email/i.test(m)) return '邮箱格式不正确';
    if (/Failed to fetch|NetworkError|Network request failed|Load failed/i.test(m) || (e && e.name === 'TypeError' && /fetch/i.test(m))) return '网络异常，稍后重试';
    if (/row[- ]level security|permission denied/i.test(m)) return '权限不足';
    if ((e && typeof e.status === 'number' && e.status >= 500) || !m || m === '{}' || /unexpected_failure|internal server/i.test(m)) return '服务器异常，稍后重试';
    if (/already|used|redeemed/i.test(m) && /card|卡/i.test(m)) return '卡密已被使用';
    if (/invalid|not found|exist/i.test(m) && /card|卡|key/i.test(m)) return '卡密无效';
    return m || '操作失败';
  }

  /* ---------- 同步期间写本地不触发再次推送 ---------- */
  function saveLocal() {
    suppress = true;
    try { Store.save(); } finally { suppress = false; }
  }

  /* ==================== Auth ==================== */
  const Auth = {
    signIn: async function(email, password) {
      if (!ready()) return { user: null, error: new Error('sdk not ready') };
      try {
        const r = await client.auth.signInWithPassword({ email: email, password: password });
        return { user: r.data && r.data.user, error: r.error };
      } catch (e) { return { user: null, error: e }; }
    },
    signUp: async function(email, password, name) {
      if (!ready()) return { user: null, error: new Error('sdk not ready') };
      try {
        const r = await client.auth.signUp({ email: email, password: password, options: { data: { name: name || '' } } });
        return { user: r.data && r.data.user, error: r.error };
      } catch (e) { return { user: null, error: e }; }
    },
    signOut: async function() {
      clearPassword();
      // 退出前尽力置离线 + 停心跳 + 清二级密码免验
      try { markOfflineBest(); } catch (e) {}
      try { stopHeartbeat(); } catch (e) {}
      try { if (typeof window !== 'undefined' && window.Auth && window.Auth.clearBypass) window.Auth.clearBypass(); } catch (e) {}
      try { if (typeof EventBus !== 'undefined' && EventBus.emit) EventBus.emit('auth:logout'); } catch (e) {}
      if (!ready()) return;
      try { await client.auth.signOut(); } catch (e) {}
    },
    getSession: async function() {
      if (!ready()) return null;
      try {
        const r = await client.auth.getSession();
        return (r.data && r.data.session) || null;
      } catch (e) { return null; }
    }
  };

  /* ==================== 密码派生加密（PBKDF2 10 万次 + AES-GCM） ==================== */
  function setPassword(p) { pwCache = p || null; encKey = null; encSalt = null; }
  function clearPassword() { pwCache = null; encKey = null; encSalt = null; for (const k in dkCache) delete dkCache[k]; }
  function hasPassword() { return !!pwCache; }
  function cryptoOk() { return typeof crypto !== 'undefined' && !!crypto.subtle; }

  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), function(c) { return c.charCodeAt(0); }); }

  async function deriveKey(password, salt) {
    const mat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
      mat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  /* 会话级加密密钥：盐一次随机，整会话复用（IV 每行独立），PBKDF2 只跑一次 */
  async function sessionKey() {
    if (!pwCache || !cryptoOk()) return null;
    if (!encKey) {
      encSalt = crypto.getRandomValues(new Uint8Array(16));
      encKey = await deriveKey(pwCache, encSalt);
    }
    return encKey;
  }

  async function encryptText(plain) {
    const key = await sessionKey();
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(String(plain)));
    return { encrypted: b64(ct), iv: b64(iv), salt: b64(encSalt) };
  }

  async function decryptText(obj) {
    if (!pwCache || !cryptoOk()) return null;
    const key = dkCache[obj.salt] || (dkCache[obj.salt] = await deriveKey(pwCache, unb64(obj.salt)));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.encrypted));
    return dec.decode(pt);
  }

  /* ==================== 同步白名单 ====================
   * theme / language / homePage / navItems / read.settings /
   * chat.temperature / chat.maxTokens / chat.thinkingEnabled / chat.voice
   * chat.keys 不走这里——API Key 走加密通道（encrypted_api_keys）。
   */
  function pickSettings() {
    const s = Store.state;
    const out = {
      theme: s.settings.theme,
      language: s.settings.language,
      homePage: s.homePage,
      navItems: s.navItems,
      read: { settings: s.read.settings },
      chat: {
        temperature: s.chat.temperature,
        maxTokens: s.chat.maxTokens,
        thinkingEnabled: s.chat.thinkingEnabled,
        voice: s.chat.voice
      }
    };
    try { return JSON.parse(JSON.stringify(out)); } catch (e) { return {}; }
  }

  function applySettings(c) {
    const s = Store.state;
    if (!c || typeof c !== 'object') return;
    if (c.theme !== undefined) s.settings.theme = c.theme;
    if (c.language !== undefined) { s.settings.language = c.language; s.language = c.language; }
    if (c.homePage) s.homePage = c.homePage;
    if (Array.isArray(c.navItems) && c.navItems.length) s.navItems = c.navItems;
    if (c.read && c.read.settings) {
      const rs = c.read.settings;
      Object.keys(rs).forEach(function(k) { s.read.settings[k] = rs[k]; });
    }
    if (c.chat) {
      if (c.chat.temperature !== undefined) s.chat.temperature = c.chat.temperature;
      if (c.chat.maxTokens !== undefined) s.chat.maxTokens = c.chat.maxTokens;
      if (c.chat.thinkingEnabled !== undefined) s.chat.thinkingEnabled = c.chat.thinkingEnabled;
      if (c.chat.voice) {
        const v = c.chat.voice;
        Object.keys(v).forEach(function(k) { s.chat.voice[k] = v[k]; });
      }
    }
  }

  /* ---------- profiles → Store.state.user ---------- */
  function toTs(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const ts = new Date(v).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  function applyProfile(p) {
    const u = Store.state.user;
    if (!p) return;
    if (p.nickname) { u.nickname = p.nickname; u.username = p.nickname; }
    if (p.role) u.role = p.role;
    if (p.plan !== undefined && p.plan !== null) u.plan = p.plan;
    if (p.plan_expires_at !== undefined) u.planExpiresAt = toTs(p.plan_expires_at);
    if (p.is_admin !== undefined && p.is_admin !== null) u.isAdmin = !!p.is_admin;
    if (p.balance !== undefined && p.balance !== null) u.balance = Number(p.balance) || 0;
    if (p.storage_used_mb !== undefined && p.storage_used_mb !== null) u.storageUsedMb = Number(p.storage_used_mb) || 0;
    if (p.storage_quota_mb !== undefined && p.storage_quota_mb !== null) u.storageQuotaMb = Number(p.storage_quota_mb);
  }

  function applyMembership(m) {
    const u = Store.state.user;
    if (!m) return;
    if (m.tier) u.role = m.tier;
    if (m.role) u.role = m.role;
    if (m.plan !== undefined && m.plan !== null) u.plan = m.plan;
    const exp = (m.expires_at !== undefined ? m.expires_at : m.plan_expires_at);
    if (exp !== undefined && exp !== null) u.planExpiresAt = toTs(exp);
    if (m.storage_used !== undefined && m.storage_used !== null) u.storageUsedMb = Number(m.storage_used) || 0;
    if (m.storage_used_mb !== undefined && m.storage_used_mb !== null) u.storageUsedMb = Number(m.storage_used_mb) || 0;
    if (m.storage_limit !== undefined && m.storage_limit !== null) u.storageQuotaMb = Number(m.storage_limit);
    if (m.storage_quota_mb !== undefined && m.storage_quota_mb !== null) u.storageQuotaMb = Number(m.storage_quota_mb);
    if (m.is_admin !== undefined && m.is_admin !== null) u.isAdmin = !!m.is_admin;
    if (m.balance !== undefined && m.balance !== null) u.balance = Number(m.balance) || 0;
  }

  function canSync() {
    return ready() && Store.state.user && Store.state.user.isLogged && !!Store.state.user.id;
  }

  /* ---------- 直查 profiles（getMembership 的回退路径） ---------- */
  async function pullProfile() {
    if (!canSync()) return null;
    try {
      const r = await client.from('profiles')
        .select('nickname,role,plan,plan_expires_at,is_admin,balance,storage_used_mb,storage_quota_mb')
        .eq('id', Store.state.user.id).maybeSingle();
      if (r.error || !r.data) return null;
      applyProfile(r.data);
      saveLocal();
      return r.data;
    } catch (e) { return null; }
  }

  /* ==================== 卡密（走 Cloudflare Worker） ==================== */
  async function cardPost(path, cardKey) {
    let res;
    try {
      res = await fetch(GATEWAY + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_key: cardKey })
      });
    } catch (e) { throw new Error('网络异常，稍后重试'); }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && (data.error || data.message)) || ('请求失败(' + res.status + ')'));
    }
    return data || {};
  }

  async function verifyCard(cardKey) { return cardPost('/api/v1/card/verify', cardKey); }
  async function redeemCard(cardKey) { return cardPost('/api/v1/card/redeem', cardKey); }

  /* ---------- 会员信息：优先 Worker（Bearer token），失败回退直查 profiles ---------- */
  async function getMembership() {
    try {
      const session = await Auth.getSession();
      const token = session && session.access_token;
      if (token) {
        const res = await fetch(GATEWAY + '/api/v1/membership', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
          const data = await res.json();
          const m = (data && (data.membership || data.data)) || data;
          if (m && typeof m === 'object') {
            applyMembership(m);
            saveLocal();
            return m;
          }
        }
      }
    } catch (e) {}
    // 回退：supabase-js 直查 profiles
    const p = await pullProfile();
    if (p) return { tier: Store.state.user.role };
    return null;
  }

  /* ==================== Sync ==================== */

  /* 推送：设置白名单 → user_settings；API Key 加密 → encrypted_api_keys
   * onProgress(done, total)：可选进度回调（diff 确认弹层的进度条用），
   * 自动防抖推送不传 → 静默直传，不触发任何 UI。
   */
  async function pushNow(onProgress) {
    if (!canSync() || !Store.state.user.cloudSync) return { ok: false, skipped: true };
    const uid = Store.state.user.id;
    let err = null;
    let payloadBytes = 0;   // 本次上传载荷字节数（写回 storage_used_mb 用）
    const keys = Store.state.chat.keys || {};
    const slugs = (hasPassword() && cryptoOk())
      ? Object.keys(keys).filter(function(k) { return typeof keys[k] === 'string' && keys[k].trim(); })
      : [];
    const total = 1 + slugs.length + 1 + 1;   // 设置 + 各 Key + 对话 + 存储统计
    let done = 0;
    function tick() { done++; if (typeof onProgress === 'function') { try { onProgress(done, total); } catch (e) {} } }

    // 1) 设置白名单
    try {
      const settings = pickSettings();
      payloadBytes += JSON.stringify(settings).length;
      const r = await client.from('user_settings').upsert(
        { user_id: uid, settings: settings, updated_at: nowIso() },
        { onConflict: 'user_id' }
      );
      if (r.error) err = r.error;
    } catch (e) { err = e; }
    tick();
    // 2) API Keys 加密上传（密码派生密钥可用时；刷新后未输密码则跳过）
    for (let i = 0; i < slugs.length; i++) {
      const provider = slugs[i];
      try {
        const box = await encryptText(keys[provider].trim());
        if (box) {
          payloadBytes += box.encrypted.length;
          const r = await client.from('encrypted_api_keys').upsert({
            user_id: uid, provider: provider,
            encrypted_key: box.encrypted, iv: box.iv, salt: box.salt,
            updated_at: nowIso()
          }, { onConflict: 'user_id,provider' });
          if (r.error && !err) err = r.error;
        }
      } catch (e) { if (!err) err = e; }
      tick();
    }
    // 3) 对话记录（5s 防抖的自动推送共用同一通道，内容未变时内部跳过）
    try {
      const cr = await pushChatConversations();
      if (cr && cr.bytes) payloadBytes += cr.bytes;
    } catch (e) {}
    tick();
    // 4) 存储用量统计：写回 profiles.storage_used_mb（列不存在/失败时静默）
    try {
      const mb = Math.round(payloadBytes / 1024 / 1024 * 100) / 100;
      const sr = await client.from('profiles').update({ storage_used_mb: mb }).eq('id', uid);
      if (!sr.error) Store.state.user.storageUsedMb = mb;
    } catch (e) {}
    tick();
    Store.state.user.lastSyncAt = Date.now();
    saveLocal();
    if (err) { console.warn('SB push error:', err); return { ok: false, error: err }; }
    return { ok: true };
  }

  function schedulePush() {
    if (!canSync() || !Store.state.user.cloudSync) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function() {
      pushNow().catch(function(e) { console.warn('SB push failed:', e); });
    }, PUSH_DEBOUNCE);
  }

  /* 「立即同步」：推送 + 拉会员信息 */
  async function syncNow() {
    const pr = await pushNow();
    await getMembership();
    Store.state.user.lastSyncAt = Date.now();
    saveLocal();
    return pr;
  }

  /* 登录/恢复后的首次同步：拉会员信息 + 设置（云端较新才覆盖）+ 解密 Key 回填 */
  async function firstSync() {
    if (!canSync()) return { ok: false };
    const uid = Store.state.user.id;
    let changed = false;
    try {
      // 1) 会员信息（后台改的等级/配额登录即生效）
      await getMembership();
      // 2) 设置白名单：云端 updated_at 较新才覆盖本地
      const r = await client.from('user_settings').select('settings,updated_at').eq('user_id', uid).maybeSingle();
      if (!r.error && r.data && r.data.settings) {
        const cloudTs = new Date(r.data.updated_at || 0).getTime() || 0;
        if (cloudTs > (Store.state.user.lastSyncAt || 0)) {
          applySettings(r.data.settings);
          changed = true;
        }
      }
      // 3) 加密 API Key 解密回填（密码可用时；单行失败跳过该行）
      const kr = await client.from('encrypted_api_keys').select('provider,encrypted_key,iv,salt').eq('user_id', uid);
      if (!kr.error && Array.isArray(kr.data) && kr.data.length) {
        if (hasPassword() && cryptoOk()) {
          for (let i = 0; i < kr.data.length; i++) {
            const row = kr.data[i];
            try {
              const plain = await decryptText({ encrypted: row.encrypted_key, iv: row.iv, salt: row.salt });
              if (plain) { Store.state.chat.keys[row.provider] = plain; changed = true; }
            } catch (e) { console.warn('SB: API Key 解密失败，已跳过', row.provider); }
          }
        } else {
          console.warn('SB: 云端存在加密 API Key，本会话无密码无法解密，已跳过（重新登录后可同步）');
        }
      }
      // 4) 对话记录拉回合并（按 id 比对 updatedAt，新者胜）
      try { if (await pullChatConversations()) changed = true; } catch (e) { console.warn('SB 对话拉取跳过:', e); }
      // 5) App 书架拉回合并（安卓端收藏同步到网页书架）
      try { if (await pullAppBookshelf()) changed = true; } catch (e) { console.warn('SB App 书架拉取跳过:', e); }
      Store.state.user.lastSyncAt = Date.now();
      saveLocal();
      // 同步结果即时反映到界面
      if (changed) {
        if (typeof Theme !== 'undefined') Theme.apply(Store.state.settings.theme || 'dark');
        if (typeof Nav !== 'undefined' && Nav.render) Nav.render();
      }
      if (typeof ProfileModule !== 'undefined' && ProfileModule.renderProfile) ProfileModule.renderProfile();
      return { ok: true };
    } catch (e) {
      console.warn('SB firstSync failed:', e);
      return { ok: false, error: e };
    }
  }

  /* ---------- 阅读进度自动同步：书架（含 chapterIdx/pageIdx/lastRead）推送 ----------
   * 远端无专用表时存 user_data 通用行；任何失败都降级为本地保存，不报错。
   */
  async function pushReadShelf() {
    if (!canSync() || !Store.state.user.cloudSync) {
      console.log('[SB] pushReadShelf 跳过（未登录或未开启云同步），阅读进度仅本地保存');
      return { ok: false, skipped: true };
    }
    const uid = Store.state.user.id;
    const now = nowIso();
    // 通用同步表（module/key/value）：与安卓 App 共用，App 按 module='bookshelf' 拉取
    const rows = (Store.state.read.shelf || []).map(function(b) {
      return {
        user_id: uid,
        module: 'bookshelf',
        key: 'web|' + (b.source || '') + '|' + (b.id || b.url || b.title),
        value: {
          kind: b.type === 'comic' ? 'comic' : 'novel',
          title: b.title, author: b.author, cover: b.cover,
          sourceKey: b.source || '', url: b.url || '',
          chapterIdx: b.chapterIdx, pageIdx: b.pageIdx,
          chapterName: b.chapterName, lastRead: b.lastRead,
          platform: 'web'
        },
        updated_at: now
      };
    });
    try {
      if (!rows.length) return { ok: true, empty: true };
      const r = await client.from('user_data').upsert(rows, { onConflict: 'user_id,module,key' });
      if (r.error) {
        console.warn('[SB] 书架推送失败（远端可能无 user_data 表），已仅本地保存:', r.error.message || r.error);
        return { ok: false, error: r.error };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[SB] 书架推送异常，已仅本地保存:', e);
      return { ok: false, error: e };
    }
  }

  /* 拉取 App 端同步上来的书架（platform='app'），合并进网页书架；
   * 已存在（按 app|sourceKey|comicId 判重）则跳过；有新增返回 true */
  async function pullAppBookshelf() {
    if (!canSync() || !Store.state.user.cloudSync) return false;
    try {
      const r = await client.from('user_data').select('value')
        .eq('user_id', Store.state.user.id).eq('module', 'bookshelf').limit(1000);
      if (r.error || !Array.isArray(r.data)) return false;
      const shelf = Store.state.read.shelf || (Store.state.read.shelf = []);
      const exist = {};
      shelf.forEach(function(b) { if (b && b.id) exist[b.id] = true; });
      let changed = false;
      r.data.forEach(function(row) {
        const v = row.value;
        if (!v || v._deleted === true || v.platform !== 'app') return;
        const id = 'app|' + (v.sourceKey || '') + '|' + (v.comicId || '');
        if (!v.comicId || exist[id]) return;
        shelf.unshift({
          id: id, title: v.title || '未命名', author: v.author || '',
          cover: v.cover || '', type: 'comic-app', source: v.sourceKey || '',
          url: '', chapterIdx: 0, pageIdx: 0, chapterName: '',
          lastRead: v.time || '', fromApp: true
        });
        exist[id] = true;
        changed = true;
      });
      if (changed) {
        saveLocal();
        console.log('[SB] 从 App 书架拉取合并完成');
      }
      return changed;
    } catch (e) {
      console.warn('[SB] App 书架拉取异常:', e);
      return false;
    }
  }

  const Sync = { schedulePush: schedulePush, syncNow: syncNow, firstSync: firstSync, pushNow: pushNow, pushReadShelf: pushReadShelf, pullAppBookshelf: pullAppBookshelf };

  /* ==================== 设备错误日志上报 ====================
   * 开关开启时把本地未上报日志 insert 到 error_logs 表；
   * 表不存在/网络失败时静默保留本地（catch 不报错），成功后清空本地已上报。
   */
  async function uploadErrorLogs() {
    if (!Store.state.settings.errorLogEnabled) return { ok: false, skipped: true };
    if (!ready()) return { ok: false, error: new Error('sdk not ready') };
    const logs = Store.state.errorLog || [];
    if (!logs.length) return { ok: true, uploaded: 0 };
    const uid = (Store.state.user && Store.state.user.id) || null;
    const rows = logs.map(function(l) {
      return {
        user_id: uid,
        message: String(l.message || '').slice(0, 1000),
        stack: String(l.stack || '').slice(0, 4000),
        version: l.version || '',
        url: String(l.url || '').slice(0, 500),
        time: l.time ? new Date(l.time).toISOString() : nowIso()
      };
    });
    try {
      const r = await client.from('error_logs').insert(rows);
      if (r.error) {
        console.warn('[SB] 错误日志上传失败（远端可能无 error_logs 表），已保留本地:', r.error.message || r.error);
        return { ok: false, error: r.error };
      }
      Store.state.errorLog = [];
      saveLocal();
      return { ok: true, uploaded: rows.length };
    } catch (e) {
      console.warn('[SB] 错误日志上传异常，已保留本地:', e);
      return { ok: false, error: e };
    }
  }

  /* ==================== 对话记录云端持久化 ====================
   * user_data key='chat_conversations'；Store.save 后 5s 防抖推送；
   * 合并策略：按 id 比对 updatedAt，新者胜。仅登录且开启云同步时生效。
   */
  let chatPushTimer = null;
  let lastChatSig = '';   // 上次推送的对话签名（id+updatedAt），未变则跳过

  function chatSig(convs) {
    let s = '';
    for (let i = 0; i < convs.length; i++) {
      if (convs[i]) s += convs[i].id + ':' + (convs[i].updatedAt || 0) + ';';
    }
    return s;
  }

  function scheduleChatPush() {
    if (!canSync() || !Store.state.user.cloudSync) return;
    const convs = (Store.state.chat && Store.state.chat.conversations) || [];
    if (chatSig(convs) === lastChatSig) return;
    if (chatPushTimer) clearTimeout(chatPushTimer);
    chatPushTimer = setTimeout(function() {
      pushChatConversations().catch(function(e) { console.warn('SB 对话推送失败:', e); });
    }, 5000);
  }

  async function pushChatConversations() {
    if (!canSync() || !Store.state.user.cloudSync) return { ok: false, skipped: true };
    const convs = (Store.state.chat && Store.state.chat.conversations) || [];
    const sig = chatSig(convs);
    if (sig === lastChatSig) return { ok: true, skipped: true };
    let payload;
    try { payload = JSON.parse(JSON.stringify(convs)); } catch (e) { return { ok: false, error: e }; }
    try {
      const r = await client.from('user_data').upsert(
        { user_id: Store.state.user.id, module: 'chat', key: 'conversations', value: { conversations: payload }, updated_at: nowIso() },
        { onConflict: 'user_id,module,key' }
      );
      if (r.error) {
        console.warn('[SB] 对话推送失败（远端可能无 user_data 表）:', r.error.message || r.error);
        return { ok: false, error: r.error };
      }
      lastChatSig = sig;
      return { ok: true, bytes: JSON.stringify(payload).length };
    } catch (e) { return { ok: false, error: e }; }
  }

  /* 拉回云端对话并按 id/updatedAt 合并（新者胜）；有变更返回 true */
  async function pullChatConversations() {
    if (!canSync()) return false;
    const r = await client.from('user_data').select('value')
      .eq('user_id', Store.state.user.id).eq('module', 'chat').eq('key', 'conversations').maybeSingle();
    if (r.error || !r.data || !r.data.value || !Array.isArray(r.data.value.conversations)) return false;
    const remote = r.data.value.conversations;
    const local = (Store.state.chat && Store.state.chat.conversations) || [];
    const map = {};
    let changed = false;
    local.forEach(function(c) { if (c && c.id) map[c.id] = c; });
    remote.forEach(function(rc) {
      if (!rc || !rc.id) return;
      const lc = map[rc.id];
      if (!lc || (rc.updatedAt || 0) > (lc.updatedAt || 0)) { map[rc.id] = rc; changed = true; }
    });
    if (!changed) { lastChatSig = chatSig(local); return false; }
    const merged = Object.keys(map).map(function(k) { return map[k]; });
    merged.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    Store.state.chat.conversations = merged;
    lastChatSig = chatSig(merged);
    saveLocal();
    return true;
  }

  /* ==================== 设备管理 ====================
   * user_devices：device_id = 指纹（UA+屏幕+时区 简hash），登录后 upsert；
   * 心跳每 5 分钟刷 last_active/is_online（页面隐藏暂停）；
   * beforeunload 尽力置离线（keepalive fetch，可带 Authorization header）。
   */
  let hbTimer = null;
  let cachedToken = '';   // 访问令牌（仅内存，置离线 REST 用）

  function simpleHash(str) {
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) ^ c) >>> 0;
    }
    return h1.toString(16) + h2.toString(16);
  }

  function deviceFingerprint() {
    const parts = [
      navigator.userAgent || '',
      (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height + '@' + screen.colorDepth : ''),
      (typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : ''),
      navigator.language || ''
    ];
    return 'dev_' + simpleHash(parts.join('|'));
  }

  /* UA 解析：浏览器 + OS + 设备类型 */
  function parseDevice() {
    const ua = navigator.userAgent || '';
    let browser = '浏览器';
    if (ua.indexOf('Edg/') !== -1) browser = 'Edge';
    else if (ua.indexOf('Firefox/') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Chrome/') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Safari/') !== -1) browser = 'Safari';
    let os = '未知系统';
    if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    let type = 'desktop';
    if (/iPad|Tablet/.test(ua)) type = 'tablet';
    else if (/Mobile|iPhone|Android/.test(ua)) type = 'mobile';
    return { name: browser + ' · ' + os, type: type };
  }

  /* 本机设备指纹（缓存在 Store.state.auth.deviceId） */
  function currentDeviceId() {
    const box = Store.state.auth || (Store.state.auth = {});
    if (!box.deviceId) box.deviceId = deviceFingerprint();
    return box.deviceId;
  }

  /* 设备上限：会员（role 非 guest/user）20，其他 10 */
  function deviceLimit() {
    const role = (Store.state.user && Store.state.user.role) || 'guest';
    return (role !== 'guest' && role !== 'user') ? 20 : 10;
  }

  /* 公共 IP 与登录地点（ipwho.is → ipapi.co 兜底；失败返回 null，不影响注册） */
  let ipLocCache = null;
  async function fetchIpLocation() {
    if (ipLocCache) return ipLocCache;
    const tryFetch = async function(url, pick) {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 5000) : null;
      try {
        const resp = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
        if (!resp.ok) return null;
        return pick(await resp.json());
      } catch (e) { return null; }
      finally { if (timer) clearTimeout(timer); }
    };
    // 字符串拆分写法（'https:/' + '/...'）是为了让括号检查器不误判注释
    let got = await tryFetch('https:/' + '/ipwho.is/', function(j) {
      if (!j || j.success === false || !j.ip) return null;
      return { ip: j.ip, location: [j.country, j.region, j.city].filter(Boolean).join(' ') };
    });
    if (!got) got = await tryFetch('https:/' + '/ipapi.co/json/', function(j) {
      if (!j || !j.ip) return null;
      return { ip: j.ip, location: [j.country_name, j.region, j.city].filter(Boolean).join(' ') };
    });
    if (got) ipLocCache = got;
    return got;
  }

  /* 尽力上报本机 IP/登录地点（location 列不存在时降级只写 ip；全失败静默） */
  async function reportIpLocation(uid, fid) {
    try {
      const loc = await fetchIpLocation();
      if (!loc) return;
      const ur = await client.from('user_devices').update({ ip: loc.ip, location: loc.location })
        .eq('user_id', uid).eq('device_id', fid);
      if (ur.error) {
        await client.from('user_devices').update({ ip: loc.ip }).eq('user_id', uid).eq('device_id', fid);
      }
    } catch (e) {}
  }

  /* 登录后注册/刷新本机设备；超限自动清理最久未用的非当前设备 */
  async function registerDevice() {
    if (!canSync()) return { ok: false, skipped: true };
    const uid = Store.state.user.id;
    const fid = currentDeviceId();
    const info = parseDevice();
    try {
      const session = await Auth.getSession();
      if (session && session.access_token) cachedToken = session.access_token;
      const r = await client.from('user_devices').upsert({
        user_id: uid, device_id: fid,
        device_name: info.name, device_type: info.type,
        is_current: true, is_online: true, last_active: nowIso()
      }, { onConflict: 'user_id,device_id' });
      if (r.error) {
        console.warn('[SB] 设备注册失败（远端可能无 user_devices 表）:', r.error.message || r.error);
        return { ok: false, error: r.error };
      }
      reportIpLocation(uid, fid);   // 登录地点异步上报，不阻塞注册
      // 其他设备不再标记"当前"
      try {
        await client.from('user_devices').update({ is_current: false })
          .eq('user_id', uid).neq('device_id', fid);
      } catch (e) {}
      // 超限清理：按 last_active 升序，删最旧的非当前设备
      const lr = await client.from('user_devices').select('device_id,last_active')
        .eq('user_id', uid).order('last_active', { ascending: true });
      if (!lr.error && Array.isArray(lr.data)) {
        const extra = lr.data.length - deviceLimit();
        if (extra > 0) {
          const victims = lr.data.filter(function(d) { return d.device_id !== fid; }).slice(0, extra);
          for (let i = 0; i < victims.length; i++) {
            try {
              await client.from('user_devices').delete()
                .eq('user_id', uid).eq('device_id', victims[i].device_id);
            } catch (e) {}
          }
          if (victims.length && typeof Toast !== 'undefined' && Toast.show) Toast.show('已清理最久未用设备');
        }
      }
      return { ok: true };
    } catch (e) { console.warn('[SB] 设备注册异常:', e); return { ok: false, error: e }; }
  }

  async function listDevices() {
    if (!canSync()) return [];
    try {
      // select('*') 兼容 location 等可选列不存在的旧表结构
      const r = await client.from('user_devices')
        .select('*')
        .eq('user_id', Store.state.user.id)
        .order('last_active', { ascending: false });
      if (r.error || !Array.isArray(r.data)) return [];
      const fid = currentDeviceId();
      return r.data.map(function(d) {
        d.is_current = !!d.is_current || d.device_id === fid;
        return d;
      });
    } catch (e) { return []; }
  }

  /* 踢出设备（不允许踢本机） */
  async function removeDevice(deviceId) {
    if (!canSync()) return { ok: false };
    if (!deviceId || deviceId === currentDeviceId()) return { ok: false, error: new Error('不能踢出本机设备') };
    try {
      const r = await client.from('user_devices').delete()
        .eq('user_id', Store.state.user.id).eq('device_id', deviceId);
      if (r.error) return { ok: false, error: r.error };
      return { ok: true };
    } catch (e) { return { ok: false, error: e }; }
  }

  /* 信任设备开关（trusted=true；邮箱验证状态由服务端会话保证，UI 侧另行注明） */
  async function setDeviceTrusted(deviceId, trusted) {
    if (!canSync() || !deviceId) return { ok: false };
    try {
      const r = await client.from('user_devices').update({ trusted: !!trusted })
        .eq('user_id', Store.state.user.id).eq('device_id', deviceId);
      if (r.error) return { ok: false, error: r.error };
      // 本机信任态同步本地标记
      if (deviceId === currentDeviceId()) {
        const box = Store.state.auth || (Store.state.auth = {});
        box.trusted = !!trusted;
        saveLocal();
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e }; }
  }

  /* 心跳：每 5 分钟刷新 last_active/is_online；页面隐藏时暂停，回前台立即补一次 */
  async function heartbeatBeat() {
    if (!canSync() || document.hidden) return;
    try {
      const session = await Auth.getSession();
      if (session && session.access_token) cachedToken = session.access_token;
      await client.from('user_devices').update({ is_online: true, last_active: nowIso() })
        .eq('user_id', Store.state.user.id).eq('device_id', currentDeviceId());
    } catch (e) {}
  }

  function startHeartbeat() {
    stopHeartbeat();
    if (!canSync()) return;
    hbTimer = setInterval(heartbeatBeat, 5 * 60 * 1000);
  }

  function stopHeartbeat() {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  }

  /* 退出/关闭页面时尽力置离线：keepalive fetch（可带 header），失败静默 */
  function markOfflineBest() {
    try {
      if (typeof Store === 'undefined' || !Store.state.user || !Store.state.user.id || !cachedToken) return;
      const url = SUPABASE_URL + '/rest/v1/user_devices?user_id=eq.' + encodeURIComponent(Store.state.user.id) +
                  '&device_id=eq.' + encodeURIComponent(currentDeviceId());
      fetch(url, {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + cachedToken,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ is_online: false, last_active: nowIso() })
      }).catch(function() {});
    } catch (e) {}
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && hbTimer) heartbeatBeat();
    });
  }
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', markOfflineBest);

  /* ==================== 云同步 diff（确认弹层用） ==================== */
  function diffCount(localObj, remoteObj) {
    const out = { added: 0, changed: 0, removed: 0 };
    const lo = localObj || {}, ro = remoteObj || {};
    Object.keys(lo).forEach(function(k) {
      if (!(k in ro)) out.added++;
      else if (JSON.stringify(lo[k]) !== JSON.stringify(ro[k])) out.changed++;
    });
    Object.keys(ro).forEach(function(k) { if (!(k in lo)) out.removed++; });
    return out;
  }

  /* 拉远端 user_settings + user_data，与本地做条目级对比（书架每本书、对话每个会话为一条） */
  async function computeDiff() {
    if (!canSync()) return null;
    const uid = Store.state.user.id;
    let remoteSettings = {};
    try {
      const r = await client.from('user_settings').select('settings').eq('user_id', uid).maybeSingle();
      if (!r.error && r.data && r.data.settings) remoteSettings = r.data.settings;
    } catch (e) {}

    // 本地条目：书架按 source|id 一书一条（比进度字段），对话按会话 id 一条（比 updatedAt）
    const localData = {};
    (Store.state.read.shelf || []).forEach(function(b) {
      localData['书架|' + (b.source || '') + '|' + (b.id || b.url || b.title)] =
        { chapterIdx: b.chapterIdx, pageIdx: b.pageIdx, lastRead: b.lastRead };
    });
    ((Store.state.chat && Store.state.chat.conversations) || []).forEach(function(c) {
      if (c && c.id) localData['对话|' + c.id] = { updatedAt: c.updatedAt || 0 };
    });

    const remoteData = {};
    try {
      const r = await client.from('user_data').select('module,key,value').eq('user_id', uid).in('module', ['bookshelf', 'chat']);
      if (!r.error && Array.isArray(r.data)) {
        r.data.forEach(function(row) {
          if (row.module === 'bookshelf') {
            const v = row.value || {};
            // key 形如 'web|source|id'（App 端为其它平台前缀），去掉平台段后与本地对齐
            const parts = String(row.key || '').split('|');
            const bare = parts.length >= 3 ? parts.slice(1).join('|') : String(row.key || '');
            remoteData['书架|' + bare] = { chapterIdx: v.chapterIdx, pageIdx: v.pageIdx, lastRead: v.lastRead };
          } else if (row.module === 'chat') {
            ((row.value && row.value.conversations) || []).forEach(function(c) {
              if (c && c.id) remoteData['对话|' + c.id] = { updatedAt: c.updatedAt || 0 };
            });
          }
        });
      }
    } catch (e) {}
    return {
      settings: diffCount(pickSettings(), remoteSettings),
      data: diffCount(localData, remoteData)
    };
  }

  /* ==================== 云端代理用量 ====================
   * 近 30 天 token_usage 合计；表/列不存在（代理维度未上线）返回 null。
   */
  async function getProxyUsage() {
    if (!canSync()) return null;
    try {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const r = await client.from('token_usage').select('*')
        .eq('user_id', Store.state.user.id).gte('created_at', since).limit(1000);
      if (r.error || !Array.isArray(r.data)) return null;
      let sum = 0;
      r.data.forEach(function(row) {
        const v = row.tokens !== undefined ? row.tokens : (row.count !== undefined ? row.count : row.amount);
        sum += Number(v) || 0;
      });
      return sum;
    } catch (e) { return null; }
  }

  const Devices = {
    register: registerDevice,
    list: listDevices,
    remove: removeDevice,
    setTrusted: setDeviceTrusted,
    startHeartbeat: startHeartbeat,
    stopHeartbeat: stopHeartbeat,
    markOffline: markOfflineBest,
    currentId: currentDeviceId,
    limit: deviceLimit
  };

  /* ==================== 启动恢复 ====================
   * app 启动时调用：getSession 有效则自动恢复登录态 + 后台 firstSync（不阻塞首屏）
   */
  async function restoreSession() {
    if (!ready()) return false;
    const session = await Auth.getSession();
    if (!session || !session.user) return false;
    const u = Store.state.user;
    u.id = session.user.id;
    u.isLogged = true;
    u.email = session.user.email || u.email || '';
    const meta = session.user.user_metadata || {};
    if (!u.nickname) u.nickname = meta.name || meta.nickname || (u.email ? u.email.split('@')[0] : '');
    if (!u.username) u.username = u.nickname;
    saveLocal();
    // 后台首次同步，不阻塞首屏
    firstSync().catch(function() {});
    // 注册本机设备 + 启动心跳（不阻塞）
    registerDevice().catch(function() {});
    startHeartbeat();
    return true;
  }

  /* ---------- Hook：Store.save 后防抖推送（登录且开启云同步时生效） ---------- */
  if (typeof Store !== 'undefined' && Store.save) {
    const _origSave = Store.save;
    Store.save = function() {
      _origSave.apply(Store, arguments);
      if (!suppress) {
        schedulePush();
        scheduleChatPush();   // 对话记录 5s 防抖推送（内容未变内部跳过）
      }
    };
  }

  return {
    ready: ready,
    errMsg: errMsg,
    Auth: Auth,
    Sync: Sync,
    setPassword: setPassword,
    clearPassword: clearPassword,
    hasPassword: hasPassword,
    verifyCard: verifyCard,
    redeemCard: redeemCard,
    getMembership: getMembership,
    pullProfile: pullProfile,
    pushReadShelf: pushReadShelf,
    uploadErrorLogs: uploadErrorLogs,
    restoreSession: restoreSession,
    Devices: Devices,
    registerDevice: registerDevice,
    computeDiff: computeDiff,
    getProxyUsage: getProxyUsage,
    pushChatConversations: pushChatConversations,
    pullChatConversations: pullChatConversations,
    _deriveKey: deriveKey
  };
})();
