/* ==================== OmniHub Read Module ==================== */

const ReadModule = (() => {
  'use strict';

  var currentTab = 'all';

  var ENGINE_META = {
    legado: { label: 'Legado', color: '#2e9e5b' },
    venera: { label: 'Venera', color: '#6366F1' },
    css:    { label: 'CSS',    color: '#8a8f99' }
  };

  function init() {
    migrateSources();
    renderRead();
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

  function engineOf(src) {
    return src.engine || (src.type === 'venera' ? 'venera' : 'css');
  }

  function findSource(key) {
    return Store.state.read.sources.find(function(s) {
      return s.name === key || s.key === key || s.id === key;
    });
  }

  function renderRead() {
    var body = document.getElementById('readBody');
    if (!body) return;

    var shelf = Store.state.read.shelf;

    var html = '';

    // Tab 栏
    html += '<div class="read-tabs">';
    html += '<button class="read-tab ' + (currentTab === 'all' ? 'active' : '') + '" data-tab="all">全部</button>';
    html += '<button class="read-tab ' + (currentTab === 'novel' ? 'active' : '') + '" data-tab="novel">小说</button>';
    html += '<button class="read-tab ' + (currentTab === 'comic' ? 'active' : '') + '" data-tab="comic">漫画</button>';
    html += '</div>';

    // 书架网格
    html += '<div class="shelf-grid" id="shelfGrid">';
    html += renderShelfItems(shelf);
    html += '</div>';

    // 空状态
    if (shelf.length === 0) {
      html += '<div class="empty-state" style="padding-top:40px;">';
      html += '<div class="empty-icon">📚</div>';
      html += '<div class="empty-text">书架为空</div>';
      html += '<div class="empty-sub">点击右上角搜索添加书籍</div>';
      html += '</div>';
    }

    body.innerHTML = html;
  }

  function renderShelfItems(shelf) {
    var filtered = currentTab === 'all' ? shelf : shelf.filter(function(b) { return b.type === currentTab; });
    if (!filtered.length) return '';

    var html = '';
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
    return html;
  }

  function esc(s) {
    return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setTab(tab) {
    currentTab = tab;
    renderRead();
  }

  function addToShelf(book) {
    var exists = Store.state.read.shelf.find(function(b) { return b.url === book.url; });
    if (!exists) {
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
      Toast.show('已加入书架');
      renderRead();
    } else {
      Toast.show('已在书架中');
    }
  }

  async function openBook(book) {
    var src = findSource(book.source);
    if (!src) return Toast.show('书源已删除', 'error');

    var engine = engineOf(src);
    var chapters = [];
    try {
      if (engine === 'legado' && typeof LegadoEngine !== 'undefined') {
        var info = null;
        try { info = await LegadoEngine.getBookInfo(src.raw, book.url); } catch(e) { console.warn('Legado 详情获取失败:', e); }
        chapters = await LegadoEngine.getToc(src.raw, { url: book.url }, info && info.tocUrl);
        // 分卷标题没有章节地址，阅读器不支持，过滤
        chapters = chapters.filter(function(c) { return c.url; });
      } else if (engine === 'venera' && typeof VeneraEngine !== 'undefined') {
        var det = await VeneraEngine.getComicDetails(src.key || src.name, book.url);
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
          currentChapter: chapterIdx
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
      var resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var html = await resp.text();
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

  async function doSearch() {
    var input = document.getElementById('readSearchInput');
    if (!input) return;
    var keyword = input.value.trim();
    if (!keyword) return Toast.show('请输入关键词', 'error');

    var resultsBox = document.getElementById('readSearchResults');
    resultsBox.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div><div>搜索中...</div></div>';

    var sources = Store.state.read.sources.filter(function(s) { return s.enabled; });
    if (!sources.length) {
      resultsBox.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">没有书源</div><div class="empty-sub">请先导入书源</div></div>';
      return;
    }

    var all = [];
    var failures = [];
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      var engine = engineOf(src);
      try {
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
        all.push.apply(all, list);
      } catch(e) {
        console.warn('搜索失败:', src.name, e);
        failures.push(src.name + '（' + (e.message || '未知错误') + '）');
      }
    }

    renderSearchResults(all, failures);
  }

  async function searchCssSource(src, keyword) {
    if (!src.searchUrl) return [];
    var url = (src.url || '') + src.searchUrl.replace('{{keyword}}', encodeURIComponent(keyword));
    try {
      var resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var html = await resp.text();
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
    var box = document.getElementById('readSearchResults');
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

  function engineBadge(engine) {
    var meta = ENGINE_META[engine] || ENGINE_META.css;
    return '<span class="source-item-tag" style="background:' + meta.color + '22;color:' + meta.color + ';">' + meta.label + '</span>';
  }

  function renderSourceList() {
    var box = document.getElementById('sourceList');
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

    var labelMap = {
      legado: 'Legado 书源', venera: 'Venera 图源', 'css-config': 'CSS 选择器配置'
    };

    if (det.type === 'legado') {
      var n = 0;
      det.sources.forEach(function(o) {
        if (Store.state.read.sources.find(function(x) { return x.name === o.bookSourceName; })) return;
        Store.state.read.sources.push({
          id: 'legado_' + Date.now() + '_' + n,
          name: o.bookSourceName,
          url: o.bookSourceUrl,
          engine: 'legado',
          type: 'legado',
          mediaType: o.bookSourceType === 2 ? 'comic' : 'novel',
          enabled: true,
          raw: o,
          addedAt: Date.now()
        });
        n++;
      });
      Store.save();
      Toast.show('识别为 Legado 格式，成功导入 ' + n + ' 个书源' + (det.message ? '，' + det.message : ''));
      renderSourceList();
    } else if (det.type === 'venera') {
      if (typeof VeneraEngine === 'undefined') return Toast.show('Venera 引擎未加载', 'error');
      try {
        var src = await VeneraEngine.loadSource(text, 'venera_source');
        Store.state.read.sources.push({
          id: 'venera_' + Date.now(),
          name: src.name, key: src.key,
          engine: 'venera', type: 'venera',
          url: src.url || '', version: src.version || '',
          mediaType: 'comic', enabled: true,
          raw: text,
          addedAt: Date.now()
        });
        Store.save();
        Toast.show('识别为 Venera 格式，成功导入 1 个书源: ' + src.name);
        renderSourceList();
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
    } else {
      // venera-index / legado-js / unknown
      Toast.show(det.message || '无法识别的书源格式', 'error');
    }
  }

  function bindEvents() {
    // 搜索按钮
    var searchBtn = document.getElementById('readSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', function() { App.openSub('subReadSearch'); });

    // 设置按钮
    var settingsBtn = document.getElementById('readSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', function() { App.openSub('subReadSettings'); });

    // 搜索提交
    var searchSubmit = document.getElementById('readSearchSubmit');
    if (searchSubmit) searchSubmit.addEventListener('click', doSearch);

    var searchInput = document.getElementById('readSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });
    }

    // 书源导入
    var importBtn = document.getElementById('sourceImportBtn');
    if (importBtn) {
      importBtn.addEventListener('click', async function() {
        var input = document.getElementById('sourceImportInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return Toast.show('请输入书源内容', 'error');
        await importSource(text);
        input.value = '';
      });
    }

    // 书源列表操作（事件委托）：启用开关 / 删除
    var listBox = document.getElementById('sourceList');
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
          if (s2 && confirm('确定删除书源「' + s2.name + '」？')) {
            Store.state.read.sources = Store.state.read.sources.filter(function(x) { return x !== s2; });
            Store.save();
            renderSourceList();
            Toast.show('已删除: ' + s2.name);
          }
        }
      });
    }

    renderSourceList();
  }

  return { init, renderRead, setTab, addToShelf, openBook, doSearch };
})();
