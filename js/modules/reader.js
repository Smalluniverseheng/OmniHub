/* ==================== OmniHub Reader ==================== */

const Reader = (() => {
  'use strict';

  let state = {
    mode: 'gallery-rtl', currentPage: 0, totalPages: 0,
    currentChapter: 0, chapters: [], images: [],
    bookTitle: '', bookUrl: '', source: '', sourceType: '',
    scaffoldOpen: false, zoomScale: 1, isZoomed: false,
    chapterPanelOpen: false, settingsPanelOpen: false
  };

  function open(book) {
    state.bookTitle = book.title;
    state.bookUrl = book.url;
    state.source = book.source;
    state.sourceType = book.sourceType;
    state.chapters = book.chapters;
    state.currentChapter = book.currentChapter || 0;
    state.currentPage = book.currentPage || 0;
    state.images = [];

    const overlay = document.getElementById('readerOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    if (window.Nav && Nav.setVisible) Nav.setVisible(false);

    loadChapter(state.currentChapter);
  }

  function close() {
    saveProgress();
    const overlay = document.getElementById('readerOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    if (window.Nav && Nav.setVisible) Nav.setVisible(true);
  }

  async function loadChapter(idx) {
    if (idx < 0 || idx >= state.chapters.length) return;
    state.isLoading = true;
    state.currentChapter = idx;
    state.currentPage = 0;
    showLoading(true);

    const ch = state.chapters[idx];
    try {
      let images = [];
      if (state.sourceType === 'venera' && typeof VeneraEngine !== 'undefined') {
        images = await VeneraEngine.getImages(state.source, state.bookUrl, ch.url || ch.id);
      } else if (state.sourceType === 'legado' && typeof LegadoEngine !== 'undefined') {
        const lsrc = (Store.state.read.sources || []).find(function(s) { return s.name === state.source || s.key === state.source || s.id === state.source; });
        if (!lsrc || !lsrc.raw) throw new Error('Legado 书源不存在');
        const res = await LegadoEngine.getContent(lsrc.raw, { name: ch.name, url: ch.url });
        if (res.type !== 'images') throw new Error('该章节为文本内容，请使用小说阅读器');
        images = res.images;
      } else {
        images = await fetchImagesCss(ch.url);
      }
      state.images = images.filter(Boolean);
      state.totalPages = state.images.length;
      state.isLoading = false;
      showLoading(false);
      render();
      updateScaffold();
    } catch(e) {
      showLoading(false);
      showError(e.message);
    }
  }

  async function fetchImagesCss(url) {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgs = doc.querySelectorAll('img');
    return Array.from(imgs).map(img => img.src).filter(s => s && s.startsWith('http'));
  }

  function render() {
    const content = document.getElementById('readerContent');
    if (!content) return;

    if (state.mode.startsWith('gallery')) {
      const url = state.images[state.currentPage];
      content.innerHTML = `<div class="reader-gallery"><img id="readerGalleryImg" src="${esc(url)}" alt="" draggable="false"></div>`;
    } else {
      content.innerHTML = `<div class="reader-continuous vertical">${state.images.map((url, i) => `
        <div class="reader-page" data-idx="${i}"><img src="${esc(url)}" alt="第${i+1}页" loading="lazy"></div>
      `).join('')}</div>`;
      setTimeout(() => scrollToPage(state.currentPage), 50);
    }
    updateScaffold();
  }

  function scrollToPage(idx) {
    const container = document.querySelector('.reader-continuous');
    if (!container) return;
    const pages = container.querySelectorAll('.reader-page');
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goPage(n) {
    if (state.isLoading || !state.images.length) return;
    state.currentPage = Math.max(0, Math.min(n, state.totalPages - 1));
    if (state.mode.startsWith('gallery')) {
      const img = document.getElementById('readerGalleryImg');
      if (img) img.src = state.images[state.currentPage];
    } else {
      scrollToPage(state.currentPage);
    }
    updateScaffold();
  }

  function nextPage() {
    if (state.currentPage < state.totalPages - 1) goPage(state.currentPage + 1);
    else if (state.currentChapter < state.chapters.length - 1) { nextChapter(); }
  }

  function prevPage() {
    if (state.currentPage > 0) goPage(state.currentPage - 1);
    else if (state.currentChapter > 0) { prevChapter(true); }
  }

  function nextChapter() {
    if (state.currentChapter < state.chapters.length - 1) loadChapter(state.currentChapter + 1);
  }

  function prevChapter(toLast) {
    if (state.currentChapter > 0) {
      loadChapter(state.currentChapter - 1).then(() => {
        if (toLast) goPage(state.totalPages - 1);
      });
    }
  }

  function toggleScaffold() {
    state.scaffoldOpen = !state.scaffoldOpen;
    updateScaffold();
  }

  function updateScaffold() {
    const top = document.getElementById('readerTopbar');
    const bottom = document.getElementById('readerBottombar');
    const float = document.getElementById('readerFloat');
    const title = document.getElementById('readerTitle');
    const slider = document.getElementById('readerPageSlider');
    const indicator = document.getElementById('readerPageIndicator');

    if (top) top.classList.toggle('open', state.scaffoldOpen);
    if (bottom) bottom.classList.toggle('open', state.scaffoldOpen);
    if (float) float.classList.toggle('open', state.scaffoldOpen);
    // 悬浮球跟随工具栏：清屏时隐藏，呼出工具栏时显示
    if (window.Nav && Nav.setVisible) Nav.setVisible(state.scaffoldOpen);
    if (title) {
      const chName = state.chapters[state.currentChapter]?.name || '';
      title.textContent = state.bookTitle + (chName ? ' · ' + chName : '');
    }
    if (slider) { slider.max = Math.max(1, state.totalPages); slider.value = state.currentPage + 1; }
    if (indicator) indicator.textContent = (state.currentPage + 1) + ' / ' + state.totalPages;
  }

  function toggleChapterPanel() {
    state.chapterPanelOpen = !state.chapterPanelOpen;
    const panel = document.getElementById('readerChapterPanel');
    if (panel) panel.classList.toggle('open', state.chapterPanelOpen);
  }

  function toggleSettingsPanel() {
    state.settingsPanelOpen = !state.settingsPanelOpen;
    const panel = document.getElementById('readerSettingsPanel');
    if (panel) panel.classList.toggle('open', state.settingsPanelOpen);
  }

  function renderChapterList() {
    const list = document.getElementById('readerChapterList');
    if (!list) return;
    list.innerHTML = state.chapters.map((ch, i) => `
      <div class="reader-chapter-item ${i === state.currentChapter ? 'active' : ''}" data-idx="${i}">
        <span>${esc(ch.name)}</span>
        ${i === state.currentChapter ? '<span class="reader-chapter-badge">阅读中</span>' : ''}
      </div>
    `).join('');
  }

  function showLoading(show) {
    const el = document.getElementById('readerLoading');
    if (el) el.classList.toggle('hidden', !show);
  }

  function showError(msg) {
    const el = document.getElementById('readerError');
    const text = document.getElementById('readerErrorText');
    if (el) el.classList.remove('hidden');
    if (text) text.textContent = msg || '加载失败';
  }

  function saveProgress() {
    const shelf = Store.state.read.shelf;
    const idx = shelf.findIndex(b => b.url === state.bookUrl);
    if (idx >= 0) {
      shelf[idx].chapterIdx = state.currentChapter;
      shelf[idx].pageIdx = state.currentPage;
      shelf[idx].chapterName = state.chapters[state.currentChapter]?.name || '';
      shelf[idx].lastRead = Date.now();
      Store.save();
    }
  }

  function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function bindEvents() {
    // 返回
    const back = document.getElementById('readerBack');
    if (back) back.addEventListener('click', close);

    // 菜单
    const menu = document.getElementById('readerMenu');
    if (menu) menu.addEventListener('click', toggleSettingsPanel);

    // 进度滑块
    const slider = document.getElementById('readerPageSlider');
    if (slider) slider.addEventListener('input', e => goPage(parseInt(e.target.value) - 1));

    // 上下章
    const prevCh = document.getElementById('readerPrevCh');
    const nextCh = document.getElementById('readerNextCh');
    if (prevCh) prevCh.addEventListener('click', prevChapter);
    if (nextCh) nextCh.addEventListener('click', nextChapter);

    // 浮动按钮
    const chBtn = document.getElementById('readerChBtn');
    const setBtn = document.getElementById('readerSetBtn');
    if (chBtn) chBtn.addEventListener('click', () => { renderChapterList(); toggleChapterPanel(); });
    if (setBtn) setBtn.addEventListener('click', toggleSettingsPanel);

    // 章节列表点击
    const chList = document.getElementById('readerChapterList');
    if (chList) {
      chList.addEventListener('click', e => {
        const item = e.target.closest('.reader-chapter-item');
        if (item) {
          toggleChapterPanel();
          loadChapter(parseInt(item.dataset.idx));
        }
      });
    }

    // 面板关闭
    const chClose = document.getElementById('readerChClose');
    const setClose = document.getElementById('readerSetClose');
    if (chClose) chClose.addEventListener('click', toggleChapterPanel);
    if (setClose) setClose.addEventListener('click', toggleSettingsPanel);

    // 重试
    const retry = document.getElementById('readerRetryBtn');
    if (retry) retry.addEventListener('click', () => loadChapter(state.currentChapter));

    // 手势
    const content = document.getElementById('readerContent');
    if (content) {
      content.addEventListener('click', e => {
        if (state.chapterPanelOpen) { toggleChapterPanel(); return; }
        if (state.settingsPanelOpen) { toggleSettingsPanel(); return; }
        const w = window.innerWidth;
        const x = e.clientX;
        if (state.mode.startsWith('gallery')) {
          if (x < w * 0.3) prevPage();
          else if (x > w * 0.7) nextPage();
          else toggleScaffold();
        } else {
          if (x > w * 0.3 && x < w * 0.7) toggleScaffold();
        }
      });

      content.addEventListener('dblclick', e => {
        state.isZoomed = !state.isZoomed;
        state.zoomScale = state.isZoomed ? 2.5 : 1;
        const img = document.getElementById('readerGalleryImg');
        if (img) {
          img.style.transform = state.isZoomed ? `scale(${state.zoomScale})` : '';
          img.style.transformOrigin = 'center center';
        }
      });
    }

    // 键盘
    document.addEventListener('keydown', e => {
      const overlay = document.getElementById('readerOverlay');
      if (!overlay || overlay.classList.contains('hidden')) return;
      switch(e.key) {
        case 'ArrowRight': state.mode === 'gallery-rtl' ? nextPage() : prevPage(); break;
        case 'ArrowLeft': state.mode === 'gallery-rtl' ? prevPage() : nextPage(); break;
        case 'ArrowDown': case 'PageDown': case ' ': nextPage(); break;
        case 'ArrowUp': case 'PageUp': prevPage(); break;
        case 'Escape': toggleScaffold(); break;
      }
    });

    // 阅读模式切换（限定漫画阅读器设置面板，避免误绑小说背景按钮）
    document.querySelectorAll('#readerSettingsPanel .reader-mode-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!btn.dataset.mode) return;
        state.mode = btn.dataset.mode;
        document.querySelectorAll('#readerSettingsPanel .reader-mode-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      });
    });
  }

  return { open, close, bindEvents };
})();
