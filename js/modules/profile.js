/* ==================== OmniHub Profile Module ==================== */

const ProfileModule = (() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function init() {
    renderProfile();
    bindEvents();
  }

  function renderProfile() {
    const body = $('profileBody');
    if (!body) return;

    const user = Store.state.user;
    const modules = Store.state.modules;

    let html = '';

    // 用户信息卡片
    html += '<div class="profile-card">';
    html += '<div class="profile-avatar">' + (user.isLogged && user.username ? user.username.charAt(0).toUpperCase() : '👤') + '</div>';
    html += '<div class="profile-name">' + (user.isLogged && user.username ? user.username : '未登录') + '</div>';
    html += '<div class="profile-meta">' + (user.isLogged && user.email ? user.email : '登录后同步数据') + '</div>';
    if (user.isLogged && user.memberLevel > 0) {
      var levels = ['免费', '会员', '高级会员'];
      html += '<span class="profile-vip">' + levels[user.memberLevel] + '</span>';
    }
    html += '</div>';

    // 账号
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">账号</div>';
    html += '<div class="settings-row" data-sub="subMemberCenter">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">👑</div><span class="settings-row-text">会员中心</span></div>';
    html += '<div class="settings-row-right">→</div></div>';
    html += '<div class="settings-row" id="syncRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">☁️</div><span class="settings-row-text">云同步</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.autoSync ? 'on' : '') + '" id="autoSyncToggle"></div></div>';
    html += '</div></div>';

    // 模块
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">模块</div>';
    html += '<div class="settings-row" data-sub="subModuleManage">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🧩</div><span class="settings-row-text">模块管理</span></div>';
    html += '<div class="settings-row-right">' + Object.values(modules).filter(m => m.enabled).length + ' 个已开启 →</div></div>';
    html += '<div class="settings-row" id="homePageRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🏠</div><span class="settings-row-text">默认主页</span></div>';
    html += '<div class="settings-row-right" id="homePageValue">' + getPageName(Store.state.homePage) + '</div>';
    html += '</div></div>';

    // 数据
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">数据</div>';
    html += '<div class="settings-row" data-sub="subDataManage">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">💾</div><span class="settings-row-text">数据管理</span></div>';
    html += '<div class="settings-row-right">→</div></div>';
    html += '<div class="settings-row" id="clearCacheRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🗑️</div><span class="settings-row-text">清除缓存</span></div>';
    html += '<div class="settings-row-right">→</div></div>';
    html += '</div>';

    // 设置
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">设置</div>';
    html += '<div class="settings-row" data-sub="subGlobalSettings">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">⚙️</div><span class="settings-row-text">全局设置</span></div>';
    html += '<div class="settings-row-right">→</div></div>';
    html += '</div>';

    // 关于
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">关于</div>';
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📦</div><span class="settings-row-text">OmniHub</span></div>';
    html += '<div class="settings-row-right">v7.0</div></div>';
    html += '</div>';

    body.innerHTML = html;

    // 渲染子页面
    renderMemberCenter();
    renderModuleManage();
    renderDataManage();
    renderGlobalSettings();
  }

  function getPageName(id) {
    var names = { profile: '我的', read: '阅读', chat: '对话' };
    return names[id] || id;
  }

  function bindEvents() {
    document.querySelectorAll('[data-sub]').forEach(row => {
      row.addEventListener('click', function() {
        var subId = this.dataset.sub;
        if (subId && window.App) App.openSub(subId);
      });
    });

    var syncToggle = $('autoSyncToggle');
    if (syncToggle) {
      syncToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.settings.autoSync = on;
        Store.save();
        Toast.show(on ? '云同步已开启' : '云同步已关闭');
      });
    }

    var clearRow = $('clearCacheRow');
    if (clearRow) {
      clearRow.addEventListener('click', function() {
        if (confirm('确定清除所有缓存？书架、书源等数据不会被删除。')) {
          localStorage.removeItem('omnihub_cache');
          Toast.show('缓存已清除');
        }
      });
    }
  }

  function renderMemberCenter() {
    var body = $('memberCenterBody');
    if (!body) return;
    var user = Store.state.user;

    var html = '';
    html += '<div class="profile-card" style="text-align:center;">';
    html += '<div class="profile-avatar" style="margin:0 auto 12px;">' + (user.isLogged && user.username ? user.username.charAt(0).toUpperCase() : '👤') + '</div>';
    html += '<div class="profile-name">' + (user.isLogged && user.username ? user.username : '未登录') + '</div>';
    html += '<div class="profile-meta">' + (user.isLogged && user.email ? user.email : '登录后享受云同步服务') + '</div>';
    if (user.isLogged && user.memberLevel > 0) {
      var levels = ['免费用户', '普通会员', '高级会员'];
      html += '<span class="profile-vip">' + levels[user.memberLevel] + '</span>';
    }
    html += '</div>';

    if (!user.isLogged) {
      html += '<div class="settings-group">';
      html += '<div class="settings-group-title">登录</div>';
      html += '<div style="padding:0;background:none;border:none;">';
      html += '<input type="text" id="loginUsername" placeholder="用户名" style="width:100%;padding:12px;margin-bottom:8px;border-radius:10px;background:var(--bg-soft);border:1px solid var(--border);color:var(--text);">';
      html += '<input type="password" id="loginPassword" placeholder="密码" style="width:100%;padding:12px;margin-bottom:12px;border-radius:10px;background:var(--bg-soft);border:1px solid var(--border);color:var(--text);">';
      html += '<button id="loginBtn" style="width:100%;padding:12px;border-radius:10px;background:var(--accent);border:none;color:#fff;font-size:15px;cursor:pointer;">登录</button>';
      html += '<button id="registerBtn" style="width:100%;padding:12px;margin-top:8px;border-radius:10px;background:var(--bg-soft);border:1px solid var(--border);color:var(--text);font-size:15px;cursor:pointer;">注册账号</button>';
      html += '</div></div>';
    } else {
      html += '<div class="settings-group">';
      html += '<div class="settings-group-title">账号管理</div>';
      html += '<div class="settings-row" id="logoutRow"><div class="settings-row-left"><div class="settings-row-icon">🚪</div><span class="settings-row-text">退出登录</span></div></div>';
      html += '</div>';
    }

    body.innerHTML = html;

    var loginBtn = $('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        var username = $('loginUsername').value.trim();
        var password = $('loginPassword').value;
        if (!username || !password) return Toast.show('请填写用户名和密码', 'error');
        Store.state.user = { isLogged: true, username: username, email: username + '@omnihub.app', token: 'demo', memberLevel: 0, memberExpire: 0, cloudSync: false };
        Store.save();
        Toast.show('登录成功');
        renderProfile();
      });
    }

    var registerBtn = $('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', function() {
        Toast.show('注册功能开发中，请使用演示账号');
      });
    }

    var logoutRow = $('logoutRow');
    if (logoutRow) {
      logoutRow.addEventListener('click', function() {
        if (confirm('确定退出登录？')) {
          Store.state.user = { isLogged: false, username: '', email: '', token: '', memberLevel: 0, memberExpire: 0, cloudSync: false };
          Store.save();
          Toast.show('已退出登录');
          renderProfile();
        }
      });
    }
  }

  function renderModuleManage() {
    var body = $('moduleManageBody');
    if (!body) return;

    var allModules = [
      { id: 'read', name: '阅读', icon: '📚', desc: '小说与漫画' },
      { id: 'chat', name: '对话', icon: '💬', desc: 'AI聊天' }
    ];

    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">已开启模块</div>';
    allModules.forEach(function(m) {
      var enabled = Store.state.modules[m.id] && Store.state.modules[m.id].enabled;
      html += '<div class="settings-row" data-module="' + m.id + '">';
      html += '<div class="settings-row-left"><div class="settings-row-icon">' + m.icon + '</div><div><div class="settings-row-text">' + m.name + '</div><div style="font-size:12px;color:var(--text-secondary);">' + m.desc + '</div></div></div>';
      html += '<div class="settings-row-right"><div class="toggle-switch ' + (enabled ? 'on' : '') + '" data-module-toggle="' + m.id + '"></div></div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">默认主页</div>';
    html += '<div class="settings-row" id="setHomePageRow"><div class="settings-row-left"><div class="settings-row-icon">🏠</div><span class="settings-row-text">打开应用时显示</span></div>';
    html += '<div class="settings-row-right" id="setHomePageValue">' + getPageName(Store.state.homePage) + '</div></div>';
    html += '</div>';

    body.innerHTML = html;

    document.querySelectorAll('[data-module-toggle]').forEach(function(toggle) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var moduleId = this.dataset.moduleToggle;
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.modules[moduleId].enabled = on;

        if (on) {
          var names = { read: '阅读', chat: '对话' };
          var icons = { read: '📚', chat: '💬' };
          var maxOrder = 0;
          Store.state.navItems.forEach(function(n) { if (n.order > maxOrder) maxOrder = n.order; });
          Store.state.navItems.push({ id: moduleId, name: names[moduleId], icon: icons[moduleId], enabled: true, order: maxOrder + 1, fixed: false });
        } else {
          Store.state.navItems = Store.state.navItems.filter(function(n) { return n.id !== moduleId; });
          if (Store.state.homePage === moduleId) Store.state.homePage = 'profile';
        }
        Store.save();
        if (window.Nav) Nav.render();
        Toast.show(on ? getPageName(moduleId) + ' 已开启' : getPageName(moduleId) + ' 已关闭');
      });
    });

    var homeRow = $('setHomePageRow');
    if (homeRow) {
      homeRow.addEventListener('click', function() {
        var enabledPages = Store.state.navItems.filter(function(n) { return n.enabled; }).map(function(n) { return n.id; });
        var msg = '选择默认主页（输入编号）:\n';
        enabledPages.forEach(function(id, i) { msg += i + '. ' + getPageName(id) + '\n'; });
        var choice = prompt(msg);
        var idx = parseInt(choice);
        if (!isNaN(idx) && enabledPages[idx]) {
          Store.state.homePage = enabledPages[idx];
          Store.save();
          var val = $('setHomePageValue');
          if (val) val.textContent = getPageName(enabledPages[idx]);
          Toast.show('默认主页已设置');
        }
      });
    }
  }

  function renderDataManage() {
    var body = $('dataManageBody');
    if (!body) return;

    var html = '<div class="settings-group"><div class="settings-group-title">备份</div>';
    html += '<div class="settings-row" id="exportDataRow"><div class="settings-row-left"><div class="settings-row-icon">📤</div><span class="settings-row-text">导出数据</span></div></div></div>';
    html += '<div class="settings-group"><div class="settings-group-title">恢复</div>';
    html += '<div style="padding:0;background:none;border:none;">';
    html += '<textarea id="importDataInput" placeholder="粘贴之前导出的数据..." style="width:100%;height:120px;padding:12px;border-radius:10px;background:var(--bg-soft);border:1px solid var(--border);color:var(--text);font-size:14px;margin-bottom:8px;"></textarea>';
    html += '<button id="importDataBtn" style="width:100%;padding:12px;border-radius:10px;background:var(--accent);border:none;color:#fff;font-size:15px;cursor:pointer;">导入数据</button></div></div>';
    html += '<div class="settings-group"><div class="settings-group-title">危险</div>';
    html += '<div class="settings-row" id="resetDataRow"><div class="settings-row-left"><div class="settings-row-icon">⚠️</div><span class="settings-row-text">重置所有数据</span></div></div></div>';

    body.innerHTML = html;

    $('exportDataRow').addEventListener('click', function() {
      var data = Store.exportData();
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omnihub_backup_' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('数据已导出');
    });

    $('importDataBtn').addEventListener('click', function() {
      var input = $('importDataInput').value.trim();
      if (!input) return Toast.show('请输入数据', 'error');
      if (Store.importData(input)) {
        Toast.show('数据导入成功，刷新页面生效');
      } else {
        Toast.show('数据格式错误', 'error');
      }
    });

    $('resetDataRow').addEventListener('click', function() {
      if (confirm('确定重置所有数据？此操作不可恢复！')) {
        Store.reset();
        Toast.show('数据已重置');
        location.reload();
      }
    });
  }

  function renderGlobalSettings() {
    var body = $('globalSettingsBody');
    if (!body) return;

    var html = '<div class="settings-group"><div class="settings-group-title">外观</div>';
    html += '<div class="settings-row"><div class="settings-row-left"><div class="settings-row-icon">🎨</div><span class="settings-row-text">主题</span></div><div class="settings-row-right">深色</div></div></div>';
    html += '<div class="settings-group"><div class="settings-group-title">导航</div>';
    html += '<div class="settings-row" id="fabSnapRow"><div class="settings-row-left"><div class="settings-row-icon">🧲</div><span class="settings-row-text">悬浮球吸附边缘</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.fabSnap ? 'on' : '') + '" id="fabSnapToggle"></div></div></div></div>';
    html += '<div class="settings-group"><div class="settings-group-title">其他</div>';
    html += '<div class="settings-row" id="notifRow"><div class="settings-row-left"><div class="settings-row-icon">🔔</div><span class="settings-row-text">通知</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.notifications ? 'on' : '') + '" id="notifToggle"></div></div></div></div>';

    body.innerHTML = html;

    var fabSnap = $('fabSnapToggle');
    if (fabSnap) {
      fabSnap.addEventListener('click', function(e) {
        e.stopPropagation();
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.settings.fabSnap = on;
        Store.save();
      });
    }

    var notif = $('notifToggle');
    if (notif) {
      notif.addEventListener('click', function(e) {
        e.stopPropagation();
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.settings.notifications = on;
        Store.save();
      });
    }
  }

  return { init, renderProfile };
})();

const Toast = {
  show: function(msg, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, 2500);
  }
};
