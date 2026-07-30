/* ==================== OmniHub Read Module ==================== */

const ReadModule = (() => {
  'use strict';

  var currentTab = 'all';

  function init() {
    renderRead();
    bindEvents();
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
    var src = Store.state.read.sources.find(function(s) { return s.name === book.source || s.key === book.source; });
    if (!src) return Toast.show('书源已删除', 'error');

    var chapters = [];
    try {
      if (src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
        var det = await VeneraEngine.getComicDetails(src.key || src.name, book.url);
        chapters = det ? det.chapters : [];
      } else {
        chapters = await fetchChaptersCss(book.url, src);
      }
    } catch(e) {
      return Toast.show('获取章节失败', 'error');
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
          sourceType: src.type,
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
          sourceType: src.type,
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
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      try {
        var list = [];
        if (src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
          list = await VeneraEngine.search(src.key || src.name, keyword, {}, 1);
          list.forEach(function(b) { b.sourceKey = src.key || src.name; b.sourceType = 'venera'; b.mediaType = src.mediaType || 'comic'; });
        } else {
          list = await searchCssSource(src, keyword);
          list.forEach(function(b) { b.sourceName = src.name; b.mediaType = src.mediaType || 'novel'; });
        }
        all.push.apply(all, list);
      } catch(e) { console.warn('搜索失败:', src.name, e); }
    }

    renderSearchResults(all);
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

  function renderSearchResults(list) {
    var box = document.getElementById('readSearchResults');
    if (!list.length) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到结果</div></div>';
      return;
    }

    var html = '';
    list.forEach(function(b) {
      html += '<div class="result-item" data-url="' + esc(b.url || b.id) + '" data-name="' + esc(b.name) + '" data-cover="' + esc(b.cover || '') + '" data-media="' + (b.mediaType || 'novel') + '" data-source="' + esc(b.sourceKey || b.sourceName || '') + '">';
      html += '<div class="result-cover">';
      if (b.cover) {
        html += '<img src="' + esc(b.cover) + '" alt="">';
      } else {
        html += '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">' + (b.mediaType === 'comic' ? '📖' : '📕') + '</div>';
      }
      html += '</div>';
      html += '<div class="result-info">';
      html += '<div class="result-title">' + esc(b.name) + '</div>';
      html += '<div class="result-meta">' + esc(b.author || '未知') + ' · ' + esc(b.sourceKey || b.sourceName || '') + '</div>';
      html += '<div class="result-actions">';
      html += '<button class="result-btn primary add-shelf-btn" data-url="' + esc(b.url || b.id) + '">加入书架</button>';
      html += '<button class="result-btn read-now-btn" data-url="' + esc(b.url || b.id) + '">立即阅读</button>';
      html += '</div></div></div>';
    });
    box.innerHTML = html;
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
      html += '<div class="source-item">';
      html += '<div class="source-item-info">';
      html += '<div class="source-item-name">' + esc(s.name) + (s.type === 'venera' ? '<span class="source-item-tag">Venera</span>' : '') + '</div>';
      html += '<div class="source-item-url">' + esc(s.url) + '</div>';
      html += '</div>';
      html += '<div class="source-item-actions">';
      html += '<button class="source-item-btn test-source" data-name="' + esc(s.name) + '">测试</button>';
      html += '<button class="source-item-btn danger del-source" data-name="' + esc(s.name) + '">删除</button>';
      html += '</div></div>';
    });
    box.innerHTML = html;
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

        var isVenera = text.indexOf('extends ComicSource') > -1 || (text.indexOf('class') > -1 && text.indexOf('search') > -1 && text.indexOf('comic') > -1);

        if (isVenera && typeof VeneraEngine !== 'undefined') {
          try {
            var src = await VeneraEngine.loadSource(text, 'venera_source');
            Store.state.read.sources.push({
              name: src.name, key: src.key, type: 'venera',
              url: src.url || '', version: src.version || '',
              mediaType: 'comic', enabled: true
            });
            Store.save();
            Toast.show('Venera 图源导入成功: ' + src.name);
            input.value = '';
            renderSourceList();
          } catch(e) {
            Toast.show('导入失败: ' + e.message, 'error');
          }
        } else {
          try {
            var data = JSON.parse(text);
            var sources = Array.isArray(data) ? data : [data];
            var n = 0;
            sources.forEach(function(s) {
              if (!s.name || !s.url) return;
              if (!Store.state.read.sources.find(function(x) { return x.name === s.name; })) {
                Store.state.read.sources.push({
                  name: s.name, url: s.url, type: 'css',
                  mediaType: s.mediaType || 'novel', enabled: true,
                  searchUrl: s.searchUrl || '', searchList: s.searchList || '',
                  searchName: s.searchName || '', chapterList: s.chapterList || '',
                  images: s.images || ''
                });
                n++;
              }
            });
            Store.save();
            Toast.show('导入 ' + n + ' 个书源');
            input.value = '';
            renderSourceList();
          } catch(e) {
            Toast.show('格式错误，请检查JSON', 'error');
          }
        }
      });
    }

    renderSourceList();
  }

  return { init, renderRead, setTab, addToShelf, openBook, doSearch };
})();
