/* ==================== OmniHub AI Providers - 厂商配置 ==================== */

const AIProviders = (() => {
  'use strict';

  const PROVIDERS = [
    {
      name: 'OpenAI',
      format: 'openai',
      base: 'https://api.openai.com',
      keySlug: 'openai',
      color: '#10A37F',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
      imageModel: 'dall-e-3'
    },
    {
      name: 'DeepSeek',
      format: 'openai',
      base: 'https://api.deepseek.com',
      keySlug: 'deepseek',
      color: '#4D6BFE',
      models: ['deepseek-chat', 'deepseek-reasoner']
    },
    {
      name: 'Kimi',
      format: 'openai',
      base: 'https://api.moonshot.cn',
      keySlug: 'kimi',
      color: '#5B8FF9',
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-0905-preview']
    },
    {
      name: '通义千问',
      format: 'openai',
      base: 'https://dashscope.aliyuncs.com/compatible-mode',
      keySlug: 'qwen',
      color: '#615CED',
      models: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
      imageModel: 'wanx2.1-t2i-turbo'
    },
    {
      name: '智谱AI',
      format: 'openai',
      base: 'https://open.bigmodel.cn/api/paas',
      keySlug: 'zhipu',
      color: '#2E6BFF',
      models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
      imageModel: 'cogview-3-plus'
    },
    {
      name: '火山引擎',
      format: 'openai',
      base: 'https://ark.cn-beijing.volces.com/api/v3',
      keySlug: 'volcengine',
      color: '#FF7A00',
      models: ['doubao-seed-1-6-250615', 'doubao-1-5-pro-32k-250115'],
      imageModel: 'doubao-seedream-3-0-t2i-250415'
    },
    {
      name: 'xAI',
      format: 'openai',
      base: 'https://api.x.ai',
      keySlug: 'xai',
      color: '#D0D0D0',
      models: ['grok-3', 'grok-3-mini']
    },
    {
      name: 'Groq',
      format: 'openai',
      base: 'https://api.groq.com/openai',
      keySlug: 'groq',
      color: '#F55036',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
    },
    {
      name: 'Anthropic',
      format: 'anthropic',
      base: 'https://api.anthropic.com',
      keySlug: 'anthropic',
      color: '#D97757',
      models: ['claude-sonnet-4-5', 'claude-haiku-4-5']
    },
    {
      name: 'Google',
      format: 'google',
      base: 'https://generativelanguage.googleapis.com',
      keySlug: 'google',
      color: '#4285F4',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro']
    },
    {
      name: '自定义',
      format: 'openai',
      base: '',
      keySlug: 'custom',
      color: '#8B5CF6',
      models: [],
      custom: true
    }
  ];

  function list() {
    return PROVIDERS.slice();
  }

  function get(keySlug) {
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].keySlug === keySlug) return PROVIDERS[i];
    }
    return null;
  }

  // p: provider 对象；model/apiKey 仅 google 流式地址需要
  function chatCompletionsUrl(p, model, apiKey) {
    if (!p) return '';
    if (p.format === 'anthropic') return p.base + '/v1/messages';
    if (p.format === 'google') {
      return p.base + '/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + apiKey;
    }
    return p.base + '/v1/chat/completions';
  }

  function headers(p, apiKey) {
    var h = { 'Content-Type': 'application/json' };
    if (!p) return h;
    if (p.format === 'anthropic') {
      h['x-api-key'] = apiKey || '';
      h['anthropic-version'] = '2023-06-01';
      h['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (p.format === 'google') {
      // google 通过 URL key 参数鉴权
    } else {
      if (apiKey) h['Authorization'] = 'Bearer ' + apiKey;
    }
    return h;
  }

  // aiBeta 模型目录厂商名 → OmniHub 厂商 keySlug 映射
  // 与 AIProviders.name 一致的直接命中；别名归入就近厂商；其余归 'custom'
  const MODEL_PROVIDER_MAP = {
    '月之暗面': 'kimi',
    '字节跳动': 'volcengine'
  };

  function mapModelProvider(name) {
    if (!name) return 'custom';
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].name === name) return PROVIDERS[i].keySlug;
    }
    if (MODEL_PROVIDER_MAP[name]) return MODEL_PROVIDER_MAP[name];
    return 'custom';
  }

  // 按 API Key 前缀猜测厂商（下拉默认选中项）
  function guessKeyProvider(apiKey) {
    var key = String(apiKey || '').trim();
    if (/^sk-ant-/i.test(key)) return 'anthropic';
    if (/^AIza/.test(key)) return 'google';
    if (/^gsk_/.test(key)) return 'groq';
    if (/^xai-/i.test(key)) return 'xai';
    if (/^sk-/i.test(key)) return 'openai';
    return 'openai';
  }

  return { list, get, chatCompletionsUrl, headers, mapModelProvider, guessKeyProvider };
})();
