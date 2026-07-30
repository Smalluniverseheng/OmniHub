/* ==================== OmniHub AI API - 请求层 ==================== */

const AIAPI = (() => {
  'use strict';

  // 统一错误处理：HTTP 非 200 读出 body 文本截取 200 字抛错
  async function checkResponse(res) {
    if (!res.ok) {
      var text = '';
      try { text = await res.text(); } catch (e) { /* ignore */ }
      throw new Error('HTTP ' + res.status + ': ' + (text || res.statusText || '请求失败').slice(0, 200));
    }
    return res;
  }

  function buildBody(p, opts, stream) {
    var format = p.format || 'openai';
    var messages = opts.messages || [];
    var i;

    if (format === 'anthropic') {
      var sysParts = [];
      var msgs = [];
      for (i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.role === 'system') sysParts.push(m.content);
        else msgs.push({ role: m.role, content: m.content });
      }
      var abody = {
        model: opts.model,
        max_tokens: opts.maxTokens || 4096,
        stream: !!stream,
        messages: msgs
      };
      if (sysParts.length) abody.system = sysParts.join('\n');
      return abody;
    }

    if (format === 'google') {
      var contents = [];
      var gSys = [];
      for (i = 0; i < messages.length; i++) {
        var gm = messages[i];
        if (gm.role === 'system') { gSys.push(gm.content); continue; }
        contents.push({
          role: gm.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: gm.content }]
        });
      }
      var gbody = { contents: contents };
      if (gSys.length) gbody.systemInstruction = { parts: [{ text: gSys.join('\n') }] };
      return gbody;
    }

    // openai 兼容
    var obody = {
      model: opts.model,
      messages: messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: !!stream
    };
    if (stream) obody.stream_options = { include_usage: true };
    return obody;
  }

  function buildUrl(p, opts, stream) {
    if (p.format === 'google') {
      var method = stream ? ':streamGenerateContent?alt=sse&key=' : ':generateContent?key=';
      return p.base + '/v1beta/models/' + opts.model + method + opts.apiKey;
    }
    return AIProviders.chatCompletionsUrl(p);
  }

  // 从 SSE data 载荷提取增量文本与 usage
  function extractDelta(format, json) {
    var text = '';
    var usage = null;
    try {
      if (format === 'anthropic') {
        if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
          text = json.delta.text;
        }
        if (json.type === 'message_delta' && json.usage) usage = json.usage;
        if (json.type === 'message_start' && json.message && json.message.usage) usage = json.message.usage;
      } else if (format === 'google') {
        var cands = json.candidates;
        if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
          var parts = cands[0].content.parts;
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].text) text += parts[i].text;
          }
        }
        if (json.usageMetadata) usage = json.usageMetadata;
      } else {
        var choices = json.choices;
        if (choices && choices[0] && choices[0].delta && choices[0].delta.content) {
          text = choices[0].delta.content;
        }
        if (json.usage) usage = json.usage;
      }
    } catch (e) { /* ignore parse issues */ }
    return { text: text, usage: usage };
  }

  // 流式对话
  // opts = { provider, model, apiKey, messages, temperature, maxTokens, onChunk, signal }
  async function chat(opts) {
    var p = opts.provider;
    var format = p.format || 'openai';
    var url = buildUrl(p, opts, true);
    var body = buildBody(p, opts, true);

    var res = await fetch(url, {
      method: 'POST',
      headers: AIProviders.headers(p, opts.apiKey),
      body: JSON.stringify(body),
      signal: opts.signal
    });
    await checkResponse(res);

    var reader = res.body.getReader();
    var decoder = new TextDecoder('utf-8');
    var buffer = '';
    var full = '';
    var usage = null;
    var timedOut = false;

    // 30 秒无数据 watchdog
    var watchdog = null;
    function resetWatchdog() {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(function() {
        timedOut = true;
        try { reader.cancel(); } catch (e) { /* ignore */ }
      }, 30000);
    }
    resetWatchdog();

    try {
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        resetWatchdog();
        buffer += decoder.decode(chunk.value, { stream: true });

        var lines = buffer.split('\n');
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.indexOf('data:') !== 0) continue;
          var payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          var json = null;
          try { json = JSON.parse(payload); } catch (e) { continue; }
          var d = extractDelta(format, json);
          if (d.usage) usage = d.usage;
          if (d.text) {
            full += d.text;
            if (typeof opts.onChunk === 'function') opts.onChunk(full);
          }
        }
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }

    if (timedOut) throw new Error('响应超时：30 秒未收到数据');
    return { content: full, usage: usage };
  }

  // 非流式降级
  async function chatSync(opts) {
    var p = opts.provider;
    var format = p.format || 'openai';
    var url = buildUrl(p, opts, false);
    var body = buildBody(p, opts, false);

    var res = await fetch(url, {
      method: 'POST',
      headers: AIProviders.headers(p, opts.apiKey),
      body: JSON.stringify(body),
      signal: opts.signal
    });
    await checkResponse(res);
    var json = await res.json();

    var content = '';
    var usage = null;
    if (format === 'anthropic') {
      if (json.content) {
        for (var i = 0; i < json.content.length; i++) {
          if (json.content[i].type === 'text') content += json.content[i].text;
        }
      }
      usage = json.usage || null;
    } else if (format === 'google') {
      var cands = json.candidates;
      if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
        var parts = cands[0].content.parts;
        for (var j = 0; j < parts.length; j++) {
          if (parts[j].text) content += parts[j].text;
        }
      }
      usage = json.usageMetadata || null;
    } else {
      if (json.choices && json.choices[0] && json.choices[0].message) {
        content = json.choices[0].message.content || '';
      }
      usage = json.usage || null;
    }
    return { content: content, usage: usage };
  }

  // 图片生成
  // opts = { provider, prompt, apiKey, size }
  async function generateImage(opts) {
    var p = opts.provider;
    if (!p || !p.imageModel) throw new Error('当前厂商不支持图片生成');
    var url = p.base + '/v1/images/generations';
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (opts.apiKey || '')
      },
      body: JSON.stringify({
        model: p.imageModel,
        prompt: opts.prompt,
        n: 1,
        size: opts.size || '1024x1024'
      }),
      signal: opts.signal
    });
    await checkResponse(res);
    var json = await res.json();
    var item = json && json.data && json.data[0];
    if (!item) throw new Error('图片生成返回格式异常');
    if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
    if (item.url) return item.url;
    throw new Error('图片生成返回格式异常');
  }

  // Key 有效性检测：拉取该厂商 models 列表验证
  // provider 可为 keySlug 或 provider 对象；customBase 可选（覆盖官方地址）
  // 返回 { ok, models?: [...], error? }
  async function validateKey(provider, apiKey, customBase) {
    var p = typeof provider === 'string' ? AIProviders.get(provider) : provider;
    if (!p) return { ok: false, error: '未知厂商' };
    var key = String(apiKey || '').trim();
    if (!key) return { ok: false, error: '请填写 API Key' };
    var base = String(customBase || p.base || '').replace(/\/+$/, '');
    if (!base) return { ok: false, error: '请填写接口地址' };

    var url;
    var headers = {};
    if (p.format === 'anthropic') {
      url = base + '/v1/models';
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    } else if (p.format === 'google') {
      url = base + '/v1beta/models?key=' + encodeURIComponent(key);
    } else {
      // openai 兼容：base 已含 /v3、/v4 等版本路径时直接拼 /models
      url = /\/v\d+$/.test(base) ? base + '/models' : base + '/v1/models';
      headers['Authorization'] = 'Bearer ' + key;
    }

    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 12000);
    try {
      var res = await fetch(url, { method: 'GET', headers: headers, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        var text = '';
        try { text = await res.text(); } catch (e) { /* ignore */ }
        return { ok: false, error: 'HTTP ' + res.status + (text ? '：' + text.slice(0, 120) : '') };
      }
      var json = await res.json();
      var models = [];
      var i;
      if (json && json.data) {
        for (i = 0; i < json.data.length; i++) {
          if (json.data[i] && json.data[i].id) models.push(json.data[i].id);
        }
      } else if (json && json.models) {
        for (i = 0; i < json.models.length; i++) {
          if (json.models[i] && json.models[i].name) models.push(json.models[i].name);
        }
      }
      return { ok: true, models: models };
    } catch (e) {
      clearTimeout(timer);
      var reason = (e && e.name === 'AbortError') ? '请求超时' : ((e && e.message) || '网络错误');
      return { ok: false, error: reason };
    }
  }

  return { chat, chatSync, generateImage, validateKey };
})();
