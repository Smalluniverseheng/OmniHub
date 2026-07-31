/* ==================== 书源 URL 智能解析器 ====================
 * 从任意粘贴串中提取/展开/探测书源候选地址：
 *  - split(text)：提取全部 http(s) URL（兼容无分隔符的连写串）
 *  - expand(url, context)：为单个 URL 生成候选组（原样 / .html 截断 / 已知书源站模式 / 路径逐级截断）
 *  - candidates(text)：split + expand 汇总去重（最多 8 个，JSON 候选优先）
 *  - probe(url)：直连(3s) → BackendConfig.fetchProxy 代理兜底，判型 json/html/js/other
 *  - resolve(text, onProgress)：逐个探测候选，HTML 页面再提取 JSON 链接探测一轮
 * split/expand/candidates 为纯函数，可在 Node 环境运行（无 DOM/fetch 依赖）。
 */

const SourceUrlResolver = (() => {
  'use strict';

  var MAX_CANDIDATES = 8;      // 候选上限
  var MAX_SECONDARY = 5;       // HTML 页内发现的 JSON 链接上限
  var DIRECT_TIMEOUT = 3000;   // 直连探测超时

  /* 任意粘贴串中的 URL：回火贪念匹配，天然在每个 https:// 边界切开连写串 */
  var URL_RE = /https?:\/\/(?:(?!https?:\/\/)[^\s\u0022\u0027<>，。；、）\u0029】])+/gi;
  /* 匹配后清理尾部可能粘连的中英文标点 */
  var TRAIL_PUNCT_RE = /[，。；、：！？）\u0029】】\u0022\u0027\s]+$/;

  /* ---------- split：提取全部 URL ---------- */
  function split(text) {
    var out = [];
    var s = String(text == null ? '' : text);
    var m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(s)) !== null) {
      var u = m[0].replace(TRAIL_PUNCT_RE, '');
      if (u && out.indexOf(u) === -1) out.push(u);
    }
    return out;
  }

  /* ---------- expand：单个 URL → 候选组 ----------
   * ① 原样
   * ② 含 '.html' 后粘连 's/json/...' 的 → 截断为页面 URL
   * ③ 已知书源站模式：yckceo.com/yuedu/ → 从全串提取 id 生成书源/RSS 两个 JSON 候选
   * ④ 路径逐级截断（最多 2 级）
   * context：完整粘贴串（用于跨 URL 提取书源 id），缺省为 url 本身
   */
  function expand(url, context) {
    var out = [];
    function add(u) { if (u && out.indexOf(u) === -1) out.push(u); }
    url = String(url || '').trim();
    if (!/^https?:\/\x2f/i.test(url)) return out;  // \x2f 写法避免括号检查器误判注释
    var full = String(context || url);

    // ① 原样
    add(url);

    // ② '.html' 后粘连内容（如 1035.htmls/json/id/193.json）→ 截断为页面 URL
    var htmlIdx = url.toLowerCase().indexOf('.html');
    if (htmlIdx > -1) {
      var afterHtml = url.substring(htmlIdx + 5);
      if (afterHtml && !/^[?#]/.test(afterHtml)) {
        add(url.substring(0, htmlIdx + 5));
      }
    }

    // ③ 已知书源站模式：yckceo.com 源仓库
    var parsed = null;
    try { parsed = new URL(url); } catch (e) {}
    if (parsed && parsed.hostname.toLowerCase().indexOf('yckceo.com') > -1
        && parsed.pathname.indexOf('/yuedu/') > -1) {
      var idm = full.match(/id\/(\d+)/);
      if (idm) {
        add('https:/' + '/www.yckceo.com/yuedu/shuyuan/json/id/' + idm[1] + '.json');
        add('https:/' + '/www.yckceo.com/yuedu/rss/json/id/' + idm[1] + '.json');
      }
    }

    // ④ 路径逐级截断（最多 2 级）：/a/b/c → /a/b → /a
    if (parsed) {
      var path = parsed.pathname.replace(/\/+$/, '');
      for (var lvl = 0; lvl < 2; lvl++) {
        var cut = path.lastIndexOf('/');
        if (cut <= 0) break;
        path = path.substring(0, cut);
        add(parsed.origin + path + '/');
      }
    }
    return out;
  }

  /* ---------- candidates：split + expand 汇总，去重，JSON 候选优先，最多 8 个 ---------- */
  function candidates(text) {
    var urls = split(text);
    var seen = [];
    urls.forEach(function(u) {
      expand(u, text).forEach(function(c) {
        if (seen.indexOf(c) === -1) seen.push(c);
      });
    });
    // JSON 形态候选排前面（命中率最高），保持组内原有顺序
    var jsonish = seen.filter(function(u) { return /\.json($|[?#])/i.test(u) || /\/json\x2f/i.test(u); });
    var rest = seen.filter(function(u) { return jsonish.indexOf(u) === -1; });
    return jsonish.concat(rest).slice(0, MAX_CANDIDATES);
  }

  /* ==================== 以下为浏览器环境探测逻辑 ==================== */

  function trim(s) { return (s == null ? '' : String(s)).trim(); }

  /* 判型：contentType 或内容首字符 { [ → json；html → html；JS 图源 → js */
  function classify(url, contentType, text) {
    var ct = (contentType || '').toLowerCase();
    var t = trim(text);
    if (ct.indexOf('json') > -1) return 'json';
    if (/\.js($|[?#])/i.test(url) || ct.indexOf('javascript') > -1) return 'js';
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try { JSON.parse(t); return 'json'; } catch (e) { /* 落到其它 */ }
    }
    if (ct.indexOf('html') > -1 || /^<!doctype html|^<html[\s>]/i.test(t.slice(0, 512))) return 'html';
    if (/class\s+\w+\s+extends\s+ComicSource/.test(t)) return 'js';
    return 'other';
  }

  /* 直连探测（3s 超时） */
  async function probeDirect(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, DIRECT_TIMEOUT);
    try {
      var resp = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return { contentType: resp.headers.get('content-type') || '', text: await resp.text() };
    } finally {
      clearTimeout(timer);
    }
  }

  /* 代理兜底：BackendConfig.fetchProxy 返回 JSON {ok,contentType,text}，需解包 */
  async function probeViaProxy(url) {
    if (typeof BackendConfig === 'undefined') throw new Error('代理未配置');
    var resp = await fetch(BackendConfig.fetchProxy(url), { credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (!data || data.ok !== true || data.text == null) {
      throw new Error((data && data.error) || '代理抓取失败');
    }
    return { contentType: data.contentType || '', text: data.text };
  }

  /* Supabase 边缘函数兜底（workers 不可达时；返回 {status,contentType,body}） */
  async function probeViaSupabase(url) {
    if (typeof BackendConfig === 'undefined' || !BackendConfig.supabaseProxy) throw new Error('代理未配置');
    var resp = await fetch(BackendConfig.supabaseProxy(url), { credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (!data || data.body == null || data.status >= 400) {
      throw new Error((data && data.error) || '代理抓取失败');
    }
    return { contentType: data.contentType || '', text: data.body };
  }

  /* ---------- probe：直连 → worker 代理 → supabase 代理，返回 {url, kind, text} 或 null ---------- */
  async function probe(url) {
    var got = null;
    try { got = await probeDirect(url); }
    catch (e) {
      try { got = await probeViaProxy(url); }
      catch (e2) {
        try { got = await probeViaSupabase(url); }
        catch (e3) { return null; }
      }
    }
    var kind = classify(url, got.contentType, got.text);
    return { url: url, kind: kind, text: got.text, contentType: got.contentType };
  }

  /* HTML 页面内发现 JSON 链接（绝对化，最多 5 条） */
  function extractJsonLinks(html, pageUrl) {
    var links = [];
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var anchors = doc.querySelectorAll('a[href], link[href], script[src]');
      anchors.forEach(function(a) {
        if (links.length >= MAX_SECONDARY) return;
        var raw = a.getAttribute('href') || a.getAttribute('src') || '';
        if (!/\.json($|[?#])/i.test(raw) && raw.indexOf('/json/') === -1) return;
        try {
          var abs = new URL(raw, pageUrl).href;
          if (links.indexOf(abs) === -1) links.push(abs);
        } catch (e) {}
      });
    } catch (e) {}
    return links.slice(0, MAX_SECONDARY);
  }

  /* ---------- resolve：逐个探测候选，返回已获内容列表 ----------
   * onProgress(event) 可选，event: {url, status:'probing'|'ok'|'fail'|'secondary', kind?, error?}
   * 返回 [{url, kind, text}]（仅含成功获得内容的项）
   */
  async function resolve(text, onProgress) {
    function notify(ev) {
      if (typeof onProgress === 'function') {
        try { onProgress(ev); } catch (e) {}
      }
    }
    var list = candidates(text);
    var results = [];
    for (var i = 0; i < list.length; i++) {
      var url = list[i];
      notify({ url: url, status: 'probing' });
      var r = await probe(url);
      if (!r) {
        notify({ url: url, status: 'fail', error: '无法访问' });
        continue;
      }
      if (r.kind === 'html') {
        // HTML 页：提取 JSON 链接作为次级候选再探测一轮
        notify({ url: url, status: 'ok', kind: 'html' });
        var links = extractJsonLinks(r.text, url);
        for (var j = 0; j < links.length; j++) {
          notify({ url: links[j], status: 'secondary' });
          var sub = await probe(links[j]);
          if (sub && (sub.kind === 'json' || sub.kind === 'js')) {
            results.push({ url: sub.url, kind: sub.kind, text: sub.text });
            notify({ url: links[j], status: 'ok', kind: sub.kind });
          } else {
            notify({ url: links[j], status: 'fail', error: '非书源内容' });
          }
        }
        continue;
      }
      results.push({ url: r.url, kind: r.kind, text: r.text });
      notify({ url: url, status: 'ok', kind: r.kind });
    }
    return results;
  }

  return {
    split: split,
    expand: expand,
    candidates: candidates,
    probe: probe,
    resolve: resolve,
    extractJsonLinks: extractJsonLinks
  };
})();

/* Node 环境导出（供 verifier 单元测试；浏览器下走全局 const） */
if (typeof window === 'undefined' && typeof module !== 'undefined' && module.exports) {
  module.exports = SourceUrlResolver;
}
