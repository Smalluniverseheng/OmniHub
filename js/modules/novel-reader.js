/* ==================== OmniHub Novel Reader ==================== */

const NovelReader = (() => {
  'use strict';

  var state = {
    chapters: [],
    currentChapter: 0,
    bookTitle: '',
    bookUrl: '',
    source: '',
    sourceType: '',
    scaffoldOpen: false,
    chapterPanelOpen: false,
    settingsPanelOpen: false,
    fontSize: 16,
    lineHeight: 1.6,
    bgMode: 'dark'
  };

  var eventsBound = false;

  function open(book) {
    state.bookTitle = book.title;
    state.bookUrl = book.url;
    state.source = book.source;
    state.sourceType = book.sourceType;
    state.chapters = book.chapters;
    state.currentChapter = book.currentChapter || 0;
    state.fontSize = Store.state.read.settings.fontSize || 16;
    state.lineHeight = Store.state.read.settings.lineHeight || 1.6;
    state.bgMode = Store.state.read.settings.background === '#f5e6d3' ? 'parchment' :
                   Store.state.read.settings.background === '#e8f5e9' ? 'green' :
                   Store.state.read.settings.background === '#fff' ? 'white' : 'dark';

    var overlay = document.getElementById('novelReaderOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    if (window.Nav && Nav.setVisible) Nav.setVisible(false);

    loadChapter(state.currentChapter);
    if (!eventsBound) {
      bindEvents();
      eventsBound = true;
    }
  }

  function close() {
    saveProgress();
    var overlay = document.getElementById('novelReaderOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
    if (window.Nav && Nav.setVisible) Nav.setVisible(true);
  }

  async function loadChapter(idx) {
    if (idx < 0 || idx >= state.chapters.length) return;
    state.currentChapter = idx;
    showLoading(true);

    var ch = state.chapters[idx];
    try {
      var content = '';
      if (state.sourceType === 'venera' && typeof VeneraEngine !== 'undefined') {
        // Venera 小说源 - 获取章节内容
        var images = await VeneraEngine.getImages(state.source, state.bookUrl, ch.url || ch.id);
        if (images && images.length) {
          // 如果返回的是图片，说明是漫画，不应该用小说阅读器
          content = '<p>此章节为图片内容，请使用漫画阅读器</p>';
        } else {
          content = '<p>无法加载内容</p>';
        }
      } else if (state.sourceType === 'legado' && typeof LegadoEngine !== 'undefined') {
        // Legado 书源 - 按规则获取章节内容
        var lsrc = (Store.state.read.sources || []).find(function(s) { return s.name === state.source || s.key === state.source || s.id === state.source; });
        if (!lsrc || !lsrc.raw) throw new Error('Legado 书源不存在');
        var res = await LegadoEngine.getContent(lsrc.raw, { name: ch.name, url: ch.url });
        if (res.type === 'images') {
          // 章节实为图片内容，以图片形式展示
          content = res.images.map(function(u) { return '<img src="' + esc(u) + '" style="max-width:100%;display:block;margin:0 auto;" loading="lazy">'; }).join('');
        } else {
          content = res.text.split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return '<p>' + esc(l) + '</p>'; }).join('');
        }
      } else {
        // 普通 CSS 书源 - 抓取章节内容
        content = await fetchNovelContent(ch.url);
      }
      showLoading(false);
      renderContent(content, ch.name);
      updateScaffold();
    } catch(e) {
      showLoading(false);
      renderContent('<p>加载失败: ' + e.message + '</p>', ch.name);
    }
  }

  async function fetchNovelContent(url) {
    var resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var html = await resp.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    // 尝试提取正文内容 - 常见的小说网站结构
    var contentEl = doc.querySelector('.content, #content, .chapter-content, #chapter-content, .read-content, #read-content, article, .text, #text');
    if (!contentEl) {
      // 尝试找最长的段落容器
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
      // 清理内容
      var clones = contentEl.querySelectorAll('script, style, iframe, nav, header, footer, .ads, .advertisement');
      clones.forEach(function(el) { el.remove(); });
      return contentEl.innerHTML;
    }
    return '<p>无法解析章节内容</p>';
  }

  function renderContent(html, chapterName) {
    var content = document.getElementById('novelReaderContent');
    if (!content) return;

    var bgClass = '';
    if (state.bgMode === 'parchment') bgClass = 'light-bg';
    else if (state.bgMode === 'green') bgClass = 'green-bg';
    else if (state.bgMode === 'white') bgClass = 'white-bg';

    content.className = 'novel-content ' + bgClass;
    content.style.fontSize = state.fontSize + 'px';
    content.style.lineHeight = state.lineHeight;

    content.innerHTML = '<div class="chapter-title">' + esc(chapterName) + '</div>' + html;

    // 清理标签，保留基本格式
    var paragraphs = content.querySelectorAll('p, div, br');
    paragraphs.forEach(function(el) {
      if (el.tagName === 'BR') {
        var p = document.createElement('p');
        p.innerHTML = '&nbsp;';
        el.parentNode.insertBefore(p, el);
        el.remove();
      }
    });
  }

  function nextChapter() {
    if (state.currentChapter < state.chapters.length - 1) {
      loadChapter(state.currentChapter + 1);
    }
  }

  function prevChapter() {
    if (state.currentChapter > 0) {
      loadChapter(state.currentChapter - 1);
    }
  }

  function toggleScaffold() {
    state.scaffoldOpen = !state.scaffoldOpen;
    updateScaffold();
  }

  function updateScaffold() {
    var top = document.getElementById('novelReaderTopbar');
    var bottom = document.getElementById('novelReaderBottombar');
    var float = document.getElementById('novelReaderFloat');
    var title = document.getElementById('novelReaderTitle');
    var indicator = document.getElementById('novelReaderPageIndicator');

    if (top) top.classList.toggle('open', state.scaffoldOpen);
    if (bottom) bottom.classList.toggle('open', state.scaffoldOpen);
    if (float) float.classList.toggle('open', state.scaffoldOpen);
    // 悬浮球跟随工具栏：清屏时隐藏，呼出工具栏时显示
    if (window.Nav && Nav.setVisible) Nav.setVisible(state.scaffoldOpen);
    if (title) title.textContent = state.bookTitle;
    if (indicator) indicator.textContent = '第' + (state.currentChapter + 1) + '章 / 共' + state.chapters.length + '章';
  }

  function toggleChapterPanel() {
    state.chapterPanelOpen = !state.chapterPanelOpen;
    var panel = document.getElementById('novelReaderChapterPanel');
    if (panel) {
      panel.classList.toggle('open', state.chapterPanelOpen);
      if (state.chapterPanelOpen) renderChapterList();
    }
  }

  function toggleSettingsPanel() {
    state.settingsPanelOpen = !state.settingsPanelOpen;
    var panel = document.getElementById('novelReaderSettingsPanel');
    if (panel) panel.classList.toggle('open', state.settingsPanelOpen);
  }

  function renderChapterList() {
    var list = document.getElementById('novelReaderChapterList');
    if (!list) return;
    var html = '';
    state.chapters.forEach(function(ch, i) {
      html += '<div class="reader-chapter-item ' + (i === state.currentChapter ? 'active' : '') + '" data-idx="' + i + '">';
      html += '<span>' + esc(ch.name) + '</span>';
      if (i === state.currentChapter) html += '<span class="reader-chapter-badge">阅读中</span>';
      html += '</div>';
    });
    list.innerHTML = html;
  }

  function showLoading(show) {
    var el = document.getElementById('novelReaderLoading');
    if (el) el.classList.toggle('hidden', !show);
  }

  function saveProgress() {
    var shelf = Store.state.read.shelf;
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i].url === state.bookUrl) {
        shelf[i].chapterIdx = state.currentChapter;
        shelf[i].chapterName = state.chapters[state.currentChapter] ? state.chapters[state.currentChapter].name : '';
        shelf[i].lastRead = Date.now();
        Store.save();
        break;
      }
    }
  }

  function esc(s) {
    return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function bindEvents() {
    // 返回
    var back = document.getElementById('novelReaderBack');
    if (back) back.addEventListener('click', close);

    // 菜单
    var menu = document.getElementById('novelReaderMenu');
    if (menu) menu.addEventListener('click', toggleSettingsPanel);

    // 上下章
    var prevCh = document.getElementById('novelReaderPrevCh');
    var nextCh = document.getElementById('novelReaderNextCh');
    if (prevCh) prevCh.addEventListener('click', prevChapter);
    if (nextCh) nextCh.addEventListener('click', nextChapter);

    // 浮动按钮
    var chBtn = document.getElementById('novelReaderChBtn');
    var setBtn = document.getElementById('novelReaderSetBtn');
    if (chBtn) chBtn.addEventListener('click', toggleChapterPanel);
    if (setBtn) setBtn.addEventListener('click', toggleSettingsPanel);

    // 章节列表点击
    var chList = document.getElementById('novelReaderChapterList');
    if (chList) {
      chList.addEventListener('click', function(e) {
        var item = e.target.closest('.reader-chapter-item');
        if (item) {
          toggleChapterPanel();
          loadChapter(parseInt(item.dataset.idx));
        }
      });
    }

    // 面板关闭
    var chClose = document.getElementById('novelReaderChClose');
    var setClose = document.getElementById('novelReaderSetClose');
    if (chClose) chClose.addEventListener('click', toggleChapterPanel);
    if (setClose) setClose.addEventListener('click', toggleSettingsPanel);

    // 内容区点击 - 切换工具栏
    var content = document.getElementById('novelReaderContent');
    if (content) {
      content.addEventListener('click', function(e) {
        if (state.chapterPanelOpen) { toggleChapterPanel(); return; }
        if (state.settingsPanelOpen) { toggleSettingsPanel(); return; }
        var h = window.innerHeight;
        var y = e.clientY;
        if (y > h * 0.3 && y < h * 0.7) toggleScaffold();
        else if (y < h * 0.3) prevChapter();
        else nextChapter();
      });
    }

    // 字体大小滑块
    var fontSlider = document.getElementById('novelFontSizeSlider');
    if (fontSlider) {
      fontSlider.value = state.fontSize;
      fontSlider.addEventListener('input', function() {
        state.fontSize = parseInt(this.value);
        if (content) content.style.fontSize = state.fontSize + 'px';
        Store.state.read.settings.fontSize = state.fontSize;
        Store.save();
      });
    }

    // 行间距滑块
    var lineSlider = document.getElementById('novelLineHeightSlider');
    if (lineSlider) {
      lineSlider.value = state.lineHeight;
      lineSlider.addEventListener('input', function() {
        state.lineHeight = parseFloat(this.value);
        if (content) content.style.lineHeight = state.lineHeight;
        Store.state.read.settings.lineHeight = state.lineHeight;
        Store.save();
      });
    }

    // 背景切换
    document.querySelectorAll('#novelReaderSettingsPanel .reader-mode-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var bg = this.dataset.bg;
        state.bgMode = bg;
        document.querySelectorAll('#novelReaderSettingsPanel .reader-mode-option').forEach(function(b) {
          b.classList.toggle('active', b.dataset.bg === bg);
        });
        var bgClass = '';
        var bgColor = '#000';
        if (bg === 'parchment') { bgClass = 'light-bg'; bgColor = '#f5e6d3'; }
        else if (bg === 'green') { bgClass = 'green-bg'; bgColor = '#e8f5e9'; }
        else if (bg === 'white') { bgClass = 'white-bg'; bgColor = '#fff'; }
        if (content) content.className = 'novel-content ' + bgClass;
        Store.state.read.settings.background = bgColor;
        Store.save();
      });
    });
  }

  return { open, close };
})();
