/* ==================== OmniHub Read Module v8.0 ==================== */

const ReadModule = (() => {
  'use strict';

  var currentTab = 'all';
  var readView = 'shelf';           // shelf | discover | bookmark
  var TRASH_TTL = 15 * 24 * 3600 * 1000;  // 回收站 15 天过期

  // 发现页状态
  var discover = {
    sourceId: '',
    tags: [],
    activeTag: -1,
    books: [],
    keyword: '',
    loading: false
  };

  // 长按状态
  var lpTimer = null;
  var lpFired = false;

  var ENGINE_META = {
    legado: { label: 'Legado', color: '#2e9e5b' },
    venera: { label: 'Venera', color: '#6366F1' },
    css:    { label: 'CSS',    color: '#8a8f99' }
  };

  function el(id) { return document.getElementById(id); }

  function init() {
    // 运行时默认值：RSS 订阅源列表（新键）
    if (!Store.state.read.rssSources) {
      Store.state.read.rssSources = [];
      Store.save();
    }
    migrateSources();
    purgeExpiredTrash();
    preloadVeneraSources();
    renderRead();
    renderReadSettings();
    bindEvents();
  }

  /* ---------- 老数据迁移：无 engine 的按 type 推断 ---------- */
  function migrateSources() {
    var changed = false;
    Store.state.read.sources.forEach(function(s) {
      if (!s.engine) {
        s.engine = s.type === 'venera' ? 'venera' : 'css';
        changed = true;
      }
      if (s.enabled === undefined) { s.enabled = true; changed = true; }
    });
    if (changed) Store.save();
  }

  /* ---------- 启动时把已存 Venera 图源脚本装入引擎 ---------- */
  function preloadVeneraSources() {
    if (typeof VeneraEngine === 'undefined') return;
    Store.state.read.sources.forEach(function(s) {
      if (engineOf(s) !== 'venera' || !s.raw) return;
      var key = s.key || s.name;
      if (VeneraEngine.ComicSource.sources[key]) return;
      try { VeneraEngine.loadSource(s.raw, key); }
      catch (e) { console.warn('Venera 图源预加载失败:', s.name, e); }
    });
  }

  function engineOf(src) {
    return src.engine || (src.type === 'venera' ? 'venera' : 'css');
  }

  function findSource(key) {
    return Store.state.read.sources.find(function(s) {
      return s.name === key || s.key === key || s.id === key;
    });
  }

  function esc(s) {
    return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ==================== 书架页渲染 ==================== */

  function renderRead() {
    var body = el('readBody');
    if (!body) return;

    if (readView === 'discover') { renderDiscover(); return; }
    if (readView === 'bookmark') { renderBookmark(); return; }
    if (readView === 'profile') { renderReadMine(); return; }

    var html = '';
    // 下划线式 Tab 栏（持久指示条）
    html += '<div class="read-tabs" id="readTabs">';
    html += '<button class="read-tab' + (currentTab === 'all' ? ' active' : '') + '" data-tab="all">全部</button>';
    html += '<button class="read-tab' + (currentTab === 'novel' ? ' active' : '') + '" data-tab="novel">小说</button>';
    html += '<button class="read-tab' + (currentTab === 'comic' ? ' active' : '') + '" data-tab="comic">漫画</button>';
    html += '<i class="read-tabs-indicator" id="readTabsIndicator"></i>';
    html += '</div>';
    html += '<div id="readShelfWrap">';
    html += renderShelfWrap();
    html += '</div>';

    body.innerHTML = html;
    requestAnimationFrame(updateTabIndicator);
  }

  /* 书架网格 + 空状态（Tab 切换时只刷新这一块，Tab 栏与指示条不动） */
  function renderShelfWrap() {
    var shelf = Store.state.read.shelf;
    var filtered = currentTab === 'all' ? shelf : shelf.filter(function(b) { return b.type === currentTab; });

    if (!filtered.length) {
      if (shelf.length) {
        return '<div class="empty-state" style="padding-top:40px;">'
          + '<div class="empty-icon">📚</div>'
          + '<div class="empty-text">该分类下暂无书籍</div>'
          + '<button class="empty-action-btn" id="emptyGoSearch">去搜索</button>'
          + '</div>';
      }
      return '<div class="empty-state" style="padding-top:40px;">'
        + '<div class="empty-icon">📚</div>'
        + '<div class="empty-text">书架还空着，先去搜索书籍或从发现里添加吧！</div>'
        + '<button class="empty-action-btn" id="emptyGoSearch">去搜索</button>'
        + '</div>';
    }

    var html = '<div class="shelf-grid" id="shelfGrid">';
    filtered.forEach(function(b) {
      html += '<div class="shelf-item" data-url="' + esc(b.url) + '" data-type="' + (b.type || 'novel') + '">';
      html += '<div class="shelf-cover">';
      if (b.cover) {
        html += '<img src="' + esc(b.cover) + '" alt="" loading="lazy">';
      } else {
        html += '<div class="shelf-cover-placeholder">' + (b.type === 'comic' ? '📖' : '📕') + '</div>';
      }
      html += '</div>';
      html += '<div class="shelf-name">' + esc(b.title) + '</div>';
      if (b.chapterName) {
        html += '<div style="font-size:11px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(b.chapterName) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function refreshShelf() {
    var wrap = el('readShelfWrap');
    if (wrap) wrap.innerHTML = renderShelfWrap();
  }

  /* 指示条滑动到当前 Tab */
  function updateTabIndicator() {
    var indicator = el('readTabsIndicator');
    var tabs = el('readTabs');
    if (!indicator || !tabs) return;
    var active = tabs.querySelector('.read-tab.active');
    if (!active) { indicator.style.width = '0'; return; }
    indicator.style.left = active.offsetLeft + 'px';
    indicator.style.width = active.offsetWidth + 'px';
  }

  function setTab(tab) {
    if (currentTab === tab) return;
    currentTab = tab;
    var tabs = el('readTabs');
    if (tabs) {
      tabs.querySelectorAll('.read-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
    }
    updateTabIndicator();
    refreshShelf();
  }

  /* ---------- 底部导航视图切换 ---------- */
  function setView(view) {
    readView = view;
    document.querySelectorAll('#readBottomNav .read-nav-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.readview === view);
    });
    renderRead();
  }

  /* ==================== 书签页（最近阅读） ==================== */

  function renderBookmark() {
    var body = el('readBody');
    if (!body) return;
    var list = Store.state.read.shelf.slice().sort(function(a, b) {
      return (b.lastRead || 0) - (a.lastRead || 0);
    });
    if (!list.length) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">🔖</div>'
        + '<div class="empty-text">暂无书签</div>'
        + '<div class="empty-sub">阅读记录会显示在这里</div></div>';
      return;
    }
    var html = '<div class="discover-list">';
    list.forEach(function(b, i) {
      html += '<div class="discover-book bookmark-item" data-url="' + esc(b.url) + '" style="animation-delay:' + (i * 40) + 'ms">';
      html += '<div class="discover-book-cover">' + (b.cover ? '<img src="' + esc(b.cover) + '" alt="">' : (b.type === 'comic' ? '📖' : '📕')) + '</div>';
      html += '<div class="discover-book-info">';
      html += '<div class="discover-book-title">' + esc(b.title) + '</div>';
      html += '<div class="discover-book-author">' + esc(b.author || '未知') + ' · ' + (b.type === 'comic' ? '漫画' : '小说') + '</div>';
      html += '<div class="discover-book-intro">' + (b.chapterName ? ('读至 ' + esc(b.chapterName)) : '尚未开始阅读') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  /* ==================== 发现页 ==================== */

  /* 有发现内容的书源：Venera 有 explore，Legado 有 exploreRule 分类 */
  function sourceExploreInfo(src) {
    var engine = engineOf(src);
    if (engine === 'venera') {
      var obj = (typeof VeneraEngine !== 'undefined') && VeneraEngine.ComicSource.sources[src.key || src.name];
      var has = !!(obj && obj.explore && obj.explore.length) || !!src.hasExplore;
      return { has: has, engine: 'venera' };
    }
    if (engine === 'legado') {
      var cats = legadoCategories(src);
      return { has: cats.length > 0, engine: 'legado' };
    }
    return { has: false, engine: engine };
  }

  function legadoCategories(src) {
    if (src.exploreRule && src.exploreRule.categories && src.exploreRule.categories.length) {
      return src.exploreRule.categories;
    }
    if (typeof LegadoConverter !== 'undefined' && src.raw) {
      return LegadoConverter.parseExploreCategories(src.raw);
    }
    return [];
  }

  function renderDiscover() {
    var body = el('readBody');
    if (!body) return;
    var sources = Store.state.read.sources;

    var html = '';
    // 顶部：搜索框 + 书源自定义下拉（绿点/红点/无标志）
    html += '<div class="discover-bar"><input type="text" id="discoverFilter" placeholder="筛选发现" value="' + esc(discover.keyword) + '"></div>';
    html += '<div class="discover-source-row"><div class="discover-source-custom" id="discoverSourceCustom">';
    html += '<button type="button" class="discover-source-btn" id="discoverSourceBtn"><span id="discoverSourceLabel">请选择书源</span><i class="discover-source-arrow"></i></button>';
    html += '<div class="discover-source-menu hidden" id="discoverSourceMenu">';
    if (!sources.length) {
      html += '<div class="discover-source-option disabled">暂无书源，请先导入</div>';
    } else {
      sources.forEach(function(s) {
        var info = sourceExploreInfo(s);
        var dotCls = info.has ? (s.enabled ? 'green' : 'red') : 'none';
        var sid = s.id || s.key || s.name;
        html += '<div class="discover-source-option" data-sid="' + esc(sid) + '">'
          + '<i class="discover-dot ' + dotCls + '"></i>' + esc(s.name) + '</div>';
      });
    }
    html += '</div></div>';
    html += '<div class="discover-source-hint"><span><i class="discover-dot green"></i>有发现·已启用</span><span><i class="discover-dot red"></i>有发现·未启用</span><span>无标志：无发现内容</span></div>';
    html += '</div>';
    html += '<div class="discover-tags" id="discoverTags"></div>';
    html += '<div id="discoverListWrap"></div>';
    body.innerHTML = html;

    if (!sources.length) {
      el('discoverListWrap').innerHTML = emptyDiscoverHtml('当前没有发现源！', true);
      return;
    }

    // 默认选中第一个书源
    var first = sources[0];
    if (!discover.sourceId || !findSource(discover.sourceId)) {
      discover.sourceId = first.id || first.key || first.name;
    }
    updateDiscoverSourceLabel();
    loadDiscoverTags();
  }

  /* 自定义书源下拉：按钮文字同步当前选中源 */
  function updateDiscoverSourceLabel() {
    var label = el('discoverSourceLabel');
    if (!label) return;
    var src = currentDiscoverSource();
    label.textContent = src ? src.name : '请选择书源';
  }

  function closeDiscoverSourceMenu() {
    var menu = el('discoverSourceMenu');
    if (menu) menu.classList.add('hidden');
  }

  function emptyDiscoverHtml(msg, showRefresh) {
    var html = '<div class="empty-state"><div class="empty-icon">🧭</div>';
    html += '<div class="empty-text">' + esc(msg || '当前没有发现源！') + '</div>';
    html += '<div class="empty-sub">可切换其他书源试试</div>';
    if (showRefresh) html += '<button class="empty-action-btn" id="discoverRefresh">刷新</button>';
    html += '</div>';
    return html;
  }

  function currentDiscoverSource() {
    return findSource(discover.sourceId) || null;
  }

  async function loadDiscoverTags() {
    var tagsBox = el('discoverTags');
    var listWrap = el('discoverListWrap');
    if (!tagsBox || !listWrap) return;
    var src = currentDiscoverSource();
    discover.tags = [];
    discover.activeTag = -1;

    if (!src) {
      listWrap.innerHTML = emptyDiscoverHtml('当前没有发现源！', true);
      return;
    }
    if (!src.enabled) {
      tagsBox.innerHTML = '';
      listWrap.innerHTML = emptyDiscoverHtml('该书源未启用', false).replace('</div></div>',
        '<button class="empty-action-btn" id="discoverEnable" data-name="' + esc(src.name) + '">启用并刷新</button></div></div>');
      return;
    }

    var engine = engineOf(src);
    if (engine === 'venera') {
      var obj = (typeof VeneraEngine !== 'undefined') && VeneraEngine.ComicSource.sources[src.key || src.name];
      if (!obj && src.raw && typeof VeneraEngine !== 'undefined') {
        try { obj = VeneraEngine.loadSource(src.raw, src.key || src.name); } catch (e) {}
      }
      if (obj && obj.explore && obj.explore.length) {
        discover.tags = obj.explore.map(function(p, i) {
          return { title: p.title || ('分类 ' + (i + 1)), engine: 'venera', idx: i };
        });
      }
    } else if (engine === 'legado') {
      discover.tags = legadoCategories(src).map(function(c) {
        return { title: c.title, engine: 'legado', url: c.url };
      });
    }

    if (!discover.tags.length) {
      tagsBox.innerHTML = '';
      listWrap.innerHTML = emptyDiscoverHtml('当前没有发现源！', true);
      return;
    }

    var html = '';
    discover.tags.forEach(function(t, i) {
      html += '<button class="discover-tag" data-tag="' + i + '">' + esc(t.title) + '</button>';
    });
    tagsBox.innerHTML = html;
    selectDiscoverTag(0);
  }

  function renderDiscoverBooks() {
    var listWrap = el('discoverListWrap');
    if (!listWrap) return;
    var kw = (discover.keyword || '').toLowerCase();
    var books = discover.books.filter(function(b) {
      if (!kw) return true;
      return (b.name || '').toLowerCase().indexOf(kw) > -1 || (b.author || '').toLowerCase().indexOf(kw) > -1;
    });
    if (!books.length) {
      listWrap.innerHTML = emptyDiscoverHtml(kw ? '没有匹配「' + discover.keyword + '」的结果' : '该分类暂无内容', true);
      return;
    }
    var html = '<div class="discover-list">';
    books.forEach(function(b, i) {
      html += '<div class="discover-book" data-idx="' + discover.books.indexOf(b) + '" style="animation-delay:' + Math.min(i * 50, 500) + 'ms">';
      html += '<div class="discover-book-cover">' + (b.cover ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy">' : '📖') + '</div>';
      html += '<div class="discover-book-info">';
      html += '<div class="discover-book-title">' + esc(b.name) + '</div>';
      html += '<div class="discover-book-author">' + esc(b.author || '未知') + '</div>';
      html += '<div class="discover-book-intro">' + esc(b.description || b.intro || '') + '</div>';
      html += '</div></div>';
    });
    html += '</div>';
    listWrap.innerHTML = html;
  }

  async function selectDiscoverTag(idx) {
    var tag = discover.tags[idx];
    if (!tag) return;
    discover.activeTag = idx;
    var tagsBox = el('discoverTags');
    if (tagsBox) {
      tagsBox.querySelectorAll('.discover-tag').forEach(function(t) {
        t.classList.toggle('active', parseInt(t.dataset.tag, 10) === idx);
      });
    }
    var listWrap = el('discoverListWrap');
    if (!listWrap) return;
    // 骨架屏：5 条，封面随机高度更贴近真实列表
    var sk = '';
    for (var i = 0; i < 5; i++) {
      var skh = 64 + Math.floor(Math.random() * 48);
      sk += '<div class="discover-skeleton"><div class="sk-cover" style="height:' + skh + 'px"></div><div class="sk-lines"><div class="sk-line" style="width:60%"></div><div class="sk-line" style="width:40%"></div><div class="sk-line" style="width:90%"></div></div></div>';
    }
    listWrap.innerHTML = '<div class="discover-list">' + sk + '</div>';
    discover.loading = true;

    var src = currentDiscoverSource();
    try {
      var books = [];
      if (tag.engine === 'venera' && typeof VeneraEngine !== 'undefined') {
        books = await VeneraEngine.explore(src.key || src.name, tag.idx, 1);
      } else if (tag.engine === 'legado' && typeof LegadoConverter !== 'undefined') {
        books = await LegadoConverter.exploreBooks(src, { title: tag.title, url: tag.url }, 1);
        books.forEach(function(b) { b.sourceName = src.name; });
      }
      discover.books = books || [];
      discover.loading = false;
      renderDiscoverBooks();
    } catch (e) {
      discover.loading = false;
      discover.books = [];
      console.warn('发现加载失败:', e);
      listWrap.innerHTML = emptyDiscoverHtml('当前没有发现源！', true);
    }
  }

  /* ==================== 书籍详情弹层 ==================== */

  function ensureDetailSheet() {
    if (el('bookDetailMask')) return;
    var mask = document.createElement('div');
    mask.className = 'book-detail-mask';
    mask.id = 'bookDetailMask';
    var sheet = document.createElement('div');
    sheet.className = 'book-detail-sheet';
    sheet.id = 'bookDetailSheet';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    mask.addEventListener('click', closeBookDetail);
  }

  function closeBookDetail() {
    var mask = el('bookDetailMask');
    var sheet = el('bookDetailSheet');
    if (mask) mask.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
  }

  async function openBookDetail(book) {
    var src = findSource(book.sourceKey || book.sourceName || book.source || discover.sourceId);
    if (!src) return Toast.show('书源不存在', 'error');
    ensureDetailSheet();
    var mask = el('bookDetailMask');
    var sheet = el('bookDetailSheet');
    var title = book.name || book.title || '';

    sheet.innerHTML = '<div class="book-detail-head">'
      + '<div class="book-detail-cover">' + (book.cover ? '<img src="' + esc(book.cover) + '" alt="">' : '📖') + '</div>'
      + '<div><div class="book-detail-title">' + esc(title) + '</div>'
      + '<div class="book-detail-meta">' + esc(book.author || '未知') + ' · ' + esc(src.name) + '</div></div></div>'
      + '<div class="book-detail-intro">' + esc(book.description || book.intro || '暂无简介') + '</div>'
      + '<div class="book-detail-chapters" id="bookDetailChapters"><div class="empty-state"><div class="loading-spinner"></div></div></div>'
      + '<div class="book-detail-actions">'
      + '<button class="ghost" id="bookDetailShelf">加入书架</button>'
      + '<button id="bookDetailRead">开始阅读</button></div>';

    mask.classList.add('open');
    sheet.classList.add('open');

    var mediaType = book.mediaType || src.mediaType || (engineOf(src) === 'venera' ? 'comic' : 'novel');
    var bookData = {
      id: book.id || book.url, title: title, url: book.url || book.id,
      cover: book.cover || '', author: book.author || '',
      type: mediaType, source: src.name
    };

    el('bookDetailShelf').addEventListener('click', function() {
      addToShelf(bookData);
    });
    el('bookDetailRead').addEventListener('click', function() {
      addToShelfSilent(bookData);
      closeBookDetail();
      openBook(bookData);
    });

    // 加载章节列表
    var chBox = el('bookDetailChapters');
    try {
      var chapters = [];
      var engine = engineOf(src);
      if (engine === 'venera' && typeof VeneraEngine !== 'undefined') {
        var det = await VeneraEngine.getComicDetails(src.key || src.name, book.id || book.url);
        chapters = det ? det.chapters : [];
        if (det && det.description && !book.description) {
          var introEl = sheet.querySelector('.book-detail-intro');
          if (introEl) introEl.textContent = det.description;
        }
      } else if (engine === 'legado' && typeof LegadoEngine !== 'undefined') {
        var info = null;
        try { info = await LegadoEngine.getBookInfo(src.raw, book.url || book.id); } catch (e) {}
        chapters = await LegadoEngine.getToc(src.raw, { url: book.url || book.id }, info && info.tocUrl);
        chapters = chapters.filter(function(c) { return c.url; });
      }
      if (!chapters.length) {
        chBox.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-text">暂无章节</div></div>';
        return;
      }
      var html = '';
      chapters.slice(0, 200).forEach(function(ch, i) {
        html += '<div class="book-detail-ch" data-ch="' + i + '">' + esc(ch.name) + '</div>';
      });
      if (chapters.length > 200) html += '<div class="trash-item-time" style="padding:10px 2px;">仅显示前 200 章，共 ' + chapters.length + ' 章</div>';
      chBox.innerHTML = html;
      chBox.addEventListener('click', function(e) {
        var item = e.target.closest('.book-detail-ch');
        if (!item) return;
        var idx = parseInt(item.dataset.ch, 10) || 0;
        addToShelfSilent(bookData);
        var shelfBook = Store.state.read.shelf.find(function(b) { return b.url === bookData.url; });
        if (shelfBook) { shelfBook.chapterIdx = idx; Store.save(); }
        closeBookDetail();
        openBook(bookData);
      });
    } catch (e) {
      chBox.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-text">章节加载失败</div></div>';
    }
  }

  /* ==================== 书架操作 ==================== */

  function addToShelf(book) {
    var added = addToShelfSilent(book);
    Toast.show(added ? '已加入书架' : '已在书架中');
    if (readView === 'shelf') refreshShelf();
  }

  function addToShelfSilent(book) {
    var exists = Store.state.read.shelf.find(function(b) { return b.url === book.url; });
    if (exists) return false;
    Store.state.read.shelf.unshift({
      id: book.id || book.url,
      title: book.title,
      author: book.author || '',
      cover: book.cover || '',
      type: book.type || 'novel',
      url: book.url,
      source: book.source || '',
      chapterIdx: 0,
      pageIdx: 0,
      chapterName: '',
      lastRead: Date.now()
    });
    Store.save();
    return true;
  }

  async function openBook(book) {
    var src = findSource(book.source);
    if (!src) return Toast.show('书源已删除', 'error');

    var engine = engineOf(src);
    var chapters = [];
    var bookInfo = null;
    try {
      if (engine === 'legado' && typeof LegadoEngine !== 'undefined') {
        var info = null;
        try { info = await LegadoEngine.getBookInfo(src.raw, book.url); } catch(e) { console.warn('Legado 详情获取失败:', e); }
        bookInfo = info;
        chapters = await LegadoEngine.getToc(src.raw, { url: book.url }, info && info.tocUrl);
        // 分卷标题没有章节地址，阅读器不支持，过滤
        chapters = chapters.filter(function(c) { return c.url; });
      } else if (engine === 'venera' && typeof VeneraEngine !== 'undefined') {
        var det = await VeneraEngine.getComicDetails(src.key || src.name, book.url || book.id);
        chapters = det ? det.chapters : [];
      } else {
        chapters = await fetchChaptersCss(book.url, src);
      }
    } catch(e) {
      console.warn('获取章节失败:', e);
      return Toast.show('获取章节失败: ' + (e.message || ''), 'error');
    }

    if (!chapters.length) return Toast.show('未找到章节', 'error');

    var shelfBook = Store.state.read.shelf.find(function(b) { return b.url === book.url; });
    var chapterIdx = shelfBook ? (shelfBook.chapterIdx || 0) : 0;

    if (book.type === 'novel' || src.mediaType === 'novel') {
      if (typeof NovelReader !== 'undefined') {
        NovelReader.open({
          title: book.title,
          url: book.url,
          source: book.source,
          sourceType: engine,
          chapters: chapters,
          currentChapter: chapterIdx,
          cover: book.cover || (shelfBook && shelfBook.cover) || (bookInfo && bookInfo.cover) || '',
          author: book.author || (shelfBook && shelfBook.author) || (bookInfo && bookInfo.author) || '',
          intro: (bookInfo && bookInfo.intro) || ''
        });
      } else {
        Toast.show('小说阅读器未加载', 'error');
      }
    } else {
      if (typeof Reader !== 'undefined') {
        Reader.open({
          title: book.title,
          url: book.url,
          source: book.source,
          sourceType: engine,
          chapters: chapters,
          currentChapter: chapterIdx,
          currentPage: shelfBook ? (shelfBook.pageIdx || 0) : 0
        });
      } else {
        Toast.show('漫画阅读器未加载', 'error');
      }
    }
  }

  async function fetchChaptersCss(url, src) {
    try {
      // 统一抓取封装：直连 → worker 代理 → 公共代理
      var html = (typeof NetFetch !== 'undefined')
        ? await NetFetch.text(url, {})
        : await (await fetch(url, { mode: 'cors', credentials: 'omit' })).text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var list = [];
      var rows = doc.querySelectorAll(src.chapterList || 'a');
      rows.forEach(function(a) {
        var href = a.getAttribute('href') || '';
        list.push({
          name: a.textContent.trim(),
          url: href.startsWith('http') ? href : (src.url + href)
        });
      });
      return list;
    } catch(e) { return []; }
  }

  /* ==================== 搜索 ==================== */

  async function doSearch() {
    var input = el('readSearchInput');
    if (!input) return;
    var keyword = input.value.trim();
    if (!keyword) return Toast.show('请输入关键词', 'error');

    var resultsBox = el('readSearchResults');
    var sources = Store.state.read.sources.filter(function(s) { return s.enabled; });
    if (!sources.length) {
      resultsBox.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">没有书源</div><div class="empty-sub">请先导入书源</div></div>';
      return;
    }

    // 每源状态行（搜索中/成功 N 条/失败原因）+ 结果容器
    var statusHtml = '<div class="search-status-box" id="searchStatusBox">';
    sources.forEach(function(s, i) {
      statusHtml += '<div class="search-status-row" data-sidx="' + i + '">'
        + '<span class="search-status-dot spin"></span>'
        + '<span class="search-status-name">' + esc(s.name) + '</span>'
        + '<span class="search-status-msg">搜索中…</span></div>';
    });
    statusHtml += '</div><div id="searchResultList"></div>';
    resultsBox.innerHTML = statusHtml;

    function setSourceStatus(idx, cls, msg) {
      var row = resultsBox.querySelector('.search-status-row[data-sidx="' + idx + '"]');
      if (!row) return;
      var dot = row.querySelector('.search-status-dot');
      var msgEl = row.querySelector('.search-status-msg');
      if (dot) dot.className = 'search-status-dot ' + cls;
      if (msgEl) msgEl.textContent = msg;
    }

    async function searchOne(src) {
      var engine = engineOf(src);
      var list = [];
      if (engine === 'legado' && typeof LegadoEngine !== 'undefined') {
        list = await LegadoEngine.search(src.raw, keyword);
        list.forEach(function(b) { b.sourceName = src.name; b.mediaType = b.mediaType || src.mediaType || 'novel'; });
      } else if (engine === 'venera' && typeof VeneraEngine !== 'undefined') {
        list = await VeneraEngine.search(src.key || src.name, keyword, {}, 1);
        list.forEach(function(b) { b.sourceKey = src.key || src.name; b.sourceType = 'venera'; b.mediaType = src.mediaType || 'comic'; });
      } else {
        list = await searchCssSource(src, keyword);
        list.forEach(function(b) { b.sourceName = src.name; b.mediaType = src.mediaType || 'novel'; });
      }
      return list;
    }

    // 并行搜索：Promise.allSettled，每源状态行实时更新
    var settled = await Promise.allSettled(sources.map(function(src, i) {
      return searchOne(src).then(function(list) {
        setSourceStatus(i, 'ok', '成功 ' + list.length + ' 条');
        return list;
      }, function(err) {
        setSourceStatus(i, 'fail', err && err.message ? err.message : '未知错误');
        throw err;
      });
    }));

    var all = [];
    var failures = [];
    settled.forEach(function(r, i) {
      if (r.status === 'fulfilled') {
        all.push.apply(all, r.value);
      } else {
        console.warn('搜索失败:', sources[i].name, r.reason);
        failures.push(sources[i].name + '（' + (r.reason && r.reason.message ? r.reason.message : '未知错误') + '）');
      }
    });

    renderSearchResults(all, failures);
  }

  async function searchCssSource(src, keyword) {
    if (!src.searchUrl) return [];
    var url = (src.url || '') + src.searchUrl.replace('{{keyword}}', encodeURIComponent(keyword));
    try {
      // 统一抓取封装：直连 → worker 代理 → 公共代理
      var html = (typeof NetFetch !== 'undefined')
        ? await NetFetch.text(url, {})
        : await (await fetch(url, { mode: 'cors', credentials: 'omit' })).text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var items = [];
      var rows = doc.querySelectorAll(src.searchList || 'div');
      rows.forEach(function(row) {
        var nameEl = row.querySelector(src.searchName || 'a');
        var urlEl = row.querySelector(src.searchUrl || 'a');
        if (nameEl && urlEl) {
          var href = urlEl.getAttribute('href') || '';
          items.push({
            id: href,
            name: nameEl.textContent.trim(),
            url: href.startsWith('http') ? href : (src.url + href),
            author: '',
            cover: '',
            mediaType: src.mediaType || 'novel'
          });
        }
      });
      return items.slice(0, 20);
    } catch(e) { return []; }
  }

  function renderSearchResults(list, failures) {
    // 优先写入结果容器（保留上方的每源状态行），否则写整个结果区
    var box = el('searchResultList') || el('readSearchResults');
    if (!box) return;
    var html = '';
    if (!list.length) {
      html += '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到结果</div></div>';
    } else {
      list.forEach(function(b) {
        html += '<div class="result-item" data-url="' + esc(b.url || b.id) + '" data-name="' + esc(b.name) + '" data-cover="' + esc(b.cover || '') + '" data-media="' + (b.mediaType || 'novel') + '" data-source="' + esc(b.sourceKey || b.sourceName || b.source || '') + '">';
        html += '<div class="result-cover">';
        if (b.cover) {
          html += '<img src="' + esc(b.cover) + '" alt="">';
        } else {
          html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">' + (b.mediaType === 'comic' ? '📖' : '📕') + '</div>';
        }
        html += '</div>';
        html += '<div class="result-info">';
        html += '<div class="result-title">' + esc(b.name) + '</div>';
        html += '<div class="result-meta">' + esc(b.author || '未知') + ' · ' + esc(b.sourceKey || b.sourceName || b.source || '') + '</div>';
        html += '<div class="result-actions">';
        html += '<button class="result-btn primary add-shelf-btn" data-url="' + esc(b.url || b.id) + '">加入书架</button>';
        html += '<button class="result-btn read-now-btn" data-url="' + esc(b.url || b.id) + '">立即阅读</button>';
        html += '</div></div></div>';
      });
    }
    // 失败书源汇总提示
    if (failures && failures.length) {
      html += '<div style="padding:12px 16px;font-size:12px;color:var(--text-2);border-top:1px solid var(--border);margin-top:8px;">';
      html += '以下书源搜索失败：' + esc(failures.join('、'));
      html += '</div>';
    }
    box.innerHTML = html;
  }

  /* ==================== 书源管理 ==================== */

  function engineBadge(engine) {
    var meta = ENGINE_META[engine] || ENGINE_META.css;
    return '<span class="source-item-tag" style="background:' + meta.color + '22;color:' + meta.color + ';">' + meta.label + '</span>';
  }

  function renderSourceList() {
    var box = el('sourceList');
    if (!box) return;
    var sources = Store.state.read.sources;

    if (!sources.length) {
      box.innerHTML = '<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">📚</div><div class="empty-text">暂无书源</div></div>';
      return;
    }

    var html = '';
    sources.forEach(function(s) {
      var engine = engineOf(s);
      html += '<div class="source-item">';
      html += '<div class="source-item-info">';
      html += '<div class="source-item-name">' + esc(s.name) + engineBadge(engine);
      html += '<span class="source-item-tag">' + (s.mediaType === 'comic' ? '漫画' : '小说') + '</span>';
      html += lastTestDot(s);
      html += '</div>';
      html += '<div class="source-item-url">' + esc(s.url) + '</div>';
      html += '</div>';
      html += '<div class="source-item-actions">';
      html += '<button class="source-item-btn toggle-source" data-name="' + esc(s.name) + '">' + (s.enabled ? '停用' : '启用') + '</button>';
      html += '<button class="source-item-btn danger del-source" data-name="' + esc(s.name) + '">删除</button>';
      html += '</div></div>';
    });
    box.innerHTML = html;
  }

  /* ---------- 书源导入：自动识别格式 ---------- */
  async function importSource(text) {
    if (typeof SourceDetect === 'undefined') return Toast.show('识别模块未加载', 'error');
    var det;
    try { det = await SourceDetect.detect(text); }
    catch(e) { return Toast.show('识别失败: ' + e.message, 'error'); }

    if (det.type === 'legado') {
      importLegadoSources(det.sources, det.message);
    } else if (det.type === 'legado-rss') {
      importRssSources(det.sources);
    } else if (det.type === 'venera') {
      if (typeof VeneraEngine === 'undefined') return Toast.show('Venera 引擎未加载', 'error');
      try {
        var src = await VeneraEngine.loadSource(text, 'venera_source');
        await testAndSaveVenera(src, text);
      } catch(e) {
        Toast.show('Venera 图源导入失败: ' + e.message, 'error');
      }
    } else if (det.type === 'css-config') {
      var m = 0;
      det.sources.forEach(function(s) {
        if (!s.name || !s.url) return;
        if (Store.state.read.sources.find(function(x) { return x.name === s.name; })) return;
        Store.state.read.sources.push({
          id: 'css_' + Date.now() + '_' + m,
          name: s.name, url: s.url,
          engine: 'css', type: 'css',
          mediaType: s.mediaType || 'novel', enabled: true,
          searchUrl: s.searchUrl || '', searchList: s.searchList || '',
          searchName: s.searchName || '', chapterList: s.chapterList || '',
          images: s.images || '',
          addedAt: Date.now()
        });
        m++;
      });
      Store.save();
      Toast.show('识别为 CSS 选择器配置，成功导入 ' + m + ' 个书源');
      renderSourceList();
      renderReadSettings();
    } else {
      // venera-index / legado-js / unknown
      Toast.show(det.message || '无法识别的书源格式', 'error');
    }
  }

  /* Legado 导入：走转换器统一 schema 存储；保存后后台逐个冒烟测试（不阻塞） */
  function importLegadoSources(rawList, extraMsg) {
    if (typeof LegadoConverter === 'undefined') return Toast.show('Legado 转换器未加载', 'error');
    var conv = LegadoConverter.convertAll(rawList);
    var n = 0;
    var added = [];
    conv.sources.forEach(function(s) {
      if (Store.state.read.sources.find(function(x) { return x.name === s.name; })) return;
      var item = {
        id: 'legado_' + Date.now() + '_' + n,
        name: s.name,
        url: s.url,
        group: s.group,
        engine: 'legado',
        type: 'legado',
        mediaType: s.type,
        enabled: true,
        hasExplore: s.hasExplore,
        searchRule: s.searchRule,
        tocRule: s.tocRule,
        contentRule: s.contentRule,
        exploreRule: s.exploreRule,
        raw: s.raw,
        addedAt: Date.now()
      };
      Store.state.read.sources.push(item);
      added.push(item);
      n++;
    });
    Store.save();
    Toast.show('识别为 Legado 格式，成功导入 ' + n + ' 个书源' + (extraMsg ? '，' + extraMsg : ''));
    renderSourceList();
    renderReadSettings();
    // 后台冒烟测试：逐个跑搜索，列表项状态点实时更新
    added.forEach(function(src) { smokeTestLegado(src); });
  }

  /* ---------- Legado 导入冒烟测试 ----------
   * 后台跑 LegadoEngine.search(raw, '斗破苍穹')（单源 15s 超时），
   * 结果写 src.lastTest={ok,msg,ts}：true=通过 / 'empty'=无结果 / false=失败 */
  var legadoTesting = {};   // id → true（测试中，显示转圈）

  async function smokeTestLegado(src) {
    if (typeof LegadoEngine === 'undefined' || !src.raw || !src.raw.searchUrl) return;
    legadoTesting[src.id] = true;
    renderSourceList();
    try {
      var list = await Promise.race([
        LegadoEngine.search(src.raw, '斗破苍穹'),
        new Promise(function(_, reject) { setTimeout(function() { reject(new Error('测试超时（15s）')); }, 15000); })
      ]);
      if (list && list.length) {
        src.lastTest = { ok: true, msg: '通过，搜索到 ' + list.length + ' 条结果', ts: Date.now() };
      } else {
        src.lastTest = { ok: 'empty', msg: '可访问但搜索无结果', ts: Date.now() };
      }
    } catch (e) {
      src.lastTest = { ok: false, msg: e && e.message ? e.message : '测试失败', ts: Date.now() };
    }
    delete legadoTesting[src.id];
    Store.save();
    renderSourceList();
  }

  /* Legado 冒烟测试状态点：绿=通过 / 黄=无结果 / 红=失败 / 灰转圈=测试中 */
  function lastTestDot(s) {
    if (engineOf(s) !== 'legado') return '';
    if (legadoTesting[s.id]) return '<span class="source-test-dot testing" title="测试搜索中…"></span>';
    var t = s.lastTest;
    if (!t) return '';
    var cls = t.ok === true ? 'ok' : (t.ok === 'empty' ? 'empty' : 'fail');
    var label = t.ok === true ? '测试通过' : (t.ok === 'empty' ? '搜索无结果' : '测试失败');
    return '<span class="source-test-dot ' + cls + '" title="' + esc(label + '：' + (t.msg || '')) + '"></span>';
  }

  /* RSS 订阅源导入：存入 Store.state.read.rssSources（独立数组） */
  function importRssSources(list) {
    if (!Store.state.read.rssSources) Store.state.read.rssSources = [];
    var n = 0;
    (list || []).forEach(function(o) {
      if (!o || !o.sourceName || !o.sourceUrl) return;
      var dup = Store.state.read.rssSources.find(function(x) {
        return x.sourceUrl === o.sourceUrl || x.sourceName === o.sourceName;
      });
      if (dup) return;
      Store.state.read.rssSources.push({
        id: 'rss_' + Date.now() + '_' + n,
        sourceName: o.sourceName,
        sourceUrl: o.sourceUrl,
        sourceGroup: o.sourceGroup || '',
        sourceIcon: o.sourceIcon || '',
        enabled: o.enabled !== false,
        raw: o,
        addedAt: Date.now()
      });
      n++;
    });
    Store.save();
    Toast.show('识别为 RSS 订阅源，已保存 ' + n + ' 个（共 ' + Store.state.read.rssSources.length + ' 个）');
    renderReadSettings();
  }

  /* Venera 导入：四步测试全部通过才保存 */
  async function testAndSaveVenera(src, rawText) {
    renderTestBox(src.name, null);
    var results = await VeneraEngine.testSource(src.key, function(list) {
      renderTestBox(src.name, list);
    });
    renderTestBox(src.name, results);
    var allOk = results.every(function(r) { return r.status === 'ok'; });
    if (!allOk) {
      VeneraEngine.unload(src.key);
      Toast.show('图源「' + src.name + '」测试未通过，已放弃导入', 'error');
      return;
    }
    var dup = Store.state.read.sources.find(function(x) {
      return (x.key && x.key === src.key) || x.name === src.name;
    });
    if (dup) {
      Toast.show('图源已存在: ' + src.name);
      return;
    }
    Store.state.read.sources.push({
      id: 'venera_' + Date.now(),
      name: src.name, key: src.key,
      engine: 'venera', type: 'venera',
      url: src.url || '', version: src.version || '',
      mediaType: 'comic', enabled: true,
      hasExplore: !!(src.explore && src.explore.length),
      raw: rawText || '',
      addedAt: Date.now()
    });
    Store.save();
    Toast.show('图源「' + src.name + '」测试通过，已导入');
    renderSourceList();
    renderReadSettings();
  }

  /* 四步测试清单渲染：等待○ → 加载中◌ → 成功✓/失败✗ */
  function renderTestBox(title, results) {
    var box = el('sourceTestResult');
    if (!box) return;
    var statusIcon = { pending: '○', loading: '◌', ok: '✓', fail: '✗' };
    var statusText = { pending: '等待', loading: '加载中…', ok: '', fail: '' };
    var html = '<div class="source-test-box">';
    html += '<div class="source-test-title">测试图源：' + esc(title) + '</div>';
    (results || [
      { step: 1, name: '搜索', status: 'pending', msg: '' },
      { step: 2, name: '详情', status: 'pending', msg: '' },
      { step: 3, name: '章节', status: 'pending', msg: '' },
      { step: 4, name: '图片', status: 'pending', msg: '' }
    ]).forEach(function(r) {
      html += '<div class="source-test-item ' + r.status + '">';
      html += '<span class="source-test-status">' + statusIcon[r.status] + '</span>';
      html += '<span>' + r.name + '</span>';
      html += '<span class="source-test-msg">' + esc(r.msg || statusText[r.status]) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
  }

  /* ---------- 进度环 ---------- */
  var RING_LEN = 119.4;
  function showProgress() {
    var box = el('sourceUrlProgress');
    if (box) box.classList.remove('hidden');
    setProgress(null, 0);
  }
  function hideProgress() {
    var box = el('sourceUrlProgress');
    if (box) box.classList.add('hidden');
  }
  function setProgress(ratio, loaded) {
    var fg = el('sourceProgressFg');
    var svg = fg ? fg.closest('.progress-ring') : null;
    var text = el('sourceProgressText');
    if (ratio == null) {
      if (svg) svg.classList.add('indeterminate');
      if (text) text.textContent = '下载中… ' + Math.round((loaded || 0) / 1024) + 'KB';
    } else {
      if (svg) svg.classList.remove('indeterminate');
      if (fg) fg.style.strokeDashoffset = String(RING_LEN * (1 - Math.min(1, ratio)));
      if (text) text.textContent = Math.round(Math.min(1, ratio) * 100) + '%';
    }
  }

  /* 通用下载（非 .js URL：Legado JSON 等），带进度回调
   * 直连流式读取 → 失败走 NetFetch 代理兜底链（代理路径无法流式，给 indeterminate 进度） */
  async function downloadTextWithProgress(url, onProgress) {
    try {
      var resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var total = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
      if (resp.body && typeof resp.body.getReader === 'function') {
        var reader = resp.body.getReader();
        var chunks = [];
        var loaded = 0;
        for (;;) {
          var r = await reader.read();
          if (r.done) break;
          chunks.push(r.value);
          loaded += r.value.length;
          onProgress(total ? Math.min(0.99, loaded / total) : null, loaded);
        }
        var buf = new Uint8Array(loaded);
        var off = 0;
        chunks.forEach(function(c) { buf.set(c, off); off += c.length; });
        onProgress(1, loaded);
        return new TextDecoder().decode(buf);
      }
      var text = await resp.text();
      onProgress(1, total || text.length);
      return text;
    } catch (e) {
      // 直连失败：代理兜底（不确定进度）
      if (typeof NetFetch === 'undefined') throw e;
      onProgress(null, 0);
      var proxied = await NetFetch.proxied(url, {});
      onProgress(1, proxied.length);
      return proxied;
    }
  }

  /* ---------- 多候选 URL 导入（粘贴连写串拆分 + 逐个探测） ---------- */

  /* 候选清单容器（JS 创建，挂在进度环后面） */
  function ensureCandidateBox() {
    var box = el('sourceUrlCandidates');
    if (box) return box;
    var anchor = el('sourceUrlProgress');
    if (!anchor || !anchor.parentNode) return null;
    box = document.createElement('div');
    box.id = 'sourceUrlCandidates';
    box.className = 'source-url-candidates';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    return box;
  }

  function clearCandidateBox() {
    var box = el('sourceUrlCandidates');
    if (box) box.innerHTML = '';
  }

  /* 渲染候选行：URL + 探测状态（spinner / ✓ / ✗） */
  function renderCandidateRows(list) {
    var box = ensureCandidateBox();
    if (!box) return;
    var html = '<div class="candidate-title">识别出 ' + list.length + ' 个候选地址，逐个探测：</div>';
    list.forEach(function(u, i) {
      html += '<div class="candidate-row" data-cand="' + i + '">'
        + '<span class="candidate-status"></span>'
        + '<span class="candidate-url">' + esc(u) + '</span>'
        + '<span class="candidate-msg"></span>'
        + '</div>';
    });
    box.innerHTML = html;
  }

  /* 更新单个候选行状态：probing / ok / fail / secondary */
  function setCandidateRow(url, status, msg) {
    var box = el('sourceUrlCandidates');
    if (!box) return;
    var rows = box.querySelectorAll('.candidate-row');
    for (var i = 0; i < rows.length; i++) {
      var urlEl = rows[i].querySelector('.candidate-url');
      if (!urlEl || urlEl.textContent !== url) continue;
      var st = rows[i].querySelector('.candidate-status');
      var msgEl = rows[i].querySelector('.candidate-msg');
      rows[i].className = 'candidate-row ' + status;
      if (st) {
        st.textContent = status === 'ok' ? '✓' : (status === 'fail' ? '✗' : '');
        st.classList.toggle('spin', status === 'probing' || status === 'secondary');
      }
      if (msgEl && msg != null) msgEl.textContent = msg;
      return;
    }
    // 次级候选（HTML 页内发现的链接）：追加行
    if (status === 'secondary') {
      var row = document.createElement('div');
      row.className = 'candidate-row secondary probing';
      row.innerHTML = '<span class="candidate-status spin"></span>'
        + '<span class="candidate-url">' + esc(url) + '</span>'
        + '<span class="candidate-msg">页内发现</span>';
      box.appendChild(row);
    }
  }

  /* 按探测结果自动导入：Venera JS 走 testAndSaveVenera；JSON（Legado/RSS/CSS）走 importSource
   * 返回值按书源数实际增量判定成败，避免空探测结果误报成功 */
  async function importResolvedItem(item) {
    if (!item || !item.text) return false;
    if (item.kind !== 'json' && item.kind !== 'js') return false;
    if (item.kind === 'js') {
      if (typeof VeneraEngine === 'undefined') return false;
      try {
        var src = VeneraEngine.loadSource(item.text, 'venera_url_' + Date.now());
        await testAndSaveVenera(src, item.text);
        return true;
      } catch (e) {
        Toast.show('Venera 图源加载失败: ' + (e.message || ''), 'error');
        return false;
      }
    }
    var before = Store.state.read.sources.length + (Store.state.read.rssSources || []).length;
    await importSource(item.text);
    var after = Store.state.read.sources.length + (Store.state.read.rssSources || []).length;
    return after > before;
  }

  /* 多候选流程：渲染清单 → 逐个 resolve → 含内容的自动导入 → 汇总成败 */
  async function importFromCandidates(raw, input) {
    var list = SourceUrlResolver.candidates(raw);
    renderCandidateRows(list);
    var results = await SourceUrlResolver.resolve(raw, function(ev) {
      var kindLabel = { json: 'JSON', html: '网页', js: 'JS 图源', other: '其它' };
      if (ev.status === 'probing') setCandidateRow(ev.url, 'probing', '探测中…');
      else if (ev.status === 'ok') setCandidateRow(ev.url, 'ok', kindLabel[ev.kind] || '成功');
      else if (ev.status === 'secondary') setCandidateRow(ev.url, 'secondary', '页内发现，探测中…');
      else setCandidateRow(ev.url, 'fail', ev.error || '失败');
    });
    var okCount = 0, failCount = 0;
    for (var i = 0; i < results.length; i++) {
      try {
        if (await importResolvedItem(results[i])) okCount++;
        else failCount++;
      } catch (e) {
        failCount++;
        console.warn('候选导入失败:', results[i].url, e);
      }
    }
    if (okCount) input.value = '';
    Toast.show(
      '候选处理完成：成功 ' + okCount + ' 个' + (failCount ? '，失败 ' + failCount + ' 个' : ''),
      failCount ? (okCount ? 'warning' : 'error') : 'success'
    );
  }

  async function importFromUrl() {
    var input = el('sourceUrlInput');
    if (!input) return;
    var raw = input.value.trim();
    if (!raw) return Toast.show('请输入书源 URL', 'error');

    // 粘贴串拆分：可能含多个 URL / 连写串
    if (typeof SourceUrlResolver !== 'undefined') {
      var cands = SourceUrlResolver.candidates(raw);
      if (!cands.length) return Toast.show('请输入有效的 http(s) 地址', 'error');
      if (cands.length > 1) {
        showProgress();
        try { await importFromCandidates(raw, input); }
        catch (e) { Toast.show('候选导入失败: ' + (e.message || ''), 'error'); }
        hideProgress();
        return;
      }
      raw = cands[0];
    } else if (!/^https?:/i.test(raw)) {
      return Toast.show('请输入有效的 http(s) 地址', 'error');
    }

    var url = raw;
    clearCandidateBox();
    showProgress();
    try {
      if (/\.js(\?|#|$)/i.test(url)) {
        // Venera JS 图源：引擎内下载并加载
        if (typeof VeneraEngine === 'undefined') throw new Error('Venera 引擎未加载');
        var src = await VeneraEngine.loadSourceFromUrl(url, setProgress);
        hideProgress();
        await testAndSaveVenera(src, src._rawText || '');
        input.value = '';
      } else {
        var text = await downloadTextWithProgress(url, setProgress);
        hideProgress();
        if (!text.trim()) throw new Error('下载内容为空');
        await importSource(text);
        input.value = '';
      }
    } catch (e) {
      hideProgress();
      Toast.show('下载失败: ' + (e.message || ''), 'error');
    }
  }

  function importFromFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function() {
      var text = String(reader.result || '');
      if (!text.trim()) return Toast.show('文件内容为空', 'error');
      await importSource(text);
    };
    reader.onerror = function() { Toast.show('文件读取失败', 'error'); };
    reader.readAsText(file);
  }

  /* ==================== 二维码导入（jsQR 动态加载） ==================== */

  var jsqrLoading = null;  // jsQR 库加载 Promise（单例）

  /* 动态加载 jsQR（script 标签注入 + onload），失败 Toast */
  function ensureJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      // 字符串拆分写法：避免括号检查器把 '://' 误判为注释
      s.src = 'https:/' + '/cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = function() { resolve(); };
      s.onerror = function() { jsqrLoading = null; reject(new Error('二维码识别库加载失败，请检查网络')); };
      document.head.appendChild(s);
    });
    return jsqrLoading;
  }

  /* 图片文件 → canvas 解码二维码文本 */
  async function decodeQrImage(file) {
    await ensureJsQR();
    var dataUrl = await new Promise(function(resolve, reject) {
      var fr = new FileReader();
      fr.onload = function() { resolve(String(fr.result)); };
      fr.onerror = function() { reject(new Error('图片读取失败')); };
      fr.readAsDataURL(file);
    });
    var img = await new Promise(function(resolve, reject) {
      var im = new Image();
      im.onload = function() { resolve(im); };
      im.onerror = function() { reject(new Error('图片解码失败')); };
      im.src = dataUrl;
    });
    var canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var code = window.jsQR(imageData.data, canvas.width, canvas.height);
    if (!code || !code.data) throw new Error('未识别到二维码，请换一张更清晰的图片');
    return code.data;
  }

  /* 二维码导入入口：选图 → 解码 → URL 走 importFromUrl / 文本走 importSource */
  async function importFromQrImage(file) {
    if (!file) return;
    Toast.show('正在识别二维码…');
    try {
      var text = (await decodeQrImage(file)).trim();
      if (/^https?:\/\x2f/i.test(text)) {   // \x2f 写法避免括号检查器误判注释
        var input = el('sourceUrlInput');
        if (input) input.value = text;
        await importFromUrl();
      } else {
        await importSource(text);
      }
    } catch (e) {
      Toast.show(e.message || '二维码识别失败', 'error');
    }
  }

  /* ==================== 官方源仓库 ==================== */

  /* 弹层 DOM（JS 创建） */
  function ensureOfficialSheet() {
    if (el('officialSourceMask')) return;
    var mask = document.createElement('div');
    mask.className = 'official-mask';
    mask.id = 'officialSourceMask';
    var sheet = document.createElement('div');
    sheet.className = 'official-sheet';
    sheet.id = 'officialSourceSheet';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    mask.addEventListener('click', closeOfficialSheet);
  }

  function closeOfficialSheet() {
    var mask = el('officialSourceMask');
    var sheet = el('officialSourceSheet');
    if (mask) mask.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
  }

  function openOfficialSheet() {
    if (typeof BackendConfig === 'undefined') return Toast.show('后端未配置', 'error');
    ensureOfficialSheet();
    var sheet = el('officialSourceSheet');
    sheet.innerHTML = '<div class="official-head"><span>官方源仓库</span>'
      + '<button class="ghost" id="officialClose">关闭</button></div>'
      + '<div class="official-body" id="officialSourceBody">'
      + '<div class="empty-state"><div class="loading-spinner"></div><div>加载中…</div></div></div>';
    el('officialSourceMask').classList.add('open');
    sheet.classList.add('open');
    el('officialClose').addEventListener('click', closeOfficialSheet);
    loadOfficialSources();
  }

  async function loadOfficialSources() {
    var body = el('officialSourceBody');
    if (!body) return;
    try {
      var resp = await fetch(BackendConfig.officialSources(), { credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      var list = (data && data.sources) || [];
      if (!list.length) throw new Error('仓库暂无可用源');
      var html = '';
      list.forEach(function(s, i) {
        html += '<div class="official-item">'
          + '<div class="official-item-info">'
          + '<div class="official-item-name">' + esc(s.name || '未命名')
          + '<span class="official-badge">' + esc(s.stype || '书源') + '</span>'
          + '<span class="official-badge format">' + esc(s.format || 'json') + '</span>'
          + '</div>'
          + '<div class="official-item-url">' + esc(s.url || '') + (s.imports ? ' · 被导入 ' + s.imports + ' 次' : '') + '</div>'
          + '</div>'
          + '<button class="source-item-btn official-import" data-oidx="' + i + '">导入</button>'
          + '</div>';
      });
      body.innerHTML = html;
      body.querySelectorAll('.official-import').forEach(function(btn) {
        btn.addEventListener('click', function() {
          importOfficialSource(list[parseInt(btn.dataset.oidx, 10)]);
        });
      });
    } catch (e) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>'
        + '<div class="empty-text">加载失败</div><div class="empty-sub">' + esc(e.message || '') + '</div>'
        + '<button class="empty-action-btn" id="officialRetry">重试</button></div>';
      var retry = el('officialRetry');
      if (retry) retry.addEventListener('click', loadOfficialSources);
    }
  }

  /* 导入官方源：payload 直接走 importSource；成功后静默上报 */
  async function importOfficialSource(item) {
    if (!item || item.payload == null) return Toast.show('该源缺少内容', 'error');
    var before = Store.state.read.sources.length + (Store.state.read.rssSources || []).length;
    var text = typeof item.payload === 'string' ? item.payload : JSON.stringify(item.payload);
    await importSource(text);
    var after = Store.state.read.sources.length + (Store.state.read.rssSources || []).length;
    if (after > before) {
      // 静默上报（失败忽略）
      try {
        fetch(BackendConfig.reportSource(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ url: item.url || '', ok: true })
        }).catch(function() {});
      } catch (e) {}
      closeOfficialSheet();
    }
  }

  /* ---------- 导入区扩展按钮（二维码导入 / 官方源仓库，JS 插入 .source-import-actions） ---------- */
  function injectImportExtraButtons() {
    var bar = document.querySelector('.source-import-actions');
    if (!bar || el('sourceQrBtn')) return;

    var qrBtn = document.createElement('button');
    qrBtn.id = 'sourceQrBtn';
    qrBtn.textContent = '二维码导入';
    bar.appendChild(qrBtn);

    var qrInput = document.createElement('input');
    qrInput.type = 'file';
    qrInput.id = 'sourceQrInput';
    qrInput.accept = 'image/' + '*';   // 拆分写法避免括号检查器把 /* 误判为注释开头
    qrInput.setAttribute('capture', 'environment');  // 移动端唤起相机
    qrInput.className = 'hidden';
    bar.appendChild(qrInput);

    qrBtn.addEventListener('click', function() { qrInput.click(); });
    qrInput.addEventListener('change', function() {
      importFromQrImage(qrInput.files && qrInput.files[0]);
      qrInput.value = '';
    });

    var officialBtn = document.createElement('button');
    officialBtn.id = 'sourceOfficialBtn';
    officialBtn.textContent = '官方源仓库';
    bar.appendChild(officialBtn);
    officialBtn.addEventListener('click', openOfficialSheet);

    var veneraBtn = document.createElement('button');
    veneraBtn.id = 'sourceVeneraRepoBtn';
    veneraBtn.textContent = 'Venera 图源仓库';
    bar.appendChild(veneraBtn);
    veneraBtn.addEventListener('click', openVeneraRepoSheet);
  }

  /* ==================== 回收站 ==================== */

  function purgeExpiredTrash() {
    var trash = Store.state.read.trash || [];
    var now = Date.now();
    var kept = trash.filter(function(t) { return now - (t.deletedAt || 0) < TRASH_TTL; });
    if (kept.length !== trash.length) {
      Store.state.read.trash = kept;
      Store.save();
    }
  }

  function trashBook(book) {
    Store.state.read.shelf = Store.state.read.shelf.filter(function(b) { return b !== book; });
    Store.state.read.trash.unshift({ kind: 'book', item: book, deletedAt: Date.now() });
    Store.save();
    refreshShelf();
    renderReadSettings();
    Toast.show('已移入回收站');
  }

  function trashSource(src) {
    Store.state.read.sources = Store.state.read.sources.filter(function(x) { return x !== src; });
    Store.state.read.trash.unshift({ kind: 'source', item: src, deletedAt: Date.now() });
    Store.save();
    renderSourceList();
    renderReadSettings();
    Toast.show('已移入回收站: ' + src.name);
  }

  function renderTrash() {
    purgeExpiredTrash();
    var body = el('readTrashBody');
    if (!body) return;
    var trash = Store.state.read.trash || [];

    var html = '';
    html += '<div class="trash-toolbar">';
    html += '<button id="trashRestoreSel">恢复选中</button>';
    html += '<button id="trashDeleteSel">彻底删除选中</button>';
    html += '<button id="trashClear" class="danger">清空回收站</button>';
    html += '</div>';

    if (!trash.length) {
      html += '<div class="empty-state"><div class="empty-icon">🗑️</div><div class="empty-text">回收站为空</div><div class="empty-sub">删除的书籍和书源会保留 15 天</div></div>';
    } else {
      // 删除时间倒序
      var sorted = trash.map(function(t, i) { return { t: t, i: i }; }).sort(function(a, b) {
        return (b.t.deletedAt || 0) - (a.t.deletedAt || 0);
      });
      sorted.forEach(function(entry) {
        var t = entry.t;
        var name = t.kind === 'book' ? (t.item.title || '未知书籍') : (t.item.name || '未知书源');
        var kindLabel = t.kind === 'book' ? '书籍' : '书源';
        var left = Math.max(0, Math.ceil((TRASH_TTL - (Date.now() - (t.deletedAt || 0))) / (24 * 3600 * 1000)));
        html += '<div class="source-item" data-trash="' + entry.i + '">';
        html += '<span class="trash-item-check" data-check="' + entry.i + '"></span>';
        html += '<div class="source-item-info">';
        html += '<div class="source-item-name">' + esc(name) + '<span class="source-item-tag">' + kindLabel + '</span></div>';
        html += '<div class="trash-item-time">删除于 ' + new Date(t.deletedAt || 0).toLocaleString('zh-CN') + ' · ' + left + ' 天后彻底清除</div>';
        html += '</div>';
        html += '<div class="source-item-actions">';
        html += '<button class="source-item-btn trash-restore" data-idx="' + entry.i + '">恢复</button>';
        html += '<button class="source-item-btn danger trash-del" data-idx="' + entry.i + '">彻底删除</button>';
        html += '</div></div>';
      });
    }
    body.innerHTML = html;
  }

  function restoreTrashItem(idx) {
    var t = Store.state.read.trash[idx];
    if (!t) return;
    if (t.kind === 'book') {
      if (!Store.state.read.shelf.find(function(b) { return b.url === t.item.url; })) {
        Store.state.read.shelf.unshift(t.item);
      }
    } else {
      if (!Store.state.read.sources.find(function(s) { return s.name === t.item.name; })) {
        Store.state.read.sources.push(t.item);
        preloadVeneraSources();
      }
    }
    Store.state.read.trash.splice(idx, 1);
    Store.save();
    renderTrash();
    refreshShelf();
    renderSourceList();
    renderReadSettings();
    Toast.show('已恢复');
  }

  function deleteTrashItem(idx) {
    Store.state.read.trash.splice(idx, 1);
    Store.save();
    renderTrash();
    renderReadSettings();
  }

  function selectedTrashIdxs() {
    var box = el('readTrashBody');
    if (!box) return [];
    var out = [];
    box.querySelectorAll('.trash-item-check.on').forEach(function(c) {
      out.push(parseInt(c.dataset.check, 10));
    });
    return out.sort(function(a, b) { return b - a; });  // 倒序， splice 不移位
  }

  /* ==================== 书架长按菜单 ==================== */

  function ensureShelfMenu() {
    if (el('shelfMenuMask')) return;
    var mask = document.createElement('div');
    mask.className = 'shelf-menu-mask';
    mask.id = 'shelfMenuMask';
    var menu = document.createElement('div');
    menu.className = 'shelf-menu';
    menu.id = 'shelfMenu';
    document.body.appendChild(mask);
    document.body.appendChild(menu);
    mask.addEventListener('click', closeShelfMenu);
  }

  function closeShelfMenu() {
    var mask = el('shelfMenuMask');
    var menu = el('shelfMenu');
    if (mask) mask.classList.remove('open');
    if (menu) menu.classList.remove('open');
  }

  function openShelfMenu(book) {
    // 兜底：若后续没有 click 事件消费掉 lpFired，600ms 后自动复位
    setTimeout(function() { lpFired = false; }, 600);
    ensureShelfMenu();
    var mask = el('shelfMenuMask');
    var menu = el('shelfMenu');
    menu.innerHTML = '<div class="shelf-menu-title">' + esc(book.title) + '</div>'
      + '<div class="shelf-menu-item danger" id="shelfMenuDelete">删除（移入回收站）</div>'
      + '<div class="shelf-menu-item" id="shelfMenuCancel">取消</div>';
    mask.classList.add('open');
    menu.classList.add('open');
    el('shelfMenuDelete').addEventListener('click', function() {
      closeShelfMenu();
      trashBook(book);
    });
    el('shelfMenuCancel').addEventListener('click', closeShelfMenu);
  }

  /* ==================== 阅读设置子页 ==================== */

  /* ==================== 阅读「我的」页 ====================
   * Legado 式布局：书源管理/回收站/仓库/阅读设置全部集中在「我的」，
   * 顶部不再放设置入口（应用户要求） */
  function renderReadMine() {
    var body = el('readBody');
    if (!body) return;
    var st = Store.state.read.settings || {};
    var sources = Store.state.read.sources;
    var trash = Store.state.read.trash || [];
    var chev = ' <svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>';

    var html = '<div class="read-mine">';

    html += '<div class="settings-row" data-sub="subReadSources">'
      + '<div class="settings-row-left"><div class="settings-row-icon">\u{1F4DA}</div><span class="settings-row-text">书源管理</span></div>'
      + '<div class="settings-row-right">' + sources.length + ' 个书源' + chev + '</div></div>';

    html += '<div class="settings-row" id="mineTrashRow">'
      + '<div class="settings-row-left"><div class="settings-row-icon">\u{1F5D1}\u{FE0F}</div><span class="settings-row-text">回收站</span></div>'
      + '<div class="settings-row-right">' + (trash.length ? trash.length + ' 项' : '空') + chev + '</div></div>';

    html += '<div class="settings-row" id="mineOfficialRow">'
      + '<div class="settings-row-left"><div class="settings-row-icon">\u{1F4E6}</div><span class="settings-row-text">官方书源仓库</span></div>'
      + '<div class="settings-row-right">一键导入' + chev + '</div></div>';

    html += '<div class="settings-row" id="mineVeneraRow">'
      + '<div class="settings-row-left"><div class="settings-row-icon">\u{1F9E9}</div><span class="settings-row-text">Venera 官方图源仓库</span></div>'
      + '<div class="settings-row-right">漫画/图文' + chev + '</div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">\u{1F4D6}</div><span class="settings-row-text">默认翻页模式</span></div>'
      + '<div class="settings-row-right"><select id="rmReaderMode">'
      + '<option value="gallery-rtl"' + (st.readerMode === 'gallery-rtl' ? ' selected' : '') + '>日漫翻页（右→左）</option>'
      + '<option value="gallery-ltr"' + (st.readerMode === 'gallery-ltr' ? ' selected' : '') + '>国漫翻页（左→右）</option>'
      + '<option value="continuous-ttb"' + (st.readerMode === 'continuous-ttb' ? ' selected' : '') + '>连续滚动（条漫）</option>'
      + '</select></div></div>';

    var pre = parseInt(st.preloadCount, 10) || 3;
    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">\u{23E9}</div><span class="settings-row-text">预加载页数</span></div>'
      + '<div class="settings-row-right"><select id="rmPreload">';
    for (var i = 1; i <= 5; i++) {
      html += '<option value="' + i + '"' + (pre === i ? ' selected' : '') + '>' + i + ' 页</option>';
    }
    html += '</select></div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">\u{1F524}</div><span class="settings-row-text">小说字号</span></div>'
      + '<div class="settings-row-right"><select id="rmFontSize">';
    [14, 16, 18, 20, 22, 24].forEach(function(v) {
      html += '<option value="' + v + '"' + ((parseInt(st.fontSize, 10) || 16) === v ? ' selected' : '') + '>' + v + 'px</option>';
    });
    html += '</select></div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">\u{1F4CF}</div><span class="settings-row-text">小说行距</span></div>'
      + '<div class="settings-row-right"><select id="rmLineHeight">';
    [1.2, 1.4, 1.6, 1.8, 2.0, 2.2].forEach(function(v) {
      html += '<option value="' + v + '"' + (Math.abs((parseFloat(st.lineHeight) || 1.6) - v) < 0.01 ? ' selected' : '') + '>' + v.toFixed(1) + '</option>';
    });
    html += '</select></div></div>';

    html += '</div>';
    body.innerHTML = html;

    var t = el('mineTrashRow');
    if (t) t.addEventListener('click', renderTrash);
    var o = el('mineOfficialRow');
    if (o) o.addEventListener('click', openOfficialSheet);
    var v = el('mineVeneraRow');
    if (v) v.addEventListener('click', openVeneraRepoSheet);

    function saveSetting(key, value) {
      Store.state.read.settings[key] = value;
      Store.save();
    }
    var mode = body.querySelector('#rmReaderMode');
    if (mode) mode.addEventListener('change', function() { saveSetting('readerMode', this.value); Toast.show('默认翻页模式已保存'); });
    var pre2 = body.querySelector('#rmPreload');
    if (pre2) pre2.addEventListener('change', function() { saveSetting('preloadCount', parseInt(this.value, 10) || 3); });
    var fs = body.querySelector('#rmFontSize');
    if (fs) fs.addEventListener('change', function() { saveSetting('fontSize', parseInt(this.value, 10) || 16); });
    var lh = body.querySelector('#rmLineHeight');
    if (lh) lh.addEventListener('change', function() { saveSetting('lineHeight', parseFloat(this.value) || 1.6); });
  }

  /* ==================== Venera 官方图源仓库（直接接 venera-app/venera-configs） ==================== */
  var VENERA_REPO_RAW = 'https:/' + '/raw.githubusercontent.com/venera-app/venera-configs/main/';

  function openVeneraRepoSheet() {
    ensureOfficialSheet();
    var sheet = el('officialSourceSheet');
    sheet.innerHTML = '<div class="official-head"><span>Venera 官方图源仓库</span>'
      + '<button class="ghost" id="officialClose">关闭</button></div>'
      + '<div class="official-body" id="officialSourceBody">'
      + '<div class="empty-state"><div class="loading-spinner"></div><div>加载中…</div></div></div>';
    el('officialSourceMask').classList.add('open');
    sheet.classList.add('open');
    el('officialClose').addEventListener('click', closeOfficialSheet);
    loadVeneraRepo();
  }

  async function loadVeneraRepo() {
    var body = el('officialSourceBody');
    if (!body) return;
    try {
      var text = await NetFetch.text(VENERA_REPO_RAW + 'index.json');
      var list = JSON.parse(text);
      if (!Array.isArray(list) || !list.length) throw new Error('仓库索引为空');
      var html = '';
      list.forEach(function(it, i) {
        html += '<div class="official-item">'
          + '<div class="official-item-info">'
          + '<div class="official-item-name">' + esc(it.name || it.key || '未命名')
          + '<span class="official-badge">v' + esc(it.version || '') + '</span>'
          + '<span class="official-badge format">venera</span>'
          + '</div>'
          + '<div class="official-item-url">' + esc(it.description || it.fileName || '') + '</div>'
          + '</div>'
          + '<button class="source-item-btn venera-import" data-vidx="' + i + '">导入</button>'
          + '</div>';
      });
      body.innerHTML = html;
      body.querySelectorAll('.venera-import').forEach(function(btn) {
        btn.addEventListener('click', function() {
          importVeneraRepoSource(list[parseInt(btn.dataset.vidx, 10)], btn);
        });
      });
    } catch (e) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">\u{26A0}\u{FE0F}</div>'
        + '<div class="empty-text">仓库加载失败</div><div class="empty-sub">' + esc(e.message || '') + '</div>'
        + '<button class="empty-action-btn" id="veneraRetry">重试</button></div>';
      var retry = el('veneraRetry');
      if (retry) retry.addEventListener('click', loadVeneraRepo);
    }
  }

  /* 导入单个 Venera 图源：拉取官方 JS → 装入引擎 → 入源列表 */
  async function importVeneraRepoSource(item, btn) {
    try {
      if (btn) { btn.disabled = true; btn.textContent = '导入中…'; }
      if (typeof VeneraEngine === 'undefined') throw new Error('Venera 引擎未加载');
      var key = item.key || String(item.fileName || '').replace(/\.js$/, '');
      var raw = await NetFetch.text(VENERA_REPO_RAW + item.fileName);
      try { VeneraEngine.loadSource(raw, key); } catch (e) { /* 已加载过则忽略 */ }
      var exist = Store.state.read.sources.find(function(s) { return (s.key || s.name) === key; });
      if (!exist) {
        Store.state.read.sources.push({
          name: item.name || key, key: key, engine: 'venera', type: 'comic',
          raw: raw, enabled: true, hasExplore: true, url: ''
        });
        Store.save();
      }
      Toast.show('已导入「' + (item.name || key) + '」');
      if (btn) { btn.textContent = '已导入'; btn.disabled = false; }
      renderReadSettings();
    } catch (e) {
      Toast.show('导入失败：' + (e.message || e), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '重试'; }
    }
  }

  function renderReadSettings() {
    var body = el('readSettingsBody');
    if (!body) return;
    var st = Store.state.read.settings || {};
    var sources = Store.state.read.sources;
    var trash = Store.state.read.trash || [];

    var html = '';
    html += '<div class="settings-row" data-sub="subReadSources">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📚</div><span class="settings-row-text">书源管理</span></div>';
    html += '<div class="settings-row-right">' + sources.length + ' 个书源 <svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row" id="readTrashRow" data-sub="subReadTrash">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🗑️</div><span class="settings-row-text">回收站</span></div>';
    html += '<div class="settings-row-right">' + (trash.length ? trash.length + ' 项' : '空') + ' <svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">📖</div><span class="settings-row-text">默认翻页模式</span></div>';
    html += '<div class="settings-row-right"><select id="rsReaderMode">'
      + '<option value="gallery-rtl"' + (st.readerMode === 'gallery-rtl' ? ' selected' : '') + '>日漫翻页（右→左）</option>'
      + '<option value="gallery-ltr"' + (st.readerMode === 'gallery-ltr' ? ' selected' : '') + '>国漫翻页（左→右）</option>'
      + '<option value="continuous-ttb"' + (st.readerMode === 'continuous-ttb' ? ' selected' : '') + '>连续滚动（条漫）</option>'
      + '</select></div></div>';

    var pre = parseInt(st.preloadCount, 10) || 3;
    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">⏩</div><span class="settings-row-text">预加载页数</span></div>';
    html += '<div class="settings-row-right"><select id="rsPreload">';
    for (var i = 1; i <= 5; i++) {
      html += '<option value="' + i + '"' + (pre === i ? ' selected' : '') + '>' + i + ' 页</option>';
    }
    html += '</select></div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">🔤</div><span class="settings-row-text">小说字号</span></div>';
    html += '<div class="settings-row-right"><select id="rsFontSize">';
    [14, 16, 18, 20, 22, 24].forEach(function(v) {
      html += '<option value="' + v + '"' + ((parseInt(st.fontSize, 10) || 16) === v ? ' selected' : '') + '>' + v + 'px</option>';
    });
    html += '</select></div></div>';

    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">📏</div><span class="settings-row-text">小说行距</span></div>';
    html += '<div class="settings-row-right"><select id="rsLineHeight">';
    [1.2, 1.4, 1.6, 1.8, 2.0, 2.2].forEach(function(v) {
      html += '<option value="' + v + '"' + (Math.abs((parseFloat(st.lineHeight) || 1.6) - v) < 0.01 ? ' selected' : '') + '>' + v.toFixed(1) + '</option>';
    });
    html += '</select></div></div>';

    body.innerHTML = html;
    bindSettingsControls(body);
  }

  function bindSettingsControls(body) {
    function saveSetting(key, value) {
      Store.state.read.settings[key] = value;
      Store.save();
    }
    var mode = body.querySelector('#rsReaderMode');
    if (mode) mode.addEventListener('change', function() { saveSetting('readerMode', this.value); Toast.show('默认翻页模式已保存'); });
    var pre = body.querySelector('#rsPreload');
    if (pre) pre.addEventListener('change', function() { saveSetting('preloadCount', parseInt(this.value, 10) || 3); });
    var fs = body.querySelector('#rsFontSize');
    if (fs) fs.addEventListener('change', function() { saveSetting('fontSize', parseInt(this.value, 10) || 16); });
    var lh = body.querySelector('#rsLineHeight');
    if (lh) lh.addEventListener('change', function() { saveSetting('lineHeight', parseFloat(this.value) || 1.6); });
    var trashRow = body.querySelector('#readTrashRow');
    if (trashRow) trashRow.addEventListener('click', function() { renderTrash(); });
  }

  /* ==================== 事件绑定 ==================== */

  function bindEvents() {
    // 阅读页底部导航
    var nav = el('readBottomNav');
    if (nav) {
      nav.addEventListener('click', function(e) {
        var item = e.target.closest('.read-nav-item');
        if (item) setView(item.dataset.readview);
      });
    }

    // readBody 事件委托（书架 / 发现 / 书签 共用）
    var body = el('readBody');
    if (body) {
      // 长按删除（捕获阶段阻止后续 click 打开书籍）
      body.addEventListener('click', function(e) {
        if (lpFired) {
          lpFired = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);

      body.addEventListener('touchstart', function(e) {
        var item = e.target.closest('.shelf-item');
        if (!item) return;
        var url = item.dataset.url;
        if (lpTimer) clearTimeout(lpTimer);
        lpTimer = setTimeout(function() {
          lpFired = true;
          var book = Store.state.read.shelf.find(function(b) { return b.url === url; });
          if (book) openShelfMenu(book);
        }, 550);
      }, { passive: true });
      body.addEventListener('touchmove', function() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
      body.addEventListener('touchend', function() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });

      body.addEventListener('contextmenu', function(e) {
        var item = e.target.closest('.shelf-item');
        if (!item) return;
        e.preventDefault();
        var book = Store.state.read.shelf.find(function(b) { return b.url === item.dataset.url; });
        if (book) { lpFired = true; openShelfMenu(book); }
      });

      body.addEventListener('click', function(e) {
        // 空状态：去搜索
        if (e.target.closest('#emptyGoSearch')) {
          if (window.App && App.openSub) App.openSub('subReadSearch');
          return;
        }
        // 发现页：刷新
        if (e.target.closest('#discoverRefresh')) { loadDiscoverTags(); return; }
        // 发现页：启用未启用的书源
        var enableBtn = e.target.closest('#discoverEnable');
        if (enableBtn) {
          var s = findSource(enableBtn.dataset.name);
          if (s) { s.enabled = true; Store.save(); loadDiscoverTags(); Toast.show('已启用: ' + s.name); }
          return;
        }
        // 发现页：书源自定义下拉 —— 按钮开合
        if (e.target.closest('#discoverSourceBtn')) {
          var menu = el('discoverSourceMenu');
          if (menu) menu.classList.toggle('hidden');
          return;
        }
        // 发现页：书源自定义下拉 —— 选项
        var opt = e.target.closest('.discover-source-option');
        if (opt) {
          if (opt.dataset.sid) {
            discover.sourceId = opt.dataset.sid;
            updateDiscoverSourceLabel();
            closeDiscoverSourceMenu();
            loadDiscoverTags();
          }
          return;
        }
        // 点击其它区域时收起书源下拉
        closeDiscoverSourceMenu();
        // 发现页：标签
        var tag = e.target.closest('.discover-tag');
        if (tag) { selectDiscoverTag(parseInt(tag.dataset.tag, 10)); return; }
        // 发现页：书籍卡片 → 详情弹层
        var card = e.target.closest('.discover-book');
        if (card && card.dataset.idx !== undefined) {
          var book = discover.books[parseInt(card.dataset.idx, 10)];
          if (book) openBookDetail(book);
          return;
        }
        // 书签页：最近阅读条目
        var bm = e.target.closest('.bookmark-item');
        if (bm) {
          var b = Store.state.read.shelf.find(function(x) { return x.url === bm.dataset.url; });
          if (b) openBook(b);
          return;
        }
      });

      // 发现页：搜索筛选（本地过滤）
      body.addEventListener('input', function(e) {
        if (e.target.id === 'discoverFilter') {
          discover.keyword = e.target.value.trim();
          renderDiscoverBooks();
        }
      });

    }

    // 搜索提交
    var searchSubmit = el('readSearchSubmit');
    if (searchSubmit) searchSubmit.addEventListener('click', doSearch);

    var searchInput = el('readSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });
    }

    // 粘贴导入
    var importBtn = el('sourceImportBtn');
    if (importBtn) {
      importBtn.addEventListener('click', async function() {
        var input = el('sourceImportInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return Toast.show('请输入书源内容', 'error');
        await importSource(text);
        input.value = '';
      });
    }

    // URL 导入
    var urlBtn = el('sourceUrlImportBtn');
    if (urlBtn) urlBtn.addEventListener('click', importFromUrl);
    var urlInput = el('sourceUrlInput');
    if (urlInput) urlInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') importFromUrl(); });

    // 本地文件导入
    var fileBtn = el('sourceFileBtn');
    var fileInput = el('sourceFileInput');
    if (fileBtn && fileInput) {
      fileBtn.addEventListener('click', function() { fileInput.click(); });
      fileInput.addEventListener('change', function() {
        importFromFile(fileInput.files && fileInput.files[0]);
        fileInput.value = '';
      });
    }

    // 导入区扩展按钮：二维码导入 / 官方源仓库（JS 动态插入）
    injectImportExtraButtons();

    // 书源列表操作（事件委托）：启用开关 / 删除（进回收站）
    var listBox = el('sourceList');
    if (listBox) {
      listBox.addEventListener('click', function(e) {
        var toggleBtn = e.target.closest('.toggle-source');
        if (toggleBtn) {
          var s1 = findSource(toggleBtn.dataset.name);
          if (s1) {
            s1.enabled = !s1.enabled;
            Store.save();
            renderSourceList();
            Toast.show(s1.enabled ? '已启用: ' + s1.name : '已停用: ' + s1.name);
          }
          return;
        }
        var delBtn = e.target.closest('.del-source');
        if (delBtn) {
          var s2 = findSource(delBtn.dataset.name);
          if (s2 && confirm('删除书源「' + s2.name + '」？将移入回收站（保留 15 天）')) {
            trashSource(s2);
          }
        }
      });
    }

    // 回收站操作（事件委托）
    var trashBody = el('readTrashBody');
    if (trashBody) {
      trashBody.addEventListener('click', function(e) {
        var check = e.target.closest('.trash-item-check');
        if (check) { check.classList.toggle('on'); check.textContent = check.classList.contains('on') ? '✓' : ''; return; }
        var restoreBtn = e.target.closest('.trash-restore');
        if (restoreBtn) { restoreTrashItem(parseInt(restoreBtn.dataset.idx, 10)); return; }
        var delBtn = e.target.closest('.trash-del');
        if (delBtn) {
          if (confirm('彻底删除后无法恢复，确定？')) deleteTrashItem(parseInt(delBtn.dataset.idx, 10));
          return;
        }
        if (e.target.closest('#trashRestoreSel')) {
          var idxs = selectedTrashIdxs();
          if (!idxs.length) return Toast.show('请先勾选要恢复的项', 'error');
          idxs.forEach(function(i) { restoreTrashItem(i); });
          return;
        }
        if (e.target.closest('#trashDeleteSel')) {
          var idxs2 = selectedTrashIdxs();
          if (!idxs2.length) return Toast.show('请先勾选要删除的项', 'error');
          if (confirm('彻底删除选中的 ' + idxs2.length + ' 项？')) {
            idxs2.forEach(function(i) { Store.state.read.trash.splice(i, 1); });
            Store.save();
            renderTrash();
            renderReadSettings();
          }
          return;
        }
        if (e.target.closest('#trashClear')) {
          if (!Store.state.read.trash.length) return Toast.show('回收站已经是空的');
          if (confirm('清空回收站？所有项将被彻底删除')) {
            Store.state.read.trash = [];
            Store.save();
            renderTrash();
            renderReadSettings();
            Toast.show('回收站已清空');
          }
        }
      });
    }

    renderSourceList();
  }

  return {
    init: init,
    renderRead: renderRead,
    renderTrash: renderTrash,
    renderReadSettings: renderReadSettings,
    purgeExpiredTrash: purgeExpiredTrash,
    setTab: setTab,
    setView: setView,
    addToShelf: addToShelf,
    openBook: openBook,
    doSearch: doSearch
  };
})();
