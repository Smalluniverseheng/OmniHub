/* ==================== OmniHub 自定义 API 厂商 ====================
 * CustomProviders.list/add/update/remove/test/buildRequest
 * 存储：Store.state.chat.customProviders[]
 * 条目 15 字段：
 *  {id, name*, model*, keyPrefix, format*(openai/anthropic/gemini/custom),
 *   baseUrl*, authType*(bearer/query/header/none), authField, authTemplate,
 *   modelsPath, chatPath*, stream(默认开), vision(默认关), thinking(默认关),
 *   customHeaders(JSON), bodyTemplate(JSON 模板支持 {model}{messages}{stream}),
 *   key(该厂商已保存的 API Key), createdAt, updatedAt}
 *
 * 集成说明：ai-api.js 不可改，自定义厂商的实际对话调用建议由 chat.js 侧
 * 在发送前检测 provider==='custom:<id>'，调用 CustomProviders.buildRequest(p, opts)
 * 得到 {url, options} 后直接 fetch + 按 p.format 复用 AIAPI 的 SSE 解析逻辑。
 * 本期仅实现 KeysPage 内的「测试」连通性调用。
 */
const CustomProviders = (() => {
  'use strict';

  var REQUIRED = ['name', 'model', 'format', 'baseUrl', 'authType', 'chatPath'];
  var FORMATS = ['openai', 'anthropic', 'gemini', 'custom'];
  var AUTH_TYPES = ['bearer', 'query', 'header', 'none'];

  /* Store 运行时默认值 */
  function store() {
    var c = Store.state.chat;
    if (!c.customProviders) c.customProviders = [];
    return c.customProviders;
  }

  function list() {
    return store().slice();
  }

  function get(id) {
    var arr = store();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  function genId() {
    return 'cp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* 规整输入： trim、布尔默认值、JSON 字段保留原文（保存时校验） */
  function normalize(data) {
    var d = data || {};
    var out = {
      id: d.id || genId(),
      name: String(d.name || '').trim(),
      model: String(d.model || '').trim(),
      keyPrefix: String(d.keyPrefix || '').trim(),
      format: String(d.format || 'openai').trim(),
      baseUrl: String(d.baseUrl || '').trim().replace(/\/+$/, ''),
      authType: String(d.authType || 'bearer').trim(),
      authField: String(d.authField || 'Authorization').trim(),
      authTemplate: String(d.authTemplate || 'Bearer {key}').trim(),
      modelsPath: String(d.modelsPath || '').trim(),
      chatPath: String(d.chatPath || '').trim(),
      stream: d.stream !== false,
      vision: d.vision === true,
      thinking: d.thinking === true,
      customHeaders: String(d.customHeaders || '').trim(),
      bodyTemplate: String(d.bodyTemplate || '').trim(),
      key: String(d.key || '').trim(),
      createdAt: d.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    if (FORMATS.indexOf(out.format) === -1) out.format = 'openai';
    if (AUTH_TYPES.indexOf(out.authType) === -1) out.authType = 'bearer';
    return out;
  }

  /* 必填 + JSON 字段校验，返回 {field: 错误消息} */
  function validate(p) {
    var errors = {};
    var i;
    for (i = 0; i < REQUIRED.length; i++) {
      if (!p[REQUIRED[i]]) errors[REQUIRED[i]] = 'required';
    }
    if (p.customHeaders) {
      try { JSON.parse(p.customHeaders); } catch (e) { errors.customHeaders = 'json'; }
    }
    if (p.bodyTemplate) {
      // 模板变量替换后必须仍是合法 JSON（与 buildBody 的替换口径一致：
      // {model} 由模板作者自行加引号，故此处替换为裸文本 m）
      var filled = p.bodyTemplate
        .replace(/\{model\}/g, 'm')
        .replace(/\{messages\}/g, '[]')
        .replace(/\{stream\}/g, 'false');
      try { JSON.parse(filled); } catch (e2) { errors.bodyTemplate = 'json'; }
    }
    return errors;
  }

  function add(data) {
    var p = normalize(data);
    var errors = validate(p);
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    store().push(p);
    Store.save();
    return { ok: true, item: p };
  }

  function update(id, data) {
    var arr = store();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        var merged = {};
        for (var k in arr[i]) merged[k] = arr[i][k];
        for (var k2 in data) merged[k2] = data[k2];
        merged.id = id;
        merged.createdAt = arr[i].createdAt;
        var p = normalize(merged);
        var errors = validate(p);
        if (Object.keys(errors).length) return { ok: false, errors: errors };
        arr[i] = p;
        Store.save();
        return { ok: true, item: p };
      }
    }
    return { ok: false, errors: { id: 'notfound' } };
  }

  function remove(id) {
    var arr = store();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        arr.splice(i, 1);
        Store.save();
        return true;
      }
    }
    return false;
  }

  /* 仅更新该厂商保存的 Key */
  function setKey(id, key) {
    var p = get(id);
    if (!p) return false;
    p.key = String(key || '').trim();
    p.updatedAt = Date.now();
    Store.save();
    return true;
  }

  /* 拼接路径：base 与 path 之间的斜杠去重；path 支持 {model} 变量 */
  function joinUrl(base, path, model) {
    if (!path) return base;
    var p = path;
    if (model) p = p.replace(/\{model\}/g, encodeURIComponent(model));
    if (/^https?:\/\x2f/i.test(p)) return p; // 完整 URL 直接用（\x2f 即斜杠，规避注释误判）
    if (p.charAt(0) !== '/') p = '/' + p;
    return base + p;
  }

  /* 按认证方式生成 headers / url query */
  function applyAuth(p, headers, url) {
    var key = p.key || '';
    if (!key || p.authType === 'none') return url;
    var value = (p.authTemplate || 'Bearer {key}').replace(/\{key\}/g, key);
    if (p.authType === 'bearer') {
      headers[p.authField || 'Authorization'] = value;
    } else if (p.authType === 'header') {
      headers[p.authField || 'X-API-Key'] = value;
    } else if (p.authType === 'query') {
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      url += sep + encodeURIComponent(p.authField || 'key') + '=' + encodeURIComponent(key);
    }
    return url;
  }

  function parseHeaders(p) {
    var headers = { 'Content-Type': 'application/json' };
    if (p.customHeaders) {
      try {
        var extra = JSON.parse(p.customHeaders);
        for (var k in extra) headers[k] = String(extra[k]);
      } catch (e) { /* 校验已拦，忽略 */ }
    }
    return headers;
  }

  /* 按格式生成默认请求体 */
  function buildBody(p, messages, stream) {
    var msgs = messages || [{ role: 'user', content: 'ping' }];
    if (p.format === 'custom' && p.bodyTemplate) {
      var filled = p.bodyTemplate
        .replace(/\{model\}/g, JSON.stringify(p.model).slice(1, -1))
        .replace(/\{messages\}/g, JSON.stringify(msgs))
        .replace(/\{stream\}/g, stream ? 'true' : 'false');
      try { return JSON.parse(filled); } catch (e) { /* 落到默认 */ }
    }
    if (p.format === 'anthropic') {
      return { model: p.model, max_tokens: 8, stream: !!stream, messages: msgs };
    }
    if (p.format === 'gemini') {
      var text = msgs.length ? (msgs[msgs.length - 1].content || 'ping') : 'ping';
      return { contents: [{ role: 'user', parts: [{ text: text }] }] };
    }
    return { model: p.model, messages: msgs, stream: !!stream, max_tokens: 8 };
  }

  /* 生成 fetch 参数（KeysPage 测试 / 未来对话链路复用）
   * opts: {messages?, stream?} → {url, options} */
  function buildRequest(p, opts) {
    var o = opts || {};
    var headers = parseHeaders(p);
    var url = joinUrl(p.baseUrl, p.chatPath || '/chat/completions', p.model);
    url = applyAuth(p, headers, url);
    return {
      url: url,
      options: {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(buildBody(p, o.messages, o.stream !== false && p.stream))
      }
    };
  }

  /* 连通性测试：优先 GET 模型列表接口，否则 POST 聊天接口 1 条 ping */
  function test(idOrObj) {
    var p = typeof idOrObj === 'string' ? get(idOrObj) : idOrObj;
    if (!p) return Promise.resolve({ ok: false, error: '厂商不存在' });
    var headers = parseHeaders(p);
    var url;
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 8000);

    var req;
    if (p.modelsPath) {
      url = joinUrl(p.baseUrl, p.modelsPath, p.model);
      url = applyAuth(p, headers, url);
      req = fetch(url, { method: 'GET', headers: headers, signal: ctrl.signal });
    } else {
      var r = buildRequest(p, { stream: false });
      r.options.signal = ctrl.signal;
      req = fetch(r.url, r.options);
    }
    return req.then(function(res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.text().then(function(text) {
          return { ok: false, error: 'HTTP ' + res.status + (text ? '：' + text.slice(0, 120) : '') };
        }).catch(function() {
          return { ok: false, error: 'HTTP ' + res.status };
        });
      }
      return res.json().then(function(json) {
        var models = [];
        if (json && json.data) {
          for (var i = 0; i < json.data.length; i++) {
            if (json.data[i] && json.data[i].id) models.push(json.data[i].id);
          }
        } else if (json && json.models) {
          for (var j = 0; j < json.models.length; j++) {
            if (json.models[j] && json.models[j].name) models.push(json.models[j].name);
          }
        }
        return { ok: true, models: models };
      }).catch(function() {
        // 非 JSON 但 2xx：聊天 ping 的自定义格式可能返回任意内容，视为连通
        return { ok: true, models: [] };
      });
    }).catch(function(e) {
      clearTimeout(timer);
      var reason = (e && e.name === 'AbortError') ? '请求超时' : ((e && e.message) || '网络错误');
      return { ok: false, error: reason };
    });
  }

  /* 自动匹配：前缀命中（keyPrefix 非空且 key 以其开头）的厂商列表 */
  function matchPrefix(key) {
    var k = String(key || '').trim();
    if (!k) return [];
    var out = [];
    var arr = store();
    for (var i = 0; i < arr.length; i++) {
      var prefix = arr[i].keyPrefix;
      if (prefix && k.indexOf(prefix) === 0) out.push(arr[i]);
    }
    return out;
  }

  return {
    list: list, get: get, add: add, update: update, remove: remove,
    setKey: setKey, test: test, buildRequest: buildRequest, matchPrefix: matchPrefix
  };
})();
