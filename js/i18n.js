/* ==================== OmniHub I18n - 多语言 + 全局动效 ==================== */
/* 契约：
     I18n.register(ns, dict)   dict = { 'zh-CN': {k:v}, 'en': {...}, 'fr','ru','es','ar' }
     I18n.t('ns.key', vars)    回退顺序：当前语 → zh-CN → en → key 本身；vars 支持 {name} 插值
     I18n.setLang(lang)        写 Store.state.settings.language + <html lang> + dir(ar=rtl) + EventBus.emit('i18n:changed')
     I18n.lang()               当前语言
   本文件同时承载全局动效引导（P1-2）：主题淡切 / 全局涟漪 / Toast 增强。 */

const I18n = (() => {
  'use strict';

  var DEFAULT_LANG = 'zh-CN';
  var dicts = Object.create(null);  // ns -> { lang: { key: value } }

  /* 注册命名空间字典；同 ns 多次注册按语言合并 */
  function register(ns, dict) {
    if (!ns || !dict) return;
    if (!dicts[ns]) dicts[ns] = Object.create(null);
    for (var lang in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, lang)) continue;
      if (!dicts[ns][lang]) dicts[ns][lang] = {};
      var table = dict[lang] || {};
      for (var k in table) {
        if (Object.prototype.hasOwnProperty.call(table, k)) dicts[ns][lang][k] = table[k];
      }
    }
  }

  function lang() {
    try {
      return (typeof Store !== 'undefined' && Store.state.settings.language) || DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function lookup(ns, key, langCode) {
    var nsDict = dicts[ns];
    if (!nsDict) return undefined;
    // 精确语言 → 语言主区（如 fr-CA → fr）
    var table = nsDict[langCode] || nsDict[String(langCode).split('-')[0]];
    if (table && table[key] !== undefined) return table[key];
    return undefined;
  }

  /* 取词：'ns.key'；不带命名空间时在全部 ns 中按注册顺序查找 */
  function t(fullKey, vars) {
    var key = String(fullKey);
    var ns = '', k = key;
    var dot = key.indexOf('.');
    if (dot > 0) { ns = key.slice(0, dot); k = key.slice(dot + 1); }

    var val;
    if (ns) {
      val = lookup(ns, k, lang());
      if (val === undefined) val = lookup(ns, k, DEFAULT_LANG);
      if (val === undefined) val = lookup(ns, k, 'en');
    } else {
      for (var regNs in dicts) {
        val = lookup(regNs, k, lang());
        if (val === undefined) val = lookup(regNs, k, DEFAULT_LANG);
        if (val === undefined) val = lookup(regNs, k, 'en');
        if (val !== undefined) break;
      }
    }
    if (val === undefined) val = key;  // 最终回退：key 本身

    if (vars && typeof val === 'string') {
      val = val.replace(/\{(\w+)\}/g, function(m, name) {
        return vars[name] !== undefined ? String(vars[name]) : m;
      });
    }
    return val;
  }

  function setLang(l) {
    if (!l) return;
    try {
      Store.state.settings.language = l;
      Store.save();
    } catch (e) { console.error('[I18n] 写入语言失败:', e); }
    try {
      document.documentElement.lang = l;
      // 阿拉伯语全局 RTL，其余 LTR
      document.documentElement.dir = (l === 'ar') ? 'rtl' : 'ltr';
    } catch (e) {}
    if (typeof EventBus !== 'undefined') EventBus.emit('i18n:changed', { lang: l });
  }

  /* ==================== 内置 common 命名空间（六语） ==================== */
  register('common', {
    'zh-CN': {
      ok: '确定', cancel: '取消', save: '保存', delete: '删除', edit: '编辑',
      search: '搜索', loading: '加载中…', networkError: '网络错误', unknownError: '未知错误',
      back: '返回', confirm: '确认', settings: '设置'
    },
    'en': {
      ok: 'OK', cancel: 'Cancel', save: 'Save', delete: 'Delete', edit: 'Edit',
      search: 'Search', loading: 'Loading…', networkError: 'Network error', unknownError: 'Unknown error',
      back: 'Back', confirm: 'Confirm', settings: 'Settings'
    },
    'fr': {
      ok: 'OK', cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer', edit: 'Modifier',
      search: 'Rechercher', loading: 'Chargement…', networkError: 'Erreur réseau', unknownError: 'Erreur inconnue',
      back: 'Retour', confirm: 'Confirmer', settings: 'Paramètres'
    },
    'ru': {
      ok: 'ОК', cancel: 'Отмена', save: 'Сохранить', delete: 'Удалить', edit: 'Изменить',
      search: 'Поиск', loading: 'Загрузка…', networkError: 'Ошибка сети', unknownError: 'Неизвестная ошибка',
      back: 'Назад', confirm: 'Подтвердить', settings: 'Настройки'
    },
    'es': {
      ok: 'OK', cancel: 'Cancelar', save: 'Guardar', delete: 'Eliminar', edit: 'Editar',
      search: 'Buscar', loading: 'Cargando…', networkError: 'Error de red', unknownError: 'Error desconocido',
      back: 'Volver', confirm: 'Confirmar', settings: 'Ajustes'
    },
    'ar': {
      ok: 'حسناً', cancel: 'إلغاء', save: 'حفظ', delete: 'حذف', edit: 'تعديل',
      search: 'بحث', loading: 'جارٍ التحميل…', networkError: 'خطأ في الشبكة', unknownError: 'خطأ غير معروف',
      back: 'رجوع', confirm: 'تأكيد', settings: 'الإعدادات'
    }
  });

  return { register: register, t: t, setLang: setLang, lang: lang };
})();

/* ==================== 全局动效引导（主题淡切 / 涟漪 / Toast 增强） ==================== */
const GlobalFX = (() => {
  'use strict';

  /* ---- 主题切换淡切：#app opacity 1→0.5(150ms)→1(150ms) ---- */
  var themeFading = false;
  function themeFade() {
    var app = document.getElementById('app');
    if (!app || themeFading) return;
    themeFading = true;
    app.style.transition = 'opacity 0.15s ease';
    app.style.opacity = '0.5';
    setTimeout(function() {
      app.style.opacity = '1';
      setTimeout(function() {
        app.style.transition = '';
        app.style.opacity = '';
        themeFading = false;
      }, 150);
    }, 150);
  }

  var lastTheme = null;
  function bindThemeFade() {
    // 双通道：EventBus 'theme:changed' 优先，Store 订阅兜底（profile.js 的 Theme.apply 只写 Store）
    if (typeof EventBus !== 'undefined') {
      EventBus.on('theme:changed', themeFade);
    }
    if (typeof Store !== 'undefined' && Store.subscribe) {
      // Store 按顶层路径通知（settings 任意键变化都会触发），这里自行比对 theme 值过滤
      try { lastTheme = Store.state.settings.theme; } catch (e) {}
      Store.subscribe('settings.theme', function() {
        var cur;
        try { cur = Store.state.settings.theme; } catch (e) { return; }
        if (cur === lastTheme) return;
        lastTheme = cur;
        themeFade();
      });
    }
  }

  /* ---- 全局涟漪：pointerdown 委托 ---- */
  var RIPPLE_SELECTOR = '.btn, .btn-primary, .icon-btn, button, .source-tab, .read-nav-item, .back-btn, .fab-module-item, .settings-row, .reader-float-btn, .novel-action';
  function bindRipple() {
    document.addEventListener('pointerdown', function(e) {
      var el = e.target && e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
      if (!el || el.disabled) return;
      spawnRipple(el, e);
    }, { passive: true });
  }

  function spawnRipple(el, e) {
    try {
      var rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // 宿主需要裁剪溢出；static 元素才补 relative（fixed/absolute 元素不能动 position，如 .fab-trigger）
      el.classList.add('oh-ripple-host');
      var pos = window.getComputedStyle ? window.getComputedStyle(el).position : '';
      if (pos === 'static' || pos === '') el.classList.add('oh-ripple-rel');
      var size = Math.max(rect.width, rect.height);
      var x = (e.clientX != null ? e.clientX : rect.left + rect.width / 2) - rect.left - size / 2;
      var y = (e.clientY != null ? e.clientY : rect.top + rect.height / 2) - rect.top - size / 2;
      var span = document.createElement('span');
      span.className = 'oh-ripple';
      span.style.width = size + 'px';
      span.style.height = size + 'px';
      span.style.left = x + 'px';
      span.style.top = y + 'px';
      el.appendChild(span);
      setTimeout(function() { span.remove(); }, 450);
    } catch (err) {}
  }

  /* ---- Toast 增强：底部滑出 + 2s 停留；新增 Toast.banner 顶部横幅（5s 进度条） ---- */
  function enhanceToast() {
    if (typeof Toast === 'undefined') return;
    Toast.show = function(msg, type) {
      var container = document.getElementById('toastContainer');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'toast ' + (type || '');
      toast.textContent = msg;
      container.appendChild(toast);
      // 底部滑入：translateY(100%)→0 + opacity 0→1
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { toast.classList.add('show'); });
      });
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
      }, 2000);
    };

    Toast.banner = function(msg) {
      var old = document.querySelector('.toast-banner');
      if (old) old.remove();
      var banner = document.createElement('div');
      banner.className = 'toast-banner';
      var text = document.createElement('div');
      text.className = 'toast-banner-text';
      text.textContent = msg;
      var bar = document.createElement('div');
      bar.className = 'toast-banner-bar';
      banner.appendChild(text);
      banner.appendChild(bar);
      document.body.appendChild(banner);
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { banner.classList.add('show'); });
      });
      var timer = setTimeout(function() { dismiss(); }, 5000);
      function dismiss() {
        clearTimeout(timer);
        banner.classList.remove('show');
        setTimeout(function() { banner.remove(); }, 300);
      }
      banner.addEventListener('click', dismiss);
    };
  }

  function init() {
    bindThemeFade();
    bindRipple();
    enhanceToast();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { themeFade: themeFade };
})();
