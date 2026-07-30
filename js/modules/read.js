/* ==================== OmniHub Read Module ==================== */

const ReadModule = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let currentTab = 'all';

  function init() {
    renderRead();
    bindEvents();
  }

  function renderRead() {
    const body = $('readBody');
    if (!body) return;

    const shelf = Store.state.read.shelf;

    body.innerHTML = `
      <div class="read-tabs">
        <button class="read-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">全部</button>
        <button class="read-tab ${currentTab === 'novel' ? 'active' : ''}" data-tab="novel">小说</button>
        <button class="read-tab ${currentTab === 'comic' ? 'active' : ''}" data-tab="comic">漫画</button>
      </div>
      <div class="shelf-grid" id="shelfGrid">
        ${renderShelfItems(shelf)}
      </div>
      ${shelf.length === 0 ? `
      <div class="empty-state" style="height:40vh;">
        <div class="empty-icon">📚</div>
        <div class="empty-text">书架为空</div>
        <div class="empty-sub">点击右上角搜索添加书籍</div>
      </div>` : ''}
    `;
  }

  function renderShelfItems(shelf) {
    const filtered = currentTab === 'all' ? shelf : shelf.filter(b => b.type === currentTab);
    return filtered.map(b => `
      <div class="shelf-item" data-url="${esc(b.url)}" data-type="${b.type}">
        <div class="shelf-cover">
          ${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : `<div class="shelf-cover-placeholder">${b.type === 'comic' ? '📖' : '📕'}</div>`}
        </div>
        <div class="shelf-name">${esc(b.title)}</div>
        ${b.chapterName ? `<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(b.chapterName)}</div>` : ''}
      </div>
    `).join('');
  }

  function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function bindEvents() {
    // Tab 切换
    document.addEventListener('click', e => {
      const tab = e.target.closest('.read-tab');
      if (tab) {
        currentTab = tab.dataset.tab;
        document.querySelectorAll('.read-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
        const shelf = Store.state.read.shelf;
        $('shelfGrid').innerHTML = renderShelfItems(shelf);
      }
    });

    // 书架点击
    document.addEventListener('click', e => {
      const item = e.target.closest('.shelf-item');
      if (item) {
        const url = item.dataset.url;
        const book = Store.state.read.shelf.find(b => b.url === url);
        if (!book) return;
        openBook(book);
      }
    });

    // 搜索按钮
    const searchBtn = $('readSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => App.openSub('subReadSearch'));

    // 设置按钮
    const settingsBtn = $('readSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => App.openSub('subReadSettings'));

    // 搜索提交
    const searchSubmit = $('readSearchSubmit');
    if (searchSubmit) {
      searchSubmit.addEventListener('click', doSearch);
    }
    const searchInput = $('readSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    }

    // 搜索类型切换
    document.addEventListener('click', e => {
      const tab = e.target.closest('.source-tab');
      if (tab && tab.closest('#subReadSearch')) {
        document.querySelectorAll('#subReadSearch .source-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      }
    });

    // 书源导入
    const importBtn = $('sourceImportBtn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const input = $('sourceImportInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return Toast.show('请输入书源内容', 'error');

        // 检测 Venera JS 图源
        const isVenera = text.includes('extends ComicSource') || (text.includes('class') && text.includes('search') && text.includes('comic'));

        if (isVenera && typeof VeneraEngine !== 'undefined') {
          try {
            const src = await VeneraEngine.loadSource(text, 'venera_source');
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
          // 普通 JSON 书源
          try {
            const data = JSON.parse(text);
            const sources = Array.isArray(data) ? data : [data];
            let n = 0;
            sources.forEach(s => {
              if (!s.name || !s.url) return;
              if (!Store.state.read.sources.find(x => x.name === s.name)) {
                Store.state.read.sources.push({
                  ...s, type: 'css', mediaType: s.mediaType || 'novel', enabled: true
                });
                n++;
              }
            });
            Store.save();
            Toast.show(`导入 ${n} 个书源`);
            input.value = '';
            renderSourceList();
          } catch(e) {
            Toast.show('格式错误，请检查JSON', 'error');
          }
        }
      });
    }

    // 渲染书源列表
    renderSourceList();

    // 阅读器事件
    bindReaderEvents();
  }

  async function doSearch() {
    const input = $('readSearchInput');
    if (!input) return;
    const keyword = input.value.trim();
    if (!keyword) return Toast.show('请输入关键词', 'error');

    const resultsBox = $('readSearchResults');
    resultsBox.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div><div>搜索中...</div></div>';

    const sources = Store.state.read.sources.filter(s => s.enabled);
    if (!sources.length) {
      resultsBox.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">没有书源</div><div class="empty-sub">请先导入书源</div></div>';
      return;
    }

    const all = [];
    for (const src of sources) {
      try {
        let list = [];
        if (src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
          list = await VeneraEngine.search(src.key, keyword, {}, 1);
          list.forEach(b => { b.sourceKey = src.key; b.sourceType = 'venera'; b.mediaType = src.mediaType || 'comic'; });
        } else {
          // 普通 CSS 书源搜索
          list = await searchCssSource(src, keyword);
          list.forEach(b => { b.sourceName = src.name; b.mediaType = src.mediaType || 'novel'; });
        }
        all.push(...list);
      } catch(e) { console.warn('搜索失败:', src.name, e); }
    }

    renderSearchResults(all);
  }

  async function searchCssSource(src, keyword) {
    if (!src.searchUrl) return [];
    const url = (src.url || '') + src.searchUrl.replace('{{keyword}}', encodeURIComponent(keyword));
    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const items = [];
      const rows = doc.querySelectorAll(src.searchList || 'div');
      rows.forEach(row => {
        const nameEl = row.querySelector(src.searchName || 'a');
        const urlEl = row.querySelector(src.searchUrl || 'a');
        if (nameEl && urlEl) {
          const href = urlEl.getAttribute('href') || '';
          items.push({
            id: href, name: nameEl.textContent.trim(),
            url: href.startsWith('http') ? href : (src.url + href),
            author: '', cover: '', mediaType: src.mediaType || 'novel'
          });
        }
      });
      return items.slice(0, 20);
    } catch(e) { return []; }
  }

  function renderSearchResults(list) {
    const box = $('readSearchResults');
    if (!list.length) {
      box.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">未找到结果</div></div>';
      return;
    }
    box.innerHTML = list.map(b => `
      <div class="result-item" data-url="${esc(b.url || b.id)}" data-name="${esc(b.name)}" data-cover="${esc(b.cover || '')}" data-media="${b.mediaType || 'novel'}" data-source="${esc(b.sourceKey || b.sourceName || '')}">
        <div class="result-cover">${b.cover ? `<img src="${esc(b.cover)}" alt="">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">${b.mediaType === 'comic' ? '📖' : '📕'}</div>`}</div>
        <div class="result-info">
          <div class="result-title">${esc(b.name)}</div>
          <div class="result-meta">${esc(b.author || '未知')} · ${esc(b.sourceKey || b.sourceName || '')}</div>
          <div class="result-actions">
            <button class="result-btn primary add-shelf-btn" data-url="${esc(b.url || b.id)}">加入书架</button>
            <button class="result-btn read-now-btn" data-url="${esc(b.url || b.id)}">立即阅读</button>
          </div>
        </div>
      </div>
    `).join('');

    // 加入书架
    document.querySelectorAll('.add-shelf-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const row = btn.closest('.result-item');
        const book = {
          id: row.dataset.url, title: row.dataset.name,
          url: row.dataset.url, cover: row.dataset.cover,
          type: row.dataset.media, source: row.dataset.source,
          author: '', chapterIdx: 0, pageIdx: 0, chapterName: '', lastRead: Date.now()
        };
        if (!Store.state.read.shelf.find(b => b.url === book.url)) {
          Store.state.read.shelf.unshift(book);
          Store.save();
          Toast.show('已加入书架');
          renderRead();
        } else {
          Toast.show('已在书架中');
        }
      });
    });

    // 立即阅读
    document.querySelectorAll('.read-now-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const row = btn.closest('.result-item');
        const book = {
          id: row.dataset.url, title: row.dataset.name,
          url: row.dataset.url, cover: row.dataset.cover,
          type: row.dataset.media, source: row.dataset.source
        };
        openBook(book);
      });
    });
  }

  function renderSourceList() {
    const box = $('sourceList');
    if (!box) return;
    const sources = Store.state.read.sources;
    box.innerHTML = sources.map(s => `
      <div class="source-item">
        <div class="source-item-info">
          <div class="source-item-name">${esc(s.name)}${s.type === 'venera' ? '<span class="source-item-tag">Venera</span>' : ''}</div>
          <div class="source-item-url">${esc(s.url)}</div>
        </div>
        <div class="source-item-actions">
          <button class="source-item-btn test-source" data-name="${esc(s.name)}">测试</button>
          <button class="source-item-btn danger del-source" data-name="${esc(s.name)}">删除</button>
        </div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">📚</div><div class="empty-text">暂无书源</div></div>';

    // 测试书源
    document.querySelectorAll('.test-source').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        const src = Store.state.read.sources.find(s => s.name === name);
        if (!src) return;
        Toast.show('测试中...');
        if (src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
          const res = await VeneraEngine.verify(src.key);
          Toast.show(res.ok ? '书源可用' : '书源不可用: ' + (res.err || res.status), res.ok ? 'success' : 'error');
        } else {
          try {
            const resp = await fetch(src.url, { mode: 'cors', method: 'HEAD' });
            Toast.show(resp.ok ? '书源可用' : 'HTTP ' + resp.status, resp.ok ? 'success' : 'error');
          } catch(e) {
            Toast.show('无法连接', 'error');
          }
        }
      });
    });

    // 删除书源
    document.querySelectorAll('.del-source').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        if (confirm('删除书源 "' + name + '"？')) {
          const src = Store.state.read.sources.find(s => s.name === name);
          if (src && src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
            VeneraEngine.unload(src.key);
          }
          Store.state.read.sources = Store.state.read.sources.filter(s => s.name !== name);
          Store.save();
          renderSourceList();
          Toast.show('已删除');
        }
      });
    });
  }

  async function openBook(book) {
    // 查找书源
    const src = Store.state.read.sources.find(s => s.name === book.source || s.key === book.source);
    if (!src) return Toast.show('书源已删除', 'error');

    // 获取章节
    let chapters = [];
    try {
      if (src.type === 'venera' && typeof VeneraEngine !== 'undefined') {
        const det = await VeneraEngine.getComicDetails(src.key, book.url);
        chapters = det ? det.chapters : [];
      } else {
        chapters = await fetchChaptersCss(book.url, src);
      }
    } catch(e) {
      return Toast.show('获取章节失败', 'error');
    }

    if (!chapters.length) return Toast.show('未找到章节', 'error');

    // 恢复阅读进度
    const shelfBook = Store.state.read.shelf.find(b => b.url === book.url);
    const chapterIdx = shelfBook ? (shelfBook.chapterIdx || 0) : 0;
    const pageIdx = shelfBook ? (shelfBook.pageIdx || 0) : 0;

    // 打开阅读器
    Reader.open({
      title: book.title,
      url: book.url,
      source: book.source,
      sourceType: src.type,
      chapters: chapters,
      currentChapter: chapterIdx,
      currentPage: pageIdx
    });
  }

  async function fetchChaptersCss(url, src) {
    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const list = [];
      const rows = doc.querySelectorAll(src.chapterList || 'a');
      rows.forEach(a => {
        const href = a.getAttribute('href') || '';
        list.push({
          name: a.textContent.trim(),
          url: href.startsWith('http') ? href : (src.url + href)
        });
      });
      return list;
    } catch(e) { return []; }
  }

  return { init, renderRead };
})();
