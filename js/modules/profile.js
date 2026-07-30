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

    body.innerHTML = `
      <!-- 用户信息卡片 -->
      <div class="profile-card">
        <div class="profile-avatar">${user.isLogged && user.username ? user.username[0].toUpperCase() : '👤'}</div>
        <div class="profile-name">${user.isLogged && user.username ? user.username : '未登录'}</div>
        <div class="profile-meta">${user.isLogged && user.email ? user.email : '登录后同步数据'}</div>
        ${user.isLogged ? `<span class="profile-vip">${['免费', '会员', '高级会员'][user.memberLevel]}</span>` : ''}
      </div>

      <!-- 会员中心 -->
      <div class="settings-group">
        <div class="settings-group-title">账号</div>
        <div class="settings-row" data-sub="subMemberCenter">
          <div class="settings-row-left">
            <div class="settings-row-icon">👑</div>
            <span class="settings-row-text">会员中心</span>
          </div>
          <div class="settings-row-right"><span data-icon="chevron-right"></span></div>
        </div>
        <div class="settings-row" id="syncRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">☁️</div>
            <span class="settings-row-text">云同步</span>
          </div>
          <div class="settings-row-right">
            <div class="toggle-switch ${Store.state.settings.autoSync ? 'on' : ''}" id="autoSyncToggle"></div>
          </div>
        </div>
      </div>

      <!-- 模块管理 -->
      <div class="settings-group">
        <div class="settings-group-title">模块</div>
        <div class="settings-row" data-sub="subModuleManage">
          <div class="settings-row-left">
            <div class="settings-row-icon">🧩</div>
            <span class="settings-row-text">模块管理</span>
          </div>
          <div class="settings-row-right">${Object.values(modules).filter(m => m.enabled).length} 个已开启 <span data-icon="chevron-right"></span></div>
        </div>
        <div class="settings-row" id="homePageRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🏠</div>
            <span class="settings-row-text">默认主页</span>
          </div>
          <div class="settings-row-right" id="homePageValue">${getPageName(Store.state.homePage)}</div>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="settings-group">
        <div class="settings-group-title">数据</div>
        <div class="settings-row" data-sub="subDataManage">
          <div class="settings-row-left">
            <div class="settings-row-icon">💾</div>
            <span class="settings-row-text">数据管理</span>
          </div>
          <div class="settings-row-right"><span data-icon="chevron-right"></span></div>
        </div>
        <div class="settings-row" id="clearCacheRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🗑️</div>
            <span class="settings-row-text">清除缓存</span>
          </div>
          <div class="settings-row-right"><span data-icon="chevron-right"></span></div>
        </div>
      </div>

      <!-- 全局设置 -->
      <div class="settings-group">
        <div class="settings-group-title">设置</div>
        <div class="settings-row" data-sub="subGlobalSettings">
          <div class="settings-row-left">
            <div class="settings-row-icon">⚙️</div>
            <span class="settings-row-text">全局设置</span>
          </div>
          <div class="settings-row-right"><span data-icon="chevron-right"></span></div>
        </div>
      </div>

      <!-- 关于 -->
      <div class="settings-group">
        <div class="settings-group-title">关于</div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-icon">📦</div>
            <span class="settings-row-text">OmniHub</span>
          </div>
          <div class="settings-row-right">v7.0</div>
        </div>
      </div>
    `;

    // 渲染子页面
    renderMemberCenter();
    renderModuleManage();
    renderDataManage();
    renderGlobalSettings();
  }

  function getPageName(id) {
    const names = { profile: '我的', read: '阅读', chat: '对话' };
    return names[id] || id;
  }

  function bindEvents() {
    // 设置行点击
    document.querySelectorAll('[data-sub]').forEach(row => {
      row.addEventListener('click', () => {
        const subId = row.dataset.sub;
        if (subId) App.openSub(subId);
      });
    });

    // 云同步开关
    const syncToggle = $('autoSyncToggle');
    if (syncToggle) {
      syncToggle.addEventListener('click', e => {
        e.stopPropagation();
        const on = !syncToggle.classList.contains('on');
        syncToggle.classList.toggle('on', on);
        Store.state.settings.autoSync = on;
        Store.save();
        Toast.show(on ? '云同步已开启' : '云同步已关闭');
      });
    }

    // 清除缓存
    const clearRow = $('clearCacheRow');
    if (clearRow) {
      clearRow.addEventListener('click', () => {
        if (confirm('确定清除所有缓存？书架、书源等数据不会被删除。')) {
          localStorage.removeItem('omnihub_cache');
          Toast.show('缓存已清除');
        }
      });
    }
  }

  // ========== 会员中心 ==========
  function renderMemberCenter() {
    const body = $('memberCenterBody');
    if (!body) return;
    const user = Store.state.user;

    body.innerHTML = `
      <div class="profile-card" style="text-align:center;">
        <div class="profile-avatar" style="margin:0 auto 12px;">${user.isLogged && user.username ? user.username[0].toUpperCase() : '👤'}</div>
        <div class="profile-name">${user.isLogged && user.username ? user.username : '未登录'}</div>
        <div class="profile-meta">${user.isLogged ? user.email : '登录后享受云同步服务'}</div>
        ${user.isLogged ? `<span class="profile-vip">${['免费用户', '普通会员', '高级会员'][user.memberLevel]}</span>` : ''}
      </div>

      ${!user.isLogged ? `
      <div class="settings-group">
        <div class="settings-group-title">登录</div>
        <div class="settings-row" style="display:block; padding:0; background:none; border:none;">
          <input type="text" id="loginUsername" placeholder="用户名" style="width:100%; padding:12px; margin-bottom:8px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border); color:var(--text);">
          <input type="password" id="loginPassword" placeholder="密码" style="width:100%; padding:12px; margin-bottom:12px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border); color:var(--text);">
          <button id="loginBtn" style="width:100%; padding:12px; border-radius:10px; background:var(--accent); border:none; color:#fff; font-size:15px; cursor:pointer;">登录</button>
          <button id="registerBtn" style="width:100%; padding:12px; margin-top:8px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border); color:var(--text); font-size:15px; cursor:pointer;">注册账号</button>
        </div>
      </div>
      ` : `
      <div class="settings-group">
        <div class="settings-group-title">账号管理</div>
        <div class="settings-row" id="logoutRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🚪</div>
            <span class="settings-row-text">退出登录</span>
          </div>
        </div>
        <div class="settings-row" id="changePwdRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🔐</div>
            <span class="settings-row-text">修改密码</span>
          </div>
        </div>
      </div>
      `}
    `;

    // 绑定登录事件
    const loginBtn = $('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const username = $('loginUsername').value.trim();
        const password = $('loginPassword').value;
        if (!username || !password) return Toast.show('请填写用户名和密码', 'error');
        Toast.show('登录中...');
        // 这里接入你的登录API
        // 模拟登录成功
        Store.state.user = { isLogged: true, username, email: username + '@omnihub.app', token: 'demo_token', memberLevel: 0, memberExpire: 0, cloudSync: false };
        Store.save();
        Toast.show('登录成功');
        renderProfile();
        renderMemberCenter();
      });
    }

    const registerBtn = $('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        Toast.show('注册功能开发中，请使用演示账号');
      });
    }

    const logoutRow = $('logoutRow');
    if (logoutRow) {
      logoutRow.addEventListener('click', () => {
        if (confirm('确定退出登录？')) {
          Store.state.user = { isLogged: false, username: '', email: '', token: '', memberLevel: 0, memberExpire: 0, cloudSync: false };
          Store.save();
          Toast.show('已退出登录');
          renderProfile();
          renderMemberCenter();
        }
      });
    }
  }

  // ========== 模块管理 ==========
  function renderModuleManage() {
    const body = $('moduleManageBody');
    if (!body) return;

    const allModules = [
      { id: 'read', name: '阅读', icon: '📚', desc: '小说与漫画' },
      { id: 'chat', name: '对话', icon: '💬', desc: 'AI聊天' }
    ];

    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">已开启模块</div>
        ${allModules.map(m => {
          const enabled = Store.state.modules[m.id]?.enabled;
          return `
          <div class="settings-row" data-module="${m.id}">
            <div class="settings-row-left">
              <div class="settings-row-icon">${m.icon}</div>
              <div>
                <div class="settings-row-text">${m.name}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${m.desc}</div>
              </div>
            </div>
            <div class="settings-row-right">
              <div class="toggle-switch ${enabled ? 'on' : ''}" data-module-toggle="${m.id}"></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      <div class="settings-group">
        <div class="settings-group-title">默认主页</div>
        <div class="settings-row" id="setHomePageRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🏠</div>
            <span class="settings-row-text">打开应用时显示</span>
          </div>
          <div class="settings-row-right" id="setHomePageValue">${getPageName(Store.state.homePage)}</div>
        </div>
      </div>
    `;

    // 绑定开关
    document.querySelectorAll('[data-module-toggle]').forEach(toggle => {
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        const moduleId = toggle.dataset.moduleToggle;
        const on = !toggle.classList.contains('on');
        toggle.classList.toggle('on', on);
        Store.state.modules[moduleId].enabled = on;

        // 更新导航栏
        if (on) {
          // 添加导航项
          const names = { read: '阅读', chat: '对话' };
          const icons = { read: '📚', chat: '💬' };
          const maxOrder = Math.max(...Store.state.navItems.map(n => n.order), 0);
          Store.state.navItems.push({
            id: moduleId, name: names[moduleId], icon: icons[moduleId],
            enabled: true, order: maxOrder + 1, fixed: false
          });
        } else {
          // 移除导航项
          Store.state.navItems = Store.state.navItems.filter(n => n.id !== moduleId);
          // 如果主页是这个模块，改回profile
          if (Store.state.homePage === moduleId) {
            Store.state.homePage = 'profile';
          }
        }
        Store.save();
        Nav.render();
        Toast.show(on ? `${getPageName(moduleId)} 已开启` : `${getPageName(moduleId)} 已关闭`);
      });
    });

    // 设置主页
    const homeRow = $('setHomePageRow');
    if (homeRow) {
      homeRow.addEventListener('click', () => {
        const enabledPages = Store.state.navItems.filter(n => n.enabled).map(n => n.id);
        const choice = prompt('选择默认主页（输入编号）:
' + enabledPages.map((id, i) => `${i}. ${getPageName(id)}`).join('
'));
        const idx = parseInt(choice);
        if (!isNaN(idx) && enabledPages[idx]) {
          Store.state.homePage = enabledPages[idx];
          Store.save();
          $('setHomePageValue').textContent = getPageName(enabledPages[idx]);
          Toast.show('默认主页已设置');
        }
      });
    }
  }

  // ========== 数据管理 ==========
  function renderDataManage() {
    const body = $('dataManageBody');
    if (!body) return;

    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">备份</div>
        <div class="settings-row" id="exportDataRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">📤</div>
            <span class="settings-row-text">导出数据</span>
          </div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">恢复</div>
        <div class="settings-row" style="display:block; padding:0; background:none; border:none;">
          <textarea id="importDataInput" placeholder="粘贴之前导出的数据..." style="width:100%; height:120px; padding:12px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border); color:var(--text); font-size:14px; margin-bottom:8px;"></textarea>
          <button id="importDataBtn" style="width:100%; padding:12px; border-radius:10px; background:var(--accent); border:none; color:#fff; font-size:15px; cursor:pointer;">导入数据</button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">危险</div>
        <div class="settings-row" id="resetDataRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">⚠️</div>
            <span class="settings-row-text">重置所有数据</span>
          </div>
        </div>
      </div>
    `;

    $('exportDataRow').addEventListener('click', () => {
      const data = Store.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnihub_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('数据已导出');
    });

    $('importDataBtn').addEventListener('click', () => {
      const input = $('importDataInput').value.trim();
      if (!input) return Toast.show('请输入数据', 'error');
      if (Store.importData(input)) {
        Toast.show('数据导入成功，刷新页面生效');
      } else {
        Toast.show('数据格式错误', 'error');
      }
    });

    $('resetDataRow').addEventListener('click', () => {
      if (confirm('确定重置所有数据？此操作不可恢复！')) {
        Store.reset();
        Toast.show('数据已重置');
        location.reload();
      }
    });
  }

  // ========== 全局设置 ==========
  function renderGlobalSettings() {
    const body = $('globalSettingsBody');
    if (!body) return;

    body.innerHTML = `
      <div class="settings-group">
        <div class="settings-group-title">外观</div>
        <div class="settings-row" id="themeRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🎨</div>
            <span class="settings-row-text">主题</span>
          </div>
          <div class="settings-row-right">深色</div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">导航</div>
        <div class="settings-row" id="fabSnapRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🧲</div>
            <span class="settings-row-text">悬浮球吸附边缘</span>
          </div>
          <div class="settings-row-right">
            <div class="toggle-switch ${Store.state.settings.fabSnap ? 'on' : ''}" id="fabSnapToggle"></div>
          </div>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">其他</div>
        <div class="settings-row" id="notifRow">
          <div class="settings-row-left">
            <div class="settings-row-icon">🔔</div>
            <span class="settings-row-text">通知</span>
          </div>
          <div class="settings-row-right">
            <div class="toggle-switch ${Store.state.settings.notifications ? 'on' : ''}" id="notifToggle"></div>
          </div>
        </div>
      </div>
    `;

    // 悬浮球吸附
    const fabSnap = $('fabSnapToggle');
    if (fabSnap) {
      fabSnap.addEventListener('click', e => {
        e.stopPropagation();
        const on = !fabSnap.classList.contains('on');
        fabSnap.classList.toggle('on', on);
        Store.state.settings.fabSnap = on;
        Store.save();
      });
    }

    // 通知
    const notif = $('notifToggle');
    if (notif) {
      notif.addEventListener('click', e => {
        e.stopPropagation();
        const on = !notif.classList.contains('on');
        notif.classList.toggle('on', on);
        Store.state.settings.notifications = on;
        Store.save();
      });
    }
  }

  return { init, renderProfile };
})();

// Toast 全局
const Toast = {
  show(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
  }
};
