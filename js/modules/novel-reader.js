/* ==================== OmniHub Novel Reader v7.6 ==================== */
/* 番茄式小说阅读器：目录页 / 底部设置面板 / 五模式翻页引擎 */

const NovelReader = (() => {
  'use strict';

  /* ---------- 常量 ---------- */
  var FONT_STACKS = [
    { id: 'default', name: '系统默认', css: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { id: 'song',    name: '思源宋体', css: "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif" },
    { id: 'hei',     name: '思源黑体', css: "'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
    { id: 'kai',     name: '楷体',     css: "KaiTi, STKaiti, 'Kaiti SC', 'PingFang SC', serif" },
    { id: 'fang',    name: '仿宋',     css: "FangSong, STFangSong, 'FangSong_GB2312', 'PingFang SC', serif" },
    { id: 'yuan',    name: '圆体',     css: "'Yuanti SC', YouYuan, 'PingFang SC', 'Microsoft YaHei', sans-serif" }
  ];

  var TEXT_COLORS = [
    { id: 'white',  name: '白',   value: '#ffffff' },
    { id: 'beige',  name: '米白', value: '#efe9dc' },
    { id: 'green',  name: '浅绿', value: '#b9d8ba' },
    { id: 'blue',   name: '浅蓝', value: '#aec6d8' },
    { id: 'gblack', name: '灰黑', value: '#4a4a4a' },
    { id: 'black',  name: '纯黑', value: '#000000' }
  ];

  var BG_THEMES = [
    { id: 'white',     name: '纯白',   value: '#ffffff', text: '#3a3a3a' },
    { id: 'parchment', name: '羊皮纸', value: '#f5f0e1', text: '#5b4636' },
    { id: 'green',     name: '护眼',   value: '#c7e5c8', text: '#2e4632' },
    { id: 'blue',      name: '雾蓝',   value: '#dce4ec', text: '#3a4a5a' },
    { id: 'night',     name: '夜间',   value: '#1a1a1a', text: '#b0b0b0' },
    { id: 'black',     name: '纯黑',   value: '#000000', text: '#8a8a8a' }
  ];

  var FLIP_MODES = [
    { id: 'simulation', name: '仿真' },
    { id: 'cover',      name: '覆盖' },
    { id: 'slide',      name: '平移' },
    { id: 'scroll',     name: '上下' },
    { id: 'none',       name: '无动画' }
  ];

  var BRIGHTNESS_KEY = 'omnihub_novel_brightness';
  var NIGHT_BG = '#1a1a1a';
  var NIGHT_TEXT = '#b0b0b0';
  var PAGE_PAD_TOP = 44;
  var PAGE_PAD_BOTTOM = 28;
  var PAGE_PAD_X = 16;

  /* ---------- 状态 ---------- */
  var state = {
    chapters: [],
    currentChapter: 0,
    bookTitle: '',
    bookUrl: '',
    source: '',
    sourceType: '',
    cover: '',
    author: '',
    intro: '',
    scaffoldOpen: false,
    catalogOpen: false,
    sheetOpen: false,
    fontPanelOpen: false,
    paras: [],        // [{t:'title'|'text'|'img', s:...}]
    pages: [],        // [[para,...], ...]
    currentPage: 0,
    hasImages: false,
    animating: false,
    settings: null,
    readMap: {},
    frontEl: null,
    pagerEl: null
  };

  var eventsBound = false;
  var measureEl = null;
  var resizeTimer = null;
  var scrollSaveTimer = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchMoved = false;

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isPaged() {
    return state.settings.flipMode !== 'scroll' && !state.hasImages;
  }

  function fontCss(id) {
    for (var i = 0; i < FONT_STACKS.length; i++) if (FONT_STACKS[i].id === id) return FONT_STACKS[i].css;
    return FONT_STACKS[0].css;
  }

  function fontName(id) {
    for (var i = 0; i < FONT_STACKS.length; i++) if (FONT_STACKS[i].id === id) return FONT_STACKS[i].name;
    return FONT_STACKS[0].name;
  }

  function bgTheme(id) {
    for (var i = 0; i < BG_THEMES.length; i++) if (BG_THEMES[i].id === id) return BG_THEMES[i];
    return BG_THEMES[5];
  }

  function bgThemeExists(id) {
    for (var i = 0; i < BG_THEMES.length; i++) if (BG_THEMES[i].id === id) return true;
    return false;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* ---------- 设置 ---------- */
  function loadSettings() {
    var s = Store.state.read.settings || {};
    var legacyBg = { '#f5e6d3': 'parchment', '#e8f5e9': 'green', '#fff': 'white', '#ffffff': 'white', '#000': 'black', '#000000': 'black', '#1a1a1a': 'night' };
    var bg = s.bgTheme || s.background || 'black';
    if (!bgThemeExists(bg)) bg = legacyBg[(bg || '').toLowerCase()] || 'black';
    state.settings = {
      fontSize: clamp(parseInt(s.fontSize, 10) || 16, 12, 32),
      fontFamily: s.fontFamily || 'default',
      textColor: s.textColor || bgTheme(bg).text,
      bgTheme: bg,
      flipMode: s.flipMode || 'slide',
      lineHeight: clamp(parseFloat(s.lineHeight) || 1.6, 1.2, 2.4),
      paraSpacing: (s.paraSpacing === undefined ? 8 : clamp(parseInt(s.paraSpacing, 10) || 0, 0, 24)),
      night: !!s.night
    };
  }

  function saveSetting(key, value) {
    state.settings[key] = value;
    Store.state.read.settings[key] = value;
    Store.save();
  }

  function getBrightness() {
    var v = parseInt(localStorage.getItem(BRIGHTNESS_KEY), 10);
    return (v >= 10 && v <= 100) ? v : 100;
  }

  /* 亮度：独立黑色遮罩层（替代内容 filter 方案） */
  function applyBrightness() {
    var mask = el('novelBrightnessMask');
    if (!mask) return;
    var dark = (100 - getBrightness()) / 100;
    mask.style.setProperty('--brightness', dark.toFixed(2));
  }

  /* 字体/主题切换：当前页文字淡出 → DOM 更新 → 淡入 */
  function fadeUpdate(fn) {
    var target = state.frontEl || el('novelReaderContent');
    if (!target) { fn(); return; }
    target.classList.add('novel-fade-out');
    setTimeout(function() {
      fn();
      var t2 = state.frontEl || el('novelReaderContent');
      if (t2) t2.classList.remove('novel-fade-out');
      target.classList.remove('novel-fade-out');
    }, 150);
  }

  function effectiveColors() {
    if (state.settings.night) return { bg: NIGHT_BG, color: NIGHT_TEXT };
    var t = bgTheme(state.settings.bgTheme);
    return { bg: t.value, color: state.settings.textColor || t.text };
  }

  function applySettings() {
    var st = state.settings;
    var eff = effectiveColors();
    var content = el('novelReaderContent');
    var overlay = el('novelReaderOverlay');
    if (overlay) overlay.style.background = eff.bg;
    if (content) {
      content.style.background = eff.bg;
      content.style.color = eff.color;
      content.style.fontSize = st.fontSize + 'px';
      content.style.lineHeight = st.lineHeight;
      content.style.fontFamily = fontCss(st.fontFamily);
    }
    applyBrightness();
    var top = el('novelTopProgress');
    if (top) top.style.color = eff.color;
    if (state.pagerEl) {
      state.pagerEl.style.background = eff.bg;
      state.pagerEl.classList.toggle('sim', st.flipMode === 'simulation');
    }
    if (state.frontEl) stylePage(state.frontEl);
    syncSheetUI();
  }

  function stylePage(pageEl) {
    var st = state.settings;
    var eff = effectiveColors();
    pageEl.style.background = eff.bg;
    pageEl.style.color = eff.color;
    pageEl.style.fontSize = st.fontSize + 'px';
    pageEl.style.lineHeight = st.lineHeight;
    pageEl.style.fontFamily = fontCss(st.fontFamily);
  }

  /* ---------- 打开 / 关闭 ---------- */
  function open(book) {
    state.bookTitle = book.title || '';
    state.bookUrl = book.url || '';
    state.source = book.source || '';
    state.sourceType = book.sourceType || '';
    state.chapters = book.chapters || [];
    state.currentChapter = book.currentChapter || 0;
    state.cover = book.cover || '';
    state.author = book.author || '';
    state.intro = book.intro || '';
    state.readMap = {};
    state.frontEl = null;
    state.pagerEl = null;
    measureEl = null;

    // 书架兜底补全书籍信息
    var shelfBook = null;
    var shelf = Store.state.read.shelf || [];
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i].url === state.bookUrl) { shelfBook = shelf[i]; break; }
    }
    if (shelfBook) {
      if (!state.cover) state.cover = shelfBook.cover || '';
      if (!state.author) state.author = shelfBook.author || '';
    }

    loadSettings();

    var overlay = el('novelReaderOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    state.scaffoldOpen = false;
    state.catalogOpen = false;
    state.sheetOpen = false;
    state.fontPanelOpen = false;
    el('novelCatalogPage').classList.remove('open');
    el('novelSettingsSheet').classList.remove('open');
    el('novelSheetMask').classList.remove('open');
    el('novelFontPanel').classList.remove('open');

    if (window.Nav && Nav.setVisible) Nav.setVisible(false);

    buildSheetControls();
    applySettings();

    var savedPage = shelfBook ? (shelfBook.pageIdx || 0) : 0;
    loadChapter(state.currentChapter, { page: savedPage, scroll: savedPage });

    if (!eventsBound) {
      bindEvents();
      eventsBound = true;
    }
  }

  function close() {
    saveProgress(true);
    var overlay = el('novelReaderOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    if (window.Nav && Nav.setVisible) Nav.setVisible(true);
  }

  /* ---------- 章节加载 ---------- */
  async function loadChapter(idx, opts) {
    opts = opts || {};
    if (idx < 0 || idx >= state.chapters.length) return;
    state.currentChapter = idx;
    state.readMap[idx] = true;
    showLoading(true);

    var ch = state.chapters[idx];
    try {
      var result = await fetchChapterParas(ch);
      state.paras = result.paras;
      state.hasImages = result.hasImages;
      showLoading(false);
      renderChapter(opts);
      updateScaffold();
      updateProgress();
      saveProgress();
    } catch (e) {
      showLoading(false);
      state.paras = [{ t: 'title', s: ch.name }, { t: 'text', s: '加载失败: ' + (e.message || e) }];
      state.hasImages = false;
      renderChapter({ page: 0 });
      updateScaffold();
    }
  }

  async function fetchChapterParas(ch) {
    var paras = [{ t: 'title', s: ch.name || ('第' + (state.currentChapter + 1) + '章') }];
    var hasImages = false;

    if (state.sourceType === 'venera' && typeof VeneraEngine !== 'undefined') {
      var images = await VeneraEngine.getImages(state.source, state.bookUrl, ch.url || ch.id);
      if (images && images.length) {
        images.forEach(function(u) { paras.push({ t: 'img', s: u }); });
        hasImages = true;
      } else {
        paras.push({ t: 'text', s: '无法加载内容' });
      }
    } else if (state.sourceType === 'legado' && typeof LegadoEngine !== 'undefined') {
      var lsrc = (Store.state.read.sources || []).find(function(s) { return s.name === state.source || s.key === state.source || s.id === state.source; });
      if (!lsrc || !lsrc.raw) throw new Error('Legado 书源不存在');
      var res = await LegadoEngine.getContent(lsrc.raw, { name: ch.name, url: ch.url });
      if (res.type === 'images') {
        res.images.forEach(function(u) { paras.push({ t: 'img', s: u }); });
        hasImages = true;
      } else {
        res.text.split('\n').forEach(function(line) {
          var t = line.replace(/\s+/g, ' ').trim();
          if (t) paras.push({ t: 'text', s: t });
        });
      }
    } else {
      var html = await fetchNovelContent(ch.url);
      var extracted = htmlToParas(html);
      extracted.forEach(function(p) {
        paras.push(p);
        if (p.t === 'img') hasImages = true;
      });
    }

    if (paras.length <= 1) paras.push({ t: 'text', s: '（本章暂无内容）' });
    return { paras: paras, hasImages: hasImages };
  }

  async function fetchNovelContent(url) {
    var resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var html = await resp.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    var contentEl = doc.querySelector('.content, #content, .chapter-content, #chapter-content, .read-content, #read-content, article, .text, #text');
    if (!contentEl) {
      var divs = doc.querySelectorAll('div');
      var maxLen = 0;
      for (var i = 0; i < divs.length; i++) {
        if (divs[i].textContent.length > maxLen) {
          maxLen = divs[i].textContent.length;
          contentEl = divs[i];
        }
      }
    }
    if (contentEl) {
      var junk = contentEl.querySelectorAll('script, style, iframe, nav, header, footer, .ads, .advertisement');
      junk.forEach(function(n) { n.remove(); });
      return contentEl.innerHTML;
    }
    return '<p>无法解析章节内容</p>';
  }

  /* HTML 转纯文本段落（图片单独成段） */
  function htmlToParas(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var paras = [];
    var blockTags = { P: 1, DIV: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, SECTION: 1, ARTICLE: 1, BLOCKQUOTE: 1, TD: 1, TR: 1 };

    function flush(buf) {
      var t = buf.s.replace(/\s+/g, ' ').trim();
      if (t) paras.push({ t: 'text', s: t });
      buf.s = '';
    }

    function walk(node, buf) {
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === 3) {
          buf.s += child.textContent;
        } else if (child.nodeType === 1) {
          var tag = child.tagName;
          if (tag === 'BR') {
            flush(buf);
          } else if (tag === 'IMG') {
            flush(buf);
            var src = child.getAttribute('src');
            if (src) paras.push({ t: 'img', s: src });
          } else if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') {
            continue;
          } else if (blockTags[tag]) {
            flush(buf);
            walk(child, buf);
            flush(buf);
          } else {
            walk(child, buf);
          }
        }
      }
    }

    var buf = { s: '' };
    walk(tmp, buf);
    flush(buf);
    return paras;
  }

  /* ---------- 渲染：分页 or 滚动 ---------- */
  function renderChapter(opts) {
    var content = el('novelReaderContent');
    if (!content) return;
    if (isPaged()) {
      showLoading(true);
      // 让 loading 先绘制，再同步分页
      setTimeout(function() {
        paginate();
        var page = 0;
        if (opts.page === 'last') page = state.pages.length - 1;
        else page = clamp(parseInt(opts.page, 10) || 0, 0, state.pages.length - 1);
        cleanupPager();
        showPage(page, 1, false);
        showLoading(false);
        updateProgress();
      }, 30);
    } else {
      renderScroll(opts);
      updateProgress();
    }
  }

  function renderScroll(opts) {
    var content = el('novelReaderContent');
    cleanupPager();
    content.classList.remove('paged');
    var st = state.settings;
    var html = '';
    state.paras.forEach(function(p) {
      if (p.t === 'title') html += '<div class="chapter-title">' + esc(p.s) + '</div>';
      else if (p.t === 'img') html += '<img src="' + esc(p.s) + '" loading="lazy">';
      else html += '<p style="margin:0 0 ' + st.paraSpacing + 'px">' + esc(p.s) + '</p>';
    });
    content.innerHTML = html;
    state.pages = [];
    state.currentPage = 0;
    content.scrollTop = (opts && opts.scroll) ? parseInt(opts.scroll, 10) || 0 : 0;
  }

  function cleanupPager() {
    if (state.pagerEl && state.pagerEl.parentNode) state.pagerEl.parentNode.removeChild(state.pagerEl);
    state.pagerEl = null;
    state.frontEl = null;
    state.animating = false;
  }

  /* ---------- 分页引擎 ---------- */
  function getMeasure() {
    var stage = el('novelReaderStage');
    if (!measureEl) {
      measureEl = document.createElement('div');
      measureEl.className = 'novel-page novel-measure';
      stage.appendChild(measureEl);
    }
    var st = state.settings;
    measureEl.style.padding = '0';
    measureEl.style.fontSize = st.fontSize + 'px';
    measureEl.style.lineHeight = st.lineHeight;
    measureEl.style.fontFamily = fontCss(st.fontFamily);
    return measureEl;
  }

  function pageBox() {
    var content = el('novelReaderContent');
    var w = content.clientWidth - PAGE_PAD_X * 2;
    var h = content.clientHeight - PAGE_PAD_TOP - PAGE_PAD_BOTTOM;
    if (w <= 0) w = window.innerWidth - PAGE_PAD_X * 2;
    if (h <= 0) h = window.innerHeight - PAGE_PAD_TOP - PAGE_PAD_BOTTOM;
    return { w: w, h: h };
  }

  function makeParaNode(p, withMargin) {
    var st = state.settings;
    var node;
    if (p.t === 'title') {
      node = document.createElement('div');
      node.className = 'chapter-title';
      node.style.margin = '0 0 ' + (withMargin ? Math.round(st.fontSize * 1.2) : 0) + 'px';
    } else {
      node = document.createElement('p');
      node.style.margin = '0 0 ' + (withMargin ? st.paraSpacing : 0) + 'px';
    }
    node.textContent = p.s;
    return node;
  }

  function paraHeight(p, meas) {
    meas.innerHTML = '';
    var node = makeParaNode(p, false);
    meas.appendChild(node);
    var margin = p.t === 'title' ? Math.round(state.settings.fontSize * 1.2) : state.settings.paraSpacing;
    return node.offsetHeight + margin;
  }

  function fitsText(text, meas, availH) {
    meas.innerHTML = '';
    var node = makeParaNode({ t: 'text', s: text }, false);
    meas.appendChild(node);
    return node.offsetHeight <= availH;
  }

  function splitLongPara(p, availH, meas) {
    // 二分切分超长段落，保证每段高度 <= availH
    var out = [];
    var rest = p.s;
    var guard = 0;
    while (rest.length && guard++ < 300) {
      if (fitsText(rest, meas, availH)) { out.push(rest); break; }
      var lo = 1, hi = rest.length - 1, best = 1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (fitsText(rest.slice(0, mid), meas, availH)) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      out.push(rest.slice(0, best));
      rest = rest.slice(best);
    }
    if (!out.length) out.push(p.s);
    return out;
  }

  function paginate() {
    var box = pageBox();
    var meas = getMeasure();
    meas.style.width = box.w + 'px';

    // 预切分超长段落
    var items = [];
    state.paras.forEach(function(p) {
      if (p.t === 'img') { items.push(p); return; }
      var h = paraHeight(p, meas);
      if (h <= box.h) { items.push(p); return; }
      splitLongPara(p, box.h, meas).forEach(function(c) { items.push({ t: 'text', s: c }); });
    });

    var pages = [];
    var cur = [];
    var curH = 0;
    items.forEach(function(p) {
      var h = (p.t === 'img') ? box.h : paraHeight(p, meas);
      if (cur.length && curH + h > box.h) {
        pages.push(cur);
        cur = [];
        curH = 0;
      }
      cur.push(p);
      curH += h;
    });
    if (cur.length) pages.push(cur);
    state.pages = pages.length ? pages : [[{ t: 'text', s: '（本章暂无内容）' }]];
  }

  function renderPageHtml(idx) {
    var st = state.settings;
    var html = '';
    state.pages[idx].forEach(function(p) {
      if (p.t === 'title') html += '<div class="chapter-title" style="margin:0 0 ' + Math.round(st.fontSize * 1.2) + 'px">' + esc(p.s) + '</div>';
      else if (p.t === 'img') html += '<img src="' + esc(p.s) + '" loading="lazy">';
      else html += '<p style="margin:0 0 ' + st.paraSpacing + 'px">' + esc(p.s) + '</p>';
    });
    return html;
  }

  function ensurePager() {
    var content = el('novelReaderContent');
    if (!state.pagerEl) {
      content.innerHTML = '';
      var pager = document.createElement('div');
      pager.className = 'novel-pager' + (state.settings.flipMode === 'simulation' ? ' sim' : '');
      var eff = effectiveColors();
      pager.style.background = eff.bg;
      var front = document.createElement('div');
      front.className = 'novel-page';
      stylePage(front);
      pager.appendChild(front);
      content.appendChild(pager);
      state.pagerEl = pager;
      state.frontEl = front;
    }
    state.pagerEl.classList.toggle('sim', state.settings.flipMode === 'simulation');
    return state.pagerEl;
  }

  function showPage(idx, dir, animate) {
    if (!state.pages.length) return;
    idx = clamp(idx, 0, state.pages.length - 1);
    dir = dir || 1;
    var content = el('novelReaderContent');
    content.classList.add('paged');
    content.scrollTop = 0;
    var pager = ensurePager();
    var front = state.frontEl;
    var html = renderPageHtml(idx);
    var mode = state.settings.flipMode;
    state.currentPage = idx;

    if (!animate || mode === 'none' || mode === 'scroll' || state.animating) {
      front.classList.remove('anim-slide', 'anim-cover', 'anim-flip');
      front.style.transform = '';
      front.style.transformOrigin = '';
      front.style.zIndex = '';
      front.innerHTML = html;
      stylePage(front);
      updateProgress();
      saveProgress();
      return;
    }

    state.animating = true;
    var inEl = document.createElement('div');
    inEl.className = 'novel-page';
    stylePage(inEl);
    inEl.innerHTML = html;

    var commit = function() {
      front.classList.remove('anim-slide', 'anim-cover', 'anim-flip');
      front.style.transform = '';
      front.style.transformOrigin = '';
      front.style.zIndex = '';
      front.innerHTML = html;
      stylePage(front);
      if (inEl.parentNode) inEl.parentNode.removeChild(inEl);
      state.animating = false;
    };

    if (mode === 'slide' || mode === 'cover') {
      // 平移：新旧页一起滑动；覆盖：新页滑入盖住旧页
      var fromX = dir >= 0 ? '100%' : '-100%';
      inEl.style.transform = 'translateX(' + fromX + ')';
      if (mode === 'cover') inEl.style.zIndex = '3';
      pager.appendChild(inEl);
      void inEl.offsetWidth;
      inEl.classList.add(mode === 'slide' ? 'anim-slide' : 'anim-cover');
      inEl.style.transform = 'translateX(0)';
      if (mode === 'slide') {
        front.classList.add('anim-slide');
        front.style.transform = 'translateX(' + (dir >= 0 ? '-100%' : '100%') + ')';
      }
      setTimeout(commit, 260);
    } else {
      // 仿真：rotateY 翻页（perspective + 左缘 transform-origin）
      if (dir >= 0) {
        inEl.style.zIndex = '1';
        front.style.zIndex = '2';
        pager.appendChild(inEl);
        front.classList.add('anim-flip');
        front.style.transformOrigin = 'left center';
        front.style.transform = 'rotateY(-160deg)';
      } else {
        inEl.style.zIndex = '2';
        inEl.style.transformOrigin = 'left center';
        inEl.style.transform = 'rotateY(-160deg)';
        pager.appendChild(inEl);
        void inEl.offsetWidth;
        inEl.classList.add('anim-flip');
        inEl.style.transform = 'rotateY(0deg)';
      }
      setTimeout(commit, 300);
    }

    updateProgress();
    saveProgress();
  }

  /* 设置变化后重排，保持阅读位置 */
  function relayout() {
    if (!state.paras.length) return;
    if (!isPaged()) {
      renderScroll({ scroll: el('novelReaderContent') ? el('novelReaderContent').scrollTop : 0 });
      applySettings();
      updateProgress();
      return;
    }
    var anchor = null;
    if (state.pages.length && state.pages[state.currentPage] && state.pages[state.currentPage].length) {
      anchor = state.pages[state.currentPage][0];
    }
    paginate();
    var idx = 0;
    if (anchor) {
      for (var i = 0; i < state.pages.length; i++) {
        if (state.pages[i].indexOf(anchor) !== -1) { idx = i; break; }
      }
    }
    showPage(idx, 1, false);
    applySettings();
    updateProgress();
  }

  /* ---------- 翻页 / 章节 ---------- */
  function nextPage() {
    if (!isPaged()) { nextChapter(); return; }
    if (state.animating) return;
    if (state.currentPage < state.pages.length - 1) {
      showPage(state.currentPage + 1, 1, true);
    } else if (state.currentChapter < state.chapters.length - 1) {
      loadChapter(state.currentChapter + 1, { page: 0 });
    } else if (window.Toast) {
      Toast.show('已经是最后一章了');
    }
  }

  function prevPage() {
    if (!isPaged()) { prevChapter(); return; }
    if (state.animating) return;
    if (state.currentPage > 0) {
      showPage(state.currentPage - 1, -1, true);
    } else if (state.currentChapter > 0) {
      loadChapter(state.currentChapter - 1, { page: 'last' });
    } else if (window.Toast) {
      Toast.show('已经是第一章了');
    }
  }

  function nextChapter() {
    if (state.currentChapter < state.chapters.length - 1) {
      loadChapter(state.currentChapter + 1, { page: 0 });
    } else if (window.Toast) {
      Toast.show('已经是最后一章了');
    }
  }

  function prevChapter() {
    if (state.currentChapter > 0) {
      loadChapter(state.currentChapter - 1, { page: 'last' });
    }
  }

  /* ---------- 工具栏 / 进度 ---------- */
  function toggleScaffold() {
    state.scaffoldOpen = !state.scaffoldOpen;
    updateScaffold();
  }

  function updateScaffold() {
    var top = el('novelReaderTopbar');
    var bottom = el('novelReaderBottombar');
    var floatBox = el('novelReaderFloat');
    var title = el('novelReaderTitle');
    var indicator = el('novelReaderPageIndicator');

    if (top) top.classList.toggle('open', state.scaffoldOpen);
    if (bottom) bottom.classList.toggle('open', state.scaffoldOpen);
    if (floatBox) floatBox.classList.toggle('open', state.scaffoldOpen);
    // 悬浮球跟随工具栏：清屏时隐藏，呼出工具栏时显示
    if (window.Nav && Nav.setVisible) Nav.setVisible(state.scaffoldOpen);
    if (title) title.textContent = state.bookTitle;
    if (indicator) indicator.textContent = '第' + (state.currentChapter + 1) + '章 / 共' + state.chapters.length + '章';
  }

  function updateProgress() {
    var topCh = el('novelTopChapter');
    var topPage = el('novelTopPage');
    var fill = el('novelProgressFill');
    var ch = state.chapters[state.currentChapter];
    if (topCh) topCh.textContent = ch ? ch.name : '';
    if (isPaged() && state.pages.length) {
      if (topPage) topPage.textContent = (state.currentPage + 1) + '/' + state.pages.length;
      if (fill) fill.style.width = (((state.currentPage + 1) / state.pages.length) * 100) + '%';
    } else {
      var content = el('novelReaderContent');
      var max = content ? (content.scrollHeight - content.clientHeight) : 0;
      var ratio = max > 0 ? clamp(content.scrollTop / max, 0, 1) : 1;
      if (topPage) topPage.textContent = Math.round(ratio * 100) + '%';
      if (fill) fill.style.width = (ratio * 100) + '%';
    }
  }

  function showLoading(show) {
    var loading = el('novelReaderLoading');
    if (loading) loading.classList.toggle('hidden', !show);
  }

  var progressSaveTimer = null;
  function saveProgress(immediate) {
    var shelf = Store.state.read.shelf;
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i].url === state.bookUrl) {
        shelf[i].chapterIdx = state.currentChapter;
        shelf[i].chapterName = state.chapters[state.currentChapter] ? state.chapters[state.currentChapter].name : '';
        shelf[i].pageIdx = isPaged() ? state.currentPage : (el('novelReaderContent') ? el('novelReaderContent').scrollTop : 0);
        shelf[i].lastRead = Date.now();
        break;
      }
    }
    // 防抖落盘，避免频繁 localStorage 写入
    if (immediate) {
      if (progressSaveTimer) { clearTimeout(progressSaveTimer); progressSaveTimer = null; }
      Store.save();
      return;
    }
    if (progressSaveTimer) clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(function() { progressSaveTimer = null; Store.save(); }, 400);
  }

  /* ---------- 目录页 ---------- */
  function openCatalog() {
    state.catalogOpen = true;
    renderCatalog();
    el('novelCatalogPage').classList.add('open');
    // 自动滚动到当前章节
    setTimeout(function() {
      var pane = el('novelTocPane');
      var list = el('novelChapterList');
      var active = list ? list.querySelector('.novel-toc-item.active') : null;
      if (pane && active) {
        pane.scrollTop = Math.max(0, active.offsetTop - pane.clientHeight / 2);
      }
    }, 60);
  }

  function closeCatalog() {
    state.catalogOpen = false;
    el('novelCatalogPage').classList.remove('open');
  }

  function renderCatalog() {
    var cover = el('novelCatalogCover');
    if (state.cover) cover.innerHTML = '<img src="' + esc(state.cover) + '" alt="">';
    else cover.textContent = '📕';
    el('novelCatalogTitle').textContent = state.bookTitle || '未知书籍';
    var meta = [];
    if (state.author) meta.push(state.author);
    if (state.source) meta.push(state.source);
    el('novelCatalogMeta').textContent = meta.join(' · ') || '未知来源';

    // 详情
    el('novelDetailPane').textContent = state.intro || '暂无简介';

    // 目录统计
    var total = state.chapters.length;
    var lastName = total ? state.chapters[total - 1].name : '';
    el('novelTocStats').textContent = total ? ('连载至 ' + lastName + ' · 共' + total + '章') : '暂无章节';

    // 章节列表
    var html = '';
    state.chapters.forEach(function(ch, i) {
      var read = (i < state.currentChapter || (state.readMap[i] && i !== state.currentChapter));
      html += '<div class="novel-toc-item' + (i === state.currentChapter ? ' active' : '') + '" data-idx="' + i + '">';
      html += '<span class="toc-name">' + esc(ch.name) + '</span>';
      if (read) html += '<span class="toc-read">已读</span>';
      html += '</div>';
    });
    el('novelChapterList').innerHTML = html;

    syncNightBtn();
    switchCatalogTab('toc');
  }

  function switchCatalogTab(tab) {
    var isToc = tab === 'toc';
    el('novelTabToc').classList.toggle('active', isToc);
    el('novelTabDetail').classList.toggle('active', !isToc);
    el('novelTocPane').classList.toggle('hidden', !isToc);
    el('novelDetailPane').classList.toggle('hidden', isToc);
  }

  function syncNightBtn() {
    var btn = el('novelActNight');
    if (!btn || !state.settings) return;
    btn.innerHTML = state.settings.night ? '<i>☀</i>日间' : '<i>☾</i>夜间';
    btn.classList.toggle('active', state.settings.night);
  }

  function toggleNight() {
    saveSetting('night', !state.settings.night);
    applySettings();
    syncNightBtn();
    if (window.Toast) Toast.show(state.settings.night ? '夜间模式已开启' : '夜间模式已关闭');
  }

  /* ---------- 设置面板 ---------- */
  function openSheet() {
    state.sheetOpen = true;
    syncSheetUI();
    el('novelSheetMask').classList.add('open');
    el('novelSettingsSheet').classList.add('open');
  }

  function closeSheet() {
    state.sheetOpen = false;
    state.fontPanelOpen = false;
    el('novelSheetMask').classList.remove('open');
    el('novelSettingsSheet').classList.remove('open');
    el('novelFontPanel').classList.remove('open');
  }

  function buildSheetControls() {
    // 颜色圆点
    var html = '';
    TEXT_COLORS.forEach(function(c) {
      html += '<button class="novel-color-dot" data-color="' + c.value + '" title="' + c.name + '" style="background:' + c.value + ';"></button>';
    });
    el('novelColorRow').innerHTML = html;

    // 背景卡
    html = '';
    BG_THEMES.forEach(function(t) {
      html += '<button class="novel-bg-card" data-bg="' + t.id + '" style="background:' + t.value + ';color:' + t.text + ';">' + t.name + '</button>';
    });
    el('novelBgRow').innerHTML = html;

    // 翻页模式
    html = '';
    FLIP_MODES.forEach(function(m) {
      html += '<button class="novel-flip-btn" data-flip="' + m.id + '">' + m.name + '</button>';
    });
    el('novelFlipRow').innerHTML = html;

    // 字体网格（「永」字预览）
    html = '';
    FONT_STACKS.forEach(function(f) {
      html += '<div class="novel-font-cell" data-font="' + f.id + '">';
      html += '<div class="fpreview" style="font-family:' + f.css + ';">永</div>';
      html += '<div class="fname">' + f.name + '</div>';
      html += '</div>';
    });
    el('novelFontGrid').innerHTML = html;

    syncSheetUI();
  }

  function syncSheetUI() {
    var st = state.settings;
    if (!st) return;
    var bright = el('novelBrightness');
    if (bright) bright.value = getBrightness();
    var fv = el('novelFontValue');
    if (fv) fv.textContent = st.fontSize;
    var fn = el('novelFontName');
    if (fn) fn.textContent = fontName(st.fontFamily) + ' ›';
    var lh = el('novelLineHeight');
    if (lh) lh.value = st.lineHeight;
    var lhv = el('novelLhValue');
    if (lhv) lhv.textContent = st.lineHeight.toFixed(1);
    var ps = el('novelParaSpacing');
    if (ps) ps.value = st.paraSpacing;
    var psv = el('novelPsValue');
    if (psv) psv.textContent = st.paraSpacing + 'px';

    document.querySelectorAll('#novelColorRow .novel-color-dot').forEach(function(d) {
      d.classList.toggle('active', d.dataset.color.toLowerCase() === (st.textColor || '').toLowerCase());
    });
    document.querySelectorAll('#novelBgRow .novel-bg-card').forEach(function(c) {
      c.classList.toggle('active', c.dataset.bg === st.bgTheme);
    });
    document.querySelectorAll('#novelFlipRow .novel-flip-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.flip === st.flipMode);
    });
    document.querySelectorAll('#novelFontGrid .novel-font-cell').forEach(function(c) {
      c.classList.toggle('active', c.dataset.font === st.fontFamily);
    });
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    el('novelReaderBack').addEventListener('click', close);
    el('novelReaderMenu').addEventListener('click', function() {
      state.sheetOpen ? closeSheet() : openSheet();
    });

    el('novelReaderPrevCh').addEventListener('click', prevChapter);
    el('novelReaderNextCh').addEventListener('click', nextChapter);

    el('novelReaderChBtn').addEventListener('click', function() {
      state.catalogOpen ? closeCatalog() : openCatalog();
    });
    el('novelReaderSetBtn').addEventListener('click', function() {
      state.sheetOpen ? closeSheet() : openSheet();
    });

    // 目录页
    el('novelCatalogBack').addEventListener('click', closeCatalog);
    el('novelTabToc').addEventListener('click', function() { switchCatalogTab('toc'); });
    el('novelTabDetail').addEventListener('click', function() { switchCatalogTab('detail'); });
    el('novelChapterList').addEventListener('click', function(e) {
      var item = e.target.closest('.novel-toc-item');
      if (!item) return;
      var idx = parseInt(item.dataset.idx, 10);
      closeCatalog();
      if (idx !== state.currentChapter) loadChapter(idx, { page: 0 });
      else if (isPaged()) showPage(0, -1, false);
    });
    el('novelActToc').addEventListener('click', function() {
      switchCatalogTab('toc');
      var pane = el('novelTocPane');
      var list = el('novelChapterList');
      var active = list ? list.querySelector('.novel-toc-item.active') : null;
      if (pane && active) pane.scrollTop = Math.max(0, active.offsetTop - pane.clientHeight / 2);
    });
    el('novelActNight').addEventListener('click', toggleNight);
    el('novelActSet').addEventListener('click', openSheet);
    el('novelActShelf').addEventListener('click', function() {
      closeCatalog();
      close();
    });

    // 设置面板
    el('novelSheetMask').addEventListener('click', closeSheet);

    el('novelBrightness').addEventListener('input', function() {
      var v = clamp(parseInt(this.value, 10) || 100, 10, 100);
      localStorage.setItem(BRIGHTNESS_KEY, String(v));
      applyBrightness();
    });

    el('novelFontMinus').addEventListener('click', function() {
      var v = clamp(state.settings.fontSize - 1, 12, 32);
      if (v === state.settings.fontSize) return;
      saveSetting('fontSize', v);
      applySettings();
      relayout();
    });
    el('novelFontPlus').addEventListener('click', function() {
      var v = clamp(state.settings.fontSize + 1, 12, 32);
      if (v === state.settings.fontSize) return;
      saveSetting('fontSize', v);
      applySettings();
      relayout();
    });

    el('novelFontBtn').addEventListener('click', function() {
      state.fontPanelOpen = true;
      syncSheetUI();
      el('novelFontPanel').classList.add('open');
    });
    el('novelFontBack').addEventListener('click', function() {
      state.fontPanelOpen = false;
      el('novelFontPanel').classList.remove('open');
    });
    el('novelFontGrid').addEventListener('click', function(e) {
      var cell = e.target.closest('.novel-font-cell');
      if (!cell) return;
      saveSetting('fontFamily', cell.dataset.font);
      fadeUpdate(function() {
        applySettings();
        relayout();
      });
    });

    el('novelColorRow').addEventListener('click', function(e) {
      var dot = e.target.closest('.novel-color-dot');
      if (!dot) return;
      // 手动覆盖文字颜色
      saveSetting('textColor', dot.dataset.color);
      applySettings();
    });

    el('novelBgRow').addEventListener('click', function(e) {
      var card = e.target.closest('.novel-bg-card');
      if (!card) return;
      var t = bgTheme(card.dataset.bg);
      saveSetting('bgTheme', t.id);
      // 背景与文字颜色联动：深色背景自动配浅色字，反之亦然（用户可再手动覆盖）
      saveSetting('textColor', t.text);
      fadeUpdate(function() {
        applySettings();
      });
    });

    el('novelFlipRow').addEventListener('click', function(e) {
      var btn = e.target.closest('.novel-flip-btn');
      if (!btn) return;
      var mode = btn.dataset.flip;
      if (mode === state.settings.flipMode) return;
      saveSetting('flipMode', mode);
      if (mode === 'scroll') {
        renderScroll({ scroll: 0 });
      } else {
        paginate();
        cleanupPager();
        showPage(clamp(state.currentPage, 0, state.pages.length - 1), 1, false);
      }
      applySettings();
      updateProgress();
    });

    el('novelSpacingBtn').addEventListener('click', function() {
      el('novelSpacingBox').classList.toggle('hidden');
    });
    el('novelLineHeight').addEventListener('input', function() {
      var v = clamp(parseFloat(this.value) || 1.6, 1.2, 2.4);
      saveSetting('lineHeight', Math.round(v * 10) / 10);
      el('novelLhValue').textContent = state.settings.lineHeight.toFixed(1);
      applySettings();
      relayout();
    });
    el('novelParaSpacing').addEventListener('input', function() {
      var v = clamp(parseInt(this.value, 10) || 0, 0, 24);
      saveSetting('paraSpacing', v);
      el('novelPsValue').textContent = v + 'px';
      applySettings();
      relayout();
    });

    // 内容区点击：左右 1/3 翻页，中间呼出工具栏
    var content = el('novelReaderContent');
    content.addEventListener('click', function(e) {
      if (touchMoved) { touchMoved = false; return; }
      if (state.catalogOpen || state.sheetOpen) return;
      if (isPaged()) {
        var w = window.innerWidth;
        var x = e.clientX;
        if (x < w / 3) prevPage();
        else if (x > w * 2 / 3) nextPage();
        else toggleScaffold();
      } else {
        var h = window.innerHeight;
        var y = e.clientY;
        if (y > h * 0.3 && y < h * 0.7) toggleScaffold();
        else if (y < h * 0.3) prevChapter();
        else nextChapter();
      }
    });

    // 左右滑动手势翻页
    content.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchMoved = false;
    }, { passive: true });
    content.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      if (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10) touchMoved = true;
    }, { passive: true });
    content.addEventListener('touchend', function(e) {
      if (!isPaged() || state.catalogOpen || state.sheetOpen) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) nextPage();
        else prevPage();
      }
    }, { passive: true });

    // 上下滚动模式：进度与位置记忆
    content.addEventListener('scroll', function() {
      if (isPaged()) return;
      updateProgress();
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(saveProgress, 400);
    }, { passive: true });

    // 窗口变化重排（显示 loading）
    window.addEventListener('resize', function() {
      var overlay = el('novelReaderOverlay');
      if (!overlay || overlay.classList.contains('hidden')) return;
      if (!isPaged() || !state.paras.length) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        showLoading(true);
        setTimeout(function() {
          relayout();
          showLoading(false);
        }, 30);
      }, 200);
    });
  }

  return { open, close };
})();
