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
      fillAll: '请填写用户名和密码', invalidData: '数据格式错误', developing: '开发中',
      account: '账号', disclaimer: '免责声明', trash: '回收站'
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
      fillAll: 'Please fill in username and password', invalidData: 'Invalid data format', developing: 'Developing',
      account: 'Account', disclaimer: 'Disclaimer', trash: 'Trash'
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
      invalidData: 'Format invalide', developing: 'En développement',
      account: 'Compte', disclaimer: 'Avertissement', trash: 'Corbeille'
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
      invalidData: 'Неверный формат', developing: 'В разработке',
      account: 'Аккаунт', disclaimer: 'Отказ от ответственности', trash: 'Корзина'
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
      invalidData: 'Formato inválido', developing: 'En desarrollo',
      account: 'Cuenta', disclaimer: 'Aviso legal', trash: 'Papelera'
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
      invalidData: 'تنسيق غير صالح', developing: 'قيد التطوير',
      account: 'الحساب', disclaimer: 'إخلاء المسؤولية', trash: 'سلة المحذوفات'
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

/* 免责声明全文（关于页 + 首次打开强制弹窗共用） */
const DISCLAIMER_TEXT =
  'OmniHub 是一款聚合多种网络服务的工具平台，为用户提供 AI 对话、网络阅读、内容管理等便捷功能。' +
  '当您使用 AI 对话功能时，OmniHub 会将您的请求通过您自行配置的 API Key 转发至相应的第三方 AI 服务提供商（如 OpenAI、Anthropic、Kimi、DeepSeek 等）。' +
  '各第三方服务返回的内容与 OmniHub 无关，OmniHub 对其准确性、合法性、及时性概不负责，亦不承担任何法律责任。' +
  '当您使用阅读功能时，OmniHub 会将您所使用的书源规则将书名、作者等信息以关键词的形式提交到各个第三方网络文学网站。' +
  '各第三方网站返回的内容与 OmniHub 无关，OmniHub 对其概不负责，亦不承担任何法律责任。' +
  '任何通过使用 OmniHub 而链接到的第三方网页均系他人制作或提供，您可能从第三方网页上获得其他服务，OmniHub 对其合法性概不负责，亦不承担任何法律责任。' +
  '用户通过 OmniHub 访问的所有第三方内容（包括但不限于 AI 生成内容、小说、漫画、视频等）的版权归原内容提供者所有。' +
  'OmniHub 仅提供技术解析和展示，不存储、不上传、不传播任何受版权保护的内容。' +
  '用户应自行承担使用 OmniHub 及相关第三方服务的风险。' +
  '因使用 OmniHub 或第三方服务而产生的任何直接、间接、偶然、特殊及后续的损害，OmniHub 概不负责。' +
  '未成年人请在监护人指导下使用本平台。';

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

    // 用户信息卡片（点击进会员中心；头像点击换头像）
    var displayName = user.isLogged ? (user.nickname || user.username || user.email || t('loggedIn')) : t('notLogged');
    html += '<div class="profile-card" data-sub="subMemberCenter" style="cursor:pointer;">';
    html += '<div class="profile-avatar" id="profileAvatarBtn">' + avatarInnerHtml(user, displayName) + '</div>';
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
    html += '<div class="settings-row" id="profileTrashRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">♻️</div><span class="settings-row-text">' + t('trash') + '</span></div>';
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
    html += '<div class="settings-row" data-sub="subAbout">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📄</div><span class="settings-row-text">' + t('disclaimer') + '</span></div>';
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
    renderErrorLog();
    renderAbout();
  }

  /* 头像内容：自定义头像 > 昵称首字符（已登录）> 平台 Logo（游客） */
  function avatarInnerHtml(user, displayName) {
    if (user.avatar && /^data:/.test(user.avatar)) {
      return '<img src="' + esc(user.avatar) + '" alt="avatar">';
    }
    if (user.isLogged && displayName) return esc(displayName.charAt(0).toUpperCase());
    return '<img src="assets/brand.jpg" alt="OmniHub">';
  }

  /* 更新日志：默认倒序（最新在前）且只展开最新版本；点击标题折叠/展开；major 高亮 */
  var changelogDesc = true;

  function renderChangelog() {
    var body = document.getElementById('changelogBody');
    if (!body) return;
    if (typeof CHANGELOG === 'undefined' || !CHANGELOG.length) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无更新日志</div></div>';
      return;
    }
    var list = CHANGELOG.slice();
    if (changelogDesc) list.reverse();

    var html = '';
    html += '<div class="changelog-toolbar">';
    html += '<button id="changelogOrderBtn">' + (changelogDesc ? '倒序 ↓' : '正序 ↑') + '</button>';
    html += '</div>';
    // 最新版本（数组时间升序，最后一项）默认展开，其余折叠
    var latestVersion = CHANGELOG[CHANGELOG.length - 1].version;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var open = item.version === latestVersion;
      html += '<div class="changelog-card' + (item.major ? ' major' : '') + (open ? ' open' : '') + '" data-ver="' + esc(item.version) + '">';
      html += '<div class="changelog-head">';
      html += '<span class="changelog-ver">v' + esc(item.version) + (item.major ? '<span class="changelog-major-tag">Major</span>' : '') + '</span>';
      html += '<span class="changelog-date">' + esc(item.date) + '<span class="changelog-arrow">›</span></span>';
      html += '</div>';
      html += '<div class="changelog-collapse">';
      html += '<ul class="changelog-list">';
      var items = item.changes || item.items || [];
      for (var j = 0; j < items.length; j++) {
        html += '<li>' + esc(items[j]) + '</li>';
      }
      html += '</ul></div></div>';
    }
    body.innerHTML = html;

    document.getElementById('changelogOrderBtn').addEventListener('click', function() {
      changelogDesc = !changelogDesc;
      renderChangelog();
    });
    body.querySelectorAll('.changelog-head').forEach(function(head) {
      head.addEventListener('click', function() {
        var card = head.parentNode;
        var collapse = card.querySelector('.changelog-collapse');
        if (card.classList.contains('open')) {
          collapse.style.maxHeight = collapse.scrollHeight + 'px';
          requestAnimationFrame(function() { collapse.style.maxHeight = '0px'; });
          card.classList.remove('open');
        } else {
          collapse.style.maxHeight = collapse.scrollHeight + 'px';
          card.classList.add('open');
          collapse.addEventListener('transitionend', function te() {
            if (card.classList.contains('open')) collapse.style.maxHeight = 'none';
            collapse.removeEventListener('transitionend', te);
          });
        }
      });
    });
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
        if (toggle.id === 'mcCloudSyncToggle' || toggle.id === 'dmCloudSyncToggle') {
          Store.state.user.cloudSync = on;
          Store.save();
          Toast.show(on ? '云同步已开启' : '云同步已关闭');
          if (on && typeof SB !== 'undefined') SB.Sync.schedulePush();
          renderDataManage();
          renderMemberCenter();
        }
        if (toggle.id === 'dmErrorLogToggle') {
          Store.state.settings.errorLogEnabled = on;
          Store.save();
          Toast.show(on ? '设备日志上报已开启' : '设备日志上报已关闭');
          if (on && typeof SB !== 'undefined' && SB.uploadErrorLogs) {
            SB.uploadErrorLogs().then(function() { renderErrorLog(); }).catch(function() {});
          }
        }
        return;
      }

      // 清除缓存
      if (e.target.closest('#clearCacheRow') || e.target.closest('#dmClearCacheRow')) {
        if (confirm(I18n.t('confirmClear'))) {
          localStorage.removeItem('omnihub_cache');
          Toast.show(I18n.t('cacheCleared'));
        }
        return;
      }

      // 回收站总入口（profile 主页 / 数据管理页）
      if (e.target.closest('#profileTrashRow') || e.target.closest('#dmTrashRow')) {
        openTrashChooser();
        return;
      }
    });

    // 头像点击（捕获阶段拦截，避免触发卡片的 data-sub 跳转）
    document.addEventListener('click', function(e) {
      var av = e.target.closest('#profileAvatarBtn, #mcAvatarBtn');
      if (av) {
        e.stopPropagation();
        e.preventDefault();
        openAvatarSheet();
      }
    }, true);
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

  /* 宇宙主题付费成长等级（与角色 TIER_MAP 并存不冲突） */
  var LEVEL_MAP = [
    { lv: 1, name: '陨石', icon: '☄️', color: '#9CA3AF', grad: 'linear-gradient(135deg,#4B5563,#9CA3AF)' },
    { lv: 2, name: '彗星', icon: '🌠', color: '#60A5FA', grad: 'linear-gradient(135deg,#1D4ED8,#60A5FA)' },
    { lv: 3, name: '卫星', icon: '🛰️', color: '#34D399', grad: 'linear-gradient(135deg,#059669,#34D399)' },
    { lv: 4, name: '行星', icon: '🪐', color: '#A78BFA', grad: 'linear-gradient(135deg,#6D28D9,#A78BFA)' },
    { lv: 5, name: '恒星', icon: '☀️', color: '#FBBF24', grad: 'linear-gradient(135deg,#D97706,#FDE68A)' },
    { lv: 6, name: '黑洞', icon: '🕳️', color: '#F472B6', grad: 'linear-gradient(135deg,#111827,#7C3AED)' }
  ];

  function levelOf(user) {
    var key = (user.role || 'guest').toLowerCase();
    var plan = String(user.plan || '');
    if (/顶级|vip/i.test(plan)) key = 'vip';
    else if (/高级|advanced/i.test(plan)) key = 'advanced';
    else if (/普通|basic|user/i.test(plan)) key = 'user';
    switch (key) {
      case 'admin': case 'agent': return LEVEL_MAP[5];
      case 'vip': return LEVEL_MAP[4];
      case 'advanced': return LEVEL_MAP[3];
      case 'user': return LEVEL_MAP[1];
      default: return LEVEL_MAP[0];
    }
  }

  /* 等级进度：当前等级 → 下一级（按到期天数，其次按余额/成长值） */
  function levelProgress(user) {
    var lv = levelOf(user).lv;
    if (lv >= 6) return 100;
    var pct = 5;
    var now = Date.now();
    if (user.planExpiresAt && user.planExpiresAt > now) {
      pct = Math.min(100, Math.max(10, Math.round((user.planExpiresAt - now) / (365 * 24 * 3600 * 1000) * 100)));
    } else if (user.balance > 0) {
      pct = Math.min(100, Math.max(10, Math.round(user.balance)));
    }
    return pct;
  }

  /* 会员计划（月付价；年付 = 月价 × 12 × 0.8） */
  var PLAN_CARDS = [
    { id: 'basic',    name: '普通会员', price: 10, quotaMb: 1024,  roles: ['user'],               feats: ['1GB 云存储空间'] },
    { id: 'advanced', name: '高级会员', price: 20, quotaMb: 5120,  roles: ['advanced'],           feats: ['5GB 云存储空间', '300 次/月云端代理'] },
    { id: 'vip',      name: '顶级会员', price: 50, quotaMb: 10240, roles: ['vip', 'agent', 'admin'], feats: ['10GB 云存储空间', '3000 次/月云端代理'] }
  ];
  var planCycle = 'month';   // 'month' | 'year'

  function currentPlanId() {
    var u = Store.state.user;
    if (!u.isLogged) return '';
    var role = (u.role || '').toLowerCase();
    var plan = String(u.plan || '');
    for (var i = 0; i < PLAN_CARDS.length; i++) {
      if (PLAN_CARDS[i].roles.indexOf(role) !== -1) return PLAN_CARDS[i].id;
    }
    if (/顶级|vip/i.test(plan)) return 'vip';
    if (/高级|advanced/i.test(plan)) return 'advanced';
    if (/普通|basic/i.test(plan)) return 'basic';
    return '';
  }

  /* 存储配额：云端返回优先，未返回时按套餐匹配默认配额 */
  function effectiveQuotaMb() {
    var u = Store.state.user;
    var q = Number(u.storageQuotaMb) || 0;
    if (q > 0) return q;
    var pid = currentPlanId();
    for (var i = 0; i < PLAN_CARDS.length; i++) {
      if (PLAN_CARDS[i].id === pid) return PLAN_CARDS[i].quotaMb;
    }
    return 0;
  }

  /* GB 单位换算：5120MB → 5GB，1536MB → 1.5GB */
  function fmtStorage(mb) {
    mb = Number(mb) || 0;
    if (mb >= 1024) {
      var gb = mb / 1024;
      var s = gb >= 100 ? String(Math.round(gb)) : String(Math.round(gb * 10) / 10);
      return s + ' GB';
    }
    return Math.round(mb) + ' MB';
  }

  /* ---------- 会员计划卡（三档 + 月/年切换） ---------- */
  function renderPlanCards() {
    var cur = currentPlanId();
    var html = '';
    html += '<div class="settings-group-title" style="padding:0 0 8px;">会员计划</div>';
    html += '<div class="plan-cycle-toggle">';
    html += '<button class="plan-cycle-btn' + (planCycle === 'month' ? ' active' : '') + '" data-cycle="month">按月付费</button>';
    html += '<button class="plan-cycle-btn' + (planCycle === 'year' ? ' active' : '') + '" data-cycle="year">按年付费<span class="plan-cycle-off">8折</span></button>';
    html += '</div>';
    html += '<div class="plan-grid">';
    PLAN_CARDS.forEach(function(p) {
      var price = planCycle === 'year' ? Math.round(p.price * 12 * 0.8) : p.price;
      var unit = planCycle === 'year' ? '/年' : '/月';
      html += '<div class="plan-card' + (cur === p.id ? ' current' : '') + '">';
      if (cur === p.id) html += '<div class="plan-card-badge">当前计划</div>';
      html += '<div class="plan-card-name">' + p.name + '</div>';
      html += '<div class="plan-card-price">¥' + price + '<span class="plan-card-unit">' + unit + '</span></div>';
      if (planCycle === 'year') html += '<div class="plan-card-orig">原价 ¥' + (p.price * 12) + '/年</div>';
      html += '<div class="plan-card-quota">' + fmtStorage(p.quotaMb) + ' 存储</div>';
      p.feats.forEach(function(f) { html += '<div class="plan-card-feat">· ' + f + '</div>'; });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function bindPlanCards(container) {
    container.querySelectorAll('.plan-cycle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        planCycle = this.dataset.cycle;
        renderMemberCenter();
      });
    });
  }

  /* ---------- 升级动画：徽章弹跳 + 彩纸粒子 ---------- */
  function playUpgradeAnimation() {
    var badge = document.querySelector('#memberCenterBody .member-card-tier') ||
                document.querySelector('#memberCenterBody .badge');
    if (badge) {
      badge.classList.add('levelup-pop');
      setTimeout(function() { badge.classList.remove('levelup-pop'); }, 900);
      spawnConfetti(badge);
    }
  }

  function spawnConfetti(anchor) {
    var rect = anchor.getBoundingClientRect();
    var box = document.createElement('div');
    box.className = 'confetti-box';
    document.body.appendChild(box);
    var colors = ['#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316', '#FDE047'];
    for (var i = 0; i < 28; i++) {
      var p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = (rect.left + rect.width / 2) + 'px';
      p.style.top = (rect.top + rect.height / 2) + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.15) + 's';
      p.style.animationDuration = (1.2 + Math.random() * 0.7) + 's';
      box.appendChild(p);
    }
    setTimeout(function() { box.remove(); }, 2000);
  }

  /* ---------- 头像选择弹层 ---------- */
  var AVATAR_PRESETS = ['☄️', '🌙', '🛰️', '🪐', '☀️', '🌌', '⭐', '🕳️'];
  var AVATAR_GRADS = [
    ['#4B5563', '#9CA3AF'], ['#1E3A8A', '#60A5FA'], ['#065F46', '#34D399'], ['#5B21B6', '#A78BFA'],
    ['#B45309', '#FDE68A'], ['#312E81', '#818CF8'], ['#92400E', '#FBBF24'], ['#111827', '#7C3AED']
  ];

  function openAvatarSheet() {
    closeAvatarSheet();
    var mask = document.createElement('div');
    mask.className = 'avatar-sheet-mask';
    mask.id = 'avatarSheetMask';
    var sheet = document.createElement('div');
    sheet.className = 'avatar-sheet';
    sheet.id = 'avatarSheet';
    var html = '<div class="avatar-sheet-title">选择头像</div>';
    html += '<div class="avatar-preset-grid">';
    AVATAR_PRESETS.forEach(function(em, i) {
      html += '<button class="avatar-preset" data-idx="' + i + '" style="background:linear-gradient(135deg,' + AVATAR_GRADS[i][0] + ',' + AVATAR_GRADS[i][1] + ')">' + em + '</button>';
    });
    html += '</div>';
    html += '<button class="btn-primary avatar-upload-btn" id="avatarUploadBtn">从相册上传</button>';
    html += '<input type="file" id="avatarFileInput" accept="image/' + '*" class="hidden">';
    html += '<button class="avatar-cancel" id="avatarCancel">取消</button>';
    sheet.innerHTML = html;
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        mask.classList.add('open');
        sheet.classList.add('open');
      });
    });
    mask.addEventListener('click', closeAvatarSheet);
    document.getElementById('avatarCancel').addEventListener('click', closeAvatarSheet);
    sheet.querySelectorAll('.avatar-preset').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.idx, 10);
        emojiToAvatar(AVATAR_PRESETS[idx], AVATAR_GRADS[idx]);
      });
    });
    document.getElementById('avatarUploadBtn').addEventListener('click', function() {
      document.getElementById('avatarFileInput').click();
    });
    document.getElementById('avatarFileInput').addEventListener('change', function() {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        var img = new Image();
        img.onload = function() {
          var dataUrl = imageToAvatar(img);
          if (dataUrl) saveAvatar(dataUrl);
        };
        img.onerror = function() { Toast.show('图片加载失败', 'error'); };
        img.src = reader.result;
      };
      reader.onerror = function() { Toast.show('文件读取失败', 'error'); };
      reader.readAsDataURL(file);
    });
  }

  function closeAvatarSheet() {
    var mask = document.getElementById('avatarSheetMask');
    var sheet = document.getElementById('avatarSheet');
    if (mask) mask.remove();
    if (sheet) sheet.remove();
  }

  /* emoji 预设 → 128×128 渐变底 dataURL */
  function emojiToAvatar(emoji, grad) {
    try {
      var cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      var ctx = cv.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 128, 128);
      g.addColorStop(0, grad[0]);
      g.addColorStop(1, grad[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      ctx.font = '72px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 70);
      saveAvatar(cv.toDataURL('image/png'));
    } catch (e) { Toast.show('头像生成失败', 'error'); }
  }

  /* 相册图片 → 居中裁剪 128×128 dataURL */
  function imageToAvatar(img) {
    try {
      var cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      var ctx = cv.getContext('2d');
      var side = Math.min(img.width, img.height);
      var sx = (img.width - side) / 2;
      var sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 128, 128);
      return cv.toDataURL('image/jpeg', 0.85);
    } catch (e) { return null; }
  }

  function saveAvatar(dataUrl) {
    Store.state.user.avatar = dataUrl;
    Store.save();
    closeAvatarSheet();
    renderProfile();
    Toast.show('头像已更新');
  }

  /* ---------- 回收站总入口：对话 / 阅读 选择 ---------- */
  function openTrashChooser() {
    closeTrashChooser();
    var mask = document.createElement('div');
    mask.className = 'shelf-menu-mask';
    mask.id = 'trashChooserMask';
    var menu = document.createElement('div');
    menu.className = 'shelf-menu';
    menu.id = 'trashChooserMenu';
    var html = '<div class="shelf-menu-title">回收站</div>';
    html += '<div class="shelf-menu-item" id="trashGoChat">💬 对话回收站</div>';
    html += '<div class="shelf-menu-item" id="trashGoRead">📚 阅读回收站</div>';
    html += '<div class="shelf-menu-item" id="trashChooserCancel">取消</div>';
    menu.innerHTML = html;
    document.body.appendChild(mask);
    document.body.appendChild(menu);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        mask.classList.add('open');
        menu.classList.add('open');
      });
    });
    mask.addEventListener('click', closeTrashChooser);
    document.getElementById('trashChooserCancel').addEventListener('click', closeTrashChooser);
    document.getElementById('trashGoChat').addEventListener('click', function() {
      closeTrashChooser();
      if (typeof ChatModule !== 'undefined' && ChatModule.renderChatTrash) ChatModule.renderChatTrash();
      App.openSub('subChatTrash');
    });
    document.getElementById('trashGoRead').addEventListener('click', function() {
      closeTrashChooser();
      if (typeof ReadModule !== 'undefined' && ReadModule.renderTrash) ReadModule.renderTrash();
      App.openSub('subReadTrash');
    });
  }

  function closeTrashChooser() {
    var mask = document.getElementById('trashChooserMask');
    var menu = document.getElementById('trashChooserMenu');
    if (mask) mask.remove();
    if (menu) menu.remove();
  }

  /* ---------- 设备日志子页面 ---------- */
  function renderErrorLog() {
    var body = document.getElementById('errorLogBody');
    if (!body) return;
    var logs = (Store.state.errorLog || []).slice().reverse();
    var html = '';
    html += '<div class="trash-toolbar">';
    html += '<button id="errorLogUpload">立即上传</button>';
    html += '<button id="errorLogClear" class="danger">清空日志</button>';
    html += '</div>';
    if (!logs.length) {
      html += '<div class="empty-state"><div class="empty-icon">🩺</div><div class="empty-text">暂无设备日志</div><div class="empty-sub">运行错误会自动记录（最多 50 条）</div></div>';
    } else {
      logs.forEach(function(l) {
        html += '<div class="errorlog-item">';
        html += '<div class="errorlog-time">' + formatDateTime(l.time) + (l.version ? ' · v' + esc(l.version) : '') + '</div>';
        html += '<div class="errorlog-msg">' + esc(l.message) + '</div>';
        if (l.stack) html += '<div class="errorlog-stack">' + esc(l.stack) + '</div>';
        html += '</div>';
      });
    }
    body.innerHTML = html;

    document.getElementById('errorLogUpload').addEventListener('click', function() {
      if (typeof SB === 'undefined' || !SB.uploadErrorLogs) return Toast.show('云服务不可用', 'error');
      if (!Store.state.settings.errorLogEnabled) return Toast.show('请先在数据管理页开启设备日志上报', 'error');
      Toast.show('上传中…');
      SB.uploadErrorLogs().then(function(r) {
        if (r && r.ok) Toast.show('已上传 ' + (r.uploaded || 0) + ' 条日志');
        else if (r && r.skipped) Toast.show('未开启上报开关');
        else Toast.show('上传失败，日志已保留本地', 'error');
        renderErrorLog();
      }).catch(function() { Toast.show('上传失败，日志已保留本地', 'error'); });
    });
    document.getElementById('errorLogClear').addEventListener('click', function() {
      if (confirm('清空本地设备日志？')) {
        Store.state.errorLog = [];
        Store.save();
        renderErrorLog();
        Toast.show('已清空');
      }
    });
  }

  /* ---------- 关于与免责声明子页面 ---------- */
  function renderAbout() {
    var body = document.getElementById('aboutBody');
    if (!body) return;
    var ver = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '7.8';
    var html = '<div class="settings-group" style="padding:16px;">';
    html += '<div class="about-logo"><img src="assets/brand.jpg" alt="OmniHub"></div>';
    html += '<div class="about-name">OmniHub</div>';
    html += '<div class="about-ver">v' + esc(ver) + '</div>';
    html += '</div>';
    html += '<div class="settings-group" style="padding:16px;">';
    html += '<div class="settings-group-title" style="padding:0 0 8px;">免责声明</div>';
    html += '<div class="about-disclaimer">' + esc(DISCLAIMER_TEXT) + '</div>';
    html += '</div>';
    body.innerHTML = html;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;');
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

    // 会员计划
    html += '<div class="settings-group" style="padding:16px;">';
    html += renderPlanCards();
    html += '</div>';

    body.innerHTML = html;
    bindPlanCards(body);

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

    // 用户卡（头像点击可更换）
    var name = user.nickname || user.username || user.email || '用户';
    var lv = levelOf(user);
    html += '<div class="profile-card">';
    html += '<div class="profile-avatar" id="mcAvatarBtn">' + avatarInnerHtml(user, name) + '</div>';
    html += '<div class="profile-name">' + esc(name) + '</div>';
    html += '<div class="profile-meta">' + esc(user.email) + '</div>';
    html += '<span class="badge" style="background:' + tier.color + '">' + tier.icon + ' ' + tier.name + '</span>';
    html += '<span class="badge level-badge" style="background:' + lv.grad + '">' + lv.icon + ' Lv' + lv.lv + ' ' + lv.name + '</span>';
    html += '</div>';

    // 会员卡（含付费成长等级进度条）
    html += '<div class="member-card" style="background:' + tier.grad + '">';
    html += '<div class="member-card-head"><span class="member-card-tier">' + tier.icon + ' ' + tier.name + '</span><span class="member-card-label">OmniHub Member</span></div>';
    html += '<div class="member-card-expire">到期时间：' + formatDate(user.planExpiresAt) + '</div>';
    var nextLv = lv.lv < 6 ? LEVEL_MAP[lv.lv] : null;
    var lvPct = levelProgress(user);
    html += '<div class="level-progress-wrap">';
    html += '<div class="level-progress-text"><span>' + lv.icon + ' Lv' + lv.lv + ' ' + lv.name + '</span><span>' + (nextLv ? '下一级 ' + nextLv.icon + ' ' + nextLv.name : '已达最高等级') + '</span></div>';
    html += '<div class="level-progress"><div class="level-progress-fill" style="width:' + lvPct + '%;background:' + lv.grad + '"></div></div>';
    html += '</div>';
    var quota = effectiveQuotaMb();
    var used = Number(user.storageUsedMb) || 0;
    if (quota <= 0) {
      html += '<div class="storage-text"><span>存储用量</span><span>--</span></div>';
    } else {
      var pct = Math.min(100, Math.round(used / quota * 100));
      html += '<div class="storage-bar"><div class="storage-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="storage-text"><span>存储用量</span><span>' + fmtStorage(used) + ' / ' + fmtStorage(quota) + '</span></div>';
    }
    html += '</div>';

    // 会员计划
    html += '<div class="settings-group" style="padding:16px;">';
    html += renderPlanCards();
    html += '</div>';

    // 卡密激活（25 位 5-5-5-5-5 分段格式）
    html += '<div class="settings-group" style="padding:16px;">';
    html += '<div class="settings-group-title" style="padding:0 0 8px;">卡密激活</div>';
    html += '<div class="cardkey-row">';
    html += '<input type="text" id="mcCardKey" class="input-field cardkey-input" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" maxlength="29" autocapitalize="characters" autocomplete="off" spellcheck="false">';
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
    bindPlanCards(body);

    // 卡密输入：自动大写、5-5-5-5-5 自动分段、粘贴清洗重排、限制 29 字符（含横线）
    var cardInput = document.getElementById('mcCardKey');
    cardInput.addEventListener('input', function() {
      var clean = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
      this.value = (clean.match(/[A-Z0-9]{1,5}/g) || []).join('-');
    });

    // 卡密激活：verify → confirm → redeem
    document.getElementById('mcRedeemBtn').addEventListener('click', async function() {
      var errEl = document.getElementById('mcCardError');
      errEl.textContent = '';
      var key = cardInput.value.trim();
      if (!key) { errEl.textContent = '请输入卡密'; shakeCardKey(cardInput); return; }
      if (!/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/.test(key)) {
        errEl.textContent = '卡密格式不正确，应为 25 位（5-5-5-5-5 分段）';
        shakeCardKey(cardInput);
        return;
      }
      if (typeof SB === 'undefined' || !SB.ready()) { errEl.textContent = '云服务不可用，请检查网络'; return; }
      var prevLv = levelOf(Store.state.user).lv;
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
        var newLv = levelOf(Store.state.user).lv;
        if (newLv > prevLv) playUpgradeAnimation();   // 升级动画
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
        window.open('https:/\/smalluniverseheng.github.io/AI-admin/');
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

  /* 卡密格式错误抖动提示 */
  function shakeCardKey(input) {
    input.classList.remove('shake');
    void input.offsetWidth;   // 重置动画
    input.classList.add('shake');
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
    var user = Store.state.user;

    // ① 回收站
    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('trash') + '</div>';
    html += '<div class="settings-row" id="dmTrashRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">♻️</div><div><div class="settings-row-text">' + t('trash') + '</div><div class="settings-row-desc">对话 / 阅读删除内容保留 15 天</div></div></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '</div>';

    // ② 云端同步 + 上次同步时间
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('cloudSync') + '</div>';
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">☁️</div><div><div class="settings-row-text">' + t('cloudSync') + '</div><div class="settings-row-desc">上次同步：' + formatDateTime(user.lastSyncAt) + '</div></div></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (user.cloudSync ? 'on' : '') + '" id="dmCloudSyncToggle"></div></div></div>';
    // ③ 存储空间进度条
    var quota = effectiveQuotaMb();
    var used = Number(user.storageUsedMb) || 0;
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">💽</div><div style="flex:1;min-width:0;"><div class="settings-row-text">存储空间</div>';
    if (quota > 0) {
      var pct = Math.min(100, Math.round(used / quota * 100));
      html += '<div class="storage-bar dm-storage-bar"><div class="storage-bar-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="settings-row-desc">' + fmtStorage(used) + ' / ' + fmtStorage(quota) + '</div>';
    } else {
      html += '<div class="settings-row-desc">' + (user.isLogged ? '未分配配额' : '登录后查看') + '</div>';
    }
    html += '</div></div></div>';
    html += '</div>';

    // ④ 数据导出 / 导入
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('exportData') + ' / ' + t('importData') + '</div>';
    html += '<div class="settings-row" id="exportDataRow"><div class="settings-row-left"><div class="settings-row-icon">📤</div><span class="settings-row-text">' + t('exportData') + '</span></div></div>';
    html += '<div class="import-box">';
    html += '<textarea id="importDataInput" placeholder="' + t('importData') + '..." class="textarea-field"></textarea>';
    html += '<button id="importDataBtn" class="btn-primary">' + t('importData') + '</button>';
    html += '</div></div>';

    // ⑤ 缓存清理
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">' + t('clearCache') + '</div>';
    html += '<div class="settings-row" id="dmClearCacheRow"><div class="settings-row-left"><div class="settings-row-icon">🗑️</div><span class="settings-row-text">' + t('clearCache') + '</span></div></div>';
    html += '</div>';

    // ⑥ 设备日志
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">设备日志</div>';
    html += '<div class="settings-row">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">🩺</div><div><div class="settings-row-text">错误日志上报</div><div class="settings-row-desc">本地记录 ' + ((Store.state.errorLog || []).length) + ' 条</div></div></div>';
    html += '<div class="settings-row-right"><div class="toggle-switch ' + (Store.state.settings.errorLogEnabled ? 'on' : '') + '" id="dmErrorLogToggle"></div></div></div>';
    html += '<div class="settings-row" id="dmViewLogRow" data-sub="subErrorLog">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">📋</div><span class="settings-row-text">查看本地日志</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '<div class="settings-row" id="dmUploadLogRow">';
    html += '<div class="settings-row-left"><div class="settings-row-icon">⬆️</div><span class="settings-row-text">立即上传</span></div>';
    html += '<div class="settings-row-right"><svg class="icon-chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div></div>';
    html += '</div>';

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

    // 查看日志：打开子页面前刷新列表
    document.getElementById('dmViewLogRow').addEventListener('click', function() {
      renderErrorLog();
    });

    // 设备日志：手动立即上传
    document.getElementById('dmUploadLogRow').addEventListener('click', function() {
      if (typeof SB === 'undefined' || !SB.uploadErrorLogs) return Toast.show('云服务不可用', 'error');
      if (!Store.state.settings.errorLogEnabled) return Toast.show('请先开启错误日志上报开关', 'error');
      if (!(Store.state.errorLog || []).length) return Toast.show('暂无待上传日志');
      Toast.show('上传中…');
      SB.uploadErrorLogs().then(function(r) {
        if (r && r.ok) Toast.show('已上传 ' + (r.uploaded || 0) + ' 条日志');
        else Toast.show('上传失败，日志已保留本地', 'error');
        renderDataManage();
      }).catch(function() { Toast.show('上传失败，日志已保留本地', 'error'); });
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
