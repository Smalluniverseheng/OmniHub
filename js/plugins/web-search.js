/* ==================== OmniHub WebSearch 插件 - 联网搜索 ====================
 * 支持三家厂商：tavily / serper / bing（用户自备 API Key，不提供免费联网服务）
 * 配置存 Store.state.chat.webSearch = { provider, key }
 * 暴露：
 *   WebSearch.configure({provider, key})
 *   WebSearch.config()                      → 当前配置
 *   WebSearch.isReady()                     → 开关开启且已配置 Key
 *   WebSearch.search(query)                 → Promise<[{title,url,snippet}]>
 *   WebSearch.needsSearch(text)             → 意图判定（自动触发用）
 */

const WebSearch = (() => {
  'use strict';

  var PROVIDERS = {
    tavily: {
      name: 'Tavily',
      method: 'POST',
      url: 'https://api.tavily.com/search',
      headers: function(key) {
        return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
      },
      body: function(query) {
        return { query: query, max_results: 6, include_answer: false };
      },
      parse: function(json) {
        var out = [];
        var list = (json && json.results) || [];
        for (var i = 0; i < list.length; i++) {
          out.push({ title: list[i].title || '', url: list[i].url || '', snippet: list[i].content || '' });
        }
        return out;
      }
    },
    serper: {
      name: 'Serper (Google)',
      method: 'POST',
      url: 'https://google.serper.dev/search',
      headers: function(key) {
        return { 'Content-Type': 'application/json', 'X-API-KEY': key };
      },
      body: function(query) {
        return { q: query, num: 6 };
      },
      parse: function(json) {
        var out = [];
        var list = (json && json.organic) || [];
        for (var i = 0; i < list.length; i++) {
          out.push({ title: list[i].title || '', url: list[i].link || '', snippet: list[i].snippet || '' });
        }
        return out;
      }
    },
    bing: {
      name: 'Bing',
      method: 'GET',
      url: 'https://api.bing.microsoft.com/v7.0/search?q=',
      headers: function(key) {
        return { 'Ocp-Apim-Subscription-Key': key };
      },
      body: null,
      parse: function(json) {
        var out = [];
        var list = (json && json.webPages && json.webPages.value) || [];
        for (var i = 0; i < list.length; i++) {
          out.push({ title: list[i].name || '', url: list[i].url || '', snippet: list[i].snippet || '' });
        }
        return out;
      }
    }
  };

  /* 触发意图关键词：时效 / 事实 / 人名 类 */
  var INTENT_RE = /最新|今天|今日|昨天|明天|新闻|时事|价格|多少钱|股价|汇率|天气|是谁|什么是|什么时候|何时|哪里|哪个|赛程|比分|release|latest|today|news|price|who is|when did|weather/i;

  function cfg() {
    var c = Store.state.chat;
    if (!c.webSearch) c.webSearch = { provider: 'tavily', key: '' };
    return c.webSearch;
  }

  /* 工具开关（智能工具「联网搜索」） */
  function enabled() {
    var tools = Store.state.chat.tools || {};
    return !!tools.webSearch;
  }

  function configure(opts) {
    var c = cfg();
    if (opts && opts.provider && PROVIDERS[opts.provider]) c.provider = opts.provider;
    if (opts && typeof opts.key === 'string') c.key = opts.key.trim();
    try { Store.save(); } catch (e) { /* ignore */ }
    return c;
  }

  function isReady() {
    return enabled() && !!cfg().key;
  }

  /* 意图判定：命中关键词，或长度 > 20 的问句 */
  function needsSearch(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (INTENT_RE.test(t)) return true;
    if (t.length > 20 && /[?？]$/.test(t)) return true;
    return false;
  }

  /* 执行搜索：统一返回 [{title,url,snippet}]，失败抛错 */
  function search(query) {
    var c = cfg();
    var p = PROVIDERS[c.provider] || PROVIDERS.tavily;
    if (!c.key) return Promise.reject(new Error('未配置 ' + p.name + ' 的 API Key'));
    var opts = { method: p.method, headers: p.headers(c.key) };
    var url = p.url;
    if (p.method === 'GET') {
      url += encodeURIComponent(query) + '&count=6';
    } else {
      opts.body = JSON.stringify(p.body(query));
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 15000);
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(function(res) {
      clearTimeout(timer);
      if (!res.ok) {
        return res.text().then(function(t) {
          throw new Error('HTTP ' + res.status + '：' + (t || '').slice(0, 120));
        });
      }
      return res.json();
    }).then(function(json) {
      clearTimeout(timer);
      return p.parse(json).slice(0, 6);
    }).catch(function(err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new Error('搜索请求超时');
      throw err;
    });
  }

  /* 搜索结果 → 注入给 AI 的系统上下文文本 */
  function toContext(query, results) {
    var lines = ['以下是联网搜索「' + query + '」的实时结果，请结合回答并注明来源：'];
    for (var i = 0; i < results.length; i++) {
      lines.push((i + 1) + '. ' + results[i].title + '（' + results[i].url + '）\n   ' + (results[i].snippet || '').slice(0, 300));
    }
    return lines.join('\n');
  }

  return {
    PROVIDERS: PROVIDERS,
    configure: configure,
    config: cfg,
    enabled: enabled,
    isReady: isReady,
    needsSearch: needsSearch,
    search: search,
    toContext: toContext
  };
})();
