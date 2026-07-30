/* ==================== OmniHub App ==================== */

const App = (() => {
  'use strict';

  let currentPage = 'profile';

  function init() {
    migrateLegacy();

    // 先初始化 Store 确保数据存在
    if (!Store.state) Store.load();

    // 全局事件委托 - 绑定在 document 上
    bindGlobalEvents();

    // 初始化模块
    ProfileModule.init();
    ReadModule.init();
    if (typeof ChatModule !== "undefined") ChatModule.init();
    Nav.init();

    // 漫画阅读器事件绑定（只需一次）
    if (typeof Reader !== "undefined" && Reader.bindEvents) Reader.bindEvents();

    // 跳转到主页
    const home = Store.state.homePage || 'profile';
    if (Store.state.modules[home] && Store.state.modules[home].enabled || home === 'profile') {
      switchPage(home);
    } else {
      switchPage('profile');
    }

    dismissSplash();
  }

  function dismissSplash() {
    // init 完成后 1.5 秒开始淡出，0.7 秒后移除节点
    setTimeout(function() {
      var s = document.getElementById('splash');
      if (!s) return;
      s.classList.add('done');
      setTimeout(function() { if (s.parentNode) s.parentNode.removeChild(s); }, 700);
    }, 1500);
  }

  function migrateLegacy() {
    const legacy = localStorage.getItem('aibeta_state');
    if (!legacy) return;
    try {
      const data = JSON.parse(legacy);
      if (data.comicSources) {
        Store.state.read.sources = data.comicSources.map(s => ({...s, type: s.type || 'css', mediaType: 'comic'}));
      }
      if (data.novelSources) {
        Store.state.read.sources.push(...data.novelSources.map(s => ({...s, type: s.type || 'css', mediaType: 'novel'})));
      }
      if (data.bookshelf && data.bookshelf.items) {
        Store.state.read.shelf = data.bookshelf.items.map(b => ({
          id: b.url, title: b.name, author: b.author || '',
          cover: b.cover || '', type: 'novel', url: b.url,
          source: b.sourceName || '', chapterIdx: b.chapterIdx || 0,
          pageIdx: b.pageIdx || 0, chapterName: b.chapterName || '',
          lastRead: b.lastRead || Date.now()
        }));
      }
      Store.save();
      console.log('Legacy migrated');
    } catch(e) { console.error('Migration failed:', e); }
  }

  function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('active');
    currentPage = pageId;
    Nav.updateActive(pageId);
  }

  function openSub(subId) {
    const sub = document.getElementById(subId);
    if (sub) {
      sub.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSub() {
    document.querySelectorAll('.subpage.open').forEach(s => s.classList.remove('open'));
    document.body.style.overflow = '';
  }

  function bindGlobalEvents() {
    // 事件委托 - 所有点击走这里
    document.addEventListener('click', function(e) {
      // 子页面返回按钮
      var closeBtn = e.target.closest('[data-close-sub]');
      if (closeBtn) { closeSub(); return; }

      // 设置行点击 - 打开子页面
      var settingsRow = e.target.closest('[data-sub]');
      if (settingsRow && !e.target.closest('.toggle-switch')) {
        var subId = settingsRow.dataset.sub;
        if (subId) openSub(subId);
        return;
      }

      // 阅读模块 Tab 切换
      var readTab = e.target.closest('.read-tab');
      if (readTab && readTab.closest('#readBody')) {
        e.stopPropagation();
        var tab = readTab.dataset.tab;
        document.querySelectorAll('#readBody .read-tab').forEach(function(t) {
          t.classList.toggle('active', t.dataset.tab === tab);
        });
        // 触发 ReadModule 的 tab 切换
        if (window.ReadModule && ReadModule.setTab) ReadModule.setTab(tab);
        return;
      }

      // 书架点击
      var shelfItem = e.target.closest('.shelf-item');
      if (shelfItem) {
        e.stopPropagation();
        var url = shelfItem.dataset.url;
        var book = Store.state.read.shelf.find(function(b) { return b.url === url; });
        if (book && window.ReadModule) ReadModule.openBook(book);
        return;
      }

      // 搜索按钮
      var searchBtn = e.target.closest('#readSearchBtn');
      if (searchBtn) {
        e.stopPropagation();
        openSub('subReadSearch');
        return;
      }

      // 阅读设置按钮
      var settingsBtn = e.target.closest('#readSettingsBtn');
      if (settingsBtn) {
        e.stopPropagation();
        openSub('subReadSettings');
        return;
      }

      // 搜索提交
      var searchSubmit = e.target.closest('#readSearchSubmit');
      if (searchSubmit) {
        e.stopPropagation();
        if (window.ReadModule && ReadModule.doSearch) ReadModule.doSearch();
        return;
      }

      // 搜索结果 - 加入书架
      var addShelfBtn = e.target.closest('.add-shelf-btn');
      if (addShelfBtn) {
        e.stopPropagation();
        var row = addShelfBtn.closest('.result-item');
        if (row && window.ReadModule) {
          ReadModule.addToShelf({
            id: row.dataset.url,
            title: row.dataset.name,
            url: row.dataset.url,
            cover: row.dataset.cover || '',
            type: row.dataset.media || 'novel',
            source: row.dataset.source || ''
          });
        }
        return;
      }

      // 搜索结果 - 立即阅读
      var readNowBtn = e.target.closest('.read-now-btn');
      if (readNowBtn) {
        e.stopPropagation();
        var row = readNowBtn.closest('.result-item');
        if (row && window.ReadModule) {
          ReadModule.openBook({
            id: row.dataset.url,
            title: row.dataset.name,
            url: row.dataset.url,
            cover: row.dataset.cover || '',
            type: row.dataset.media || 'novel',
            source: row.dataset.source || ''
          });
        }
        return;
      }

      // 搜索结果行点击
      var resultItem = e.target.closest('.result-item');
      if (resultItem && !e.target.closest('.result-btn')) {
        e.stopPropagation();
        // 显示详情或加入书架
        return;
      }
    });

    // 子页面点击背景关闭
    document.querySelectorAll('.subpage').forEach(sub => {
      sub.addEventListener('click', function(e) {
        if (e.target === this) closeSub();
      });
    });
  }

  return { init, switchPage, openSub, closeSub, getCurrentPage: () => currentPage };
})();

document.addEventListener('DOMContentLoaded', function() { App.init(); });
