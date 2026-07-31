/* ==================== OmniHub DeviceDetector - 三端适配 ==================== */
/* 端型判断：
     watch   <360px 或 UA 含 Watch
     mobile  <768px
     desktop ≥768px（左侧固定侧边栏 280px + 顶部工具栏，悬浮球隐藏，主内容区 margin-left:280px）
   跨端切换不刷新页面：#app opacity 1→0(150ms) → 切 body class → 0→1(150ms)。
   键盘避让：visualViewport.resize 监听，悬浮球随键盘高度上移，收起恢复。 */

const DeviceDetector = (() => {
  'use strict';

  var currentType = null;
  var resizeTimer = null;
  var inited = false;
  var sidebarEl = null;
  var topbarEl = null;
  var lastNavJson = '';   // 侧边栏数据快照，避免无谓重绘

  /* 模块 id → 图标名（Icons 库）映射；未命中回退用 navItems 里的 emoji */
  var ID_ICON = {
    profile: 'user', read: 'book', chat: 'sparkles', reader: 'book',
    settings: 'settings', home: 'home', search: 'search'
  };

  function type() {
    var ua = (navigator.userAgent || '');
    if (/Watch/i.test(ua)) return 'watch';
    var w = window.innerWidth;
    if (w < 360) return 'watch';
    if (w < 768) return 'mobile';
    return 'desktop';
  }

  function isDesktop() { return currentType === 'desktop'; }
  function isWatch() { return currentType === 'watch'; }

  function init() {
    if (inited) return;
    inited = true;
    applyType(type(), true);
    bindResize();
    bindKeyboard();
    bindStoreSync();
    bindPageSync();
  }

  /* ---- body class：device-watch/mobile/desktop + 简写 watch/mobile/desktop 双挂 ---- */
  function applyType(t, immediate) {
    currentType = t;
    var body = document.body;
    ['device-watch', 'device-mobile', 'device-desktop', 'watch', 'mobile', 'desktop'].forEach(function(c) {
      body.classList.remove(c);
    });
    body.classList.add('device-' + t);
    body.classList.add(t);
    if (t === 'desktop') {
      ensureDesktopChrome();
      renderSidebar();
      updateTopbarTitle();
    }
  }

  /* ---- resize 跨端切换（防抖 150ms + 淡出/淡入 150ms）---- */
  function bindResize() {
    window.addEventListener('resize', function() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        resizeTimer = null;
        var next = type();
        if (next === currentType) return;
        crossFadeTo(next);
      }, 150);
    });
  }

  function crossFadeTo(next) {
    var app = document.getElementById('app');
    if (!app) { applyType(next); return; }
    app.style.transition = 'opacity 0.15s ease';
    app.style.opacity = '0';
    setTimeout(function() {
      applyType(next);
      app.style.opacity = '1';
      setTimeout(function() {
        app.style.transition = '';
        app.style.opacity = '';
      }, 150);
    }, 150);
  }

  /* ---- 桌面端：左侧固定侧边栏 280px + 顶部工具栏（纯 JS 建 DOM）---- */
  function ensureDesktopChrome() {
    if (!sidebarEl) {
      sidebarEl = document.createElement('aside');
      sidebarEl.id = 'desktopSidebar';
      var brand = document.createElement('div');
      brand.className = 'ds-brand';
      brand.innerHTML = '<img src="assets/brand.jpg" alt="OmniHub"><span class="ds-brand-name">OmniHub</span>';
      var nav = document.createElement('nav');
      nav.className = 'ds-nav';
      nav.id = 'desktopSidebarNav';
      sidebarEl.appendChild(brand);
      sidebarEl.appendChild(nav);
      document.body.appendChild(sidebarEl);

      // 列表点击：切换页面（事件委托）
      nav.addEventListener('click', function(e) {
        var item = e.target.closest('.ds-item');
        if (!item) return;
        if (typeof App !== 'undefined') App.switchPage(item.dataset.pageId);
      });
    }
    if (!topbarEl) {
      topbarEl = document.createElement('header');
      topbarEl.id = 'desktopTopbar';
      topbarEl.innerHTML =
        '<div class="dt-title" id="desktopTopbarTitle"></div>' +
        '<div class="dt-actions">' +
        '<button class="icon-btn dt-btn" id="desktopSearchBtn" title="搜索"><span data-icon="search"></span></button>' +
        '<button class="icon-btn dt-btn" id="desktopSettingsBtn" title="设置"><span data-icon="settings"></span></button>' +
        '</div>';
      document.body.appendChild(topbarEl);

      // 顶栏按钮按当前模块转发（以 DOM 活动页为准，最可靠）：阅读 → 书源搜索/阅读设置；其余 → 全局设置/搜索提示
      function readActive() {
        var p = document.getElementById('page-read');
        return !!(p && p.classList.contains('active'));
      }
      var sBtn = topbarEl.querySelector('#desktopSearchBtn');
      if (sBtn) sBtn.addEventListener('click', function() {
        if (readActive() && typeof App !== 'undefined' && App.openSub) {
          App.openSub('subReadSearch');
          return;
        }
        if (typeof Toast !== 'undefined') Toast.show(I18nSafe('search') + '…');
      });
      var gBtn = topbarEl.querySelector('#desktopSettingsBtn');
      if (gBtn) gBtn.addEventListener('click', function() {
        if (readActive() && typeof App !== 'undefined' && App.openSub) {
          App.openSub('subReadSettings');
          return;
        }
        if (typeof App !== 'undefined' && App.openSub) App.openSub('subGlobalSettings');
      });
      if (typeof Icons !== 'undefined') Icons.render(topbarEl);
    }
  }

  function I18nSafe(key) {
    try { return I18n.t('common.' + key); } catch (e) { return key; }
  }

  function renderSidebar() {
    var nav = document.getElementById('desktopSidebarNav');
    if (!nav) return;
    var items = [];
    try {
      items = Store.state.navItems.filter(function(n) { return n.enabled; })
        .sort(function(a, b) { return a.order - b.order; });
    } catch (e) { return; }
    lastNavJson = JSON.stringify(items);

    var cur = (typeof App !== 'undefined' && App.getCurrentPage) ? App.getCurrentPage() : 'profile';
    var html = '';
    items.forEach(function(item) {
      var iconName = ID_ICON[item.id];
      var iconHtml = iconName
        ? '<span class="ds-icon" data-icon="' + iconName + '"></span>'
        : '<span class="ds-icon ds-emoji">' + item.icon + '</span>';
      html += '<div class="ds-item' + (item.id === cur ? ' active' : '') + '" data-page-id="' + item.id + '">' +
        iconHtml + '<span class="ds-name">' + item.name + '</span></div>';
    });
    nav.innerHTML = html;
    if (typeof Icons !== 'undefined') Icons.render(nav);
  }

  function updateSidebarActive(pageId) {
    if (!sidebarEl) return;
    var nodes = sidebarEl.querySelectorAll('.ds-item');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('active', nodes[i].dataset.pageId === pageId);
    }
  }

  function updateTopbarTitle() {
    var title = document.getElementById('desktopTopbarTitle');
    if (!title) return;
    var cur = (typeof App !== 'undefined' && App.getCurrentPage) ? App.getCurrentPage() : 'profile';
    var name = cur;
    try {
      var item = Store.state.navItems.find(function(n) { return n.id === cur; });
      if (item) name = item.name;
    } catch (e) {}
    title.textContent = name;
  }

  /* navItems 变化 → 重建侧边栏（比对快照，避免拖拽悬浮球等无关变化触发） */
  function bindStoreSync() {
    if (typeof Store === 'undefined' || !Store.subscribe) return;
    Store.subscribe('navItems.*', function() {
      if (currentType !== 'desktop') return;
      var json;
      try { json = JSON.stringify(Store.state.navItems.filter(function(n) { return n.enabled; })); } catch (e) { return; }
      if (json === lastNavJson) return;
      renderSidebar();
    });
  }

  /* 页面切换 → 侧边栏高亮 + 顶栏标题（App.switchPage 内会 emit 'page:changed'） */
  function bindPageSync() {
    if (typeof EventBus === 'undefined') return;
    EventBus.on('page:changed', function(payload) {
      var pageId = payload && payload.page;
      if (!pageId) return;
      updateSidebarActive(pageId);
      updateTopbarTitle();
    });
  }

  /* ---- 键盘避让：visualViewport.resize，悬浮球随键盘上移 ---- */
  function bindKeyboard() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', function() {
      var vv = window.visualViewport;
      var kb = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      var open = kb > 80;   // 80px 阈值滤掉地址栏伸缩误报
      document.body.classList.toggle('kb-open', open);
      var trigger = document.getElementById('fabTrigger');
      if (!trigger) return;
      if (!trigger.style.top) {
        // 未拖拽定位过：直接抬升 bottom（默认 30px → 键盘高 + 20px）
        trigger.style.bottom = open ? (kb + 20) + 'px' : '';
      } else {
        // 拖拽定位过：用位移让开键盘
        trigger.style.transform = open ? 'translateY(' + (-kb) + 'px)' : '';
      }
    });
  }

  return { init: init, type: type, isDesktop: isDesktop, isWatch: isWatch };
})();

/* 启动：DOM 就绪自动初始化（App.init 内也会幂等调用一次保证顺序） */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { DeviceDetector.init(); });
} else {
  DeviceDetector.init();
}
