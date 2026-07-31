/* ==================== OmniHub Auth · 二级密码系统 ====================
 * 一级密码 = 登录密码（SB.Auth）；二级密码 = 敏感操作验证（本模块）。
 * 算法：PBKDF2(10 万次, SHA-256) 派生 256bit，盐 16 字节 hex，
 * 存 Store.state.auth.sec（仅存盐+派生值，不存明文）。
 * 验证通过后 15 分钟内同 actionKey 免验；切换账号/退出登录清空免验。
 * 弹窗 UI 由 JS 动态创建，样式见 css/profile.css（.auth2-*）。
 */
const Auth = (() => {
  'use strict';

  var BYPASS_MS = 15 * 60 * 1000;   // 免验时长：15 分钟
  var ITER = 100000;                // PBKDF2 迭代次数
  var grants = {};                  // actionKey -> 通过时间戳（仅内存）
  var lastUid = null;               // 上次通过时的账号 ID（换号即失效）
  var modalEl = null;               // 当前弹窗 {mask, sheet}
  var i18nRegistered = false;

  /* ---------- 六语文案（I18n 存在时注册到 'auth' 命名空间，否则内嵌兜底） ---------- */
  var DICT = {
    zh: {
      setupTitle: '设置二级密码', setupDesc: '二级密码用于敏感操作验证（卡密激活、云同步、重置数据、导出数据等），请与登录密码区分并妥善保管。',
      verifyTitle: '安全验证', verifyDesc: '该操作需要验证二级密码',
      pwd: '请输入二级密码', pwd2: '请再次输入二级密码',
      confirm: '确认', cancel: '取消',
      mismatch: '两次输入的密码不一致', tooShort: '密码至少 4 位', wrong: '二级密码错误',
      setDone: '二级密码已设置', noCrypto: '当前环境不支持加密，无法使用二级密码'
    },
    en: {
      setupTitle: 'Set Secondary Password', setupDesc: 'The secondary password protects sensitive actions (card redeem, cloud sync, data reset/export). Keep it different from your login password.',
      verifyTitle: 'Security Check', verifyDesc: 'This action requires your secondary password',
      pwd: 'Enter secondary password', pwd2: 'Confirm secondary password',
      confirm: 'Confirm', cancel: 'Cancel',
      mismatch: 'Passwords do not match', tooShort: 'At least 4 characters', wrong: 'Incorrect secondary password',
      setDone: 'Secondary password set', noCrypto: 'Crypto unavailable in this environment'
    },
    fr: {
      setupTitle: 'Définir le mot de passe secondaire', setupDesc: 'Le mot de passe secondaire protège les actions sensibles (activation, sync cloud, réinitialisation/export).',
      verifyTitle: 'Vérification de sécurité', verifyDesc: 'Cette action requiert le mot de passe secondaire',
      pwd: 'Mot de passe secondaire', pwd2: 'Confirmer le mot de passe',
      confirm: 'Confirmer', cancel: 'Annuler',
      mismatch: 'Les mots de passe ne correspondent pas', tooShort: 'Au moins 4 caractères', wrong: 'Mot de passe incorrect',
      setDone: 'Mot de passe secondaire défini', noCrypto: 'Chiffrement indisponible'
    },
    ru: {
      setupTitle: 'Задайте второй пароль', setupDesc: 'Второй пароль защищает важные действия (активация карты, облачная синхронизация, сброс/экспорт данных).',
      verifyTitle: 'Проверка безопасности', verifyDesc: 'Для этого действия нужен второй пароль',
      pwd: 'Введите второй пароль', pwd2: 'Повторите второй пароль',
      confirm: 'Подтвердить', cancel: 'Отмена',
      mismatch: 'Пароли не совпадают', tooShort: 'Минимум 4 символа', wrong: 'Неверный второй пароль',
      setDone: 'Второй пароль установлен', noCrypto: 'Шифрование недоступно'
    },
    es: {
      setupTitle: 'Establecer contraseña secundaria', setupDesc: 'La contraseña secundaria protege acciones sensibles (activación, sync nube, restablecer/exportar datos).',
      verifyTitle: 'Verificación de seguridad', verifyDesc: 'Esta acción requiere la contraseña secundaria',
      pwd: 'Contraseña secundaria', pwd2: 'Confirmar contraseña',
      confirm: 'Confirmar', cancel: 'Cancelar',
      mismatch: 'Las contraseñas no coinciden', tooShort: 'Mínimo 4 caracteres', wrong: 'Contraseña incorrecta',
      setDone: 'Contraseña secundaria establecida', noCrypto: 'Cifrado no disponible'
    },
    ar: {
      setupTitle: 'تعيين كلمة المرور الثانوية', setupDesc: 'كلمة المرور الثانوية تحمي العمليات الحساسة (تفعيل البطاقة، المزامنة السحابية، إعادة تعيين/تصدير البيانات).',
      verifyTitle: 'التحقق الأمني', verifyDesc: 'هذه العملية تتطلب كلمة المرور الثانوية',
      pwd: 'أدخل كلمة المرور الثانوية', pwd2: 'أكد كلمة المرور الثانوية',
      confirm: 'تأكيد', cancel: 'إلغاء',
      mismatch: 'كلمتا المرور غير متطابقتين', tooShort: '4 أحرف على الأقل', wrong: 'كلمة المرور الثانوية خاطئة',
      setDone: 'تم تعيين كلمة المرور الثانوية', noCrypto: 'التشفير غير متاح في هذه البيئة'
    }
  };

  /* 全局 I18n（N1 提供）存在则注册；可能后加载，故在 t() 里惰性重试 */
  function ensureRegister() {
    if (i18nRegistered) return;
    if (typeof I18n !== 'undefined' && I18n && I18n.register) {
      try { I18n.register('auth', DICT); i18nRegistered = true; } catch (e) {}
    }
  }

  function t(key) {
    ensureRegister();
    try {
      if (typeof I18n !== 'undefined' && I18n && I18n.t) {
        var v = I18n.t('auth.' + key);
        if (v && v !== 'auth.' + key) return v;
        v = I18n.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    var lang = 'zh';
    try { lang = (Store.state.settings && Store.state.settings.language) || 'zh'; } catch (e) {}
    return (DICT[lang] && DICT[lang][key]) || DICT.zh[key] || key;
  }

  function toast(msg) {
    if (typeof Toast !== 'undefined' && Toast.show) Toast.show(msg);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;');
  }

  /* ---------- 加密工具 ---------- */
  function cryptoOk() { return typeof crypto !== 'undefined' && !!crypto.subtle; }

  function toHex(buf) {
    var arr = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < arr.length; i++) out += ('0' + arr[i].toString(16)).slice(-2);
    return out;
  }

  function hexToBytes(hex) {
    var arr = new Uint8Array(hex.length / 2);
    for (var i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
  }

  /* PBKDF2(10 万次, SHA-256) 派生 256bit → hex */
  async function hashPwd(pwd, saltHex, iter) {
    var mat = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pwd)), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: iter || ITER, hash: 'SHA-256' },
      mat, 256
    );
    return toHex(bits);
  }

  /* ---------- 存储（Store.state.auth.sec） ---------- */
  function secBox() {
    if (typeof Store === 'undefined') return null;
    if (!Store.state.auth) Store.state.auth = {};
    return Store.state.auth;
  }

  function isSet() {
    var box = secBox();
    return !!(box && box.sec && box.sec.hash && box.sec.salt);
  }

  /* 设置/重设二级密码；成功返回 true */
  async function setup(pwd) {
    if (!cryptoOk() || typeof Store === 'undefined') return false;
    var salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    var hash = await hashPwd(pwd, salt, ITER);
    var box = secBox();
    box.sec = { salt: salt, hash: hash, iter: ITER, v: 1, updatedAt: Date.now() };
    Store.save();
    return true;
  }

  /* 校验二级密码（内部用） */
  async function verify(pwd) {
    var box = secBox();
    if (!box || !box.sec || !cryptoOk()) return false;
    var iter = box.sec.iter || ITER;
    var hash = await hashPwd(pwd, box.sec.salt, iter);
    return hash === box.sec.hash;
  }

  /* 修改二级密码：先验旧再设新；旧密码错误返回 false */
  async function change(oldPwd, newPwd) {
    if (!isSet()) return setup(newPwd);
    var ok = await verify(oldPwd);
    if (!ok) return false;
    clearBypass();
    return setup(newPwd);
  }

  /* ---------- 免验管理 ---------- */
  function currentUid() {
    try { return (Store.state.user && Store.state.user.id) || ''; } catch (e) { return ''; }
  }

  /* 切换账号即清空免验 */
  function syncAccount() {
    var uid = currentUid();
    if (lastUid !== null && uid !== lastUid) grants = {};
    lastUid = uid;
  }

  function clearBypass() { grants = {}; }

  /* 登录成功后调用：新会话要求重新验证 */
  function onLogin() {
    grants = {};
    lastUid = currentUid();
  }

  /* ---------- 眼睛图标 SVG ---------- */
  function eyeSvg(open) {
    if (open) {
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
      '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
      '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }

  /* ---------- 弹窗（引导设置 / 验证 共用） ---------- */
  function closeModal() {
    if (modalEl) {
      if (modalEl.mask && modalEl.mask.parentNode) modalEl.mask.remove();
      if (modalEl.sheet && modalEl.sheet.parentNode) modalEl.sheet.remove();
      modalEl = null;
    }
  }

  function showModal(mode, actionKey) {
    return new Promise(function(resolve) {
      closeModal();
      var mask = document.createElement('div');
      mask.className = 'auth2-mask';
      var sheet = document.createElement('div');
      sheet.className = 'auth2-sheet';

      var html = '';
      html += '<div class="auth2-title">' + esc(t(mode === 'setup' ? 'setupTitle' : 'verifyTitle')) + '</div>';
      html += '<div class="auth2-desc">' + esc(t(mode === 'setup' ? 'setupDesc' : 'verifyDesc')) + '</div>';
      html += '<div class="auth2-field">';
      html += '<input type="password" id="auth2Pwd1" class="auth2-input" placeholder="' + esc(t('pwd')) + '" autocomplete="off">';
      html += '<button type="button" class="auth2-eye" data-eye="auth2Pwd1">' + eyeSvg(false) + '</button>';
      html += '</div>';
      if (mode === 'setup') {
        html += '<div class="auth2-field">';
        html += '<input type="password" id="auth2Pwd2" class="auth2-input" placeholder="' + esc(t('pwd2')) + '" autocomplete="off">';
        html += '<button type="button" class="auth2-eye" data-eye="auth2Pwd2">' + eyeSvg(false) + '</button>';
        html += '</div>';
      }
      html += '<div class="auth2-error" id="auth2Error"></div>';
      html += '<div class="auth2-actions">';
      html += '<button type="button" class="auth2-btn ghost" id="auth2Cancel">' + esc(t('cancel')) + '</button>';
      html += '<button type="button" class="auth2-btn primary" id="auth2Ok">' + esc(t('confirm')) + '</button>';
      html += '</div>';
      sheet.innerHTML = html;

      document.body.appendChild(mask);
      document.body.appendChild(sheet);
      modalEl = { mask: mask, sheet: sheet };
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          mask.classList.add('open');
          sheet.classList.add('open');
        });
      });

      function done(ok) {
        closeModal();
        resolve(ok);
      }
      function fail(msg, inputId) {
        var err = sheet.querySelector('#auth2Error');
        if (err) err.textContent = msg;
        var input = sheet.querySelector('#' + inputId);
        if (input) {
          input.classList.add('error');
          input.classList.remove('shake');
          void input.offsetWidth;   // 重置抖动动画
          input.classList.add('shake');
        }
      }

      mask.addEventListener('click', function() { done(false); });
      sheet.querySelector('#auth2Cancel').addEventListener('click', function() { done(false); });

      // 密码显示/隐藏切换
      sheet.querySelectorAll('.auth2-eye').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var input = sheet.querySelector('#' + btn.getAttribute('data-eye'));
          if (!input) return;
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.innerHTML = eyeSvg(show);
        });
      });
      // 输入时清除错误态
      sheet.querySelectorAll('.auth2-input').forEach(function(input) {
        input.addEventListener('input', function() {
          input.classList.remove('error');
          var err = sheet.querySelector('#auth2Error');
          if (err) err.textContent = '';
        });
      });

      var submitting = false;
      async function submit() {
        if (submitting) return;
        var p1 = sheet.querySelector('#auth2Pwd1').value;
        submitting = true;
        try {
          if (mode === 'setup') {
            var p2 = sheet.querySelector('#auth2Pwd2').value;
            if (p1.length < 4) { fail(t('tooShort'), 'auth2Pwd1'); return; }
            if (p1 !== p2) { fail(t('mismatch'), 'auth2Pwd2'); return; }
            var okSet = await setup(p1);
            if (!okSet) { fail(t('noCrypto'), 'auth2Pwd1'); return; }
            grants[actionKey] = Date.now();
            syncAccount();
            toast(t('setDone'));
            done(true);
          } else {
            var okV = await verify(p1);
            if (!okV) { fail(t('wrong'), 'auth2Pwd1'); return; }
            grants[actionKey] = Date.now();
            syncAccount();
            done(true);
          }
        } finally {
          submitting = false;
        }
      }
      sheet.querySelector('#auth2Ok').addEventListener('click', submit);
      sheet.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(); });
      setTimeout(function() {
        var input = sheet.querySelector('#auth2Pwd1');
        if (input) input.focus();
      }, 300);
    });
  }

  /* ---------- 对外主入口：敏感操作前验证 ----------
   * actionKey 维度免验：同一动作 15 分钟内只验一次。
   * 返回 Promise<boolean>：true = 已验证可继续，false = 用户取消/环境不支持。
   */
  function require(actionKey) {
    actionKey = actionKey || 'default';
    syncAccount();
    if (!cryptoOk()) {
      toast(t('noCrypto'));
      return Promise.resolve(false);
    }
    if (!isSet()) return showModal('setup', actionKey);   // 未设置 → 引导设置
    var at = grants[actionKey];
    if (at && (Date.now() - at) < BYPASS_MS) return Promise.resolve(true);
    return showModal('verify', actionKey);
  }

  /* 退出登录清空免验：优先监听 EventBus，可能后加载故延迟重试 */
  function subscribeLogout() {
    if (typeof EventBus !== 'undefined' && EventBus && EventBus.on) {
      try {
        EventBus.on('auth:logout', function() { clearBypass(); lastUid = null; });
        return true;
      } catch (e) {}
    }
    return false;
  }
  if (!subscribeLogout()) setTimeout(subscribeLogout, 2000);

  var api = {
    isSet: isSet,
    setup: setup,
    change: change,
    require: require,
    clearBypass: clearBypass,
    onLogin: onLogin
  };

  /* 供其他 IIFE 模块（如 SB，其内部有同名 Auth 常量）通过 window.Auth 访问 */
  try { window.Auth = api; } catch (e) {}

  return api;
})();
