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

  /* 推送：设置白名单 → user_settings；API Key 加密 → encrypted_api_keys */
  async function pushNow() {
    if (!canSync() || !Store.state.user.cloudSync) return { ok: false, skipped: true };
    const uid = Store.state.user.id;
    let err = null;
    // 1) 设置白名单
    try {
      const r = await client.from('user_settings').upsert(
        { user_id: uid, settings: pickSettings(), updated_at: nowIso() },
        { onConflict: 'user_id' }
      );
      if (r.error) err = r.error;
    } catch (e) { err = e; }
    // 2) API Keys 加密上传（密码派生密钥可用时；刷新后未输密码则跳过）
    if (hasPassword() && cryptoOk()) {
      const keys = Store.state.chat.keys || {};
      const slugs = Object.keys(keys).filter(function(k) { return typeof keys[k] === 'string' && keys[k].trim(); });
      for (let i = 0; i < slugs.length; i++) {
        const provider = slugs[i];
        try {
          const box = await encryptText(keys[provider].trim());
          if (!box) break;
          const r = await client.from('encrypted_api_keys').upsert({
            user_id: uid, provider: provider,
            encrypted_key: box.encrypted, iv: box.iv, salt: box.salt,
            updated_at: nowIso()
          }, { onConflict: 'user_id,provider' });
          if (r.error && !err) err = r.error;
        } catch (e) { if (!err) err = e; }
      }
    }
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

  const Sync = { schedulePush: schedulePush, syncNow: syncNow, firstSync: firstSync, pushNow: pushNow };

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
    return true;
  }

  /* ---------- Hook：Store.save 后防抖推送（登录且开启云同步时生效） ---------- */
  if (typeof Store !== 'undefined' && Store.save) {
    const _origSave = Store.save;
    Store.save = function() {
      _origSave.apply(Store, arguments);
      if (!suppress) schedulePush();
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
    restoreSession: restoreSession,
    _deriveKey: deriveKey
  };
})();
