/* ==================== OmniHub 模型选择页（ModelsPage） ====================
 * 容器钩子：app.js 打开子页面时派发 document 事件 'render:subChatModel'
 * 渲染目标：#chatModelBody（不存在则自建弹层）
 * 对外契约：ModelsPage.render() / ModelsPage.open()
 * 选择模型：优先 ChatModule.selectModel(modelId)（chat.js 侧存在性委托），
 *          缺失时回退为直接写 Store（与 chat.js selectCatalogModel 行为一致）
 */
const ModelsPage = (() => {
  'use strict';

  /* ==================== I18n ==================== */
  var DICT = {
    zh: {
      tabList: '模型列表', tabRank: '排行榜',
      searchPh: '搜索模型 / 厂商 / 描述',
      historyTitle: '历史搜索', historyClear: '清空',
      pinned: '置顶', legacy: '历史版本', legacyCount: '个历史版本',
      tagCode: '代码', tagLong: '长文本', tagVision: '多模态', tagThinking: '思考',
      ctxUnit: '上下文',
      start: '开始使用', startAnyway: '仍要开始对话', goConfig: '去配置 Key',
      noKey: '尚未配置 {p} 的 API Key',
      warnDeprecated: '该模型已下架或为历史版本，可能无法正常使用',
      warnNote: '注意：{n}',
      switched: '已切换到 {m}',
      pin: '置顶', unpin: '取消置顶', viewDetail: '查看详情',
      offline: '离线参考数据', noDetail: '该模型暂未收录详情',
      empty: '没有匹配的模型', pageTitle: '选择模型',
      loading: '加载中…'
    },
    en: {
      tabList: 'Models', tabRank: 'Leaderboard',
      searchPh: 'Search models / providers / descriptions',
      historyTitle: 'Search History', historyClear: 'Clear',
      pinned: 'Pinned', legacy: 'Legacy', legacyCount: 'legacy models',
      tagCode: 'Code', tagLong: 'Long Ctx', tagVision: 'Multimodal', tagThinking: 'Thinking',
      ctxUnit: 'context',
      start: 'Start Chat', startAnyway: 'Chat Anyway', goConfig: 'Configure Key',
      noKey: 'API Key for {p} not configured',
      warnDeprecated: 'This model is deprecated and may not work',
      warnNote: 'Note: {n}',
      switched: 'Switched to {m}',
      pin: 'Pin', unpin: 'Unpin', viewDetail: 'View Details',
      offline: 'Offline reference data', noDetail: 'Model details not available',
      empty: 'No matching models', pageTitle: 'Select Model',
      loading: 'Loading…'
    }
  };

  /* 注册进全局 I18n（若存在），失败则用本地字典 */
  function registerI18n() {
    try {
      if (typeof I18n === 'undefined') return;
      if (typeof I18n.register === 'function') {
        I18n.register('models', DICT);
      } else if (I18n.data) {
        if (!I18n.data.zh) I18n.data.zh = {};
        if (!I18n.data.en) I18n.data.en = {};
        for (var k in DICT.zh) I18n.data.zh[k] = DICT.zh[k];
        for (var k2 in DICT.en) I18n.data.en[k2] = DICT.en[k2];
      }
    } catch (e) { /* ignore */ }
  }

  function isEn() {
    var l = '';
    try {
      l = (Store.state.settings && Store.state.settings.language) || Store.state.language || 'zh';
    } catch (e) { /* ignore */ }
    return /^en/i.test(String(l));
  }

  function t(key, vars) {
    var d = isEn() ? DICT.en : DICT.zh;
    var v = d[key];
    if (v == null) {
      try {
        if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') {
          var r = I18n.t(key);
          if (r !== key) v = r;
        }
      } catch (e) { /* ignore */ }
    }
    if (v == null) v = key;
    if (vars) {
      for (var k in vars) v = v.replace('{' + k + '}', vars[k]);
    }
    return v;
  }

  /* ==================== 工具 ==================== */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\x22/g, '&quot;');
  }

  function hashColor(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return 'hsl(' + (Math.abs(h) % 360) + ',45%,42%)';
  }

  /* 厂商 keySlug：AIProviders 映射 + 补充表（小米 MiMo 由 KeysPage 扩展支持） */
  var EXTRA_SLUGS = { '小米 MiMo': 'mimo' };

  function slugFor(name) {
    if (EXTRA_SLUGS[name]) return EXTRA_SLUGS[name];
    if (typeof AIProviders !== 'undefined') return AIProviders.mapModelProvider(name);
    return 'custom';
  }

  function providerMeta(name) {
    var slug = slugFor(name);
    var p = (typeof AIProviders !== 'undefined') ? AIProviders.get(slug) : null;
    var color = (p && slug !== 'custom') ? p.color : hashColor(String(name || '?'));
    var n = String(name || '?');
    var first = n.charAt(0);
    var abbr = /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
    return { color: color, abbr: abbr, slug: slug };
  }

  function brandIcon(name) {
    var svg = (typeof BrandIcons !== 'undefined') ? BrandIcons.svg(name) : null;
    if (svg) return svg;
    return esc(providerMeta(name).abbr);
  }

  /* 读取某厂商 Key（兼容字符串与双 Key 结构 {plan, payg} + slugBilling） */
  function readKey(slug) {
    var keys = Store.state.chat.keys || {};
    var v = keys[slug];
    if (v && typeof v === 'object') {
      var billing = keys[slug + 'Billing'] || 'plan';
      return String(v[billing] || v.plan || v.payg || '');
    }
    return String(v || '');
  }

  function hasKeyForProvider(name) {
    var slug = slugFor(name);
    if (slug === 'custom') {
      var c = Store.state.chat;
      return !!(readKey('custom') || (c.customBase && c.customModel));
    }
    return !!readKey(slug);
  }

  /* 能力标签：代码 / 长文本 / 多模态 / 思考 */
  function modelTags(m) {
    var tags = [];
    var text = ((m.id || '') + ' ' + (m.name || '') + ' ' + (m.desc || ''));
    if (/code|coder|codestral|devstral/i.test(text) || text.indexOf('代码') !== -1) tags.push({ k: 'code', label: t('tagCode') });
    if ((m.ctx || 0) >= 256) tags.push({ k: 'long', label: t('tagLong') });
    if (m.vision) tags.push({ k: 'vision', label: t('tagVision') });
    if (m.thinking) tags.push({ k: 'thinking', label: t('tagThinking') });
    return tags;
  }

  /* 参数规模标签：优先名称里的 xxB，其次上下文规格（如「200K 上下文」） */
  function sizeLabel(m) {
    var match = /(\d+(?:\.\d+)?)\s*B\b/i.exec(m.name || '');
    if (match) return match[1] + 'B';
    if (m.ctx) {
      if (m.ctx >= 1024) {
        var v = m.ctx / 1024;
        var s = (v === Math.floor(v)) ? String(v) : v.toFixed(1);
        return s + 'M ' + t('ctxUnit');
      }
      return m.ctx + 'K ' + t('ctxUnit');
    }
    return '';
  }

  /* 历史版本判定：status='deprecated' 或 note 含旧版/历史字样 */
  function isLegacy(m) {
    if (m.status === 'deprecated') return true;
    if (m.note && /旧版|历史|legacy/i.test(m.note)) return true;
    return false;
  }

  /* 内测/审核判定（详情页警告条） */
  function restrictedNote(m) {
    if (m.status === 'deprecated') return t('warnDeprecated');
    if (m.note && /内测|审核/.test(m.note)) return t('warnNote', { n: m.note });
    return '';
  }

  /* 当前选中模型 id（优先 ChatModule.getState 契约，回退 Store） */
  function currentModelId() {
    try {
      if (window.ChatModule && typeof ChatModule.getState === 'function') {
        var st = ChatModule.getState();
        if (st && (st.modelId || st.model)) return st.modelId || st.model;
      }
    } catch (e) { /* ignore */ }
    var c = Store.state.chat;
    return c.modelId || c.model || '';
  }

  /* ==================== 模块状态 ==================== */
  var inited = false;
  var root = null;          // 渲染容器（#chatModelBody 或自建弹层 body）
  var overlay = null;       // 自建弹层（容器不存在时）
  var tab = 'list';         // 'list' | 'rank'
  var search = '';
  var expandedProvider = null;
  var historyOpen = false;
  var histTimer = null;
  var lbIdx = 0;            // 当前榜单索引
  var lbRows = {};          // board → rows
  var lbLoading = {};       // board → bool
  var detailEl = null;      // 详情弹层
  var ctxMenuEl = null;     // 长按菜单
  var lpTimer = null;       // 长按计时器

  /* Store 运行时默认值 */
  function chatState() {
    var c = Store.state.chat;
    if (!c.modelSearchHistory) c.modelSearchHistory = [];
    if (!c.pinnedModels) c.pinnedModels = [];
    return c;
  }

  /* ==================== 渲染入口 ==================== */
  function ensureRoot() {
    var body = document.getElementById('chatModelBody');
    if (body) { root = body; return body; }
    // 容器不存在 → 自建弹层
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'mp-overlay';
      overlay.innerHTML =
        '<div class="mp-overlay-head"><h3>' + esc(t('pageTitle')) + '</h3>' +
        '<button class="mp-overlay-close" type="button">✕</button></div>' +
        '<div class="mp-overlay-body"></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.mp-overlay-close').addEventListener('click', function() {
        overlay.classList.remove('open');
      });
    }
    overlay.classList.add('open');
    root = overlay.querySelector('.mp-overlay-body');
    return root;
  }

  function render() {
    registerI18n();
    var box = ensureRoot();
    if (!box) return;
    bindEvents(box);
    renderShell(box);
    if (typeof Icons !== 'undefined' && Icons.render) {
      try { Icons.render(box); } catch (e) { /* ignore */ }
    }
  }

  /* open：主动打开（容器存在走 App.openSub，否则开自建弹层） */
  function open() {
    var sub = document.getElementById('subChatModel');
    if (sub && window.App && App.openSub) {
      App.openSub('subChatModel'); // 会派发 render:subChatModel → render()
    } else {
      render();
    }
  }

  function renderShell(box) {
    var html = '';
    html += '<div class="mp-tabs">';
    html += '<button type="button" class="mp-tab' + (tab === 'list' ? ' active' : '') + '" data-mptab="list">' + esc(t('tabList')) + '</button>';
    html += '<button type="button" class="mp-tab' + (tab === 'rank' ? ' active' : '') + '" data-mptab="rank">' + esc(t('tabRank')) + '</button>';
    html += '</div>';
    if (tab === 'list') {
      html += '<div class="mp-search">';
      html += '<input type="text" id="mpSearchInput" placeholder="' + esc(t('searchPh')) + '" value="' + esc(search) + '" autocomplete="off">';
      html += historyHtml();
      html += '</div>';
      html += '<div id="mpListWrap"></div>';
    } else {
      html += '<div id="mpRankWrap"></div>';
    }
    box.innerHTML = html;
    if (tab === 'list') renderList(box);
    else renderRank(box);
  }

  /* 历史搜索下拉（max-height 动画） */
  function historyHtml() {
    var hist = chatState().modelSearchHistory || [];
    var kw = search.trim().toLowerCase();
    var items = [];
    for (var i = 0; i < hist.length; i++) {
      if (kw && hist[i].toLowerCase().indexOf(kw) === -1) continue;
      items.push(hist[i]);
    }
    var html = '<div class="mp-history' + (historyOpen && items.length ? ' open' : '') + '" id="mpHistory">';
    html += '<div class="mp-history-head"><span>' + esc(t('historyTitle')) + '</span>' +
      '<button type="button" class="mp-hist-clear">' + esc(t('historyClear')) + '</button></div>';
    for (var j = 0; j < items.length; j++) {
      html += '<button type="button" class="mp-hist-item" data-hist="' + esc(items[j]) + '">' + esc(items[j]) + '</button>';
    }
    html += '</div>';
    return html;
  }

  function refreshHistory(box) {
    var wrap = box.querySelector('.mp-search');
    if (!wrap) return;
    var old = wrap.querySelector('.mp-history');
    if (old) old.remove();
    wrap.insertAdjacentHTML('beforeend', historyHtml());
  }

  /* 记录搜索历史（最多 10 条） */
  function commitHistory(term) {
    var kw = String(term || '').trim();
    if (!kw) return;
    var c = chatState();
    var arr = c.modelSearchHistory;
    var idx = arr.indexOf(kw);
    if (idx !== -1) arr.splice(idx, 1);
    arr.unshift(kw);
    if (arr.length > 10) arr.length = 10;
    Store.save();
  }

  /* ==================== 模型列表 ==================== */
  function groupByProvider(models) {
    var map = {};
    var order = [];
    for (var i = 0; i < models.length; i++) {
      var p = models[i].provider || '?';
      if (!map[p]) { map[p] = []; order.push(p); }
      map[p].push(models[i]);
    }
    // 按模型数量降序
    order.sort(function(a, b) { return map[b].length - map[a].length; });
    return { map: map, order: order };
  }

  function filterModels(models) {
    var kw = search.trim().toLowerCase();
    if (!kw) return models;
    return models.filter(function(m) {
      return (m.id || '').toLowerCase().indexOf(kw) !== -1 ||
        (m.name || '').toLowerCase().indexOf(kw) !== -1 ||
        (m.provider || '').toLowerCase().indexOf(kw) !== -1 ||
        (m.desc || '').toLowerCase().indexOf(kw) !== -1;
    });
  }

  function rowHtml(m, active, delay) {
    var meta = providerMeta(m.provider);
    var html = '<div class="mp-row mp-enter' + (active ? ' active' : '') + '" data-mid="' + esc(m.id) + '"' +
      (delay ? ' style="animation-delay:' + delay + 'ms"' : '') + '>';
    html += '<div class="mp-ricon" style="background:' + meta.color + '">' + brandIcon(m.provider) + '</div>';
    html += '<div class="mp-rinfo">';
    html += '<div class="mp-rname">' + esc(m.name || m.id);
    var size = sizeLabel(m);
    if (size) html += '<span class="mp-size">' + esc(size) + '</span>';
    html += '</div>';
    html += '<div class="mp-rtags">';
    var tags = modelTags(m);
    for (var i = 0; i < tags.length; i++) {
      html += '<span class="mp-tag mp-tag-' + tags[i].k + '">' + esc(tags[i].label) + '</span>';
    }
    if (m.status === 'deprecated') html += '<span class="mp-tag mp-tag-dep">deprecated</span>';
    html += '</div>';
    html += '</div>';
    if (active) html += '<div class="mp-rcheck">✓</div>';
    html += '</div>';
    return html;
  }

  function renderList(box) {
    var wrap = box.querySelector('#mpListWrap');
    if (!wrap) return;
    var all = (typeof AIModels !== 'undefined') ? AIModels.list() : [];
    var filtered = filterModels(all);
    var curId = currentModelId();
    var c = chatState();
    var pinned = c.pinnedModels || [];
    var html = '';
    var delay = 0;

    // 厂商分类区（搜索时隐藏卡片）
    if (!search.trim()) {
      var g = groupByProvider(all);
      html += '<div class="mp-provs">';
      for (var i = 0; i < g.order.length; i++) {
        var name = g.order[i];
        var meta = providerMeta(name);
        html += '<button type="button" class="mp-prov-card' + (expandedProvider === name ? ' active' : '') + '" data-prov="' + esc(name) + '">';
        html += '<span class="mp-picon" style="background:' + meta.color + '">' + brandIcon(name) + '</span>';
        html += '<span class="mp-pname">' + esc(name) + '</span>';
        html += '<span class="mp-pcount">' + g.map[name].length + '</span>';
        html += '</button>';
      }
      html += '</div>';
    }

    // 置顶组
    var pinnedSet = {};
    for (var pi = 0; pi < pinned.length; pi++) pinnedSet[pinned[pi]] = true;
    var pinnedRows = [];
    for (var pj = 0; pj < filtered.length; pj++) {
      if (pinnedSet[filtered[pj].id]) pinnedRows.push(filtered[pj]);
    }
    if (pinnedRows.length) {
      html += '<div class="mp-group-title">📌 ' + esc(t('pinned')) + '</div>';
      for (var pk = 0; pk < pinnedRows.length; pk++) {
        html += rowHtml(pinnedRows[pk], pinnedRows[pk].id === curId, delay);
        delay += 25;
      }
    }

    // 分组列表（厂商卡片展开时仅显示该厂商；历史版本折叠）
    var fg = groupByProvider(filtered.filter(function(m) { return !pinnedSet[m.id]; }));
    var providersToShow = expandedProvider && !search.trim() ? [expandedProvider] : fg.order;
    for (var gi = 0; gi < providersToShow.length; gi++) {
      var pname = providersToShow[gi];
      var list = fg.map[pname];
      if (!list || !list.length) continue;
      var normal = [];
      var legacy = [];
      for (var li = 0; li < list.length; li++) {
        if (isLegacy(list[li])) legacy.push(list[li]);
        else normal.push(list[li]);
      }
      html += '<div class="mp-group-title">' + esc(pname) + ' · ' + list.length + '</div>';
      for (var ni = 0; ni < normal.length; ni++) {
        html += rowHtml(normal[ni], normal[ni].id === curId, delay);
        delay += 25;
      }
      if (legacy.length) {
        html += '<div class="mp-legacy" data-legacy="' + esc(pname) + '">';
        html += '<button type="button" class="mp-legacy-head">' +
          '<span class="mp-legacy-arrow">▸</span> ' + esc(t('legacy')) + '（' + legacy.length + '）</button>';
        html += '<div class="mp-legacy-body">';
        for (var lj = 0; lj < legacy.length; lj++) {
          html += rowHtml(legacy[lj], legacy[lj].id === curId, 0);
        }
        html += '</div></div>';
      }
    }

    if (!html || (!pinnedRows.length && !fg.order.length)) {
      html = '<div class="empty-state"><div class="empty-text">' + esc(t('empty')) + '</div></div>';
    }
    wrap.innerHTML = html;
    if (delay > 400) {
      // 大量行时关闭过长的错开延迟，避免尾行迟迟不出现
      var rows = wrap.querySelectorAll('.mp-enter');
      for (var ri = 0; ri < rows.length; ri++) {
        if (parseInt(rows[ri].style.animationDelay, 10) > 400) rows[ri].style.animationDelay = '400ms';
      }
    }
  }

  /* ==================== 排行榜 ==================== */
  function boardLabel(b) {
    return isEn() ? b.en : b.zh;
  }

  function lbSkeleton() {
    var html = '<div class="lb-skel-wrap">';
    for (var i = 0; i < 10; i++) {
      html += '<div class="lb-skel-row" style="animation-delay:' + (i * 60) + 'ms">' +
        '<span class="lb-skel sk-rank"></span><span class="lb-skel sk-icon"></span>' +
        '<span class="lb-skel sk-name"></span><span class="lb-skel sk-score"></span></div>';
    }
    html += '</div>';
    return html;
  }

  function lbPanelHtml(board) {
    var rows = lbRows[board.id];
    if (!rows) return lbSkeleton();
    var html = '';
    if (rows._offline) {
      html += '<div class="lb-offline-badge">' + esc(t('offline')) + '</div>';
    }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var medal = (r.rank <= 3) ? (' lb-rank-' + r.rank) : '';
      html += '<div class="lb-row lb-enter" data-lbmid="' + esc(r.id) + '" style="animation-delay:' + (i * 40) + 'ms">';
      html += '<span class="lb-rank' + medal + '">' + r.rank + '</span>';
      html += '<span class="lb-icon" style="background:' + providerMeta(r.provider).color + '">' + brandIcon(r.provider) + '</span>';
      html += '<span class="lb-name">' + esc(r.name) + '</span>';
      html += '<span class="lb-score">' + esc(r.display) + '</span>';
      html += '</div>';
    }
    return html;
  }

  function renderRank(box) {
    var wrap = box.querySelector('#mpRankWrap');
    if (!wrap) return;
    var boards = (typeof Leaderboard !== 'undefined') ? Leaderboard.BOARDS : [];
    var html = '';
    html += '<div class="lb-chips">';
    for (var i = 0; i < boards.length; i++) {
      html += '<button type="button" class="lb-chip' + (i === lbIdx ? ' active' : '') + '" data-lbidx="' + i + '">' + esc(boardLabel(boards[i])) + '</button>';
    }
    html += '<span class="lb-indicator" style="transform:translateX(' + (lbIdx * 100) + '%)"></span>';
    html += '</div>';
    html += '<div class="lb-swipe" id="lbSwipe">';
    for (var j = 0; j < boards.length; j++) {
      html += '<div class="lb-panel" data-lbboard="' + esc(boards[j].id) + '">' + lbPanelHtml(boards[j]) + '</div>';
    }
    html += '</div>';
    html += '<div class="lb-dots">';
    for (var d = 0; d < boards.length; d++) {
      html += '<span class="lb-dot' + (d === lbIdx ? ' active' : '') + '"></span>';
    }
    html += '</div>';
    wrap.innerHTML = html;

    // 恢复横向位置 + 绑定滚动同步
    var swipe = wrap.querySelector('#lbSwipe');
    if (swipe) {
      swipe.scrollLeft = lbIdx * swipe.clientWidth;
      swipe.addEventListener('scroll', function() {
        var w = swipe.clientWidth || 1;
        var idx = Math.round(swipe.scrollLeft / w);
        if (idx !== lbIdx) {
          lbIdx = idx;
          syncRankUI(wrap);
        }
      });
    }
    // 懒加载各榜单数据
    loadBoards(box);
  }

  function syncRankUI(wrap) {
    var chips = wrap.querySelectorAll('.lb-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', i === lbIdx);
    }
    var ind = wrap.querySelector('.lb-indicator');
    if (ind) ind.style.transform = 'translateX(' + (lbIdx * 100) + '%)';
    var dots = wrap.querySelectorAll('.lb-dot');
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.toggle('active', j === lbIdx);
    }
  }

  function loadBoards(box) {
    if (typeof Leaderboard === 'undefined') return;
    var boards = Leaderboard.BOARDS;
    for (var i = 0; i < boards.length; i++) {
      (function(b) {
        if (lbRows[b.id] || lbLoading[b.id]) return;
        lbLoading[b.id] = true;
        Leaderboard.get(b.id).then(function(rows) {
          lbRows[b.id] = rows;
          lbLoading[b.id] = false;
          if (tab !== 'rank') return;
          var panel = box.querySelector('.lb-panel[data-lbboard="' + b.id + '"]');
          if (panel) panel.innerHTML = lbPanelHtml(b);
        }).catch(function() {
          lbLoading[b.id] = false;
        });
      })(boards[i]);
    }
  }

  /* ==================== 模型详情弹层 ==================== */
  function closeDetail() {
    if (detailEl) {
      detailEl.classList.remove('open');
      var el = detailEl;
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
      detailEl = null;
    }
  }

  function openDetail(id) {
    if (typeof AIModels === 'undefined') return;
    var m = AIModels.get(id);
    if (!m) return;
    closeDetail();
    var meta = providerMeta(m.provider);
    var warn = restrictedNote(m);
    var keyOk = hasKeyForProvider(m.provider);
    var tags = modelTags(m);

    var html = '';
    html += '<div class="mp-detail">';
    html += '<button type="button" class="mp-detail-close">✕</button>';
    html += '<div class="mp-dhead">';
    html += '<span class="mp-dicon" style="background:' + meta.color + '">' + brandIcon(m.provider) + '</span>';
    html += '<div class="mp-dtitle">';
    html += '<div class="mp-dname">' + esc(m.name || m.id) + '</div>';
    html += '<div class="mp-dprov">' + esc(m.provider) + ' · ' + esc(m.type || 'chat') + '</div>';
    html += '</div></div>';
    html += '<div class="mp-dtags">';
    var size = sizeLabel(m);
    if (size) html += '<span class="mp-tag mp-tag-size">' + esc(size) + '</span>';
    for (var i = 0; i < tags.length; i++) {
      html += '<span class="mp-tag mp-tag-' + tags[i].k + '">' + esc(tags[i].label) + '</span>';
    }
    html += '</div>';
    if (m.desc) html += '<div class="mp-ddesc">' + esc(m.desc) + '</div>';
    if (m.note && !warn) html += '<div class="mp-ddesc mp-dnote">' + esc(m.note) + '</div>';

    if (warn) {
      // 已下架 / 内测 / 审核：警告条，无「开始使用」
      html += '<div class="mp-warn">⚠ ' + esc(warn) + '</div>';
    } else if (!keyOk) {
      html += '<div class="mp-nokey">' + esc(t('noKey', { p: m.provider })) + '</div>';
      html += '<div class="mp-dactions">';
      html += '<button type="button" class="mp-btn mp-btn-primary" data-dact="gokey">' + esc(t('goConfig')) + '</button>';
      html += '<button type="button" class="mp-btn mp-btn-ghost" data-dact="anyway">' + esc(t('startAnyway')) + '</button>';
      html += '</div>';
    } else {
      html += '<div class="mp-dactions">';
      html += '<button type="button" class="mp-btn mp-btn-primary" data-dact="start">' + esc(t('start')) + '</button>';
      html += '</div>';
    }
    html += '</div>';

    detailEl = document.createElement('div');
    detailEl.className = 'mp-detail-mask';
    detailEl.innerHTML = html;
    document.body.appendChild(detailEl);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { if (detailEl) detailEl.classList.add('open'); });
    });

    detailEl.addEventListener('click', function(e) {
      if (e.target === detailEl || e.target.closest('.mp-detail-close')) { closeDetail(); return; }
      var btn = e.target.closest('[data-dact]');
      if (!btn) return;
      var act = btn.dataset.dact;
      if (act === 'gokey') {
        var slug = slugFor(m.provider);
        closeDetail();
        if (window.App && App.closeSub) App.closeSub();
        if (window.App && App.openSub) App.openSub('subChatSettings');
        if (window.KeysPage && typeof KeysPage.highlightProvider === 'function') {
          KeysPage.highlightProvider(slug);
        }
      } else if (act === 'anyway' || act === 'start') {
        doSelect(m.id);
      }
    });
  }

  /* 选择模型：优先 ChatModule 契约，缺失时回退直接写 Store（同 chat.js selectCatalogModel） */
  function doSelect(id) {
    closeDetail();
    closeCtxMenu();
    if (window.ChatModule && typeof ChatModule.selectModel === 'function') {
      try {
        ChatModule.selectModel(id);
        refreshSelection();
        return;
      } catch (e) { /* 落到回退 */ }
    }
    var m = (typeof AIModels !== 'undefined') ? AIModels.get(id) : null;
    if (!m) return;
    var c = Store.state.chat;
    var slug = AIProviders.mapModelProvider(m.provider);
    c.modelId = m.id;
    c.mode = (m.type === 'image') ? 'image' : 'single'; // 与 chat.js selectCatalogModel 一致
    if (slug === 'custom') {
      c.provider = 'custom';
      c.customModel = m.id;
    } else {
      c.provider = slug;
      c.model = m.id;
    }
    Store.save();
    if (window.App && App.closeSub) App.closeSub();
    if (window.Toast) Toast.show(t('switched', { m: m.name || m.id }));
    refreshSelection();
  }

  /* 重新高亮当前选中行 */
  function refreshSelection() {
    if (!root) return;
    var curId = currentModelId();
    var rows = root.querySelectorAll('.mp-row');
    for (var i = 0; i < rows.length; i++) {
      var active = rows[i].dataset.mid === curId;
      rows[i].classList.toggle('active', active);
      var check = rows[i].querySelector('.mp-rcheck');
      if (active && !check) {
        rows[i].insertAdjacentHTML('beforeend', '<div class="mp-rcheck">✓</div>');
      } else if (!active && check) {
        check.remove();
      }
    }
  }

  /* ==================== 长按菜单（500ms）：置顶 / 查看详情 / 取消置顶 ==================== */
  function closeCtxMenu() {
    if (ctxMenuEl) {
      ctxMenuEl.remove();
      ctxMenuEl = null;
    }
  }

  function openCtxMenu(mid, x, y) {
    closeCtxMenu();
    var c = chatState();
    var isPinned = (c.pinnedModels || []).indexOf(mid) !== -1;
    ctxMenuEl = document.createElement('div');
    ctxMenuEl.className = 'mp-ctx';
    ctxMenuEl.innerHTML =
      '<button type="button" data-cact="pin">' + esc(isPinned ? t('unpin') : t('pin')) + '</button>' +
      '<button type="button" data-cact="detail">' + esc(t('viewDetail')) + '</button>';
    document.body.appendChild(ctxMenuEl);
    // 防出屏
    var rect = ctxMenuEl.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - rect.width - 12);
    var top = Math.min(y, window.innerHeight - rect.height - 12);
    ctxMenuEl.style.left = Math.max(12, left) + 'px';
    ctxMenuEl.style.top = Math.max(12, top) + 'px';
    ctxMenuEl.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-cact]');
      if (!btn) return;
      if (btn.dataset.cact === 'pin') togglePin(mid);
      else if (btn.dataset.cact === 'detail') openDetail(mid);
      closeCtxMenu();
    });
    setTimeout(function() {
      document.addEventListener('click', closeCtxMenu, { once: true });
    }, 0);
  }

  function togglePin(mid) {
    var c = chatState();
    var arr = c.pinnedModels;
    var idx = arr.indexOf(mid);
    if (idx === -1) {
      arr.unshift(mid);
      if (window.Toast) Toast.show(t('pin') + ' ✓');
    } else {
      arr.splice(idx, 1);
      if (window.Toast) Toast.show(t('unpin') + ' ✓');
    }
    Store.save();
    render();
  }

  /* ==================== 事件委托 ==================== */
  function bindEvents(box) {
    if (box._mpBound) return;
    box._mpBound = true;

    box.addEventListener('click', function(e) {
      // Tab 切换
      var tabBtn = e.target.closest('.mp-tab');
      if (tabBtn) {
        tab = tabBtn.dataset.mptab;
        render();
        return;
      }
      // 厂商卡片展开/收起
      var card = e.target.closest('.mp-prov-card');
      if (card) {
        var p = card.dataset.prov;
        expandedProvider = (expandedProvider === p) ? null : p;
        render();
        return;
      }
      // 历史版本折叠组
      var legacyHead = e.target.closest('.mp-legacy-head');
      if (legacyHead) {
        var group = legacyHead.closest('.mp-legacy');
        var body = group.querySelector('.mp-legacy-body');
        var opening = !group.classList.contains('open');
        group.classList.toggle('open', opening);
        body.style.maxHeight = opening ? (body.scrollHeight + 'px') : '0px';
        return;
      }
      // 历史搜索项回填
      var histItem = e.target.closest('.mp-hist-item');
      if (histItem) {
        search = histItem.dataset.hist || '';
        commitHistory(search);
        historyOpen = false;
        render();
        return;
      }
      var histClear = e.target.closest('.mp-hist-clear');
      if (histClear) {
        chatState().modelSearchHistory = [];
        Store.save();
        historyOpen = false;
        refreshHistory(box);
        return;
      }
      // 排行榜 chip 切换
      var chip = e.target.closest('.lb-chip');
      if (chip) {
        var idx = parseInt(chip.dataset.lbidx, 10) || 0;
        lbIdx = idx;
        var swipe = box.querySelector('#lbSwipe');
        if (swipe) {
          var w = swipe.clientWidth || 1;
          swipe.scrollTo({ left: idx * w, behavior: 'smooth' });
        }
        syncRankUI(box);
        return;
      }
      // 排行榜行 → 详情
      var lbRow = e.target.closest('.lb-row');
      if (lbRow) {
        var lbMid = lbRow.dataset.lbmid;
        if (lbMid && typeof AIModels !== 'undefined' && AIModels.get(lbMid)) openDetail(lbMid);
        else if (window.Toast) Toast.show(t('noDetail'));
        return;
      }
      // 模型行 → 详情
      var row = e.target.closest('.mp-row');
      if (row && row.dataset.mid) {
        openDetail(row.dataset.mid);
        return;
      }
    });

    // 搜索输入：实时过滤 + 历史记录下拉
    box.addEventListener('input', function(e) {
      if (e.target.id === 'mpSearchInput') {
        search = e.target.value;
        historyOpen = true;
        refreshHistory(box);
        renderList(box);
        // 停止输入 1.2s 后记录历史
        if (histTimer) clearTimeout(histTimer);
        histTimer = setTimeout(function() {
          commitHistory(search);
          refreshHistory(box);
        }, 1200);
      }
    });

    box.addEventListener('focusin', function(e) {
      if (e.target.id === 'mpSearchInput') {
        historyOpen = true;
        refreshHistory(box);
      }
    });

    box.addEventListener('focusout', function(e) {
      if (e.target.id === 'mpSearchInput') {
        setTimeout(function() {
          historyOpen = false;
          refreshHistory(box);
        }, 200);
      }
    });

    box.addEventListener('keydown', function(e) {
      if (e.target.id === 'mpSearchInput' && e.key === 'Enter') {
        commitHistory(search);
        historyOpen = false;
        refreshHistory(box);
      }
    });

    // 长按 500ms 菜单（触摸）
    box.addEventListener('touchstart', function(e) {
      var row = e.target.closest('.mp-row');
      if (!row || !row.dataset.mid) return;
      var mid = row.dataset.mid;
      var touch = e.touches[0];
      var x = touch.clientX;
      var y = touch.clientY;
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = setTimeout(function() {
        lpTimer = null;
        openCtxMenu(mid, x, y);
      }, 500);
    });
    box.addEventListener('touchend', function() {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    });
    box.addEventListener('touchmove', function() {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    });

    // 桌面右键同效
    box.addEventListener('contextmenu', function(e) {
      var row = e.target.closest('.mp-row');
      if (!row || !row.dataset.mid) return;
      e.preventDefault();
      openCtxMenu(row.dataset.mid, e.clientX, e.clientY);
    });
  }

  /* ==================== 初始化 ==================== */
  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener('render:subChatModel', function() {
      render();
    });
  }

  init();

  return { render: render, open: open, openDetail: openDetail };
})();
