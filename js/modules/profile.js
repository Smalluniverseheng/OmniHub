/* ==================== OmniHub Profile Module ==================== */

const I18n = {
  lang: 'zh',
  data: {
    zh: {
      my: '我的', memberCenter: '会员中心', cloudSync: '云同步', modules: '模块',
      moduleManage: '模块管理', homePage: '默认主页', data: '数据', dataManage: '数据管理',
      clearCache: '清除缓存', settings: '设置', globalSettings: '全局设置', about: '关于',
      login: '登录', register: '注册', logout: '退出登录', username: '用户名',
      password: '密码', notLogged: '未登录', loginToSync: '登录后同步数据',
      loggedIn: '已登录', exportData: '导出数据', importData: '导入数据', resetData: '重置所有数据',
      theme: '主题', dark: '深色', light: '浅色', followSystem: '跟随系统',
      language: '语言', fabSnap: '悬浮球吸附边缘', notifications: '通知',
      reading: '阅读', chat: '对话', novelAndComic: '小说与漫画', aiChat: 'AI聊天',
      enabled: '个已开启', selectHomePage: '选择默认主页', saved: '已保存',
      cacheCleared: '缓存已清除', dataExported: '数据已导出', dataImported: '数据导入成功',
      dataReset: '数据已重置', confirmReset: '确定重置所有数据？此操作不可恢复！',
      confirmClear: '确定清除所有缓存？书架、书源等数据不会被删除。',
      confirmLogout: '确定退出登录？', loginSuccess: '登录成功', logoutSuccess: '已退出登录',
      fillAll: '请填写用户名和密码', invalidData: '数据格式错误', developing: '开发中'
    },
    en: {
      my: 'Profile', memberCenter: 'Member Center', cloudSync: 'Cloud Sync', modules: 'Modules',
      moduleManage: 'Module Manager', homePage: 'Home Page', data: 'Data', dataManage: 'Data Manager',
      clearCache: 'Clear Cache', settings: 'Settings', globalSettings: 'Global Settings', about: 'About',
      login: 'Login', register: 'Register', logout: 'Logout', username: 'Username',
      password: 'Password', notLogged: 'Not logged in', loginToSync: 'Login to sync data',
      loggedIn: 'Logged in', exportData: 'Export Data', importData: 'Import Data', resetData: 'Reset All Data',
      theme: 'Theme', dark: 'Dark', light: 'Light', followSystem: 'Follow System',
      language: 'Language', fabSnap: 'FAB Snap to Edge', notifications: 'Notifications',
      reading: 'Reading', chat: 'Chat', novelAndComic: 'Novel & Comic', aiChat: 'AI Chat',
      enabled: ' enabled', selectHomePage: 'Select Home Page', saved: 'Saved',
      cacheCleared: 'Cache cleared', dataExported: 'Data exported', dataImported: 'Data imported',
      dataReset: 'Data reset', confirmReset: 'Reset all data? This cannot be undone!',
      confirmClear: 'Clear cache? Bookshelf and sources will not be deleted.',
      confirmLogout: 'Logout?', loginSuccess: 'Login successful', logoutSuccess: 'Logged out',
      fillAll: 'Please fill in username and password', invalidData: 'Invalid data format', developing: 'Developing'
    },
    fr: {
      my: 'Profil', memberCenter: 'Centre Membre', cloudSync: 'Sync Cloud', modules: 'Modules',
      moduleManage: 'Gestion Modules', homePage: "Page d'accueil", data: 'Données', dataManage: 'Gestion Données',
      clearCache: 'Vider Cache', settings: 'Paramètres', globalSettings: 'Paramètres Globaux', about: 'À propos',
      login: 'Connexion', register: 'Inscription', logout: 'Déconnexion', username: "Nom d'utilisateur",
      password: 'Mot de passe', notLogged: 'Non connecté', loginToSync: 'Connectez-vous pour synchroniser',
      loggedIn: 'Connecté', exportData: 'Exporter', importData: 'Importer', resetData: 'Réinitialiser',
      theme: 'Thème', dark: 'Sombre', light: 'Clair', followSystem: 'Suivre système',
      language: 'Langue', fabSnap: 'FAB adhérence bord', notifications: 'Notifications',
      reading: 'Lecture', chat: 'Chat', novelAndComic: 'Roman & BD', aiChat: 'Chat IA',
      enabled: ' activé', selectHomePage: "Choisir page d'accueil", saved: 'Enregistré',
      cacheCleared: 'Cache vidé', dataExported: 'Données exportées', dataImported: 'Données importées',
      dataReset: 'Données réinitialisées', confirmReset: 'Réinitialiser? Irréversible!',
      confirmClear: 'Vider cache? Bibliothèque conservée.', confirmLogout: 'Déconnexion?',
      loginSuccess: 'Connecté', logoutSuccess: 'Déconnecté', fillAll: 'Remplir tous les champs',
      invalidData: 'Format invalide', developing: 'En développement'
    },
    ru: {
      my: 'Профиль', memberCenter: 'Центр участника', cloudSync: 'Облачная синхронизация', modules: 'Модули',
      moduleManage: 'Управление модулями', homePage: 'Главная страница', data: 'Данные', dataManage: 'Управление данными',
      clearCache: 'Очистить кэш', settings: 'Настройки', globalSettings: 'Глобальные настройки', about: 'О приложении',
      login: 'Вход', register: 'Регистрация', logout: 'Выход', username: 'Имя пользователя',
      password: 'Пароль', notLogged: 'Не авторизован', loginToSync: 'Войдите для синхронизации',
      loggedIn: 'Авторизован', exportData: 'Экспорт', importData: 'Импорт', resetData: 'Сбросить все',
      theme: 'Тема', dark: 'Тёмная', light: 'Светлая', followSystem: 'Как в системе',
      language: 'Язык', fabSnap: 'FAB прилипание к краю', notifications: 'Уведомления',
      reading: 'Чтение', chat: 'Чат', novelAndComic: 'Роман и комикс', aiChat: 'ИИ-чат',
      enabled: ' включено', selectHomePage: 'Выбрать главную', saved: 'Сохранено',
      cacheCleared: 'Кэш очищен', dataExported: 'Данные экспортированы', dataImported: 'Данные импортированы',
      dataReset: 'Данные сброшены', confirmReset: 'Сбросить все данные? Необратимо!',
      confirmClear: 'Очистить кэш? Книги сохранятся.', confirmLogout: 'Выйти?',
      loginSuccess: 'Вход выполнен', logoutSuccess: 'Выход выполнен', fillAll: 'Заполните все поля',
      invalidData: 'Неверный формат', developing: 'В разработке'
    },
    es: {
      my: 'Perfil', memberCenter: 'Centro Miembro', cloudSync: 'Sync Nube', modules: 'Módulos',
      moduleManage: 'Gestión Módulos', homePage: 'Página Inicio', data: 'Datos', dataManage: 'Gestión Datos',
      clearCache: 'Borrar Caché', settings: 'Ajustes', globalSettings: 'Ajustes Globales', about: 'Acerca de',
      login: 'Iniciar sesión', register: 'Registrarse', logout: 'Cerrar sesión', username: 'Usuario',
      password: 'Contraseña', notLogged: 'No conectado', loginToSync: 'Inicie sesión para sincronizar',
      loggedIn: 'Conectado', exportData: 'Exportar', importData: 'Importar', resetData: 'Restablecer todo',
      theme: 'Tema', dark: 'Oscuro', light: 'Claro', followSystem: 'Seguir sistema',
      language: 'Idioma', fabSnap: 'FAB adherir borde', notifications: 'Notificaciones',
      reading: 'Lectura', chat: 'Chat', novelAndComic: 'Novela y Cómic', aiChat: 'Chat IA',
      enabled: ' habilitado', selectHomePage: 'Elegir página inicio', saved: 'Guardado',
      cacheCleared: 'Caché borrado', dataExported: 'Datos exportados', dataImported: 'Datos importados',
      dataReset: 'Datos restablecidos', confirmReset: '¿Restablecer todo? ¡Irreversible!',
      confirmClear: '¿Borrar caché? Biblioteca conservada.', confirmLogout: '¿Cerrar sesión?',
      loginSuccess: 'Sesión iniciada', logoutSuccess: 'Sesión cerrada', fillAll: 'Complete todos los campos',
      invalidData: 'Formato inválido', developing: 'En desarrollo'
    },
    ar: {
      my: 'الملف الشخصي', memberCenter: 'مركز العضو', cloudSync: 'مزامنة السحابة', modules: 'الوحدات',
      moduleManage: 'إدارة الوحدات', homePage: 'الصفحة الرئيسية', data: 'البيانات', dataManage: 'إدارة البيانات',
      clearCache: 'مسح ذاكرة التخزين', settings: 'الإعدادات', globalSettings: 'الإعدادات العامة', about: 'حول',
      login: 'تسجيل الدخول', register: 'التسجيل', logout: 'تسجيل الخروج', username: 'اسم المستخدم',
      password: 'كلمة المرور', notLogged: 'لم يتم تسجيل الدخول', loginToSync: 'سجل الدخول للمزامنة',
      loggedIn: 'تم تسجيل الدخول', exportData: 'تصدير', importData: 'استيراد', resetData: 'إعادة تعيين الكل',
      theme: 'السمة', dark: 'داكن', light: 'فاتح', followSystem: 'مثل النظام',
      language: 'اللغة', fabSnap: 'FAB التصاق الحافة', notifications: 'الإشعارات',
      reading: 'القراءة', chat: 'دردشة', novelAndComic: 'رواية وكوميك', aiChat: 'دردشة ذكاء اصطناعي',
      enabled: ' مفعل', selectHomePage: 'اختر الصفحة الرئيسية', saved: 'تم الحفظ',
      cacheCleared: 'تم مسح ذاكرة التخزين', dataExported: 'تم تصدير البيانات', dataImported: 'تم استيراد البيانات',
      dataReset: 'تم إعادة التعيين', confirmReset: 'إعادة تعيين الكل؟ لا يمكن التراجع!',
      confirmClear: 'مسح ذاكرة التخزين؟ المكتبة محفوظة.', confirmLogout: 'تسجيل الخروج؟',
      loginSuccess: 'تم تسجيل الدخول', logoutSuccess: 'تم تسجيل الخروج', fillAll: 'املأ جميع الحقول',
      invalidData: 'تنسيق غير صالح', developing: 'قيد التطوير'
    }
  },
  t(key) {
    const l = Store.state.settings.language || 'zh';
    return (this.data[l] && this.data[l][key]) || this.data.zh[key] || key;
  },
  setLang(lang) {
    Store.state.settings.language = lang;
    Store.save();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  }
};

const Theme = {
  init() {
    const mode = Store.state.settings.theme || 'dark';
    this.apply(mode);
    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (Store.state.settings.theme === 'system') this.apply('system');
      });
    }
  },
  apply(mode) {
    const html = document.documentElement;
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    html.classList.toggle('dark', isDark);
    html.classList.toggle('light', !isDark);
    Store.state.settings.theme = mode;
    Store.save();
  }
};

const ProfileModule = (() => {
  'use strict';

  function init() {
    Theme.init();
    I18n.lang = Store.state.settings.language || 'zh';
    renderProfile();
    bindEvents();
  }

  function renderProfile() {
    const body = document.getElementById('profileBody');
    if (!body) return;

    const user = Store.state.user;
    const modules = Store.state.modules;
    const t = I18n.t.bind(I18n);

    let html = '';

    // 用户信息卡片（点击进会员中心）
    var displayName = user.isLogged ? (user.nickname || user.username || user.email || t('loggedIn')) : t('notLogged');
    html += '<div class="profile-card" data-sub="subMemberCenter" style="cursor:pointer;">';
    html += '<div class="profile-avatar">' + (user.isLogged && displayName ? esc(displayName.charAt(0).toUpperCase()) : '👤') + '</div>';
    html += '<div class="profile-name">' + esc(displayName) + '</div>';
    html += '<div class="profile-meta">' + (user.isLogged && user.email ? esc(user.email) : t('loginToSync')) + '</div>';
    if (user.isLogged) {
      var tier = tierOf(user.role);
      html += '<span class="badge" style="background:' + tier.color + '">' + tier.icon + ' ' + tier.name + '</span>';
    } else if (user.memberLevel > 0) {
      var levels = ['免费', '会员', '高级会员'];
      html += '<span class="profile-vip">' + levels[user.memberLevel] + '</span>';
    }
    html += '</div>';

    // 账号
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('account') + '</div>';
    html += '<div class="settings-row" data-sub="subMemberCenter">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">👑</div><span class="settings-row-text">' + t('memberCenter') + '</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row" id="syncRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">☁️</div><span class="settings-row-text">' + t('cloudSync') + '</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.autoSync ? 'on' : '') + '" id="autoSyncToggle"></div></div>';
    html += '</div></div>';

    // 模块
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('modules') + '</div>';
    html += '<div class="settings-row" data-sub="subModuleManage">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🧩</div><span class="settings-row-text">' + t('moduleManage') + '</span></div>';
    html += '<div class="settings-row-right">' + Object.values(modules).filter(m => m.enabled).length + t('enabled') + ' <svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row" id="homePageRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🏠</div><span class="settings-row-text">' + t('homePage') + '</span></div>';
    html += '<div class="settings-row-right" id="homePageValue">' + getPageName(Store.state.homePage) + '</div>';
    html += '</div></div>';

    // 数据
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('data') + '</div>';
    html += '<div class="settings-row" data-sub="subDataManage">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">💾</div><span class="settings-row-text">' + t('dataManage') + '</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row" id="clearCacheRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🗑️</div><span class="settings-row-text">' + t('clearCache') + '</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '</div>';

    // 设置
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('settings') + '</div>';
    html += '<div class="settings-row" data-sub="subGlobalSettings">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">⚙️</div><span class="settings-row-text">' + t('globalSettings') + '</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '</div>';

    // 关于
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('about') + '</div>';
    html += '<div class="settings-row" data-sub="subChangelog">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📋</div><span class="settings-row-text">更新日志</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📦</div><span class="settings-row-text">OmniHub</span></div>';
    html += '<div class="settings-row-right">v7.8</div></div>';
    html += '</div>';

    body.innerHTML = html;

    renderMemberCenter();
    renderModuleManage();
    renderDataManage();
    renderGlobalSettings();
    renderChangelog();
  }

  function renderChangelog() {
    var body = document.getElementById('changelogBody');
    if (!body) return;
    if (typeof CHANGELOG === 'undefined' || !CHANGELOG.length) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无更新日志</div></div>';
      return;
    }
    var list = CHANGELOG.slice().reverse();
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      html += '<div class="changelog-card">';
      html += '<div class="changelog-head"><span class="changelog-ver">v' + item.version + '</span><span class="changelog-date">' + item.date + '</span></div>';
      html += '<ul class="changelog-list">';
      for (var j = 0; j < item.changes.length; j++) {
        html += '<li>' + item.changes[j] + '</li>';
      }
      html += '</ul></div>';
    }
    body.innerHTML = html;
  }

  function getPageName(id) {
    var names = { profile: I18n.t('my'), read: I18n.t('reading'), chat: I18n.t('chat') };
    return names[id] || id;
  }

  function bindEvents() {
    // 事件委托 - 所有点击通过 document 捕获
    document.addEventListener('click', function(e) {
      // 切换开关
      var toggle = e.target.closest('.toggle-switch');
      if (toggle) {
        e.stopPropagation();
        var on = !toggle.classList.contains('on');
        toggle.classList.toggle('on', on);
        if (toggle.id === 'autoSyncToggle') {
          Store.state.settings.autoSync = on;
          Store.save();
          Toast.show(on ? I18n.t('saved') : I18n.t('saved'));
        }
        if (toggle.id === 'mcCloudSyncToggle') {
          Store.state.user.cloudSync = on;
          Store.save();
          Toast.show(on ? '云同步已开启' : '云同步已关闭');
          if (on && typeof SB !== 'undefined') SB.Sync.schedulePush();
        }
        return;
      }

      // 清除缓存
      if (e.target.closest('#clearCacheRow')) {
        if (confirm(I18n.t('confirmClear'))) {
          localStorage.removeItem('omnihub_cache');
          Toast.show(I18n.t('cacheCleared'));
        }
        return;
      }
    });
  }

  /* ==================== 会员中心 ==================== */

  // 六级会员体系
  var TIER_MAP = {
    guest:    { name: '游客',     icon: '🌑', color: '#6B7280', grad: 'linear-gradient(135deg,#374151,#6B7280)' },
    user:     { name: '普通会员', icon: '🛰️', color: '#3B82F6', grad: 'linear-gradient(135deg,#1D4ED8,#3B82F6)' },
    advanced: { name: '进阶会员', icon: '🪐', color: '#8B5CF6', grad: 'linear-gradient(135deg,#6D28D9,#8B5CF6)' },
    vip:      { name: 'VIP',      icon: '☀️', color: '#F59E0B', grad: 'linear-gradient(135deg,#D97706,#FBBF24)' },
    agent:    { name: '代理',     icon: '🌌', color: '#EC4899', grad: 'linear-gradient(135deg,#BE185D,#EC4899)' },
    admin:    { name: '管理员',   icon: '🌠', color: '#EF4444', grad: 'linear-gradient(135deg,#B91C1C,#F97316)' }
  };

  function tierOf(role) { return TIER_MAP[role] || TIER_MAP.guest; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDate(ts) {
    if (!ts) return '长期有效';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '长期有效';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatDateTime(ts) {
    if (!ts) return '从未同步';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '从未同步';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  function renderMemberCenter() {
    var body = document.getElementById('memberCenterBody');
    if (!body) return;
    if (Store.state.user.isLogged) renderMcLoggedIn(body);
    else renderMcGuest(body);
  }

  /* ---------- 未登录态：品牌区 + 登录/注册 + 游客模式 ---------- */
  function renderMcGuest(body) {
    var html = '';

    // 品牌区
    html += '<div class="mc-brand">';
    html += '<div class="mc-brand-logo">👑</div>';
    html += '<div class="mc-brand-name">OmniHub 会员中心</div>';
    html += '<div class="mc-brand-slogan">登录后同步数据 · 卡密激活会员等级</div>';
    html += '</div>';

    // 登录 / 注册 Tab 卡片
    html += '<div class="settings-group" style="padding:16px;">';
    html += '<div class="auth-tabs">';
    html += '<div class="auth-tab active" id="mcTabLogin">登录</div>';
    html += '<div class="auth-tab" id="mcTabRegister">注册</div>';
    html += '</div>';
    html += '<div id="mcLoginForm">';
    html += '<input type="email" id="mcLoginEmail" placeholder="邮箱" class="input-field" autocomplete="email">';
    html += '<input type="password" id="mcLoginPassword" placeholder="密码" class="input-field" autocomplete="current-password">';
    html += '<div class="auth-error" id="mcLoginError"></div>';
    html += '<button id="mcLoginBtn" class="btn-primary">登录</button>';
    html += '</div>';
    html += '<div id="mcRegisterForm" class="hidden">';
    html += '<input type="text" id="mcRegNickname" placeholder="昵称" class="input-field" autocomplete="nickname">';
    html += '<input type="email" id="mcRegEmail" placeholder="邮箱" class="input-field" autocomplete="email">';
    html += '<input type="password" id="mcRegPassword" placeholder="密码（至少 6 位）" class="input-field" autocomplete="new-password">';
    html += '<input type="password" id="mcRegPassword2" placeholder="确认密码" class="input-field" autocomplete="new-password">';
    html += '<div class="auth-error" id="mcRegError"></div>';
    html += '<button id="mcRegBtn" class="btn-primary">注册</button>';
    html += '</div>';
    html += '</div>';

    // 游客模式
    html += '<div class="auth-link" id="mcGuestLink">游客模式继续使用 ›</div>';

    body.innerHTML = html;

    var tabLogin = document.getElementById('mcTabLogin');
    var tabRegister = document.getElementById('mcTabRegister');
    var formLogin = document.getElementById('mcLoginForm');
    var formRegister = document.getElementById('mcRegisterForm');
    tabLogin.addEventListener('click', function() {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.classList.remove('hidden');
      formRegister.classList.add('hidden');
    });
    tabRegister.addEventListener('click', function() {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.classList.remove('hidden');
      formLogin.classList.add('hidden');
    });

    // 登录
    document.getElementById('mcLoginBtn').addEventListener('click', async function() {
      var errEl = document.getElementById('mcLoginError');
      errEl.textContent = '';
      var email = document.getElementById('mcLoginEmail').value.trim();
      var pw = document.getElementById('mcLoginPassword').value;
      if (!email || !pw) { errEl.textContent = '请填写邮箱和密码'; return; }
      if (!validEmail(email)) { errEl.textContent = '邮箱格式不正确'; return; }
      if (pw.length < 6) { errEl.textContent = '密码至少 6 位'; return; }
      if (typeof SB === 'undefined' || !SB.ready()) { errEl.textContent = '云服务不可用，请检查网络'; return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '登录中…';
      try {
        var r = await SB.Auth.signIn(email, pw);
        if (r.error || !r.user) { errEl.textContent = SB.errMsg(r.error || new Error('登录失败')); return; }
        SB.setPassword(pw);   // 仅内存，用于派生 Key 加密密钥
        var u = Store.state.user;
        u.id = r.user.id;
        u.isLogged = true;
        u.email = r.user.email || email;
        var meta = r.user.user_metadata || {};
        u.nickname = meta.name || meta.nickname || email.split('@')[0];
        u.username = u.nickname;
        Store.save();
        Toast.show('登录成功');
        renderProfile();
        SB.Sync.firstSync();   // 后台同步，不阻塞
      } finally {
        btn.disabled = false;
        btn.textContent = '登录';
      }
    });

    // 注册
    document.getElementById('mcRegBtn').addEventListener('click', async function() {
      var errEl = document.getElementById('mcRegError');
      errEl.textContent = '';
      var nickname = document.getElementById('mcRegNickname').value.trim();
      var email = document.getElementById('mcRegEmail').value.trim();
      var pw = document.getElementById('mcRegPassword').value;
      var pw2 = document.getElementById('mcRegPassword2').value;
      if (!nickname) { errEl.textContent = '请填写昵称'; return; }
      if (!validEmail(email)) { errEl.textContent = '邮箱格式不正确'; return; }
      if (pw.length < 6) { errEl.textContent = '密码至少 6 位'; return; }
      if (pw !== pw2) { errEl.textContent = '两次输入的密码不一致'; return; }
      if (typeof SB === 'undefined' || !SB.ready()) { errEl.textContent = '云服务不可用，请检查网络'; return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '注册中…';
      try {
        var r = await SB.Auth.signUp(email, pw, nickname);
        if (r.error) { errEl.textContent = SB.errMsg(r.error); return; }
        Toast.show('验证邮件已发送，请查收后登录');
        // 切回登录 Tab 并预填邮箱
        tabLogin.click();
        document.getElementById('mcLoginEmail').value = email;
      } finally {
        btn.disabled = false;
        btn.textContent = '注册';
      }
    });

    // 游客模式
    document.getElementById('mcGuestLink').addEventListener('click', function() {
      if (typeof App !== 'undefined' && App.closeSub) App.closeSub();
      Toast.show('游客模式：数据仅保存在本设备');
    });
  }

  /* ---------- 登录态：用户卡 + 会员卡 + 卡密激活 + 云同步 + 管理后台 + 退出 ---------- */
  function renderMcLoggedIn(body) {
    var user = Store.state.user;
    var tier = tierOf(user.role);
    var html = '';

    // 用户卡
    var name = user.nickname || user.username || user.email || '用户';
    html += '<div class="profile-card">';
    html += '<div class="profile-avatar">' + esc(name.charAt(0).toUpperCase()) + '</div>';
    html += '<div class="profile-name">' + esc(name) + '</div>';
    html += '<div class="profile-meta">' + esc(user.email) + '</div>';
    html += '<span class="badge" style="background:' + tier.color + '">' + tier.icon + ' ' + tier.name + '</span>';
    html += '</div>';

    // 会员卡
    html += '<div class="member-card" style="background:' + tier.grad + '">';
    html += '<div class="member-card-head"><span class="member-card-tier">' + tier.icon + ' ' + tier.name + '</span><span class="member-card-label">OmniHub Member</span></div>';
    html += '<div class="member-card-expire">到期时间：' + formatDate(user.planExpiresAt) + '</div>';
    var quota = Number(user.storageQuotaMb) || 0;
    var used = Number(user.storageUsedMb) || 0;
    if (quota <= 0) {
      html += '<div class="storage-text"><span>存储用量</span><span>--</span></div>';
    } else {
      var pct = Math.min(100, Math.round(used / quota * 100));
      html += '<div class="storage-bar"><div class="storage-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="storage-text"><span>存储用量</span><span>' + used + ' / ' + quota + ' MB</span></div>';
    }
    html += '</div>';

    // 卡密激活
    html += '<div class="settings-group" style="padding:16px;">';
    html += '<div class="settings-group-title" style="padding:0 0 8px;">卡密激活</div>';
    html += '<div class="cardkey-row">';
    html += '<input type="text" id="mcCardKey" class="input-field" placeholder="TP-XXXX-XXXX-XXXX" autocapitalize="characters">';
    html += '<button id="mcRedeemBtn" class="btn-primary">激活</button>';
    html += '</div>';
    html += '<div class="auth-error" id="mcCardError"></div>';
    html += '</div>';

    // 云同步
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">云同步</div>';
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">☁️</div><span class="settings-row-text">自动同步设置</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (user.cloudSync ? 'on' : '') + '" id="mcCloudSyncToggle"></div></div>';
    html += '</div>';
    html += '<div class="settings-row" id="mcSyncNowRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🔄</div><div><div class="settings-row-text">立即同步</div><div class="settings-row-desc" id="mcLastSync">上次同步：' + formatDateTime(user.lastSyncAt) + '</div></div></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>';
    html += '</div>';
    html += '</div>';

    // 管理后台入口（仅管理员）
    if (user.role === 'admin' || user.isAdmin === true) {
      html += '<div class="settings-group">';
      html += '<div class="settings-row" id="mcAdminRow">';
      html += '<div class="settings-row-left"><div class="settings-row-icon">🛠</div><div><div class="settings-row-text">管理后台</div><div class="settings-row-desc">会员/代理/数据统计</div></div></div>';
      html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>';
      html += '</div>';
      html += '</div>';
    }

    // 退出登录
    html += '<div class="settings-group">';
    html += '<div class="settings-row" id="mcLogoutRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🚪</div><span class="settings-row-text" style="color:var(--danger)">退出登录</span></div>';
    html += '</div>';
    html += '</div>';

    body.innerHTML = html;

    // 卡密激活：verify → confirm → redeem
    document.getElementById('mcRedeemBtn').addEventListener('click', async function() {
      var errEl = document.getElementById('mcCardError');
      errEl.textContent = '';
      var key = document.getElementById('mcCardKey').value.trim();
      if (!key) { errEl.textContent = '请输入卡密'; return; }
      if (typeof SB === 'undefined' || !SB.ready()) { errEl.textContent = '云服务不可用，请检查网络'; return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '验证中…';
      try {
        var v = await SB.verifyCard(key);
        if (!confirm(describeCard(v, key))) return;
        btn.textContent = '兑换中…';
        await SB.redeemCard(key);
        await SB.getMembership();   // 刷新会员信息
        renderProfile();
        Toast.show('已升级为 ' + tierOf(Store.state.user.role).name);
      } catch (e) {
        errEl.textContent = SB.errMsg(e);
      } finally {
        btn.disabled = false;
        btn.textContent = '激活';
      }
    });

    // 立即同步
    document.getElementById('mcSyncNowRow').addEventListener('click', async function() {
      if (typeof SB === 'undefined' || !SB.ready()) return Toast.show('云服务不可用，请检查网络', 'error');
      var desc = document.getElementById('mcLastSync');
      if (desc) desc.textContent = '同步中…';
      try {
        var r = await SB.Sync.syncNow();
        if (r && r.ok === false && !r.skipped) Toast.show('同步失败：' + SB.errMsg(r.error), 'error');
        else Toast.show('同步完成');
      } catch (e) {
        Toast.show('同步失败：' + SB.errMsg(e), 'error');
      }
      renderProfile();
    });

    // 管理后台
    var adminRow = document.getElementById('mcAdminRow');
    if (adminRow) {
      adminRow.addEventListener('click', function() {
        window.open('https://smalluniverseheng.github.io/AI-admin/');
      });
    }

    // 退出登录
    document.getElementById('mcLogoutRow').addEventListener('click', function() {
      if (!confirm('确定退出登录？本地数据将保留')) return;
      if (typeof SB !== 'undefined') SB.Auth.signOut();
      // 清空会话字段，保留本地数据
      var u = Store.state.user;
      u.isLogged = false;
      u.id = '';
      u.username = '';
      u.email = '';
      u.token = '';
      u.nickname = '';
      u.role = 'guest';
      u.plan = '';
      u.planExpiresAt = 0;
      u.balance = 0;
      u.storageUsedMb = 0;
      u.storageQuotaMb = 0;
      u.isAdmin = false;
      u.memberLevel = 0;
      u.memberExpire = 0;
      u.cloudSync = false;
      u.lastSyncAt = 0;
      Store.save();
      Toast.show('已退出登录');
      renderProfile();
    });
  }

  /* 卡面信息确认文案（字段宽容：Worker 返回结构以实际为准） */
  function describeCard(v, key) {
    var c = (v && (v.card || v.data || v.card_key_info)) || v || {};
    var msg = '卡密信息确认\n\n';
    msg += '卡密：' + (c.card_key || c.key || key) + '\n';
    var lv = c.level || c.plan || c.role || c.tier || c.target_role;
    if (lv) msg += '等级：' + (tierOf(lv).name) + '\n';
    var days = c.days || c.duration_days || c.valid_days;
    if (days) msg += '时长：' + days + ' 天\n';
    var amount = c.amount || c.balance || c.value || c.face_value;
    if (amount) msg += '面额：' + amount + '\n';
    if (c.remark || c.note) msg += '备注：' + (c.remark || c.note) + '\n';
    msg += '\n确认激活该卡密？';
    return msg;
  }

  function renderModuleManage() {
    var body = document.getElementById('moduleManageBody');
    if (!body) return;
    var t = I18n.t.bind(I18n);

    var allModules = [
      { id: 'read', name: t('reading'), icon: '📚', desc: t('novelAndComic') },
      { id: 'chat', name: t('chat'), icon: '💬', desc: t('aiChat') }
    ];

    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('modules') + '</div>';
    allModules.forEach(function(m) {
      var enabled = Store.state.modules[m.id] && Store.state.modules[m.id].enabled;
      html += '<div class="settings-row" data-module="' + m.id + '">';
      html += '<div class="settings-row-left"><div class="settings-row-icon">' + m.icon + '</div><div><div class="settings-row-text">' + m.name + '</div><div class="settings-row-desc">' + m.desc + '</div></div></div>';
      html += '<div class="settings-row-right"><div class="toggle-switch ' + (enabled ? 'on' : '') + '" data-module-toggle="' + m.id + '"></div></div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('homePage') + '</div>';
    html += '<div class="settings-row" id="setHomePageRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🏠</div><span class="settings-row-text">' + t('selectHomePage') + '</span></div>';
    html += '<div class="settings-row-right" id="setHomePageValue">' + getPageName(Store.state.homePage) + '</div>';
    html += '</div></div>';

    body.innerHTML = html;

    document.querySelectorAll('[data-module-toggle]').forEach(function(toggle) {
      toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var moduleId = this.dataset.moduleToggle;
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.modules[moduleId].enabled = on;

        if (on) {
          var names = { read: t('reading'), chat: t('chat') };
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
        Toast.show(on ? m.name + ' ' + t('enabled') : m.name + ' ' + t('enabled'));
      });
    });

    var homeRow = document.getElementById('setHomePageRow');
    if (homeRow) {
      homeRow.addEventListener('click', function() {
        var enabledPages = Store.state.navItems.filter(function(n) { return n.enabled; }).map(function(n) { return n.id; });
        var msg = t('selectHomePage') + ':\n';
        enabledPages.forEach(function(id, i) { msg += i + '. ' + getPageName(id) + '\n'; });
        var choice = prompt(msg);
        var idx = parseInt(choice);
        if (!isNaN(idx) && enabledPages[idx]) {
          Store.state.homePage = enabledPages[idx];
          Store.save();
          var val = document.getElementById('setHomePageValue');
          if (val) val.textContent = getPageName(enabledPages[idx]);
          Toast.show(t('saved'));
        }
      });
    }
  }

  function renderDataManage() {
    var body = document.getElementById('dataManageBody');
    if (!body) return;
    var t = I18n.t.bind(I18n);

    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('exportData') + '</div>';
    html += '<div class="settings-row" id="exportDataRow"><div class="settings-row-left"><div class="settings-row-icon">📤</div><span class="settings-row-text">' + t('exportData') + '</span></div></div>';
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('importData') + '</div>';
    html += '<div class="import-box">';
    html += '<textarea id="importDataInput" placeholder="' + t('importData') + '..." class="textarea-field"></textarea>';
    html += '<button id="importDataBtn" class="btn-primary">' + t('importData') + '</button>';
    html += '</div></div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title" style="color:var(--danger)">Danger</div>';
    html += '<div class="settings-row" id="resetDataRow"><div class="settings-row-left"><div class="settings-row-icon">⚠️</div><span class="settings-row-text">' + t('resetData') + '</span></div></div>';
    html += '</div>';

    body.innerHTML = html;

    document.getElementById('exportDataRow').addEventListener('click', function() {
      var data = Store.exportData();
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'omnihub_backup_' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      Toast.show(t('dataExported'));
    });

    document.getElementById('importDataBtn').addEventListener('click', function() {
      var input = document.getElementById('importDataInput').value.trim();
      if (!input) return Toast.show(t('fillAll'), 'error');
      if (Store.importData(input)) {
        Toast.show(t('dataImported'));
      } else {
        Toast.show(t('invalidData'), 'error');
      }
    });

    document.getElementById('resetDataRow').addEventListener('click', function() {
      if (confirm(t('confirmReset'))) {
        Store.reset();
        Toast.show(t('dataReset'));
        location.reload();
      }
    });
  }

  function renderGlobalSettings() {
    var body = document.getElementById('globalSettingsBody');
    if (!body) return;
    var t = I18n.t.bind(I18n);
    var currentTheme = Store.state.settings.theme || 'dark';
    var currentLang = Store.state.settings.language || 'zh';

    var themes = [
      { id: 'dark', name: t('dark'), icon: '🌙' },
      { id: 'light', name: t('light'), icon: '☀️' },
      { id: 'system', name: t('followSystem'), icon: '📱' }
    ];

    var langs = [
      { id: 'zh', name: '简体中文' },
      { id: 'en', name: 'English' },
      { id: 'fr', name: 'Français' },
      { id: 'ru', name: 'Русский' },
      { id: 'es', name: 'Español' },
      { id: 'ar', name: 'العربية' }
    ];

    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('theme') + '</div>';
    themes.forEach(function(th) {
      html += '<div class="settings-row theme-option ' + (currentTheme === th.id ? 'active' : '') + '" data-theme="' + th.id + '">';
      html += '<div class="settings-row-left"><div class="settings-row-icon">' + th.icon + '</div><span class="settings-row-text">' + th.name + '</span></div>';
      html += '<div class="settings-row-right">' + (currentTheme === th.id ? '✓' : '') + '</div></div>';
    });
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('language') + '</div>';
    langs.forEach(function(l) {
      html += '<div class="settings-row lang-option ' + (currentLang === l.id ? 'active' : '') + '" data-lang="' + l.id + '">';
      html += '<div class="settings-row-left"><span class="settings-row-text">' + l.name + '</span></div>';
      html += '<div class="settings-row-right">' + (currentLang === l.id ? '✓' : '') + '</div></div>';
    });
    html += '</div>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('settings') + '</div>';
    html += '<div class="settings-row" id="fabSnapRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🧲</div><span class="settings-row-text">' + t('fabSnap') + '</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.fabSnap ? 'on' : '') + '" id="fabSnapToggle"></div></div></div>';
    html += '<div class="settings-row" id="notifRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🔔</div><span class="settings-row-text">' + t('notifications') + '</span></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.notifications ? 'on' : '') + '" id="notifToggle"></div></div></div>';
    html += '</div>';

    body.innerHTML = html;

    // 主题切换
    document.querySelectorAll('.theme-option').forEach(function(row) {
      row.addEventListener('click', function() {
        var theme = this.dataset.theme;
        Theme.apply(theme);
        Store.state.settings.theme = theme;
        Store.save();
        document.querySelectorAll('.theme-option').forEach(function(r) {
          r.classList.toggle('active', r.dataset.theme === theme);
          var right = r.querySelector('.settings-row-right');
          if (right) right.textContent = r.dataset.theme === theme ? '✓' : '';
        });
        Toast.show(t('saved'));
      });
    });

    // 语言切换
    document.querySelectorAll('.lang-option').forEach(function(row) {
      row.addEventListener('click', function() {
        var lang = this.dataset.lang;
        I18n.setLang(lang);
        document.querySelectorAll('.lang-option').forEach(function(r) {
          r.classList.toggle('active', r.dataset.lang === lang);
          var right = r.querySelector('.settings-row-right');
          if (right) right.textContent = r.dataset.lang === lang ? '✓' : '';
        });
        renderProfile(); // 重新渲染以更新语言
        Toast.show(t('saved'));
      });
    });

    // 悬浮球吸附
    var fabSnap = document.getElementById('fabSnapToggle');
    if (fabSnap) {
      fabSnap.addEventListener('click', function(e) {
        e.stopPropagation();
        var on = !this.classList.contains('on');
        this.classList.toggle('on', on);
        Store.state.settings.fabSnap = on;
        Store.save();
      });
    }

    // 通知
    var notif = document.getElementById('notifToggle');
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
