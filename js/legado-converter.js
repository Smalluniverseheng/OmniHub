/* ==================== Legado 书源格式转换器 ====================
 * Legado JSON → OmniHub 内部统一 source schema：
 * { name, url, group, type:'novel'|'comic', engine:'legado', enabled, hasExplore,
 *   searchRule, tocRule, contentRule, exploreRule, raw }
 * explore 规则从 exploreUrl / ruleExplore 提取，供发现页标签使用。
 */

const LegadoConverter = (() => {
  'use strict';

  function trim(s) { return (s == null ? '' : String(s)).trim(); }

  function isLegadoSource(o) {
    return !!(o && typeof o === 'object' && !Array.isArray(o) && o.bookSourceName && o.bookSourceUrl);
  }

  /* 探索分类解析：exploreUrl 多行，每行 "标题::地址"，分隔符支持换行 / && */
  function parseExploreCategories(raw) {
    var text = trim(raw && raw.exploreUrl);
    if (!text) return [];
    var lines = text.split(/\r?\n|&&/).map(trim).filter(function(l) { return !!l; });
    var cats = [];
    lines.forEach(function(line) {
      var idx = line.indexOf('::');
      if (idx > -1) {
        var title = trim(line.substring(0, idx));
        var url = trim(line.substring(idx + 2));
        if (title && url) cats.push({ title: title, url: url });
      } else if (/^https?:/i.test(line)) {
        cats.push({ title: '默认', url: line });
      }
    });
    return cats;
  }

  /* 单个 Legado JSON → 统一 schema */
  function convert(o) {
    if (!isLegadoSource(o)) return null;
    var categories = parseExploreCategories(o);
    var hasExplore = categories.length > 0 && !!(o.ruleExplore && (o.ruleExplore.bookList || o.ruleExplore.name));
    return {
      name: o.bookSourceName,
      url: o.bookSourceUrl,
      group: o.bookSourceGroup || '',
      type: o.bookSourceType === 2 ? 'comic' : 'novel',
      engine: 'legado',
      enabled: o.enabled !== false,
      hasExplore: hasExplore,
      searchRule: {
        searchUrl: o.searchUrl || '',
        rule: o.ruleSearch || {}
      },
      tocRule: o.ruleToc || {},
      contentRule: o.ruleContent || {},
      exploreRule: {
        categories: categories,
        rule: o.ruleExplore || {}
      },
      raw: o
    };
  }

  /* 批量转换：返回 { sources:[统一schema], skipped: 跳过的无效条目数 } */
  function convertAll(items) {
    var list = Array.isArray(items) ? items : [items];
    var sources = [];
    var skipped = 0;
    list.forEach(function(o) {
      var s = convert(o);
      if (s) sources.push(s); else skipped++;
    });
    return { sources: sources, skipped: skipped };
  }

  /* 发现页：加载某个分类的书籍列表
   * src: 统一 schema（convert 产物）或 Legado 原始 JSON
   * category: { title, url }，page 从 1 开始
   */
  async function exploreBooks(src, category, page) {
    if (typeof LegadoEngine === 'undefined') throw new Error('Legado 引擎未加载');
    var raw = src.raw || src;
    var rule = (src.exploreRule && src.exploreRule.rule) || raw.ruleExplore || {};
    if (!category || !category.url) throw new Error('该分类缺少地址');
    var req = LegadoEngine.buildRequest(category.url, '', page || 1);
    var resp = await LegadoEngine.fetchText(req.url, req.init);
    var ctx = { dom: resp.dom, json: resp.json, text: resp.text, baseUrl: req.url };
    var items = LegadoEngine.evalRule(rule.bookList, ctx, true);

    var out = [];
    if (!items.length) return out;

    // bookList 命中的是元素列表还是字符串列表未知，这里按 DOM 元素逐项取值
    // evalRule(wantList=true) 对 CSS/XPath 规则返回文本数组，无法逐项子规则取值；
    // 因此优先走 LegadoEngine 未导出的逐项路径不可行，改为逐 URL 退化：
    // 每项若是 URL 则直接作为书籍链接，否则用子规则在整个页面上按索引取值（近似）。
    var names = LegadoEngine.evalRule(rule.name, ctx, true);
    var authors = LegadoEngine.evalRule(rule.author, ctx, true);
    var intros = LegadoEngine.evalRule(rule.intro, ctx, true);
    var covers = LegadoEngine.evalRule(rule.coverUrl, ctx, true);
    var urls = LegadoEngine.evalRule(rule.bookUrl, ctx, true);

    function abs(u) { try { return u ? new URL(u, req.url).href : ''; } catch (e) { return u || ''; } }

    for (var i = 0; i < names.length; i++) {
      var name = trim(names[i]);
      if (!name) continue;
      out.push({
        name: name,
        author: trim(authors[i] || ''),
        intro: trim(intros[i] || ''),
        cover: abs(covers[i] || ''),
        url: abs(urls[i] || ''),
        source: raw.bookSourceName || '',
        mediaType: raw.bookSourceType === 2 ? 'comic' : 'novel'
      });
    }
    return out;
  }

  return {
    isLegadoSource: isLegadoSource,
    parseExploreCategories: parseExploreCategories,
    convert: convert,
    convertAll: convertAll,
    exploreBooks: exploreBooks
  };
})();
