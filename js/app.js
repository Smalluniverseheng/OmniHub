/* ==================== OmniHub App ==================== */

const App = (() => {
  'use strict';

  let currentPage = 'profile';

  /* ==================== 设备错误日志：全局捕获 ==================== */
  function pushErrorLog(entry) {
    try {
      if (!Store.state.errorLog) Store.state.errorLog = [];
      Store.state.errorLog.push({
        message: String(entry.message || '').slice(0, 1000),
        stack: String(entry.stack || '').slice(0, 4000),
        version: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '',
        time: Date.now(),
        url: String(entry.url || location.href || '').slice(0, 500)
      });
      if (Store.state.errorLog.length > 50) {
        Store.state.errorLog = Store.state.errorLog.slice(-50);
      }
      Store.save();
    } catch (e) {}
  }

  window.addEventListener('error', function(e) {
    pushErrorLog({ message: e.message || 'Unknown error', stack: (e.error && e.error.stack) || '', url: e.filename || location.href });
  });
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason;
    pushErrorLog({ message: (r && r.message) || String(r || 'Unhandled rejection'), stack: (r && r.stack) || '' });
  });

  function init() {
    migrateLegacy();

    // 先初始化 Store 确保数据存在
    if (!Store.state) Store.load();

    // 全局事件委托 - 绑定在 document 上
    bindGlobalEvents();

    // 语言方向初始化（dir=rtl/ltr），其余 I18n 引导在 js/i18n.js 完成
    try {
      var initLang = Store.state.settings.language || 'zh-CN';
      document.documentElement.lang = initLang;
      document.documentElement.dir = initLang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {}

    // 设备检测（幂等，device.js 也会自启一次；这里保证在模块渲染前就绪）
    if (typeof DeviceDetector !== 'undefined') DeviceDetector.init();

    // 初始化模块（错误边界：单模块失败不影响其余模块）
    safeInitModule('我的', 'profileBody', function() { ProfileModule.init(); });
    safeInitModule('阅读', 'readBody', function() { ReadModule.init(); });
    if (typeof ChatModule !== "undefined") {
      safeInitModule('对话', 'chatBody', function() { ChatModule.init(); });
    }
    try {
      Nav.init();
    } catch (e) { console.error('[App] 导航初始化失败:', e); }

    // 漫画阅读器事件绑定（只需一次）
    try {
      if (typeof Reader !== "undefined" && Reader.bindEvents) Reader.bindEvents();
    } catch (e) { console.error('[App] 阅读器事件绑定失败:', e); }

    // 跳转到主页
    const home = Store.state.homePage || 'profile';
    if (Store.state.modules[home] && Store.state.modules[home].enabled || home === 'profile') {
      switchPage(home);
    } else {
      switchPage('profile');
    }

    // 云服务：SDK 就绪且会话有效则恢复登录态 + 后台 firstSync（不阻塞首屏）
    if (typeof SB !== 'undefined' && SB.ready()) {
      SB.restoreSession().then(function(restored) {
        if (restored && typeof ProfileModule !== 'undefined') ProfileModule.renderProfile();
      }).catch(function(e) { console.warn('SB restore failed:', e); });
    }

    dismissSplash();
    checkVersionAnnouncement();
    startReadProgressSync();
    purgeExpiredTrash();
    checkDisclaimer();
  }

  /* ==================== 错误边界：模块 init 失败注入降级页 ==================== */
  function safeInitModule(name, bodyId, fn) {
    try {
      fn();
    } catch (e) {
      console.error('[App] 模块「' + name + '」初始化失败:', e);
      injectFallback(bodyId, name);
    }
  }

  // 降级页：模块名 + 「服务暂时不可用」+ 重试按钮（其余模块不受影响）
  function injectFallback(bodyId, name) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    body.innerHTML =
      '<div class="module-fallback">' +
      '<div class="module-fallback-icon"><span data-icon="alert"></span></div>' +
      '<div class="module-fallback-title">' + escapeHtml(name) + '</div>' +
      '<div class="module-fallback-desc">服务暂时不可用</div>' +
      '<button type="button" class="module-fallback-btn">重试</button>' +
      '</div>';
    var btn = body.querySelector('.module-fallback-btn');
    if (btn) btn.addEventListener('click', function() { location.reload(); });
    if (typeof Icons !== 'undefined') Icons.render(body);
  }

  // 回收站 15 天过期自动清除（启动时做一次；阅读/对话各一份）
  function purgeExpiredTrash() {
    try {
      if (typeof ReadModule !== 'undefined' && ReadModule.purgeExpiredTrash) ReadModule.purgeExpiredTrash();
    } catch (e) { console.warn('[App] 阅读回收站清理跳过:', e); }
    try {
      if (typeof ChatModule !== 'undefined' && ChatModule.purgeChatTrash) ChatModule.purgeChatTrash();
    } catch (e) { console.warn('[App] 对话回收站清理跳过:', e); }
  }

  // 首次打开免责声明：未同意则强制弹窗（底部滑出），同意后才能使用
  function checkDisclaimer() {
    if (Store.state.settings.disclaimerAgreed) return;
    var text = (typeof DISCLAIMER_TEXT !== 'undefined') ? DISCLAIMER_TEXT : '';
    var overlay = document.createElement('div');
    overlay.className = 'disclaimer-mask';
    var html = '<div class="disclaimer-sheet">';
    html += '<div class="disclaimer-title">免责声明</div>';
    html += '<div class="disclaimer-body">' + escapeHtml(text) + '</div>';
    html += '<div class="disclaimer-actions">';
    html += '<button class="disclaimer-btn ghost" id="disclaimerReject">不同意</button>';
    html += '<button class="disclaimer-btn primary" id="disclaimerAgree">我已阅读并同意</button>';
    html += '</div></div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    // 触发滑出动画
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { overlay.classList.add('open'); });
    });
    overlay.querySelector('#disclaimerAgree').addEventListener('click', function() {
      Store.state.settings.disclaimerAgreed = true;
      Store.save();
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 350);
    });
    overlay.querySelector('#disclaimerReject').addEventListener('click', function() {
      Toast.show('需同意后才能使用');
    });
  }

  // 阅读进度自动同步：每 30s 把书架（含进度）推送到云端；
  // 未登录/未开云同步/远端无表时自动降级为本地保存（pushReadShelf 内部兜底，不报错）
  function startReadProgressSync() {
    setInterval(function() {
      try {
        if (typeof SB !== 'undefined' && SB.pushReadShelf) {
          SB.pushReadShelf().catch(function() {});
        }
      } catch (e) { console.warn('[App] 阅读进度同步跳过:', e); }
    }, 30000);
  }

  // 新版本公告：版本不一致时弹出，必须点「知道了」关闭
  function checkVersionAnnouncement() {
    if (typeof APP_VERSION === 'undefined') return;
    if (Store.state.lastSeenVersion === APP_VERSION) return;
    var changes = [];
    if (typeof CHANGELOG !== 'undefined') {
      for (var i = CHANGELOG.length - 1; i >= 0; i--) {
        if (CHANGELOG[i].version === APP_VERSION) { changes = CHANGELOG[i].changes; break; }
      }
    }
    var overlay = document.createElement('div');
    overlay.className = 'update-overlay';
    var html = '<div class="update-card">';
    html += '<div class="update-title">v' + escapeHtml(APP_VERSION) + ' 更新</div>';
    if (changes.length) {
      html += '<ul class="update-list">';
      for (var j = 0; j < changes.length; j++) {
        html += '<li>' + escapeHtml(changes[j]) + '</li>';
      }
      html += '</ul>';
    }
    html += '<button class="update-btn" id="updateAnnounceOk">知道了</button>';
    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    overlay.querySelector('#updateAnnounceOk').addEventListener('click', function() {
      Store.state.lastSeenVersion = APP_VERSION;
      Store.save();
      overlay.remove();
    });
    // 遮罩点击不关闭：不绑定 overlay 点击事件
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
    const target = document.getElementById('page-' + pageId);
    if (!target) return;
    const oldPage = document.querySelector('.page.active');
    currentPage = pageId;
    Nav.updateActive(pageId);
    // 广播页面切换（桌面侧边栏高亮/顶栏标题等订阅此事件）
    if (typeof EventBus !== 'undefined') EventBus.emit('page:changed', { page: pageId });

    if (!oldPage || oldPage === target) {
      switchToken++;  // 作废旧动画的延迟收尾，避免误删 active
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      target.classList.add('active');
      cleanupSwitchAnim();
      return;
    }
    animateSwitch(oldPage, target);
  }

  /* ---- 10.1 页面切换动效：旧页 1→0 + 0→-30px（200ms），新页 30→0 + 0→1（250ms 错开 50ms）---- */
  var switchToken = 0;   // 动画令牌：快速连切时作废旧动画的收尾

  function animateSwitch(oldPage, target) {
    var token = ++switchToken;
    var rtl = document.documentElement.dir === 'rtl';  // RTL 方向反转
    var outX = rtl ? 30 : -30;
    var inX = rtl ? -30 : 30;

    // 双页 position:absolute 叠加，避免高度差导致跳动
    oldPage.style.transition = 'none';
    oldPage.style.opacity = '1';
    oldPage.style.transform = 'translateX(0)';
    target.classList.add('active');
    target.style.transition = 'none';
    target.style.opacity = '0';
    target.style.transform = 'translateX(' + inX + 'px)';

    requestAnimationFrame(function() {
      if (token !== switchToken) return;
      oldPage.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      oldPage.style.opacity = '0';
      oldPage.style.transform = 'translateX(' + outX + 'px)';
      setTimeout(function() {
        if (token !== switchToken) return;
        target.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        target.style.opacity = '1';
        target.style.transform = 'translateX(0)';
      }, 50);
    });

    // 动画完清理：旧页退场、内联样式复位
    setTimeout(function() {
      if (token !== switchToken) return;
      cleanupSwitchAnim(oldPage, target);
    }, 320);
  }

  function cleanupSwitchAnim(oldPage, target) {
    if (oldPage) {
      oldPage.classList.remove('active');
      oldPage.style.transition = '';
      oldPage.style.opacity = '';
      oldPage.style.transform = '';
    }
    if (target) {
      target.style.transition = '';
      target.style.opacity = '';
      target.style.transform = '';
    }
  }

  // 子页面导航堆栈：打开新子页面时隐藏当前子页面，返回时逐级回退
  var subStack = [];

  function openSub(subId) {
    const sub = document.getElementById(subId);
    if (!sub) return;
    if (sub.classList.contains('open')) return;
    const current = document.querySelector('.subpage.open');
    if (current && current !== sub) {
      current.classList.remove('open');
      subStack.push(current.id);
    }
    sub.classList.add('open');
    document.body.style.overflow = 'hidden';
    // 浏览器后退可关闭子页面：压入一条历史记录，popstate 时消费
    try { history.pushState({ omnihubSub: subId }, ''); } catch (e) {}
    // 直接渲染一次图标（MutationObserver 兜底之外的稳态保障）
    if (typeof Icons !== 'undefined') Icons.render(sub);
    // 打开时触发目标子页面的渲染钩子（若模块定义了的话）
    var hook = 'render:' + subId;
    try { document.dispatchEvent(new CustomEvent(hook)); } catch (e) {}
  }

  function closeSub() {
    // 若历史栈顶是子页面压入的记录，走 history.back()，由 popstate 统一执行关闭，
    // 避免这里关闭一次、popstate 又关一次的重复回退
    try {
      if (history.state && history.state.omnihubSub && document.querySelector('.subpage.open')) {
        history.back();
        return;
      }
    } catch (e) {}
    doCloseSub();
  }

  // 真正执行关闭（popstate 触发或历史栈对不上时的直关路径）
  function doCloseSub() {
    const current = document.querySelector('.subpage.open');
    if (current) current.classList.remove('open');
    const prevId = subStack.pop();
    const prev = prevId && document.getElementById(prevId);
    if (prev) {
      prev.classList.add('open');
      if (typeof Icons !== 'undefined') Icons.render(prev);
    } else {
      subStack.length = 0;
      document.body.style.overflow = '';
    }
  }

  // 浏览器后退：关闭当前子页面（无打开子页面时不干预默认行为）
  window.addEventListener('popstate', function() {
    if (document.querySelector('.subpage.open')) doCloseSub();
  });

  // Esc 关闭当前子页面（桌面端 13.3）
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.querySelector('.subpage.open')) closeSub();
  });

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

  return { init, switchPage, openSub, closeSub, pushErrorLog, getCurrentPage: () => currentPage };
})();

document.addEventListener('DOMContentLoaded', function() { App.init(); });
