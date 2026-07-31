/* ==================== OmniHub API Key 管理页（KeysPage） ====================
 * 容器钩子：app.js 派发 document 事件 'render:subChatSettings'
 * 渲染目标：#chatSettingsBody（不存在则自建弹层）
 * 对外契约：KeysPage.render() / KeysPage.highlightProvider(slug) / KeysPage.getKey(slug)
 * 安全：查看明文（眼睛）前 await Auth.require('viewApiKey')；
 *       导出前 await Auth.require('exportKeys')（Auth 未接入时降级为 confirm 确认）
 */
const KeysPage = (() => {
  'use strict';

  /* ==================== I18n ==================== */
  var DICT = {
    zh: {
      pageTitle: 'API Key 管理',
      quickPh: 'sk-... 或任意格式 API Key',
      quickBtn: '自动匹配', quickBusy: '匹配中…',
      quickEmpty: '请先粘贴 API Key',
      quickOk: '已匹配并保存：{n}', quickFail: '未匹配到任何厂商，请检查 Key 是否有效',
      quickNone: '未识别到 Key 候选',
      export: '导出', batchImport: '批量导入', custom: '自定义',
      domestic: '国内厂商', foreign: '国外厂商', customGroup: '自定义',
      configured: '已配置', notConfigured: '未配置',
      modelCount: '{n} 个模型', getKey: '获取 Key',
      keyPh: '粘贴 {p} 的 API Key',
      mimoPlan: '会员计划 Key', mimoPayg: '按量付费 Key', mimoBilling: '计费方式',
      billingPlan: '会员计划（Token Plan）', billingPayg: '按量付费（Pay as you go）',
      authView: '查看明文 Key 需要二级密码验证，是否继续？',
      authExport: '导出 API Key 需要二级密码验证，是否继续？',
      exportOk: '已导出 Key 文件', exportCancel: '已取消导出',
      importTitle: '批量导入', importPh: '粘贴一段文字（可含多个 API Key），自动识别分配',
      importBtn: '识别并分配', close: '关闭',
      cpTitleNew: '新建自定义厂商', cpTitleEdit: '编辑自定义厂商',
      cpName: '厂商名称', cpModel: '模型名称', cpPrefix: 'API Key 前缀',
      cpFormat: '请求格式', cpBase: '请求地址 (Base URL)', cpAuth: '认证方式',
      cpAuthField: '认证字段名', cpAuthTpl: '认证字段值模板',
      cpModelsPath: '模型列表接口', cpChatPath: '聊天接口',
      cpStream: '支持流式', cpVision: '支持多模态', cpThinking: '支持思考模式',
      cpHeaders: '请求头自定义 (JSON)', cpBody: '请求体自定义 (JSON 模板)',
      cpSave: '保存', cpRequired: '必填项未填写或格式错误',
      cpSaved: '已保存自定义厂商', cpDeleted: '已删除自定义厂商',
      cpDeleteConfirm: '确定删除该自定义厂商？此操作不可恢复',
      cpEdit: '编辑', cpDelete: '删除', cpTest: '测试连接', cpTesting: '测试中…',
      cpTestOk: '连接成功', cpTestFail: '连接失败：{e}',
      cpEmpty: '还没有自定义厂商，点击顶部「自定义」添加',
      authBearer: 'Bearer Token', authQuery: 'Query 参数', authHeader: 'Header 自定义', authNone: '无认证',
      eyeShow: '显示', eyeHide: '隐藏'
    },
    en: {
      pageTitle: 'API Key Management',
      quickPh: 'sk-... or any API Key format',
      quickBtn: 'Auto Match', quickBusy: 'Matching…',
      quickEmpty: 'Please paste an API Key first',
      quickOk: 'Matched and saved: {n}', quickFail: 'No provider matched. Check the key.',
      quickNone: 'No key candidates found',
      export: 'Export', batchImport: 'Batch Import', custom: 'Custom',
      domestic: 'Domestic', foreign: 'International', customGroup: 'Custom',
      configured: 'Configured', notConfigured: 'Not configured',
      modelCount: '{n} models', getKey: 'Get Key',
      keyPh: 'Paste {p} API Key',
      mimoPlan: 'Token Plan Key', mimoPayg: 'Pay-as-you-go Key', mimoBilling: 'Billing',
      billingPlan: 'Token Plan', billingPayg: 'Pay as you go',
      authView: 'Viewing plaintext keys requires secondary password. Continue?',
      authExport: 'Exporting keys requires secondary password. Continue?',
      exportOk: 'Key file exported', exportCancel: 'Export cancelled',
      importTitle: 'Batch Import', importPh: 'Paste text containing one or more API keys',
      importBtn: 'Detect & Assign', close: 'Close',
      cpTitleNew: 'New Custom Provider', cpTitleEdit: 'Edit Custom Provider',
      cpName: 'Provider Name', cpModel: 'Model Name', cpPrefix: 'API Key Prefix',
      cpFormat: 'Request Format', cpBase: 'Base URL', cpAuth: 'Auth Type',
      cpAuthField: 'Auth Field Name', cpAuthTpl: 'Auth Value Template',
      cpModelsPath: 'Models Endpoint', cpChatPath: 'Chat Endpoint',
      cpStream: 'Streaming', cpVision: 'Multimodal', cpThinking: 'Thinking Mode',
      cpHeaders: 'Custom Headers (JSON)', cpBody: 'Custom Body (JSON Template)',
      cpSave: 'Save', cpRequired: 'Required fields missing or invalid',
      cpSaved: 'Custom provider saved', cpDeleted: 'Custom provider deleted',
      cpDeleteConfirm: 'Delete this custom provider? This cannot be undone.',
      cpEdit: 'Edit', cpDelete: 'Delete', cpTest: 'Test', cpTesting: 'Testing…',
      cpTestOk: 'Connection OK', cpTestFail: 'Failed: {e}',
      cpEmpty: 'No custom providers yet. Tap "Custom" above to add one.',
      authBearer: 'Bearer Token', authQuery: 'Query Param', authHeader: 'Custom Header', authNone: 'None',
      eyeShow: 'Show', eyeHide: 'Hide'
    }
  };

  function registerI18n() {
    try {
      if (typeof I18n === 'undefined') return;
      if (typeof I18n.register === 'function') {
        I18n.register('keys', DICT);
      } else if (I18n.data) {
        if (!I18n.data.zh) I18n.data.zh = {};
        if (!I18n.data.en) I18n.data.en = {};
        for (var k in DICT.zh) I18n.data.zh[k] = DICT.zh[k];
        for (var k2 in DICT.en) I18n.data.en[k2] = DICT.en[k2];
      }
    } catch (e) { /* ignore */ }
  }

  function isEn() {
    var l = '';
    try {
      l = (Store.state.settings && Store.state.settings.language) || Store.state.language || 'zh';
    } catch (e) { /* ignore */ }
    return /^en/i.test(String(l));
  }

  function t(key, vars) {
    var d = isEn() ? DICT.en : DICT.zh;
    var v = d[key];
    if (v == null) {
      try {
        if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') {
          var r = I18n.t(key);
          if (r !== key) v = r;
        }
      } catch (e) { /* ignore */ }
    }
    if (v == null) v = key;
    if (vars) {
      for (var k in vars) v = v.replace('{' + k + '}', vars[k]);
    }
    return v;
  }

  /* ==================== 工具 ==================== */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\x22/g, '&quot;');
  }

  /* Auth 二级密码（未接入时降级 confirm） */
  function requireAuth(actionKey) {
    if (typeof Auth !== 'undefined' && Auth && typeof Auth.require === 'function') {
      return Promise.resolve(Auth.require(actionKey)).then(function(ok) { return !!ok; })
        .catch(function() { return false; });
    }
    var msg = (actionKey === 'exportKeys') ? t('authExport') : t('authView');
    return Promise.resolve(window.confirm(msg));
  }

  /* ==================== 厂商定义 ==================== */
  /* 补充厂商：不在 AIProviders 内但需要 Key 管理（小米 MiMo 双 Key） */
  var EXTRA_PROVIDERS = {
    mimo: {
      name: '小米 MiMo', keySlug: 'mimo', color: '#FF6900', dual: true,
      keyUrl: 'https://platform.xiaomimimo.com'
    }
  };
  var DOMESTIC = ['deepseek', 'kimi', 'qwen', 'zhipu', 'volcengine', 'mimo'];
  var FOREIGN = ['openai', 'anthropic', 'google', 'xai', 'groq'];

  /* Key 获取地址提示 */
  var KEY_URLS = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/settings/keys',
    google: 'https://aistudio.google.com/apikey',
    deepseek: 'https://platform.deepseek.com/api_keys',
    kimi: 'https://platform.moonshot.cn/console/api-keys',
    qwen: 'https://bailian.console.aliyun.com/#/api-key',
    zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
    volcengine: 'https://console.volcengine.com/ark',
    xai: 'https://console.x.ai/',
    groq: 'https://console.groq.com/keys'
  };

  function providerDef(slug) {
    if (EXTRA_PROVIDERS[slug]) return EXTRA_PROVIDERS[slug];
    if (typeof AIProviders !== 'undefined') {
      var p = AIProviders.get(slug);
      if (p) return p;
    }
    return { name: slug, keySlug: slug, color: '#8B5CF6' };
  }

  function keyUrlFor(slug) {
    return KEY_URLS[slug] || (EXTRA_PROVIDERS[slug] && EXTRA_PROVIDERS[slug].keyUrl) || '';
  }

  function brandIcon(name, color) {
    var svg = (typeof BrandIcons !== 'undefined') ? BrandIcons.svg(name) : null;
    if (svg) return svg;
    var first = String(name || '?').charAt(0);
    return esc(/[a-zA-Z]/.test(first) ? first.toUpperCase() : first);
  }

  /* MODELS 统计某厂商模型数量（按 provider 名称） */
  function modelCountFor(name) {
    if (typeof AIModels === 'undefined') return 0;
    var all = AIModels.list();
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      if (all[i].provider === name) n++;
    }
    return n;
  }

  /* ==================== Key 读写（双 Key 兼容） ==================== */
  function keysState() {
    var c = Store.state.chat;
    if (!c.keys) c.keys = {};
    return c.keys;
  }

  /* 读取有效 Key：字符串直取；{plan,payg} 按 slugBilling 选择（向后兼容字符串形式） */
  function getKey(slug) {
    var keys = keysState();
    var v = keys[slug];
    if (v && typeof v === 'object') {
      var billing = keys[slug + 'Billing'] || 'plan';
      return String(v[billing] || v.plan || v.payg || '');
    }
    return String(v || '');
  }

  function getDualKey(slug) {
    var v = keysState()[slug];
    if (v && typeof v === 'object') return { plan: String(v.plan || ''), payg: String(v.payg || '') };
    // 向后兼容：字符串形式视为会员计划 Key
    return { plan: String(v || ''), payg: '' };
  }

  function getBilling(slug) {
    return keysState()[slug + 'Billing'] || 'plan';
  }

  function setKey(slug, value) {
    var keys = keysState();
    if (EXTRA_PROVIDERS[slug] && EXTRA_PROVIDERS[slug].dual) {
      var dual = getDualKey(slug);
      dual[getBilling(slug)] = String(value || '').trim();
      keys[slug] = dual;
    } else {
      keys[slug] = String(value || '').trim();
    }
    Store.save();
  }

  function setDualKey(slug, kind, value) {
    var keys = keysState();
    var dual = getDualKey(slug);
    dual[kind] = String(value || '').trim();
    keys[slug] = dual;
    Store.save();
  }

  function setBilling(slug, billing) {
    keysState()[slug + 'Billing'] = billing;
    Store.save();
  }

  function hasKey(slug) {
    if (EXTRA_PROVIDERS[slug] && EXTRA_PROVIDERS[slug].dual) {
      var dual = getDualKey(slug);
      return !!(dual.plan || dual.payg);
    }
    return !!getKey(slug);
  }

  /* ==================== 模块状态 ==================== */
  var inited = false;
  var root = null;
  var overlay = null;
  var expanded = {};        // slug → bool
  var quickBusy = false;
  var sheetEl = null;       // 自定义厂商表单弹层
  var importEl = null;      // 批量导入弹层
  var editingCpId = null;   // 表单编辑中的自定义厂商 id

  /* ==================== 渲染 ==================== */
  function ensureRoot() {
    var body = document.getElementById('chatSettingsBody');
    if (body) { root = body; return body; }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'kp-overlay';
      overlay.innerHTML =
        '<div class="kp-overlay-head"><h3>' + esc(t('pageTitle')) + '</h3>' +
        '<button class="kp-overlay-close" type="button">✕</button></div>' +
        '<div class="kp-overlay-body"></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.kp-overlay-close').addEventListener('click', function() {
        overlay.classList.remove('open');
      });
    }
    overlay.classList.add('open');
    root = overlay.querySelector('.kp-overlay-body');
    return root;
  }

  function render() {
    registerI18n();
    var box = ensureRoot();
    if (!box) return;
    bindEvents(box);

    var html = '';
    // 自动匹配区
    html += '<div class="kp-quick kp-enter">';
    html += '<div class="kp-quick-row">';
    html += '<input type="text" id="kpQuickInput" placeholder="' + esc(t('quickPh')) + '" autocomplete="off">';
    html += '<button type="button" class="kp-btn kp-btn-primary" id="kpQuickBtn">' + esc(quickBusy ? t('quickBusy') : t('quickBtn')) + '</button>';
    html += '</div>';
    html += '<div class="kp-quick-status" id="kpQuickStatus"></div>';
    html += '</div>';

    // 顶部操作
    html += '<div class="kp-actions kp-enter" style="animation-delay:40ms">';
    html += '<button type="button" class="kp-btn" id="kpExportBtn">⬇ ' + esc(t('export')) + '</button>';
    html += '<button type="button" class="kp-btn" id="kpImportBtn">⬆ ' + esc(t('batchImport')) + '</button>';
    html += '<button type="button" class="kp-btn" id="kpCustomBtn">⚙ ' + esc(t('custom')) + '</button>';
    html += '</div>';

    // 厂商分组
    html += groupHtml(t('domestic'), DOMESTIC, 60);
    html += groupHtml(t('foreign'), FOREIGN, 120);
    html += customGroupHtml(180);

    box.innerHTML = html;
    if (typeof Icons !== 'undefined' && Icons.render) {
      try { Icons.render(box); } catch (e) { /* ignore */ }
    }
  }

  function groupHtml(title, slugs, baseDelay) {
    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + esc(title) + '</div>';
    for (var i = 0; i < slugs.length; i++) {
      html += providerBlockHtml(slugs[i], baseDelay + i * 30);
    }
    html += '</div>';
    return html;
  }

  function providerBlockHtml(slug, delay) {
    var def = providerDef(slug);
    var count = modelCountFor(def.name);
    var configured = hasKey(slug);
    var open = !!expanded[slug];
    var keyUrl = keyUrlFor(slug);

    var html = '<div class="kp-block kp-enter' + (open ? ' open' : '') + '" data-kslug="' + esc(slug) + '"' +
      (delay ? ' style="animation-delay:' + delay + 'ms"' : '') + '>';
    html += '<button type="button" class="kp-block-head">';
    html += '<span class="kp-icon" style="background:' + (def.color || '#8B5CF6') + '">' + brandIcon(def.name) + '</span>';
    html += '<span class="kp-title">';
    html += '<span class="kp-name">' + esc(def.name) + '</span>';
    html += '<span class="kp-meta">' + esc(t('modelCount', { n: count })) + '</span>';
    html += '</span>';
    html += '<span class="kp-status ' + (configured ? 'ok' : 'none') + '">' + esc(configured ? t('configured') : t('notConfigured')) + '</span>';
    html += '<span class="kp-arrow">' + (open ? '▾' : '▸') + '</span>';
    html += '</button>';
    html += '<div class="kp-block-body"' + (open ? '' : ' hidden') + '>';

    if (def.dual) {
      // 双 Key 厂商（小米 MiMo）：会员计划 / 按量付费 + 计费方式下拉
      var dual = getDualKey(slug);
      var billing = getBilling(slug);
      html += dualInputHtml(slug, 'plan', t('mimoPlan'), dual.plan, def.name);
      html += dualInputHtml(slug, 'payg', t('mimoPayg'), dual.payg, def.name);
      html += '<div class="kp-billing">';
      html += '<span class="kp-billing-label">' + esc(t('mimoBilling')) + '</span>';
      html += '<select data-kbilling="' + esc(slug) + '">';
      html += '<option value="plan"' + (billing === 'plan' ? ' selected' : '') + '>' + esc(t('billingPlan')) + '</option>';
      html += '<option value="payg"' + (billing === 'payg' ? ' selected' : '') + '>' + esc(t('billingPayg')) + '</option>';
      html += '</select></div>';
    } else {
      html += keyInputRowHtml(slug, getKey(slug), t('keyPh', { p: def.name }));
    }

    if (keyUrl) {
      html += '<a class="kp-getlink" href="' + esc(keyUrl) + '" target="_blank" rel="noopener">🔗 ' + esc(t('getKey')) + ' ↗</a>';
    }
    html += '</div></div>';
    return html;
  }

  /* password 输入框 + 眼睛切换（眼睛点击前必须过二级密码） */
  function keyInputRowHtml(slug, value, ph) {
    var html = '<div class="kp-keyrow">';
    html += '<input type="password" data-kinput="' + esc(slug) + '" value="' + esc(value) + '" placeholder="' + esc(ph) + '" autocomplete="off">';
    html += '<button type="button" class="kp-eye" data-keye="' + esc(slug) + '" title="' + esc(t('eyeShow')) + '">👁</button>';
    html += '</div>';
    return html;
  }

  function dualInputHtml(slug, kind, label, value, pname) {
    var html = '<div class="kp-duallabel">' + esc(label) + '</div>';
    html += '<div class="kp-keyrow">';
    html += '<input type="password" data-kdual="' + esc(slug) + ':' + kind + '" value="' + esc(value) + '" placeholder="' + esc(t('keyPh', { p: pname })) + '" autocomplete="off">';
    html += '<button type="button" class="kp-eye" data-keye="' + esc(slug) + ':' + kind + '" title="' + esc(t('eyeShow')) + '">👁</button>';
    html += '</div>';
    return html;
  }

  /* 自定义分组（齿轮图标） */
  function customGroupHtml(delay) {
    var list = (typeof CustomProviders !== 'undefined') ? CustomProviders.list() : [];
    var html = '<div class="settings-group">';
    html += '<div class="settings-group-title">' + esc(t('customGroup')) + '</div>';
    if (!list.length) {
      html += '<div class="kp-cp-empty kp-enter" style="animation-delay:' + delay + 'ms">' + esc(t('cpEmpty')) + '</div>';
    }
    for (var i = 0; i < list.length; i++) {
      var cp = list[i];
      var open = !!expanded[cp.id];
      html += '<div class="kp-block kp-enter' + (open ? ' open' : '') + '" data-kcp="' + esc(cp.id) + '"' +
        ' style="animation-delay:' + (delay + i * 30) + 'ms">';
      html += '<button type="button" class="kp-block-head">';
      html += '<span class="kp-icon" style="background:#8B5CF6">⚙</span>';
      html += '<span class="kp-title">';
      html += '<span class="kp-name">' + esc(cp.name) + '</span>';
      html += '<span class="kp-meta">' + esc(cp.model) + ' · ' + esc(cp.format) + '</span>';
      html += '</span>';
      html += '<span class="kp-status ' + (cp.key ? 'ok' : 'none') + '">' + esc(cp.key ? t('configured') : t('notConfigured')) + '</span>';
      html += '<span class="kp-arrow">' + (open ? '▾' : '▸') + '</span>';
      html += '</button>';
      html += '<div class="kp-block-body"' + (open ? '' : ' hidden') + '>';
      html += '<div class="kp-keyrow">';
      html += '<input type="password" data-kcpkey="' + esc(cp.id) + '" value="' + esc(cp.key || '') + '" placeholder="' + esc(t('keyPh', { p: cp.name })) + '" autocomplete="off">';
      html += '<button type="button" class="kp-eye" data-keye="cp:' + esc(cp.id) + '" title="' + esc(t('eyeShow')) + '">👁</button>';
      html += '</div>';
      html += '<div class="kp-cp-ops">';
      html += '<button type="button" class="kp-btn kp-btn-small" data-kcptest="' + esc(cp.id) + '">' + esc(t('cpTest')) + '</button>';
      html += '<button type="button" class="kp-btn kp-btn-small" data-kcpedit="' + esc(cp.id) + '">' + esc(t('cpEdit')) + '</button>';
      html += '<button type="button" class="kp-btn kp-btn-small kp-btn-danger" data-kcpdel="' + esc(cp.id) + '">' + esc(t('cpDelete')) + '</button>';
      html += '</div>';
      html += '<div class="kp-quick-status" data-kcpstatus="' + esc(cp.id) + '"></div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  /* ==================== 自动匹配 ==================== */
  /* 候选 Key 提取正则（中文/句子噪声天然不匹配这些形态） */
  var KEY_RE = /sk-ant-[\w-]{20,}|sk-[\w-]{20,}|AIza[\w-]{20,}|AQ\.[\w-]{6,}|xai-[\w-]{20,}|gsk_[\w-]{20,}|[a-f0-9]{32}/g;

  /* 参与探测的官方厂商（mimo 无公开 models 端点，不参与） */
  var PROBE_SLUGS = ['openai', 'deepseek', 'kimi', 'qwen', 'zhipu', 'volcengine', 'anthropic', 'google', 'xai', 'groq'];

  function extractCandidates(text) {
    var found = String(text || '').match(KEY_RE) || [];
    var seen = {};
    var out = [];
    for (var i = 0; i < found.length; i++) {
      var k = found[i];
      if (seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  /* 前缀猜厂商：复用 ai-providers.js 规则 + AQ.→Google、xai-→xAI、gsk_→Groq
   * 返回待探测 slug 列表：唯一前缀只探测单个；sk-/hex32 等不唯一前缀全量并行探测 */
  function guessProbeSlugs(key) {
    if (/^sk-ant-/i.test(key)) return ['anthropic'];
    if (/^AIza/.test(key)) return ['google'];
    if (/^AQ\./.test(key)) return ['google'];
    if (/^xai-/i.test(key)) return ['xai'];
    if (/^gsk_/.test(key)) return ['groq'];
    return PROBE_SLUGS.slice(); // sk- / 32位hex / 其他：全部并行探测
  }

  /* 单个 Key 的归属探测（官方厂商并行 validateKey + 自定义厂商前缀匹配 test） */
  function probeKey(key) {
    var slugs = guessProbeSlugs(key);
    var jobs = slugs.map(function(slug) {
      return AIAPI.validateKey(slug, key, '', 5000).then(function(res) {
        return { slug: slug, name: providerDef(slug).name, ok: !!(res.ok && res.models && res.models.length) };
      }).catch(function() {
        return { slug: slug, name: providerDef(slug).name, ok: false };
      });
    });
    // 自定义厂商：前缀匹配后逐一 test() 探测
    if (typeof CustomProviders !== 'undefined') {
      var cps = CustomProviders.matchPrefix(key);
      for (var i = 0; i < cps.length; i++) {
        (function(cp) {
          jobs.push(CustomProviders.test(cp).then(function(res) {
            return { cpId: cp.id, name: cp.name, ok: !!res.ok };
          }).catch(function() {
            return { cpId: cp.id, name: cp.name, ok: false };
          }));
        })(cps[i]);
      }
    }
    return Promise.all(jobs).then(function(results) {
      return results.filter(function(r) { return r.ok; });
    });
  }

  /* 自动匹配主流程（quick 输入框 / 批量导入共用） */
  function doAutoMatch(text, onDone) {
    if (quickBusy) return;
    var candidates = extractCandidates(text);
    if (!candidates.length) {
      if (window.Toast) Toast.show(t('quickNone'), 'error');
      if (onDone) onDone([]);
      return;
    }
    quickBusy = true;
    var btn = root && root.querySelector('#kpQuickBtn');
    if (btn) btn.textContent = t('quickBusy');

    var jobs = candidates.map(function(key) {
      return probeKey(key).then(function(hits) {
        // 命中：写入对应厂商（含自定义）
        for (var i = 0; i < hits.length; i++) {
          if (hits[i].slug) setKey(hits[i].slug, key);
          else if (hits[i].cpId && typeof CustomProviders !== 'undefined') {
            CustomProviders.setKey(hits[i].cpId, key);
          }
        }
        return hits;
      });
    });

    Promise.all(jobs).then(function(allHits) {
      quickBusy = false;
      if (btn) btn.textContent = t('quickBtn');
      var names = [];
      var i, j;
      for (i = 0; i < allHits.length; i++) {
        for (j = 0; j < allHits[i].length; j++) {
          if (names.indexOf(allHits[i][j].name) === -1) names.push(allHits[i][j].name);
        }
      }
      var status = root && root.querySelector('#kpQuickStatus');
      var quickVal = root && root.querySelector('#kpQuickInput') ? root.querySelector('#kpQuickInput').value : '';
      if (names.length) {
        render(); // 刷新状态标签
        if (root) {
          var inp = root.querySelector('#kpQuickInput');
          if (inp) inp.value = quickVal;
          var st = root.querySelector('#kpQuickStatus');
          if (st) { st.className = 'kp-quick-status ok'; st.textContent = '✓ ' + t('quickOk', { n: names.join('、') }); }
        }
        if (window.Toast) Toast.show('✓ ' + t('quickOk', { n: names.join('、') }), 'success');
      } else {
        if (status) { status.className = 'kp-quick-status fail'; status.textContent = '✗ ' + t('quickFail'); }
        if (window.Toast) Toast.show(t('quickFail'), 'error');
      }
      if (onDone) onDone(names);
    }).catch(function() {
      quickBusy = false;
      if (btn) btn.textContent = t('quickBtn');
      if (onDone) onDone([]);
    });
  }

  /* ==================== 导出 / 批量导入 ==================== */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function exportKeys() {
    requireAuth('exportKeys').then(function(ok) {
      if (!ok) {
        if (window.Toast) Toast.show(t('exportCancel'));
        return;
      }
      var payload = {
        app: 'omnihub-keys',
        version: 1,
        exportedAt: Date.now(),
        keys: keysState(),
        customProviders: (typeof CustomProviders !== 'undefined') ? CustomProviders.list() : []
      };
      // btoa 简单混淆（非加密，仅防明文直读）
      var obfuscated = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      var d = new Date();
      var fname = 'omnihub-keys-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.json';
      var blob = new Blob([obfuscated], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        URL.revokeObjectURL(url);
        a.remove();
      }, 100);
      if (window.Toast) Toast.show(t('exportOk'), 'success');
    });
  }

  function closeImport() {
    if (importEl) { importEl.remove(); importEl = null; }
  }

  function openImport() {
    closeImport();
    importEl = document.createElement('div');
    importEl.className = 'kp-modal-mask';
    importEl.innerHTML =
      '<div class="kp-modal">' +
      '<div class="kp-modal-title">' + esc(t('importTitle')) + '</div>' +
      '<textarea id="kpImportText" rows="6" placeholder="' + esc(t('importPh')) + '"></textarea>' +
      '<div class="kp-quick-status" id="kpImportStatus"></div>' +
      '<div class="kp-modal-ops">' +
      '<button type="button" class="kp-btn kp-btn-primary" id="kpImportGo">' + esc(t('importBtn')) + '</button>' +
      '<button type="button" class="kp-btn" id="kpImportClose">' + esc(t('close')) + '</button>' +
      '</div></div>';
    document.body.appendChild(importEl);
    importEl.addEventListener('click', function(e) {
      if (e.target === importEl || e.target.closest('#kpImportClose')) { closeImport(); return; }
      if (e.target.closest('#kpImportGo')) {
        var text = importEl.querySelector('#kpImportText').value;
        var status = importEl.querySelector('#kpImportStatus');
        if (!extractCandidates(text).length) {
          status.className = 'kp-quick-status fail';
          status.textContent = '✗ ' + t('quickNone');
          return;
        }
        status.className = 'kp-quick-status';
        status.textContent = t('quickBusy');
        doAutoMatch(text, function(names) {
          if (!importEl) return;
          var st = importEl.querySelector('#kpImportStatus');
          if (!st) return;
          if (names && names.length) {
            st.className = 'kp-quick-status ok';
            st.textContent = '✓ ' + t('quickOk', { n: names.join('、') });
          } else {
            st.className = 'kp-quick-status fail';
            st.textContent = '✗ ' + t('quickFail');
          }
        });
      }
    });
  }

  /* ==================== 自定义厂商表单（底部滑出全屏弹窗） ==================== */
  var CP_FIELDS = [
    { k: 'name', req: true, type: 'text', label: 'cpName' },
    { k: 'model', req: true, type: 'text', label: 'cpModel' },
    { k: 'keyPrefix', type: 'text', label: 'cpPrefix' },
    { k: 'format', req: true, type: 'select', label: 'cpFormat', opts: ['openai', 'anthropic', 'gemini', 'custom'] },
    { k: 'baseUrl', req: true, type: 'text', label: 'cpBase' },
    { k: 'authType', req: true, type: 'select', label: 'cpAuth', opts: ['bearer', 'query', 'header', 'none'] },
    { k: 'authField', type: 'text', label: 'cpAuthField' },
    { k: 'authTemplate', type: 'text', label: 'cpAuthTpl' },
    { k: 'modelsPath', type: 'text', label: 'cpModelsPath' },
    { k: 'chatPath', req: true, type: 'text', label: 'cpChatPath' },
    { k: 'stream', type: 'toggle', label: 'cpStream' },
    { k: 'vision', type: 'toggle', label: 'cpVision' },
    { k: 'thinking', type: 'toggle', label: 'cpThinking' },
    { k: 'customHeaders', type: 'textarea', label: 'cpHeaders' },
    { k: 'bodyTemplate', type: 'textarea', label: 'cpBody' }
  ];

  function authTypeLabel(v) {
    var map = { bearer: 'authBearer', query: 'authQuery', header: 'authHeader', none: 'authNone' };
    return t(map[v] || 'authBearer');
  }

  function closeSheet() {
    if (sheetEl) {
      var el = sheetEl;
      el.classList.remove('open');
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
      sheetEl = null;
      editingCpId = null;
    }
  }

  function openCustomForm(id) {
    if (typeof CustomProviders === 'undefined') return;
    closeSheet();
    editingCpId = id || null;
    var cp = id ? CustomProviders.get(id) : null;
    var defaults = {
      name: '', model: '', keyPrefix: '', format: 'openai', baseUrl: '',
      authType: 'bearer', authField: 'Authorization', authTemplate: 'Bearer {key}',
      modelsPath: '', chatPath: '', stream: true, vision: false, thinking: false,
      customHeaders: '', bodyTemplate: ''
    };
    var data = cp || defaults;

    var html = '';
    html += '<div class="cp-sheet">';
    html += '<div class="cp-sheet-head">';
    html += '<span class="cp-sheet-title">' + esc(id ? t('cpTitleEdit') : t('cpTitleNew')) + '</span>';
    html += '<button type="button" class="cp-sheet-close">✕</button>';
    html += '</div>';
    html += '<div class="cp-sheet-body">';
    for (var i = 0; i < CP_FIELDS.length; i++) {
      var f = CP_FIELDS[i];
      var val = data[f.k];
      html += '<div class="cp-field">';
      html += '<label class="cp-label">' + esc(t(f.label)) + (f.req ? ' <em>*</em>' : '') + '</label>';
      if (f.type === 'select') {
        html += '<select data-cpf="' + f.k + '">';
        for (var j = 0; j < f.opts.length; j++) {
          var ol = (f.k === 'authType') ? authTypeLabel(f.opts[j]) : f.opts[j];
          html += '<option value="' + f.opts[j] + '"' + (val === f.opts[j] ? ' selected' : '') + '>' + esc(ol) + '</option>';
        }
        html += '</select>';
      } else if (f.type === 'toggle') {
        html += '<div class="cp-toggle' + (val ? ' on' : '') + '" data-cpf="' + f.k + '"><span class="cp-toggle-dot"></span></div>';
      } else if (f.type === 'textarea') {
        html += '<textarea data-cpf="' + f.k + '" rows="3" placeholder="' + (f.k === 'bodyTemplate' ? '{"model":"{model}","messages":{messages},"stream":{stream}}' : '{"X-Header":"value"}') + '">' + esc(val || '') + '</textarea>';
      } else {
        html += '<input type="text" data-cpf="' + f.k + '" value="' + esc(val || '') + '">';
      }
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="cp-sheet-foot">';
    html += '<button type="button" class="kp-btn kp-btn-primary" id="cpSaveBtn">' + esc(t('cpSave')) + '</button>';
    html += '</div>';
    html += '</div>';

    sheetEl = document.createElement('div');
    sheetEl.className = 'cp-mask';
    sheetEl.innerHTML = html;
    document.body.appendChild(sheetEl);
    // translateY(100%)→0 滑出动画
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { if (sheetEl) sheetEl.classList.add('open'); });
    });

    sheetEl.addEventListener('click', function(e) {
      if (e.target === sheetEl || e.target.closest('.cp-sheet-close')) { closeSheet(); return; }
      var toggle = e.target.closest('.cp-toggle');
      if (toggle) { toggle.classList.toggle('on'); return; }
      if (e.target.closest('#cpSaveBtn')) saveCustomForm();
    });
  }

  /* 必填标红 + 左右抖动 3 次 */
  function markError(fieldKey) {
    if (!sheetEl) return;
    var input = sheetEl.querySelector('[data-cpf="' + fieldKey + '"]');
    if (!input) return;
    var field = input.closest('.cp-field');
    field.classList.add('cp-error');
    input.classList.remove('cp-shake');
    void input.offsetWidth; // 重触发动画
    input.classList.add('cp-shake');
    setTimeout(function() { input.classList.remove('cp-shake'); }, 500);
  }

  function saveCustomForm() {
    if (!sheetEl) return;
    var data = {};
    for (var i = 0; i < CP_FIELDS.length; i++) {
      var f = CP_FIELDS[i];
      var el = sheetEl.querySelector('[data-cpf="' + f.k + '"]');
      if (!el) continue;
      if (f.type === 'toggle') data[f.k] = el.classList.contains('on');
      else data[f.k] = el.value;
    }
    var result = editingCpId
      ? CustomProviders.update(editingCpId, data)
      : CustomProviders.add(data);
    if (!result.ok) {
      var fields = sheetEl.querySelectorAll('.cp-field');
      for (var j = 0; j < fields.length; j++) fields[j].classList.remove('cp-error');
      for (var key in result.errors) markError(key);
      if (window.Toast) Toast.show(t('cpRequired'), 'error');
      return;
    }
    closeSheet();
    render();
    if (window.Toast) Toast.show(t('cpSaved'), 'success');
  }

  /* ==================== 高亮闪烁（详情页「去配置 Key」跳转） ==================== */
  function highlightProvider(slug) {
    if (!root || !document.contains(root)) render();
    expanded[slug] = true;
    render();
    if (!root) return;
    var block = root.querySelector('.kp-block[data-kslug="' + slug + '"]');
    if (!block) return;
    try { block.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {
      block.scrollIntoView();
    }
    block.classList.add('kp-flash');
    setTimeout(function() { block.classList.remove('kp-flash'); }, 2000);
  }

  /* ==================== 事件委托 ==================== */
  function bindEvents(box) {
    if (box._kpBound) return;
    box._kpBound = true;

    box.addEventListener('click', function(e) {
      // 厂商区块展开/收起
      var head = e.target.closest('.kp-block-head');
      if (head) {
        var block = head.closest('.kp-block');
        var slug = block.dataset.kslug || block.dataset.kcp;
        expanded[slug] = !expanded[slug];
        var body = block.querySelector('.kp-block-body');
        block.classList.toggle('open', expanded[slug]);
        if (body) body.hidden = !expanded[slug];
        var arrow = head.querySelector('.kp-arrow');
        if (arrow) arrow.textContent = expanded[slug] ? '▾' : '▸';
        return;
      }
      // 眼睛切换（先过二级密码）
      var eye = e.target.closest('.kp-eye');
      if (eye) {
        var target = eye.dataset.keye;
        var input = null;
        if (target.indexOf('cp:') === 0) {
          input = box.querySelector('[data-kcpkey="' + target.slice(3) + '"]');
        } else if (target.indexOf(':') !== -1) {
          input = box.querySelector('[data-kdual="' + target + '"]');
        } else {
          input = box.querySelector('[data-kinput="' + target + '"]');
        }
        if (!input) return;
        if (input.type === 'text') {
          input.type = 'password';
          eye.textContent = '👁';
          eye.title = t('eyeShow');
          return;
        }
        requireAuth('viewApiKey').then(function(ok) {
          if (!ok) return;
          input.type = 'text';
          eye.textContent = '🙈';
          eye.title = t('eyeHide');
        });
        return;
      }
      // 自动匹配
      if (e.target.closest('#kpQuickBtn')) {
        var inp = box.querySelector('#kpQuickInput');
        var val = inp ? inp.value.trim() : '';
        if (!val) {
          if (window.Toast) Toast.show(t('quickEmpty'), 'error');
          return;
        }
        doAutoMatch(val);
        return;
      }
      // 顶部操作
      if (e.target.closest('#kpExportBtn')) { exportKeys(); return; }
      if (e.target.closest('#kpImportBtn')) { openImport(); return; }
      if (e.target.closest('#kpCustomBtn')) { openCustomForm(); return; }
      // 自定义厂商操作
      var testBtn = e.target.closest('[data-kcptest]');
      if (testBtn) {
        var cpId = testBtn.dataset.kcptest;
        var status = box.querySelector('[data-kcpstatus="' + cpId + '"]');
        testBtn.disabled = true;
        testBtn.textContent = t('cpTesting');
        if (status) { status.className = 'kp-quick-status'; status.textContent = t('cpTesting'); }
        CustomProviders.test(cpId).then(function(res) {
          testBtn.disabled = false;
          testBtn.textContent = t('cpTest');
          if (status) {
            status.className = 'kp-quick-status ' + (res.ok ? 'ok' : 'fail');
            status.textContent = res.ok ? ('✓ ' + t('cpTestOk')) : ('✗ ' + t('cpTestFail', { e: res.error || '' }));
          }
        });
        return;
      }
      var editBtn = e.target.closest('[data-kcpedit]');
      if (editBtn) { openCustomForm(editBtn.dataset.kcpedit); return; }
      var delBtn = e.target.closest('[data-kcpdel]');
      if (delBtn) {
        if (window.confirm(t('cpDeleteConfirm'))) {
          CustomProviders.remove(delBtn.dataset.kcpdel);
          render();
          if (window.Toast) Toast.show(t('cpDeleted'));
        }
        return;
      }
    });

    box.addEventListener('input', function(e) {
      var el = e.target;
      if (el.dataset && el.dataset.kinput) {
        setKey(el.dataset.kinput, el.value);
      } else if (el.dataset && el.dataset.kdual) {
        var parts = el.dataset.kdual.split(':');
        setDualKey(parts[0], parts[1], el.value);
      } else if (el.dataset && el.dataset.kcpkey) {
        CustomProviders.setKey(el.dataset.kcpkey, el.value);
      }
    });

    box.addEventListener('change', function(e) {
      var el = e.target;
      if (el.dataset && el.dataset.kbilling) {
        setBilling(el.dataset.kbilling, el.value);
      }
    });
  }

  /* ==================== 初始化 ==================== */
  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener('render:subChatSettings', function() {
      render();
    });
  }

  init();

  return {
    render: render,
    highlightProvider: highlightProvider,
    getKey: getKey,
    openCustomForm: openCustomForm
  };
})();
