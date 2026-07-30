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

  // dataURL → { mime, data }（base64 拆分，供 anthropic / google 使用）
  function splitDataUrl(dataUrl) {
    var m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) return { mime: 'image/jpeg', data: '' };
    return { mime: m[1], data: m[2] };
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
        if (m.role === 'system') { sysParts.push(m.content); continue; }
        if (m.images && m.images.length) {
          // 图片消息：content 数组 = image(base64) + text
          var cparts = [];
          for (var ai = 0; ai < m.images.length; ai++) {
            var sp = splitDataUrl(m.images[ai]);
            cparts.push({ type: 'image', source: { type: 'base64', media_type: sp.mime, data: sp.data } });
          }
          cparts.push({ type: 'text', text: m.content || '' });
          msgs.push({ role: m.role, content: cparts });
        } else {
          msgs.push({ role: m.role, content: m.content });
        }
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
        var gparts = [];
        if (gm.images && gm.images.length) {
          for (var gi = 0; gi < gm.images.length; gi++) {
            var gsp = splitDataUrl(gm.images[gi]);
            gparts.push({ inline_data: { mime_type: gsp.mime, data: gsp.data } });
          }
        }
        gparts.push({ text: gm.content || '' });
        contents.push({
          role: gm.role === 'assistant' ? 'model' : 'user',
          parts: gparts
        });
      }
      var gbody = { contents: contents };
      if (gSys.length) gbody.systemInstruction = { parts: [{ text: gSys.join('\n') }] };
      return gbody;
    }

    // openai 兼容：含图片的消息 content 转数组
    var omsgs = [];
    for (i = 0; i < messages.length; i++) {
      var om = messages[i];
      if (om.images && om.images.length && om.role !== 'system') {
        var oparts = [{ type: 'text', text: om.content || '' }];
        for (var oi = 0; oi < om.images.length; oi++) {
          oparts.push({ type: 'image_url', image_url: { url: om.images[oi] } });
        }
        omsgs.push({ role: om.role, content: oparts });
      } else {
        omsgs.push({ role: om.role, content: om.content });
      }
    }
    var obody = {
      model: opts.model,
      messages: omsgs,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: !!stream
    };
    if (stream) obody.stream_options = { include_usage: true };
    // 深度思考开关：deepseek 系请求加 enable_thinking
    if (opts.thinking && p.keySlug === 'deepseek') obody.enable_thinking = true;
    return obody;
  }

  function buildUrl(p, opts, stream) {
    if (p.format === 'google') {
      var method = stream ? ':streamGenerateContent?alt=sse&key=' : ':generateContent?key=';
      return p.base + '/v1beta/models/' + opts.model + method + opts.apiKey;
    }
    return AIProviders.chatCompletionsUrl(p);
  }

  // 从 SSE data 载荷提取增量文本、思考内容与 usage
  function extractDelta(format, json) {
    var text = '';
    var thinking = '';
    var usage = null;
    try {
      if (format === 'anthropic') {
        if (json.type === 'content_block_delta' && json.delta) {
          if (json.delta.text) text = json.delta.text;
          else if (json.delta.type === 'thinking_delta' && json.delta.thinking) thinking = json.delta.thinking;
        }
        if (json.type === 'message_delta' && json.usage) usage = json.usage;
        if (json.type === 'message_start' && json.message && json.message.usage) usage = json.message.usage;
      } else if (format === 'google') {
        var cands = json.candidates;
        if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
          var parts = cands[0].content.parts;
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].text) {
              if (parts[i].thought) thinking += parts[i].text;
              else text += parts[i].text;
            }
          }
        }
        if (json.usageMetadata) usage = json.usageMetadata;
      } else {
        var choices = json.choices;
        if (choices && choices[0] && choices[0].delta) {
          var delta = choices[0].delta;
          if (delta.content) text = delta.content;
          if (delta.reasoning_content) thinking = delta.reasoning_content;
        }
        if (json.usage) usage = json.usage;
      }
    } catch (e) { /* ignore parse issues */ }
    return { text: text, thinking: thinking, usage: usage };
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
    var thinkingFull = '';
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
          if (d.thinking) thinkingFull += d.thinking;
          if (d.text) full += d.text;
          if ((d.text || d.thinking) && typeof opts.onChunk === 'function') {
            opts.onChunk(full, thinkingFull);
          }
        }
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }

    if (timedOut) throw new Error('响应超时：30 秒未收到数据');
    return { content: full, thinking: thinkingFull, usage: usage };
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
    var thinking = '';
    var usage = null;
    if (format === 'anthropic') {
      if (json.content) {
        for (var i = 0; i < json.content.length; i++) {
          if (json.content[i].type === 'text') content += json.content[i].text;
          else if (json.content[i].type === 'thinking') thinking += json.content[i].thinking || '';
        }
      }
      usage = json.usage || null;
    } else if (format === 'google') {
      var cands = json.candidates;
      if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
        var parts = cands[0].content.parts;
        for (var j = 0; j < parts.length; j++) {
          if (parts[j].text) {
            if (parts[j].thought) thinking += parts[j].text;
            else content += parts[j].text;
          }
        }
      }
      usage = json.usageMetadata || null;
    } else {
      if (json.choices && json.choices[0] && json.choices[0].message) {
        content = json.choices[0].message.content || '';
        thinking = json.choices[0].message.reasoning_content || '';
      }
      usage = json.usage || null;
    }
    return { content: content, thinking: thinking, usage: usage };
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
  // timeoutMs 可选（默认 12000，自动匹配并行探测用 5000）
  // 返回 { ok, models?: [...], error? }
  async function validateKey(provider, apiKey, customBase, timeoutMs) {
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
    var timer = setTimeout(function() { ctrl.abort(); }, timeoutMs || 12000);
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
