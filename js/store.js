/* ==================== OmniHub Store - 数据层 ==================== */

const Store = (() => {
  'use strict';

  const KEY = 'omnihub_v7';

  const DEFAULT_STATE = {
    // 全局
    version: '7.0',
    lastSeenVersion: '',     // 已读公告的版本号
    theme: 'dark',
    language: 'zh-CN',
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
      conversations: []   // [{id,title,messages:[{id,role,content,image,images,files,thinking,ts}],createdAt,updatedAt}]
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
      lastSyncAt: 0
    },

    // 全局设置
    settings: {
      fabPosition: { x: null, y: null },  // null = 默认右下角
      fabSnap: true,                       // 是否吸附边缘
      notifications: true,
      autoSync: false
    }
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return deepClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      // 合并默认值（新字段兼容）
      return mergeDeep(deepClone(DEFAULT_STATE), parsed);
    } catch(e) {
      console.error('Store load error:', e);
      return deepClone(DEFAULT_STATE);
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch(e) {
      console.error('Store save error:', e);
    }
  }

  function patch(obj) {
    state = mergeDeep(state, obj);
    save();
  }

  function reset() {
    state = deepClone(DEFAULT_STATE);
    save();
  }

  function exportData() {
    return JSON.stringify(state, null, 2);
  }

  function importData(json) {
    try {
      const data = JSON.parse(json);
      state = mergeDeep(deepClone(DEFAULT_STATE), data);
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

  return { get state() { return state; }, save, patch, reset, exportData, importData, deepClone };
})();
