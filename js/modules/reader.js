/* ==================== OmniHub Reader v8.0（漫画阅读器） ==================== */

const Reader = (() => {
  'use strict';

  let state = {
    mode: 'gallery-rtl', currentPage: 0, totalPages: 0,
    currentChapter: 0, chapters: [], images: [],
    bookTitle: '', bookUrl: '', source: '', sourceType: '',
    scaffoldOpen: false, zoomScale: 1, isZoomed: false,
    chapterPanelOpen: false, settingsPanelOpen: false,
    preloadCount: 3,
    // 连续模式流：[{type:'divider', name} | {type:'page', chapter, idx, url}]
    stream: [], streamChapters: [], appending: false,
    isLoading: false
  };

  let saveTimer = null;
  let pageObserver = null;      // 连续模式：逐页懒加载
  let sentinelObserver = null;  // 连续模式：章节末尾自动加载下一章
  // 触摸手势状态
  let touch = { x0: 0, y0: 0, dx: 0, active: false, pinching: false, dist0: 0, scale0: 1 };

  function el(id) { return document.getElementById(id); }
  function esc(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isGallery() { return state.mode.indexOf('gallery') === 0; }

  /* ---------- 设置持久化 ---------- */
  function loadSettings() {
    const st = (typeof Store !== 'undefined' && Store.state.read.settings) || {};
    state.mode = st.readerMode || 'gallery-rtl';
    state.preloadCount = Math.max(1, Math.min(5, parseInt(st.preloadCount, 10) || 3));
    syncModeButtons();
  }

  function saveSetting(key, value) {
    if (typeof Store === 'undefined') return;
    Store.state.read.settings[key] = value;
    Store.save();
  }

  function syncModeButtons() {
    document.querySelectorAll('#readerSettingsPanel .reader-mode-option').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === state.mode);
    });
  }

  /* ---------- 打开 / 关闭 ---------- */
  function open(book) {
    state.bookTitle = book.title;
    state.bookUrl = book.url;
    state.source = book.source;
    state.sourceType = book.sourceType;
    state.chapters = book.chapters;
    state.currentChapter = book.currentChapter || 0;
    state.currentPage = book.currentPage || 0;
    state.images = [];
    state.stream = [];
    state.streamChapters = [];
    state.zoomScale = 1;
    state.isZoomed = false;

    loadSettings();

    const overlay = el('readerOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    if (window.Nav && Nav.setVisible) Nav.setVisible(false);

    loadChapter(state.currentChapter, { page: state.currentPage });
  }

  function close() {
    saveProgress(true);
    disconnectObservers();
    removeDots();
    const overlay = el('readerOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    if (window.Nav && Nav.setVisible) Nav.setVisible(true);
  }

  /* ---------- 章节图片获取 ---------- */
  async function fetchChapterImages(idx) {
    const ch = state.chapters[idx];
    if (!ch) return [];
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
    return images.filter(Boolean);
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

  async function loadChapter(idx, opts) {
    opts = opts || {};
    if (idx < 0 || idx >= state.chapters.length) return;
    state.isLoading = true;
    state.currentChapter = idx;
    state.currentPage = opts.page || 0;
    showLoading(true);
    hideError();

    try {
      const images = await fetchChapterImages(idx);
      state.images = images;
      state.totalPages = images.length;
      state.isLoading = false;
      showLoading(false);

      if (isGallery()) {
        state.stream = [];
        render();
      } else {
        // 连续模式：重置流为本章
        state.stream = [{ type: 'divider', name: state.chapters[idx].name || ('第' + (idx + 1) + '章') }];
        images.forEach(function(url, i) {
          state.stream.push({ type: 'page', chapter: idx, idx: i, url: url });
        });
        state.streamChapters = [idx];
        render();
        if (state.currentPage > 0) setTimeout(function() { scrollToStreamPage(idx, state.currentPage); }, 80);
      }
      preloadAhead();
      updateScaffold();
    } catch(e) {
      state.isLoading = false;
      showLoading(false);
      showError(e.message);
    }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const content = el('readerContent');
    if (!content) return;
    disconnectObservers();

    if (isGallery()) {
      const url = state.images[state.currentPage];
      content.innerHTML = '<div class="reader-gallery"><img id="readerGalleryImg" src="' + esc(url) + '" alt="" draggable="false"></div>';
      renderDots();
    } else {
      removeDots();
      let html = '<div class="reader-continuous vertical" id="readerContinuous">';
      state.stream.forEach(function(item, gi) {
        if (item.type === 'divider') {
          html += '<div class="reader-chapter-divider">' + esc(item.name) + '</div>';
        } else {
          html += '<div class="reader-page" data-gi="' + gi + '" data-ch="' + item.chapter + '" data-idx="' + item.idx + '"><div class="reader-page-skeleton"></div></div>';
        }
      });
      html += '<div id="readerSentinel" style="height:4px;"></div></div>';
      content.innerHTML = html;
      setupContinuousObservers();
    }
    updateScaffold();
  }

  /* ---------- 连续模式：IntersectionObserver 懒加载 + 自动加载下一章 ---------- */
  function disconnectObservers() {
    if (pageObserver) { pageObserver.disconnect(); pageObserver = null; }
    if (sentinelObserver) { sentinelObserver.disconnect(); sentinelObserver = null; }
  }

  function setupContinuousObservers() {
    const container = el('readerContinuous');
    if (!container || typeof IntersectionObserver === 'undefined') {
      // 兜底：直接加载全部图片
      if (container) {
        container.querySelectorAll('.reader-page').forEach(loadStreamPageEl);
      }
      return;
    }

    pageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        const pg = entry.target;
        loadStreamPageEl(pg);
        const ch = parseInt(pg.dataset.ch, 10);
        const idx = parseInt(pg.dataset.idx, 10);
        if (!isNaN(idx)) {
          state.currentPage = idx;
          if (!isNaN(ch)) state.currentChapter = ch;
          updateScaffold();
          saveProgress();
        }
      });
    }, { root: container, rootMargin: '150% 0px' });

    container.querySelectorAll('.reader-page').forEach(function(pg) {
      pageObserver.observe(pg);
    });

    const sentinel = el('readerSentinel');
    if (sentinel) {
      sentinelObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) appendNextChapter();
        });
      }, { root: container, rootMargin: '400px 0px' });
      sentinelObserver.observe(sentinel);
    }
  }

  function loadStreamPageEl(pg) {
    if (!pg || pg.dataset.loaded) return;
    pg.dataset.loaded = '1';
    const gi = parseInt(pg.dataset.gi, 10);
    const item = state.stream[gi];
    if (!item || item.type !== 'page') return;
    const img = document.createElement('img');
    img.alt = '第' + (item.idx + 1) + '页';
    img.src = item.url;
    pg.innerHTML = '';
    pg.appendChild(img);
  }

  /* 滚动到章节末尾：自动加载下一章，边界插入章节标题分隔条 */
  async function appendNextChapter() {
    if (state.appending) return;
    const lastCh = state.streamChapters.length ? state.streamChapters[state.streamChapters.length - 1] : state.currentChapter;
    const nextIdx = lastCh + 1;
    if (nextIdx >= state.chapters.length) return;
    state.appending = true;
    try {
      const images = await fetchChapterImages(nextIdx);
      state.streamChapters.push(nextIdx);
      const container = el('readerContinuous');
      const sentinel = el('readerSentinel');
      if (!container || !sentinel) return;

      const frag = document.createDocumentFragment();
      const divider = document.createElement('div');
      divider.className = 'reader-chapter-divider';
      divider.textContent = state.chapters[nextIdx].name || ('第' + (nextIdx + 1) + '章');
      frag.appendChild(divider);
      images.forEach(function(url, i) {
        state.stream.push({ type: 'page', chapter: nextIdx, idx: i, url: url });
        const pg = document.createElement('div');
        pg.className = 'reader-page';
        pg.dataset.gi = String(state.stream.length - 1);
        pg.dataset.ch = String(nextIdx);
        pg.dataset.idx = String(i);
        pg.innerHTML = '<div class="reader-page-skeleton"></div>';
        frag.appendChild(pg);
        if (pageObserver) pageObserver.observe(pg);
      });
      container.insertBefore(frag, sentinel);
    } catch (e) {
      console.warn('下一章加载失败:', e);
      if (window.Toast) Toast.show('下一章加载失败: ' + (e.message || ''), 'error');
    } finally {
      state.appending = false;
    }
  }

  function scrollToStreamPage(ch, pageIdx) {
    const container = el('readerContinuous');
    if (!container) return;
    const target = container.querySelector('.reader-page[data-ch="' + ch + '"][data-idx="' + pageIdx + '"]');
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function scrollToPage(idx) {
    const container = document.querySelector('.reader-continuous');
    if (!container) return;
    const pages = container.querySelectorAll('.reader-page');
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- 图片预加载（提前 preloadCount 页） ---------- */
  function preloadAhead() {
    if (!isGallery() || !state.images.length) return;
    for (let i = 1; i <= state.preloadCount; i++) {
      const url = state.images[state.currentPage + i];
      if (url) { const im = new Image(); im.src = url; }
    }
  }

  /* ---------- 页码圆点指示器 ---------- */
  function renderDots() {
    removeDots();
    const overlay = el('readerOverlay');
    if (!overlay || !state.totalPages) return;
    const box = document.createElement('div');
    box.className = 'reader-dots';
    box.id = 'readerDots';
    overlay.appendChild(box);
    updateDots();
  }

  function removeDots() {
    const box = el('readerDots');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  function updateDots() {
    const box = el('readerDots');
    if (!box) return;
    const total = state.totalPages;
    const cur = state.currentPage;
    const MAX = 15;
    let start = 0, end = total;
    if (total > MAX) {
      start = Math.max(0, Math.min(cur - Math.floor(MAX / 2), total - MAX));
      end = start + MAX;
    }
    let html = '';
    for (let i = start; i < end; i++) {
      html += '<i class="reader-dot' + (i === cur ? ' active' : '') + '"></i>';
    }
    box.innerHTML = html;
  }

  /* ---------- 翻页 ---------- */
  function goPage(n) {
    if (state.isLoading || !state.images.length) return;
    state.currentPage = Math.max(0, Math.min(n, state.totalPages - 1));
    if (isGallery()) {
      const img = el('readerGalleryImg');
      if (img) {
        img.style.transition = '';
        img.style.transform = '';
        img.src = state.images[state.currentPage];
      }
      state.zoomScale = 1;
      state.isZoomed = false;
      updateDots();
      preloadAhead();
    } else {
      scrollToPage(state.currentPage);
    }
    updateScaffold();
    saveProgress();
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
      loadChapter(state.currentChapter - 1).then(function() {
        if (toLast) goPage(state.totalPages - 1);
      });
    }
  }

  /* ---------- 工具栏 / 面板 ---------- */
  function toggleScaffold() {
    state.scaffoldOpen = !state.scaffoldOpen;
    updateScaffold();
  }

  function updateScaffold() {
    const top = el('readerTopbar');
    const bottom = el('readerBottombar');
    const float = el('readerFloat');
    const title = el('readerTitle');
    const slider = el('readerPageSlider');
    const indicator = el('readerPageIndicator');

    if (top) top.classList.toggle('open', state.scaffoldOpen);
    if (bottom) bottom.classList.toggle('open', state.scaffoldOpen);
    if (float) float.classList.toggle('open', state.scaffoldOpen);
    // 悬浮球跟随工具栏：清屏时隐藏，呼出工具栏时显示
    if (window.Nav && Nav.setVisible) Nav.setVisible(state.scaffoldOpen);
    if (title) {
      const chName = state.chapters[state.currentChapter] ? state.chapters[state.currentChapter].name : '';
      title.textContent = state.bookTitle + (chName ? ' · ' + chName : '');
    }
    if (slider) { slider.max = Math.max(1, state.totalPages); slider.value = state.currentPage + 1; }
    if (indicator) indicator.textContent = (state.currentPage + 1) + ' / ' + state.totalPages;
    if (isGallery()) updateDots();
  }

  function toggleChapterPanel() {
    state.chapterPanelOpen = !state.chapterPanelOpen;
    const panel = el('readerChapterPanel');
    if (panel) panel.classList.toggle('open', state.chapterPanelOpen);
    if (state.chapterPanelOpen) {
      renderChapterList();
      // 当前章节高亮并自动滚动到视口中央
      setTimeout(function() {
        const list = el('readerChapterList');
        const active = list ? list.querySelector('.reader-chapter-item.active') : null;
        if (list && active) {
          list.scrollTop = Math.max(0, active.offsetTop - list.clientHeight / 2);
        }
      }, 60);
    }
  }

  function toggleSettingsPanel() {
    state.settingsPanelOpen = !state.settingsPanelOpen;
    const panel = el('readerSettingsPanel');
    if (panel) panel.classList.toggle('open', state.settingsPanelOpen);
  }

  function renderChapterList() {
    const list = el('readerChapterList');
    if (!list) return;
    let html = '';
    state.chapters.forEach(function(ch, i) {
      html += '<div class="reader-chapter-item' + (i === state.currentChapter ? ' active' : '') + '" data-idx="' + i + '">'
        + '<span>' + esc(ch.name) + '</span>'
        + (i === state.currentChapter ? '<span class="reader-chapter-badge">阅读中</span>' : '')
        + '</div>';
    });
    list.innerHTML = html;
  }

  function showLoading(show) {
    const el2 = el('readerLoading');
    if (el2) el2.classList.toggle('hidden', !show);
  }

  function showError(msg) {
    const box = el('readerError');
    const text = el('readerErrorText');
    if (box) box.classList.remove('hidden');
    if (text) text.textContent = msg || '加载失败';
  }

  function hideError() {
    const box = el('readerError');
    if (box) box.classList.add('hidden');
  }

  /* ---------- 进度保存（防抖） ---------- */
  function saveProgress(immediate) {
    const shelf = Store.state.read.shelf;
    const idx = shelf.findIndex(function(b) { return b.url === state.bookUrl; });
    if (idx < 0) return;
    shelf[idx].chapterIdx = state.currentChapter;
    shelf[idx].pageIdx = state.currentPage;
    shelf[idx].chapterName = state.chapters[state.currentChapter] ? state.chapters[state.currentChapter].name : '';
    shelf[idx].lastRead = Date.now();
    if (immediate) {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      Store.save();
      return;
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { saveTimer = null; Store.save(); }, 400);
  }

  /* ---------- Gallery 手势：滑动跟随 + 弹簧回弹 + 双指捏合缩放 ---------- */
  function galleryImg() { return el('readerGalleryImg'); }

  function onTouchStart(e) {
    if (!isGallery()) return;
    if (e.touches.length === 2) {
      // 双指捏合开始
      const t0 = e.touches[0], t1 = e.touches[1];
      touch.pinching = true;
      touch.active = false;
      touch.dist0 = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touch.scale0 = state.zoomScale || 1;
      const img = galleryImg();
      if (img) img.style.transition = 'none';
      return;
    }
    if (e.touches.length !== 1) return;
    touch.x0 = e.touches[0].clientX;
    touch.y0 = e.touches[0].clientY;
    touch.dx = 0;
    touch.active = true;
  }

  function onTouchMove(e) {
    if (!isGallery()) return;
    if (touch.pinching && e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (touch.dist0 > 0) {
        state.zoomScale = Math.max(1, Math.min(4, touch.scale0 * dist / touch.dist0));
        state.isZoomed = state.zoomScale > 1.05;
        const img = galleryImg();
        if (img) {
          img.style.transformOrigin = 'center center';
          img.style.transform = 'scale(' + state.zoomScale + ')';
        }
      }
      return;
    }
    if (!touch.active || e.touches.length !== 1) return;
    // 放大状态下不触发翻页跟随
    if (state.isZoomed) return;
    const dx = e.touches[0].clientX - touch.x0;
    const dy = e.touches[0].clientY - touch.y0;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;  // 竖向滚动不拦截
    touch.dx = dx;
    const img = galleryImg();
    if (img) {
      img.style.transition = 'none';
      img.style.transform = 'translateX(' + dx + 'px)';
    }
  }

  function onTouchEnd(e) {
    if (!isGallery()) return;
    if (touch.pinching) {
      if (e.touches.length < 2) {
        touch.pinching = false;
        // 缩得太小则回弹到 1
        if (state.zoomScale < 1.1) {
          state.zoomScale = 1;
          state.isZoomed = false;
          const img0 = galleryImg();
          if (img0) {
            img0.style.transition = 'transform .45s cubic-bezier(0.34,1.56,0.64,1)';
            img0.style.transform = '';
          }
        }
      }
      return;
    }
    if (!touch.active) return;
    touch.active = false;
    if (state.isZoomed || !touch.dx) { touch.dx = 0; return; }
    const dx = touch.dx;
    touch.dx = 0;
    const img = galleryImg();
    const w = window.innerWidth;
    // 超过 50% 宽度松手翻页，不足回弹
    if (Math.abs(dx) > w * 0.5) {
      const rtl = state.mode === 'gallery-rtl';
      // 日漫（rtl）：向左滑（dx<0）翻下一页；国漫相反
      const goNext = rtl ? dx < 0 : dx > 0;
      if (img) { img.style.transition = ''; img.style.transform = ''; }
      if (goNext) nextPage(); else prevPage();
    } else if (img) {
      // 弹簧回弹
      img.style.transition = 'transform .45s cubic-bezier(0.34,1.56,0.64,1)';
      img.style.transform = 'translateX(0)';
      setTimeout(function() {
        if (img) { img.style.transition = ''; img.style.transform = ''; }
      }, 480);
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    // 返回
    const back = el('readerBack');
    if (back) back.addEventListener('click', close);

    // 菜单
    const menu = el('readerMenu');
    if (menu) menu.addEventListener('click', toggleSettingsPanel);

    // 进度滑块
    const slider = el('readerPageSlider');
    if (slider) slider.addEventListener('input', function(e) { goPage(parseInt(e.target.value, 10) - 1); });

    // 上下章
    const prevCh = el('readerPrevCh');
    const nextCh = el('readerNextCh');
    if (prevCh) prevCh.addEventListener('click', function() { prevChapter(); });
    if (nextCh) nextCh.addEventListener('click', nextChapter);

    // 浮动按钮
    const chBtn = el('readerChBtn');
    const setBtn = el('readerSetBtn');
    if (chBtn) chBtn.addEventListener('click', toggleChapterPanel);
    if (setBtn) setBtn.addEventListener('click', toggleSettingsPanel);

    // 章节列表点击
    const chList = el('readerChapterList');
    if (chList) {
      chList.addEventListener('click', function(e) {
        const item = e.target.closest('.reader-chapter-item');
        if (item) {
          toggleChapterPanel();
          loadChapter(parseInt(item.dataset.idx, 10));
        }
      });
    }

    // 面板关闭
    const chClose = el('readerChClose');
    const setClose = el('readerSetClose');
    if (chClose) chClose.addEventListener('click', toggleChapterPanel);
    if (setClose) setClose.addEventListener('click', toggleSettingsPanel);

    // 重试
    const retry = el('readerRetryBtn');
    if (retry) retry.addEventListener('click', function() { loadChapter(state.currentChapter); });

    // 手势
    const content = el('readerContent');
    if (content) {
      content.addEventListener('click', function(e) {
        if (state.chapterPanelOpen) { toggleChapterPanel(); return; }
        if (state.settingsPanelOpen) { toggleSettingsPanel(); return; }
        if (touch.pinching || state.isZoomed) return;
        const w = window.innerWidth;
        const x = e.clientX;
        if (isGallery()) {
          if (x < w * 0.3) prevPage();
          else if (x > w * 0.7) nextPage();
          else toggleScaffold();
        } else {
          if (x > w * 0.3 && x < w * 0.7) toggleScaffold();
        }
      });

      content.addEventListener('dblclick', function(e) {
        if (!isGallery()) return;
        state.isZoomed = !state.isZoomed;
        state.zoomScale = state.isZoomed ? 2 : 1;
        const img = galleryImg();
        if (img) {
          img.style.transition = '';
          if (state.isZoomed) {
            // 聚焦双击点：以点击位置为缩放原点
            const r = img.getBoundingClientRect();
            const ox = Math.max(0, Math.min(100, ((e.clientX - r.left) / (r.width || 1)) * 100));
            const oy = Math.max(0, Math.min(100, ((e.clientY - r.top) / (r.height || 1)) * 100));
            img.style.transformOrigin = ox.toFixed(1) + '% ' + oy.toFixed(1) + '%';
            img.style.transform = 'scale(' + state.zoomScale + ')';
          } else {
            img.style.transform = '';
            img.style.transformOrigin = 'center center';
          }
        }
      });

      // touch 手势翻页 + 捏合缩放
      content.addEventListener('touchstart', onTouchStart, { passive: true });
      content.addEventListener('touchmove', onTouchMove, { passive: false });
      content.addEventListener('touchend', onTouchEnd, { passive: true });
      content.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    // 键盘
    document.addEventListener('keydown', function(e) {
      const overlay = el('readerOverlay');
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
    document.querySelectorAll('#readerSettingsPanel .reader-mode-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!btn.dataset.mode) return;
        state.mode = btn.dataset.mode;
        saveSetting('readerMode', state.mode);   // 持久化
        document.querySelectorAll('#readerSettingsPanel .reader-mode-option').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        // 切回 gallery 时重建单章视图；切到连续时以当前章重建流
        const keepPage = state.currentPage;
        loadChapter(state.currentChapter).then(function() {
          goPage(Math.min(keepPage, state.totalPages - 1));
        });
      });
    });
  }

  return { open, close, bindEvents };
})();
