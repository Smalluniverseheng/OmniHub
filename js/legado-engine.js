/* ==================== Legado（开源阅读）书源引擎 (Web 版) ====================
 * 基于 https://github.com/gedoor/legado 书源规则
 * 支持：搜索 / 详情 / 目录 / 正文 全流程，规则求值（XPath / JSONPath / JSoup 简写 CSS / JS 段）
 */

const LegadoEngine = (() => {
  'use strict';

  var PROXIES = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?'];
  var sessionVars = {}; // java.put/get 会话级存储

  /* ---------------- 基础工具 ---------------- */

  function trim(s) { return (s == null ? '' : String(s)).trim(); }
  function isNonEmpty(s) { return trim(s) !== ''; }

  function absUrl(rel, base) {
    rel = trim(rel);
    if (!rel) return '';
    try { return new URL(rel, base).href; } catch (e) { return rel; }
  }

  function decodeEntities(s) {
    if (!s) return '';
    return s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);/g, function(m, n) { return String.fromCharCode(parseInt(n, 10)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function(m, n) { return String.fromCharCode(parseInt(n, 16)); });
  }

  /* ---------------- MD5（java.md5Encode 用，RFC 1321 实现） ---------------- */

  function md5(input) {
    var s = unescape(encodeURIComponent(String(input)));
    var bytes = [];
    var i, j;
    for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var lo = bitLen % 0x100000000;
    var hi = Math.floor(bitLen / 0x100000000);
    for (i = 0; i < 4; i++) bytes.push((lo >>> (8 * i)) & 255);
    for (i = 0; i < 4; i++) bytes.push((hi >>> (8 * i)) & 255);

    var K = [];
    for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
    var S = [7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
             5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20,
             4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
             6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21];

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var off = 0; off < bytes.length; off += 64) {
      var M = [];
      for (i = 0; i < 16; i++) {
        j = off + i * 4;
        M[i] = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
      }
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        var tmp = D;
        D = C; C = B;
        var x = (A + F + K[i] + M[g]) | 0;
        B = (B + ((x << S[i]) | (x >>> (32 - S[i])))) | 0;
        A = tmp;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    function le(v) {
      var out = '';
      for (var k = 0; k < 4; k++) {
        var b = (v >>> (8 * k)) & 255;
        out += (b < 16 ? '0' : '') + b.toString(16);
      }
      return out;
    }
    return le(a0) + le(b0) + le(c0) + le(d0);
  }

  function b64encode(s) { return btoa(unescape(encodeURIComponent(String(s)))); }
  function b64decode(s) {
    try { return decodeURIComponent(escape(atob(String(s)))); }
    catch (e) { try { return atob(String(s)); } catch (_) { return ''; } }
  }

  /* ---------------- JS 沙箱（<js>...</js> 与 @js: 段） ---------------- */

  function makeJavaStub() {
    return {
      put: function(k, v) { sessionVars[k] = v; return v; },
      get: function(k) { return sessionVars[k]; },
      ajax: function(url) {
        console.warn('[Legado] java.ajax 同步网络请求在浏览器环境不支持，已忽略:', url);
        return '';
      },
      md5Encode: function(s) { return md5(s); },
      base64Decode: function(s) { return b64decode(s); },
      base64Encode: function(s) { return b64encode(s); },
      log: function() { console.log.apply(console, ['[Legado JS]'].concat(Array.prototype.slice.call(arguments))); }
    };
  }

  function runJs(code, result, context) {
    try {
      // eval 语义：整个代码段最后一条语句的完成值即为返回值（与 Legado JS 规则一致）
      var fn = new Function('result', 'java', 'book', 'chapter', 'baseUrl', 'cookie', 'cache', '__code',
        '"use strict";return eval(__code);');
      var out = fn(String(result == null ? '' : result), makeJavaStub(),
        context.book || {}, context.chapter || {}, context.baseUrl || '', {}, {}, String(code));
      return out == null ? '' : out;
    } catch (e) {
      console.warn('[Legado] JS 规则执行失败，已降级为空结果:', e.message);
      return '';
    }
  }

  /* ---------------- 规则拆解辅助 ---------------- */

  // 按顶层分隔符拆分（跳过 {{}}、<js></js> 与 ## 正则尾部）
  function splitTop(str, sep) {
    var parts = [];
    var depth = 0, inJs = false, i = 0, start = 0;
    while (i < str.length) {
      if (!inJs && str.substr(i, 4) === '<js>') { inJs = true; i += 4; continue; }
      if (inJs && str.substr(i, 5) === '</js>') { inJs = false; i += 5; continue; }
      if (inJs) { i++; continue; }
      if (str.substr(i, 2) === '{{') { depth++; i += 2; continue; }
      if (str.substr(i, 2) === '}}' && depth > 0) { depth--; i += 2; continue; }
      if (depth === 0 && str.substr(i, 2) === '##') {
        // ## 之后是正则替换尾部，不再拆分
        break;
      }
      if (depth === 0 && str.substr(i, sep.length) === sep) {
        parts.push(str.substring(start, i));
        i += sep.length;
        start = i;
        continue;
      }
      i++;
    }
    parts.push(str.substring(start));
    return parts;
  }

  // 拆出 ##正则##替换 尾部
  function splitRegexTail(rule) {
    var idx = -1;
    var depth = 0, inJs = false, i = 0;
    while (i < rule.length) {
      if (!inJs && rule.substr(i, 4) === '<js>') { inJs = true; i += 4; continue; }
      if (inJs && rule.substr(i, 5) === '</js>') { inJs = false; i += 5; continue; }
      if (inJs) { i++; continue; }
      if (rule.substr(i, 2) === '{{') { depth++; i += 2; continue; }
      if (rule.substr(i, 2) === '}}' && depth > 0) { depth--; i += 2; continue; }
      if (depth === 0 && rule.substr(i, 2) === '##') { idx = i; break; }
      i++;
    }
    if (idx < 0) return { main: rule, replaces: [] };
    var main = rule.substring(0, idx);
    var tail = rule.substring(idx + 2).split('##');
    var replaces = [];
    for (var k = 0; k < tail.length; k += 2) {
      replaces.push([tail[k], (k + 1 < tail.length) ? tail[k + 1] : '']);
    }
    return { main: main, replaces: replaces };
  }

  function applyReplaces(value, replaces) {
    if (!replaces || !replaces.length) return value;
    function rep(str) {
      var out = String(str);
      replaces.forEach(function(r) {
        if (!r[0]) return;
        try { out = out.replace(new RegExp(r[0], 'g'), r[1] == null ? '' : r[1]); }
        catch (e) { console.warn('[Legado] 替换正则无效:', r[0]); }
      });
      return out;
    }
    if (Array.isArray(value)) return value.map(rep);
    return rep(value);
  }

  /* ---------------- 取值器：XPath ---------------- */

  function xpathSelect(xpath, context) {
    var node = context.dom;
    if (!node) return [];
    var doc = node.nodeType === 9 ? node : node.ownerDocument;
    if (!doc || !doc.evaluate) return [];
    try {
      var res = doc.evaluate(xpath, node, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      var out = [];
      for (var i = 0; i < res.snapshotLength; i++) out.push(res.snapshotItem(i));
      return out;
    } catch (e) {
      console.warn('[Legado] XPath 求值失败:', xpath, e.message);
      return [];
    }
  }

  function xpathNodeValue(node) {
    if (node.nodeType === 2) return trim(node.value);           // 属性
    if (node.nodeType === 3 || node.nodeType === 4) return trim(node.textContent); // 文本
    return trim(node.textContent);                              // 元素
  }

  /* ---------------- 取值器：JSONPath（简易） ---------------- */

  function jsonFindKey(obj, key) {
    // 递归下降找 key，取第一个
    if (obj == null || typeof obj !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var v = jsonFindKey(obj[keys[i]], key);
      if (v !== undefined) return v;
    }
    return undefined;
  }

  function jsonPath(obj, path) {
    path = trim(path);
    if (obj === undefined) return undefined;
    if (path === '$' || path === '') return obj;
    if (path.indexOf('$..') === 0) return jsonFindKey(obj, path.substring(3));
    if (path.indexOf('..') === 0) return jsonFindKey(obj, path.substring(2));
    if (path.charAt(0) === '$') path = path.substring(1);
    if (path.charAt(0) === '.') path = path.substring(1);
    if (!path) return obj;
    var tokens = path.split('.');
    var cur = obj;
    for (var t = 0; t < tokens.length; t++) {
      if (cur == null) return undefined;
      var token = tokens[t];
      var m = token.match(/^([^\[]*)((?:\[\d+\])*)$/);
      if (!m) return undefined;
      if (m[1]) cur = cur[m[1]];
      var idxs = token.match(/\[(\d+)\]/g);
      if (idxs) {
        for (var k = 0; k < idxs.length; k++) {
          if (cur == null) return undefined;
          cur = cur[parseInt(idxs[k].slice(1, -1), 10)];
        }
      }
    }
    return cur;
  }

  /* ---------------- 取值器：JSoup 简写 CSS ---------------- */

  function parseCssRule(rule) {
    var segs = rule.split('@');
    var value = null;
    // 单段且本身是取值关键字：作用于上下文元素自身
    if (segs.length === 1 && /^(text|textNodes|ownText|html)$/i.test(trim(segs[0]))) {
      return { selector: null, index: -1, value: { kind: trim(segs[0]).toLowerCase() } };
    }
    if (segs.length > 1) {
      var last = trim(segs[segs.length - 1]);
      if (/^(text|textNodes|ownText|html)$/i.test(last)) {
        value = { kind: last.toLowerCase() };
        segs.pop();
      } else if (/^[a-zA-Z][\w-]*$/.test(last)) {
        value = { kind: 'attr', name: last };
        segs.pop();
      }
    }
    var selParts = [], index = -1;
    segs.forEach(function(segRaw) {
      var seg = trim(segRaw);
      if (!seg) return;
      if (seg.indexOf('class.') === 0) {
        var cn = seg.substring(6);
        selParts.push('.' + cn.split(/\s+/).join('.'));
      } else if (seg.indexOf('id.') === 0) {
        selParts.push('#' + seg.substring(3));
      } else if (seg.indexOf('tag.') === 0) {
        var t = seg.substring(4);
        var m = t.match(/^([\w-]+)\.(-?\d+)$/);
        if (m) {
          var n = parseInt(m[2], 10);
          // 序号 → nth-of-type（作用于本级选择器）
          selParts.push(n >= 0 ? (m[1] + ':nth-of-type(' + (n + 1) + ')') : (m[1] + ':nth-last-of-type(' + (-n) + ')'));
        }
        else selParts.push(t);
      } else {
        selParts.push(seg);
      }
    });
    return { selector: selParts.join(' ') || null, index: index, value: value };
  }

  function cssSelect(parsed, context) {
    var root = context.dom;
    if (!root) return [];
    if (!parsed.selector) return root.nodeType === 1 ? [root] : [];
    var els;
    try { els = root.querySelectorAll(parsed.selector); }
    catch (e) { console.warn('[Legado] CSS 选择器无效:', parsed.selector); return []; }
    var arr = Array.prototype.slice.call(els);
    if (parsed.index >= 0) {
      var idx = parsed.index < 0 ? arr.length + parsed.index : parsed.index;
      return arr[idx] ? [arr[idx]] : [];
    }
    return arr;
  }

  function cssExtract(el, value, baseUrl) {
    if (!value) return trim(el.textContent);
    if (value.kind === 'text') return trim(el.textContent);
    if (value.kind === 'html') return trim(el.innerHTML);
    if (value.kind === 'textnodes' || value.kind === 'owntext') {
      var out = [];
      for (var i = 0; i < el.childNodes.length; i++) {
        var n = el.childNodes[i];
        if (n.nodeType === 3 && trim(n.textContent)) out.push(trim(n.textContent));
      }
      return out.join('\n');
    }
    if (value.kind === 'attr') {
      var v = el.getAttribute(value.name);
      if (v == null) return '';
      v = trim(v);
      if (/^(href|src)$/i.test(value.name)) return absUrl(v, baseUrl);
      return v;
    }
    return trim(el.textContent);
  }

  /* ---------------- 规则求值 evalRule ---------------- */

  function finalize(out, wantList) {
    if (wantList) {
      if (Array.isArray(out)) return out.map(function(v) { return v == null ? '' : String(v); }).filter(isNonEmpty);
      return isNonEmpty(out) ? [String(out)] : [];
    }
    if (Array.isArray(out)) return out.length ? String(out[0] == null ? '' : out[0]) : '';
    return out == null ? '' : String(out);
  }

  // 单个取值器求值 → 字符串数组
  function evalValue(rule, context) {
    // XPath
    if (/^@XPath:/i.test(rule)) {
      return xpathSelect(rule.substring(7), context).map(xpathNodeValue);
    }
    if (rule.indexOf('//') === 0 || rule.indexOf('./') === 0 || rule.indexOf('..//') === 0) {
      return xpathSelect(rule, context).map(xpathNodeValue);
    }
    // JSONPath
    if (/^@JSon:/i.test(rule)) {
      return jsonValues(jsonPath(context.json, rule.substring(6)));
    }
    if (rule.charAt(0) === '$') {
      return jsonValues(jsonPath(context.json, rule));
    }
    // CSS
    var cssRule = rule;
    if (/^@CSS:/i.test(cssRule)) cssRule = cssRule.substring(5);
    var parsed = parseCssRule(cssRule);
    return cssSelect(parsed, context).map(function(el) {
      return cssExtract(el, parsed.value, context.baseUrl);
    });
  }

  function jsonValues(v) {
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) {
      return v.map(function(item) {
        return (item !== null && typeof item === 'object') ? JSON.stringify(item) : String(item);
      }).filter(isNonEmpty);
    }
    if (typeof v === 'object') return [JSON.stringify(v)];
    return [String(v)];
  }

  function evalRule(rule, context, wantList) {
    context = context || {};
    if (rule == null) return wantList ? [] : '';
    if (typeof rule !== 'string') rule = String(rule);
    rule = trim(rule);
    if (!rule) return wantList ? [] : '';

    // 1) 整段 <js>...</js>
    if (rule.indexOf('<js>') === 0 && rule.lastIndexOf('</js>') === rule.length - 5) {
      var jsCode = rule.substring(4, rule.length - 5);
      return finalize(runJs(jsCode, context.text || '', context), wantList);
    }

    // 2) ## 正则替换后缀
    var parts = splitRegexTail(rule);
    var main = trim(parts.main);
    if (!main) return wantList ? [] : '';

    // 3) || 组合：取第一个非空
    var alts = splitTop(main, '||');
    if (alts.length > 1) {
      for (var i = 0; i < alts.length; i++) {
        var v = evalRule(alts[i], context, wantList);
        if (wantList ? v.length : isNonEmpty(v)) return applyReplaces(v, parts.replaces);
      }
      return wantList ? [] : '';
    }

    // 4) && 组合：结果拼接
    var ands = splitTop(main, '&&');
    if (ands.length > 1) {
      var buf = [];
      for (var j = 0; j < ands.length; j++) {
        var av = evalRule(ands[j], context, false);
        if (isNonEmpty(av)) buf.push(av);
      }
      var joined = buf.join(wantList ? '\n' : '');
      return applyReplaces(wantList ? (joined ? [joined] : []) : joined, parts.replaces);
    }

    // 5) @js: 尾段（先求前缀规则，结果作为 result 注入）
    var jsIdx = topLevelIndexOf(main, '@js:');
    if (jsIdx > -1) {
      var preRule = main.substring(0, jsIdx);
      var jsTail = main.substring(jsIdx + 4);
      var preRes = preRule ? evalRule(preRule, context, false) : (context.text || '');
      return applyReplaces(finalize(runJs(jsTail, preRes, context), wantList), parts.replaces);
    }

    // 6) {{ }} 模板插值（递归求值内层规则）
    if (main.indexOf('{{') > -1) {
      var out = '', rest = main, guard = 0;
      while (rest.indexOf('{{') > -1 && guard++ < 50) {
        var s = rest.indexOf('{{');
        var e = rest.indexOf('}}', s + 2);
        if (e < 0) break;
        out += rest.substring(0, s);
        out += evalRule(rest.substring(s + 2, e), context, false);
        rest = rest.substring(e + 2);
      }
      out += rest;
      var inter = trim(out);
      return applyReplaces(wantList ? (inter ? [inter] : []) : inter, parts.replaces);
    }

    // 7) 取值器
    var vals = evalValue(main, context);
    var res = wantList ? vals : (vals.length ? vals[0] : '');
    return applyReplaces(res, parts.replaces);
  }

  function topLevelIndexOf(str, token) {
    var depth = 0, inJs = false;
    for (var i = 0; i <= str.length - token.length; i++) {
      if (!inJs && str.substr(i, 4) === '<js>') { inJs = true; i += 3; continue; }
      if (inJs && str.substr(i, 5) === '</js>') { inJs = false; i += 4; continue; }
      if (inJs) continue;
      if (str.substr(i, 2) === '{{') { depth++; i++; continue; }
      if (str.substr(i, 2) === '}}' && depth > 0) { depth--; i++; continue; }
      if (depth === 0 && str.substr(i, 2) === '##') return -1; // ## 之后是正则尾部
      if (depth === 0 && str.substr(i, token.length) === token) return i;
    }
    return -1;
  }

  /* ---------------- 列表规则：返回每项的子上下文 ---------------- */

  function evalItems(rule, context) {
    if (!isNonEmpty(rule)) return [];
    rule = trim(rule);
    var base = context.baseUrl;

    function fromDom(els) {
      return els.map(function(el) { return { dom: el, baseUrl: base, book: context.book, chapter: context.chapter }; });
    }
    function fromJson(arr) {
      return arr.map(function(item) {
        if (item !== null && typeof item === 'object') return { json: item, baseUrl: base, book: context.book, chapter: context.chapter };
        return { text: String(item), baseUrl: base, book: context.book, chapter: context.chapter };
      });
    }

    // JS 段：结果尝试解析为 JSON 数组
    if (rule.indexOf('<js>') === 0 || topLevelIndexOf(rule, '@js:') > -1) {
      var out = evalRule(rule, context, false);
      try {
        var parsed = JSON.parse(out);
        return fromJson(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) { return []; }
    }

    // 模板插值后重判
    if (rule.indexOf('{{') > -1) rule = evalRule(rule, context, false);

    if (/^@XPath:/i.test(rule)) {
      return fromDom(xpathSelect(rule.substring(7), context).filter(function(n) { return n.nodeType === 1; }));
    }
    if (rule.indexOf('//') === 0 || rule.indexOf('./') === 0) {
      return fromDom(xpathSelect(rule, context).filter(function(n) { return n.nodeType === 1; }));
    }
    if (/^@JSon:/i.test(rule)) {
      var v1 = jsonPath(context.json, rule.substring(6));
      return fromJson(Array.isArray(v1) ? v1 : (v1 != null ? [v1] : []));
    }
    if (rule.charAt(0) === '$') {
      var v2 = jsonPath(context.json, rule);
      return fromJson(Array.isArray(v2) ? v2 : (v2 != null ? [v2] : []));
    }
    var cssRule = rule;
    if (/^@CSS:/i.test(cssRule)) cssRule = cssRule.substring(5);
    return fromDom(cssSelect(parseCssRule(cssRule), context));
  }

  /* ---------------- URL 编译 buildRequest ---------------- */

  function buildRequest(searchUrl, key, page) {
    var raw = trim(searchUrl);
    var url = raw, options = null;
    var optIdx = raw.indexOf(',{');
    if (optIdx > -1) {
      url = trim(raw.substring(0, optIdx));
      var optText = raw.substring(optIdx + 1);
      // options 中的占位符先替换再解析
      optText = optText.split('{{key}}').join(encodeURIComponent(key))
                       .split('{{searchKey}}').join(encodeURIComponent(key))
                       .split('{{page}}').join(String(page))
                       .split('{{searchPage}}').join(String(page));
      try { options = JSON.parse(optText); }
      catch (e) { console.warn('[Legado] searchUrl options JSON 解析失败，按 GET 处理'); options = null; }
    }

    url = url.split('{{key}}').join(encodeURIComponent(key))
             .split('{{searchKey}}').join(encodeURIComponent(key))
             .split('{{page}}').join(String(page))
             .split('{{searchPage}}').join(String(page));

    var init = { method: 'GET', headers: {} };
    if (options) {
      if (options.method) init.method = String(options.method).toUpperCase();
      if (options.headers && typeof options.headers === 'object') init.headers = options.headers;
      if (options.body != null) {
        var body = String(options.body);
        body = body.split('searchKey').join(key)
                   .split('{{searchPage}}').join(String(page))
                   .split('{{page}}').join(String(page));
        init.body = body;
      }
      if (options.webView) console.warn('[Legado] webView 类型请求不支持，按普通请求处理');
    }
    return { url: url, init: init };
  }

  /* ---------------- 网络 fetchText（直连 + CORS 代理回退） ---------------- */

  async function fetchText(url, init) {
    init = init || {};
    var method = init.method || 'GET';
    var opts = { method: method, headers: init.headers || {}, credentials: 'omit' };
    if (init.body != null && method !== 'GET' && method !== 'HEAD') opts.body = init.body;

    var text = null, lastErr = null;
    try {
      var r = await fetch(url, opts);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text();
    } catch (e) {
      lastErr = e;
      for (var i = 0; i < PROXIES.length; i++) {
        try {
          // 代理仅支持 GET
          var pr = await fetch(PROXIES[i] + encodeURIComponent(url), { credentials: 'omit' });
          if (!pr.ok) throw new Error('HTTP ' + pr.status);
          text = await pr.text();
          break;
        } catch (_) {}
      }
      if (text == null) throw new Error('网络请求失败：' + (lastErr && lastErr.message ? lastErr.message : '目标站点无法访问'));
    }

    var t = trim(text);
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try { return { text: text, json: JSON.parse(text), baseUrl: url }; } catch (e) { /* 落到 HTML */ }
    }
    var doc = null;
    try { doc = new DOMParser().parseFromString(text, 'text/html'); } catch (e) {}
    return { text: text, dom: doc, baseUrl: url };
  }

  /* ---------------- 媒体类型判定 ---------------- */

  function mediaTypeOf(src) {
    return src.bookSourceType === 2 ? 'comic' : 'novel';
  }

  /* ---------------- 流程：搜索 ---------------- */

  async function search(src, keyword) {
    if (!src.searchUrl) throw new Error('书源「' + (src.bookSourceName || '') + '」未配置搜索地址');
    var req = buildRequest(src.searchUrl, keyword, 1);
    var resp = await fetchText(req.url, req.init);
    var ctx = { dom: resp.dom, json: resp.json, text: resp.text, baseUrl: req.url };
    var rs = src.ruleSearch || {};
    var items = evalItems(rs.bookList, ctx);
    var out = [];
    items.forEach(function(ictx) {
      try {
        var name = evalRule(rs.name, ictx, false);
        var bookUrl = evalRule(rs.bookUrl, ictx, false);
        // 列表项本身是纯 URL 字符串时兜底
        if (!bookUrl && ictx.text && /^https?:/i.test(trim(ictx.text))) bookUrl = trim(ictx.text);
        if (!name && ictx.dom) name = trim(ictx.dom.textContent);
        if (!name) return;
        out.push({
          name: decodeEntities(name),
          author: decodeEntities(evalRule(rs.author, ictx, false)),
          intro: decodeEntities(evalRule(rs.intro, ictx, false)),
          cover: absUrl(evalRule(rs.coverUrl, ictx, false), req.url),
          lastChapter: decodeEntities(evalRule(rs.lastChapter, ictx, false)),
          url: absUrl(bookUrl, req.url),
          source: src.bookSourceName || '',
          mediaType: mediaTypeOf(src)
        });
      } catch (e) { console.warn('[Legado] 搜索项解析失败:', e.message); }
    });
    return out;
  }

  /* ---------------- 流程：书籍详情 ---------------- */

  async function getBookInfo(src, bookUrl) {
    var resp = await fetchText(bookUrl, {});
    var ctx = { dom: resp.dom, json: resp.json, text: resp.text, baseUrl: bookUrl };
    var ri = src.ruleBookInfo || {};
    return {
      name: decodeEntities(evalRule(ri.name, ctx, false)),
      author: decodeEntities(evalRule(ri.author, ctx, false)),
      intro: decodeEntities(evalRule(ri.intro, ctx, false)),
      kind: decodeEntities(evalRule(ri.kind, ctx, false)),
      lastChapter: decodeEntities(evalRule(ri.lastChapter, ctx, false)),
      cover: absUrl(evalRule(ri.coverUrl, ctx, false), bookUrl),
      tocUrl: absUrl(evalRule(ri.tocUrl, ctx, false), bookUrl),
      url: bookUrl
    };
  }

  /* ---------------- 流程：目录 ---------------- */

  async function getToc(src, book, tocUrl) {
    var rt = src.ruleToc || {};
    var url = tocUrl || book.tocUrl || book.url;
    if (!url) throw new Error('缺少目录地址');
    var chapters = [];
    var page = 0;
    var redirected = false;

    while (url && page < 5) {
      var resp = await fetchText(url, {});
      var ctx = { dom: resp.dom, json: resp.json, text: resp.text, baseUrl: url, book: book };
      var items = evalItems(rt.chapterList, ctx);

      // 当前页没有章节：尝试从页面提取目录地址再跳一次
      if (!items.length && !redirected && isNonEmpty(rt.tocUrl)) {
        redirected = true;
        var next = absUrl(evalRule(rt.tocUrl, ctx, false), url);
        if (next && next !== url) { url = next; continue; }
      }

      items.forEach(function(ictx) {
        try {
          var name = evalRule(rt.chapterName, ictx, false);
          if (!name && ictx.dom) name = trim(ictx.dom.textContent);
          var volVal = evalRule(rt.isVolume, ictx, false);
          var isVolume = isNonEmpty(volVal) && volVal !== 'false' && volVal !== '0';
          var curl = isVolume ? '' : absUrl(evalRule(rt.chapterUrl, ictx, false), url);
          if (!name) return;
          chapters.push({ name: decodeEntities(name), url: curl, isVolume: isVolume });
        } catch (e) { console.warn('[Legado] 章节解析失败:', e.message); }
      });

      // 目录分页
      var nextToc = '';
      if (isNonEmpty(rt.nextTocUrl)) {
        var nv = evalRule(rt.nextTocUrl, ctx, true);
        nextToc = nv.length ? absUrl(nv[0], url) : '';
      }
      url = (nextToc && nextToc !== url) ? nextToc : null;
      page++;
    }
    return chapters;
  }

  /* ---------------- 流程：正文 ---------------- */

  function htmlToText(html) {
    var s = String(html);
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/<[^>]+>/g, '');
    s = decodeEntities(s);
    var lines = s.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l !== ''; });
    return lines.join('\n');
  }

  function looksLikeImageUrl(s) {
    return /^https?:\/\/\S+?\.(jpe?g|png|webp|gif|bmp)(\?\S*)?$/i.test(trim(s));
  }

  async function getContent(src, chapter) {
    var rc = src.ruleContent || {};
    if (!isNonEmpty(rc.content)) throw new Error('书源「' + (src.bookSourceName || '') + '」未配置正文规则');
    var url = chapter.url;
    if (!url) throw new Error('缺少章节地址');

    var chunks = [];
    var page = 0;
    while (url && page < 3) {
      var resp = await fetchText(url, {});
      var ctx = { dom: resp.dom, json: resp.json, text: resp.text, baseUrl: url, chapter: chapter };
      var vals = evalRule(rc.content, ctx, true);
      if (vals.length) chunks.push(vals.join('\n'));

      var nextUrl = '';
      if (isNonEmpty(rc.nextContentUrl)) {
        var nv = evalRule(rc.nextContentUrl, ctx, true);
        nextUrl = nv.length ? absUrl(nv[0], url) : '';
      }
      url = (nextUrl && nextUrl !== url) ? nextUrl : null;
      page++;
    }

    var content = chunks.join('\n');

    // replaceRegex 净化
    if (isNonEmpty(rc.replaceRegex)) {
      try { content = content.replace(new RegExp(rc.replaceRegex, 'g'), ''); }
      catch (e) { console.warn('[Legado] replaceRegex 无效:', rc.replaceRegex); }
    }

    // 判定图片章节：含 <img 标签 → 提取全部 img src
    if (content.indexOf('<img') > -1) {
      var images = [];
      var re = /<img[^>]+src=["']([^"']+)["']/gi;
      var m;
      while ((m = re.exec(content)) !== null) {
        var u = absUrl(m[1], chapter.url);
        if (u) images.push(u);
      }
      if (images.length) return { type: 'images', images: images };
    }

    // 判定图片章节：每行都是图片 URL（CSS @src 类规则）
    var lines = content.split('\n').map(trim).filter(isNonEmpty);
    if (lines.length && lines.every(looksLikeImageUrl)) {
      return { type: 'images', images: lines.map(function(u) { return absUrl(u, chapter.url); }) };
    }

    return { type: 'text', text: htmlToText(content) };
  }

  return {
    evalRule: evalRule,
    buildRequest: buildRequest,
    fetchText: fetchText,
    search: search,
    getBookInfo: getBookInfo,
    getToc: getToc,
    getContent: getContent,
    mediaTypeOf: mediaTypeOf,
    _md5: md5
  };
})();
