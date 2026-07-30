/* ==================== OmniHub App - 入口 ==================== */

const App = (() => {
  'use strict';

  let currentPage = 'profile';

  function init() {
    // 检查老用户数据迁移
    migrateLegacy();

    // 初始化模块
    ProfileModule.init();
    ReadModule.init();

    // 初始化导航
    Nav.init();

    // 跳转到主页
    const home = Store.state.homePage || 'profile';
    if (Store.state.modules[home]?.enabled || home === 'profile') {
      switchPage(home);
    } else {
      switchPage('profile');
    }

    // 全局事件
    bindGlobalEvents();
  }

  function migrateLegacy() {
    // 从 aiBeta 迁移数据
    const legacy = localStorage.getItem('aibeta_state');
    if (!legacy) return;
    try {
      const data = JSON.parse(legacy);
      // 迁移书源
      if (data.comicSources) {
        Store.state.read.sources = data.comicSources.map(s => ({
          ...s, type: s.type || 'css', mediaType: 'comic'
        }));
      }
      if (data.novelSources) {
        Store.state.read.sources.push(...data.novelSources.map(s => ({
          ...s, type: s.type || 'css', mediaType: 'novel'
        })));
      }
      // 迁移书架
      if (data.bookshelf) {
        Store.state.read.shelf = data.bookshelf.items.map(b => ({
          id: b.url, title: b.name, author: b.author || '',
          cover: b.cover || '', type: 'novel', url: b.url,
          source: b.sourceName || '', chapterIdx: b.chapterIdx || 0,
          pageIdx: b.pageIdx || 0, chapterName: b.chapterName || '',
          lastRead: b.lastRead || Date.now()
        }));
      }
      // 标记已迁移
      Store.save();
      console.log('Legacy data migrated');
    } catch(e) {
      console.error('Migration failed:', e);
    }
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
    // 子页面返回按钮
    document.querySelectorAll('[data-close-sub]').forEach(btn => {
      btn.addEventListener('click', closeSub);
    });

    // 点击遮罩关闭子页面
    document.querySelectorAll('.subpage').forEach(sub => {
      sub.addEventListener('click', e => {
        if (e.target === sub) closeSub();
      });
    });
  }

  return { init, switchPage, openSub, closeSub, getCurrentPage: () => currentPage };
})();

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
