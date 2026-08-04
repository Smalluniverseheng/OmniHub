/* ==================== OmniHub Store - 数据层 ==================== */
/* v8.2 升级：
   1) Store.subscribe(path, cb)：支持 'a.b.*' 通配与 'a.b.c' 精确订阅，
      在 patch/save 时按变化的顶层路径通知（save 时与上次快照做顶层 diff）。
   2) Store.save() 改为 500ms 防抖写入 localStorage；Store.flush() 立即写入。
      关键动作后可手动 Store.flush() 保证落盘。
   3) theme/language 统一以 settings.theme/settings.language 为准：
      顶层 theme/language 仅在加载时迁移一次，之后以不可枚举的兼容访问器
      （getter/setter 代理到 settings.*）保留，避免双写不一致。 */

const Store = (() => {
  'use strict';

  const KEY = 'omnihub_v7';
  const SAVE_DEBOUNCE = 500;  // 持久化防抖 500ms

  const DEFAULT_STATE = {
    // 全局
    version: '7.0',
    lastSeenVersion: '',     // 已读公告的版本号
    theme: 'dark',           // 兼容旧字段：加载时迁移到 settings.theme 后仅作访问器代理
    language: 'zh-CN',       // 兼容旧字段：加载时迁移到 settings.language 后仅作访问器代理
    homePage: 'profile',  // 默认主页

    // 导航栏
    navItems: [
      { id: 'profile', name: '我的', icon: '⌂', enabled: true, order: 0, fixed: true }
    ],

    // 模块数据
    modules: {
      profile: { enabled: true, data: {} },
      read: { enabled: false, data: {} },
      chat: { enabled: false, data: {} }
    },

    // 阅读模块
    read: {
      sources: [],        // 书源列表
      shelf: [],          // 书架 [{id, title, author, cover, type:'novel'|'comic', url, source, chapterIdx, pageIdx, chapterName, lastRead}]
      history: [],        // 阅读历史
      trash: [],          // 回收站 [{kind:'book'|'source', item:{...}, deletedAt}] 15 天过期自动清除
      settings: {
        readerMode: 'gallery-rtl',
        preloadCount: 3,
        fontSize: 16,
        lineHeight: 1.6,
        background: '#000'
      }
    },

    // 对话模块
    chat: {
      keys: {},           // { keySlug: apiKey }
      customBase: '',     // 自定义接口地址
      customModel: '',    // 自定义模型名
      provider: 'openai',
      model: 'gpt-4o-mini',
      mode: 'chat',       // 'chat' | 'image'
      temperature: 0.7,
      maxTokens: 4096,
      presets: [],        // 常用语 [{id,title,content}]
      thinkingEnabled: false, // 深度思考开关
      voice: {            // 语音播报设置
        engine: 'browser',  // 'browser' | 'openai'
        voiceURI: '',       // 浏览器引擎音色
        ttsVoice: 'alloy',  // OpenAI TTS 音色
        rate: 1,            // 语速 0.5-2
        autoSpeak: false    // AI 回复完成自动朗读
      },
      conversations: [],  // [{id,title,messages:[{id,role,content,image,images,files,thinking,ts}],createdAt,updatedAt}]
      trash: []           // 对话回收站 [{...conv, deletedAt}] 15 天过期自动清除
    },

    // 会员/账号
    user: {
      isLogged: false,
      username: '',
      email: '',
      token: '',
      memberLevel: 0,   // 0=免费, 1=普通会员, 2=高级会员（旧字段兼容）
      memberExpire: 0,
      cloudSync: false,
      id: '',              // Supabase 用户 ID
      nickname: '',
      role: 'guest',       // guest/user/advanced/vip/agent/admin
      plan: '',
      planExpiresAt: 0,
      balance: 0,
      storageUsedMb: 0,
      storageQuotaMb: 0,
      isAdmin: false,
      lastSyncAt: 0,
      avatar: ''           // 头像（Base64 dataURL 或空）
    },

    // 设备错误日志（上限 50 条）
    errorLog: [],

    // 全局设置
    settings: {
      theme: 'dark',                       // 主题（唯一权威来源）：dark/light/system
      language: 'zh-CN',                   // 语言（唯一权威来源）：zh-CN/en/fr/ru/es/ar
      fabPosition: { x: null, y: null },  // null = 默认右下角
      fabSnap: true,                       // 是否吸附边缘
      notifications: true,
      autoSync: false,
      errorLogEnabled: false,   // 设备日志自动上报开关
      aiLogAssist: false,       // AI 对话辅助诊断：把近期错误日志附给 AI
      disclaimerAgreed: false   // 首次打开免责声明是否已同意
    }
  };

  let state = load();

  // ---- 订阅机制：path 支持 'a.b.*' 通配与 'a.b.c' 精确 ----
  var subscribers = [];        // [{path, cb}]
  var snapshot = {};           // 顶层键 -> JSON 字符串，用于 save 时 diff
  var saveTimer = null;        // 防抖计时器

  function load() {
    var loaded;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        loaded = deepClone(DEFAULT_STATE);
      } else {
        const parsed = JSON.parse(raw);
        // 合并默认值（新字段兼容）
        loaded = mergeDeep(deepClone(DEFAULT_STATE), parsed);
        migrateThemeLanguage(loaded, parsed);
      }
    } catch(e) {
      console.error('Store load error:', e);
      loaded = deepClone(DEFAULT_STATE);
    }
    installCompatAccessors(loaded);
    return loaded;
  }

  // 顶层 theme/language 迁移一次：settings.* 缺失时以旧顶层值补齐，之后 settings.* 为唯一权威
  function migrateThemeLanguage(merged, parsed) {
    if (!parsed || typeof parsed !== 'object') return;
    var parsedSettings = parsed.settings || {};
    if (parsedSettings.theme === undefined && typeof parsed.theme === 'string') {
      merged.settings.theme = parsed.theme;
    }
    if (parsedSettings.language === undefined && typeof parsed.language === 'string') {
      merged.settings.language = parsed.language;
    }
  }

  // 顶层 theme/language 兼容访问器（不可枚举：JSON.stringify / 展开运算符均忽略，杜绝双写入盘）
  function installCompatAccessors(target) {
    ['theme', 'language'].forEach(function(k) {
      try { delete target[k]; } catch (e) {}
      Object.defineProperty(target, k, {
        enumerable: false,
        configurable: true,
        get: function() { return target.settings[k]; },
        set: function(v) { target.settings[k] = v; }
      });
    });
  }

  // ---- 持久化：save 防抖 + flush 立即写 ----
  function writeNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch(e) {
      console.error('Store save error:', e);
    }
  }

  function save() {
    notifyByDiff();  // 先按顶层 diff 通知订阅者（与落盘解耦，通知不防抖）
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      saveTimer = null;
      writeNow();
    }, SAVE_DEBOUNCE);
  }

  function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    writeNow();
  }

  // ---- 订阅通知 ----
  function snapshotAll() {
    var snap = {};
    for (var k in state) {
      if (!Object.prototype.hasOwnProperty.call(state, k)) continue;
      try { snap[k] = JSON.stringify(state[k]); } catch (e) { snap[k] = ''; }
    }
    return snap;
  }

  // 与上次快照比较，返回变化的顶层键数组
  function diffTopKeys() {
    var changed = [];
    for (var k in state) {
      if (!Object.prototype.hasOwnProperty.call(state, k)) continue;
      var cur;
      try { cur = JSON.stringify(state[k]); } catch (e) { cur = ''; }
      if (snapshot[k] !== cur) changed.push(k);
    }
    return changed;
  }

  function getByPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '*') break;
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // 订阅路径是否关注某个顶层键：'a.b.*' / 'a.b.c' 的首段匹配，'*' 匹配全部
  function matchTop(subPath, topKey) {
    if (subPath === '*') return true;
    return subPath.split('.')[0] === topKey;
  }

  function notify(changedTopKeys) {
    if (!changedTopKeys || !changedTopKeys.length) return;
    for (var i = 0; i < subscribers.length; i++) {
      var sub = subscribers[i];
      for (var j = 0; j < changedTopKeys.length; j++) {
        var topKey = changedTopKeys[j];
        if (!matchTop(sub.path, topKey)) continue;
        try {
          sub.cb(getByPath(state, sub.path), sub.path, topKey);
        } catch (e) {
          console.error('[Store] 订阅回调失败 (' + sub.path + '):', e);
        }
        break;  // 同一订阅者一次通知只触发一回
      }
    }
  }

  function notifyByDiff() {
    var changed = diffTopKeys();
    snapshot = snapshotAll();
    notify(changed);
  }

  // 订阅状态变化；返回取消订阅函数
  function subscribe(path, cb) {
    if (!path || typeof cb !== 'function') return function() {};
    var entry = { path: path, cb: cb };
    subscribers.push(entry);
    return function unsubscribe() {
      var idx = subscribers.indexOf(entry);
      if (idx >= 0) subscribers.splice(idx, 1);
    };
  }

  function patch(obj) {
    if (!obj || typeof obj !== 'object') return;
    // 顶层 theme/language 统一改写进 settings.*，杜绝双写不一致
    var normalized = {};
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      normalized[k] = obj[k];
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'theme')) {
      if (!normalized.settings) normalized.settings = {};
      normalized.settings.theme = normalized.theme;
      delete normalized.theme;
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'language')) {
      if (!normalized.settings) normalized.settings = {};
      normalized.settings.language = normalized.language;
      delete normalized.language;
    }
    state = mergeDeep(state, normalized);
    installCompatAccessors(state);  // mergeDeep 产生新对象，需重新挂兼容访问器
    var changed = Object.keys(normalized);
    snapshot = snapshotAll();       // patch 的变化已明确，直接更新快照避免 save 重复通知
    notify(changed);
    save();                         // 防抖落盘（save 内 diff 已无变化，不会二次通知）
  }

  function reset() {
    state = deepClone(DEFAULT_STATE);
    installCompatAccessors(state);
    snapshot = snapshotAll();
    notify(Object.keys(state));
    save();
  }

  function exportData() {
    return JSON.stringify(state, null, 2);
  }

  function importData(json) {
    try {
      const data = JSON.parse(json);
      state = mergeDeep(deepClone(DEFAULT_STATE), data);
      migrateThemeLanguage(state, data);
      installCompatAccessors(state);
      snapshot = snapshotAll();
      notify(Object.keys(state));
      save();
      return true;
    } catch(e) {
      return false;
    }
  }

  // 工具函数
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDeep(target, source) {
    if (!source || typeof source !== 'object') return target;
    const result = Array.isArray(target) ? [...target] : { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // 初始化快照（load 完成后）
  snapshot = snapshotAll();

  // 页面隐藏/关闭前强制落盘，避免防抖窗口内丢数据
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

  // 重新加载（丢弃内存态，从 localStorage 恢复；供外部显式调用）
  function reload() {
    state = load();
    snapshot = snapshotAll();
    return state;
  }

  return { get state() { return state; }, save, flush, patch, reset, exportData, importData, subscribe, load: reload, deepClone };
})();
