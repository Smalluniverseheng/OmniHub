/* ==================== OmniHub ChatModes - 对话模式系统 ====================
 * 模式：single 单模型 / multi 多模型并行 / debate 辩论 / collab 协同
 * 兼容旧值：'chat' → single；'image' 绘画模式独立保留
 * 配置存：
 *   Store.state.chat.multi  = { models: [{provider, model}] }            最多 8 个
 *   Store.state.chat.debate = { pro, con, judge, format, rounds }        赛制 battle/fast/standard，轮数 1-5
 *   Store.state.chat.collab = { workers: [{provider, model}] }           主持人 = 当前模型
 * 依赖 chat.js 暴露的 ChatModule 钩子（callModel / buildMessages / updateBubble ...）
 */

/* ---------- chat 命名空间错误文案（他人提供 I18n.register 时接管，否则本地兜底） ---------- */
const ChatI18n = (() => {
  'use strict';
  var DICT = {
    'zh-CN': {
      needTwoModels: '多模型模式至少选择 2 个模型',
      modelLimit: '最多选择 8 个模型',
      needDebateConfig: '请先完成辩论角色配置',
      needWorkers: '请先选择至少 1 个协作者',
      searchFail: '联网搜索失败',
      webreadFail: '网页阅读失败',
      modeChanged: '已切换对话模式',
      taskTokenLimit: '已达单次任务消耗上限，提前结束',
      noKey: '未配置 API Key'
    },
    en: {
      needTwoModels: 'Select at least 2 models for multi mode',
      modelLimit: 'Up to 8 models',
      needDebateConfig: 'Please configure debate roles first',
      needWorkers: 'Select at least 1 worker',
      searchFail: 'Web search failed',
      webreadFail: 'Web reading failed',
      modeChanged: 'Chat mode switched',
      taskTokenLimit: 'Task token limit reached, stopped early',
      noKey: 'API key not configured'
    }
  };
  var registered = false;
  if (typeof I18n !== 'undefined' && typeof I18n.register === 'function') {
    try {
      I18n.register('chat', DICT);
      registered = true;
    } catch (e) { /* ignore */ }
  }
  function t(key) {
    if (registered) {
      var v = I18n.t('chat.' + key);
      if (v && v !== 'chat.' + key) return v;
    }
    var lang = (Store.state.settings && Store.state.settings.language) || 'zh';
    var dict = /^zh/.test(lang) ? DICT['zh-CN'] : DICT.en;
    return dict[key] || DICT['zh-CN'][key] || key;
  }
  return { t: t };
})();

const ChatModes = (() => {
  'use strict';

  var MODES = [
    { id: 'single', name: '单模型' },
    { id: 'multi', name: '多模型' },
    { id: 'debate', name: '辩论' },
    { id: 'collab', name: '协同' }
  ];

  var FORMATS = {
    battle: { name: '自由交锋', rounds: 3 },
    fast: { name: '快速', rounds: 1 },
    standard: { name: '标准', rounds: 2 }
  };

  /* ---------- 数据 ---------- */

  function cs() { return Store.state.chat; }

  /* 兼容旧 'chat' → single */
  function currentMode() {
    var m = cs().mode;
    return (m === 'chat' || !m) ? 'single' : m;
  }

  function multiCfg() {
    if (!cs().multi) cs().multi = { models: [] };
    return cs().multi;
  }

  function debateCfg() {
    if (!cs().debate) cs().debate = { pro: null, con: null, judge: null, format: 'standard', rounds: 2 };
    return cs().debate;
  }

  function collabCfg() {
    if (!cs().collab) cs().collab = { workers: [] };
    return cs().collab;
  }

  function limits() {
    if (!cs().limits) cs().limits = { maxToolRounds: 30, maxMessageLength: 500000, maxTaskTokens: 1000000 };
    return cs().limits;
  }

  /* 已配置厂商的全部可选模型（keys 里有 Key 的厂商 + 自定义接口） */
  function availableModels() {
    var c = cs();
    var out = [];
    var providers = AIProviders.list();
    for (var i = 0; i < providers.length; i++) {
      var p = providers[i];
      if (p.keySlug === 'custom') continue;
      if (!(c.keys && c.keys[p.keySlug])) continue;
      var models = p.models || [];
      for (var j = 0; j < models.length; j++) {
        out.push({ provider: p.keySlug, model: models[j], name: p.name + ' · ' + models[j], color: p.color });
      }
    }
    if (c.customBase && c.customModel) {
      out.push({ provider: 'custom', model: c.customModel, name: '自定义 · ' + c.customModel, color: '#8B5CF6' });
    }
    return out;
  }

  function modelLabel(sel) {
    if (!sel) return '?';
    var p = AIProviders.get(sel.provider);
    var pname = sel.provider === 'custom' ? '自定义' : (p ? p.name : sel.provider);
    return pname + ' · ' + sel.model;
  }

  function sameSel(a, b) {
    return a && b && a.provider === b.provider && a.model === b.model;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;');
  }

  /* ---------- 初始化 ---------- */

  function init() {
    // 注册自定义气泡渲染器
    ChatModule.registerModeRenderer('multi', renderMultiBubble);
    ChatModule.registerModeRenderer('role', renderRoleBubble);
    renderModeBar();
    if (window.EventBus && typeof EventBus.on === 'function') {
      EventBus.on('chat:modelChanged', function() { renderModeBar(); });
    }
  }

  /* ---------- 模式切换胶囊条 ---------- */

  function renderModeBar() {
    var bar = document.getElementById('chatModeBar');
    if (!bar) return;
    var mode = currentMode();
    var html = '';
    for (var i = 0; i < MODES.length; i++) {
      html += '<button class="chat-mode-pill' + (mode === MODES[i].id ? ' active' : '') + '" data-cmode="' + MODES[i].id + '">' + MODES[i].name + '</button>';
    }
    // 模式配置提示（multi/debate/collab 显示当前配置摘要）
    if (mode === 'multi') {
      var n = multiCfg().models.length;
      html += '<button class="chat-mode-cfg" data-cfg="multi">' + (n ? n + ' 个模型 ⚙' : '选择模型 ⚙') + '</button>';
    } else if (mode === 'debate') {
      html += '<button class="chat-mode-cfg" data-cfg="debate">赛制 ' + (FORMATS[debateCfg().format] || FORMATS.standard).name + ' · ' + debateCfg().rounds + ' 轮 ⚙</button>';
    } else if (mode === 'collab') {
      var w = collabCfg().workers.length;
      html += '<button class="chat-mode-cfg" data-cfg="collab">' + (w ? w + ' 个协作者 ⚙' : '选择协作者 ⚙') + '</button>';
    }
    bar.innerHTML = html;
    if (!bar.dataset.bound) {
      bar.dataset.bound = '1';
      bar.addEventListener('click', function(e) {
        var pill = e.target.closest('[data-cmode]');
        if (pill) {
          setMode(pill.dataset.cmode);
          return;
        }
        var cfg = e.target.closest('[data-cfg]');
        if (cfg) openConfig(cfg.dataset.cfg);
      });
    }
  }

  function setMode(mode) {
    if (mode === 'multi' && multiCfg().models.length < 2) {
      openConfig('multi');
      return;
    }
    if (mode === 'debate') {
      var d = debateCfg();
      if (!d.pro || !d.con || !d.judge) {
        openConfig('debate');
        return;
      }
    }
    if (mode === 'collab' && !collabCfg().workers.length) {
      openConfig('collab');
      return;
    }
    cs().mode = mode;
    Store.save();
    renderModeBar();
    ChatModule.renderMessages();
    Toast.show(ChatI18n.t('modeChanged') + '：' + modeName(mode));
    if (window.EventBus && typeof EventBus.emit === 'function') EventBus.emit('chat:modeChanged', mode);
  }

  function modeName(mode) {
    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i].id === mode) return MODES[i].name;
    }
    return mode;
  }

  /* ---------- 配置弹层（动态 DOM，遮罩 + 底部面板） ---------- */

  function ensureLayer() {
    var layer = document.getElementById('chatModesLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'chatModesLayer';
    layer.className = 'chat-modes-layer';
    layer.innerHTML =
      '<div class="chat-modes-mask" id="chatModesMask"></div>' +
      '<div class="chat-modes-sheet"><div class="chat-modes-body" id="chatModesBody"></div></div>';
    document.body.appendChild(layer);
    layer.querySelector('#chatModesMask').addEventListener('click', closeConfig);
    layer.querySelector('#chatModesBody').addEventListener('click', onConfigClick);
    layer.querySelector('#chatModesBody').addEventListener('change', onConfigChange);
    return layer;
  }

  function openConfig(kind) {
    var layer = ensureLayer();
    renderConfig(kind);
    layer.classList.remove('open');
    void layer.offsetWidth;
    layer.classList.add('open');
  }

  function closeConfig() {
    var layer = document.getElementById('chatModesLayer');
    if (layer) layer.classList.remove('open');
  }

  function selKey(sel) {
    return sel.provider + '::' + sel.model;
  }

  function renderConfig(kind) {
    var body = document.getElementById('chatModesBody');
    if (!body) return;
    body.dataset.kind = kind;
    var models = availableModels();
    var html = '';
    if (!models.length) {
      body.innerHTML = '<div class="empty-state"><div class="empty-icon">🔑</div><div class="empty-text">请先在对话设置中配置至少一个厂商的 API Key</div></div>';
      return;
    }

    if (kind === 'multi') {
      html += '<div class="chat-modes-title">多模型并行（最多 8 个，已选 <span id="chatMultiCount">' + multiCfg().models.length + '</span>）</div>';
      html += '<div class="chat-modes-list">';
      for (var i = 0; i < models.length; i++) {
        var m = models[i];
        var checked = multiCfg().models.some(function(s) { return sameSel(s, m); });
        html += '<label class="chat-modes-row">';
        html += '<input type="checkbox" data-multi="' + esc(selKey(m)) + '"' + (checked ? ' checked' : '') + '>';
        html += '<span class="chat-provider-dot" style="background:' + m.color + '"></span>' + esc(m.name);
        html += '</label>';
      }
      html += '</div>';
      html += '<button class="btn-primary chat-modes-ok" id="chatMultiOk">确定（至少 2 个）</button>';
    } else if (kind === 'debate') {
      var d = debateCfg();
      html += '<div class="chat-modes-title">辩论模式配置</div>';
      html += debateRoleSelect('pro', '正方', d.pro, models);
      html += debateRoleSelect('con', '反方', d.con, models);
      html += debateRoleSelect('judge', '裁判', d.judge, models);
      html += '<div class="chat-modes-sub">赛制</div>';
      html += '<div class="chat-modes-formats">';
      for (var f in FORMATS) {
        html += '<button class="chat-mode-pill' + (d.format === f ? ' active' : '') + '" data-format="' + f + '">' + FORMATS[f].name + '</button>';
      }
      html += '</div>';
      html += '<div class="chat-modes-sub">轮数（1-5）</div>';
      html += '<div class="chat-stepper"><button data-rounds="-1">−</button><span id="chatDebateRounds">' + d.rounds + '</span><button data-rounds="1">＋</button></div>';
      html += '<button class="btn-primary chat-modes-ok" id="chatDebateOk">保存配置</button>';
    } else if (kind === 'collab') {
      var workers = collabCfg().workers;
      html += '<div class="chat-modes-title">协同模式：主持人 = 当前模型，选择协作者（可同模型多实例）</div>';
      html += '<div class="chat-modes-list">';
      for (var k = 0; k < models.length; k++) {
        var wm = models[k];
        var count = 0;
        for (var w = 0; w < workers.length; w++) {
          if (sameSel(workers[w], wm)) count++;
        }
        html += '<div class="chat-modes-row chat-modes-worker">';
        html += '<span class="chat-provider-dot" style="background:' + wm.color + '"></span><span class="chat-modes-wname">' + esc(wm.name) + '</span>';
        html += '<span class="chat-stepper chat-stepper-sm"><button data-worker="-1" data-wkey="' + esc(selKey(wm)) + '">−</button><span>' + count + '</span><button data-worker="1" data-wkey="' + esc(selKey(wm)) + '">＋</button></span>';
        html += '</div>';
      }
      html += '</div>';
      html += '<button class="btn-primary chat-modes-ok" id="chatCollabOk">保存配置</button>';
    }
    body.innerHTML = html;
  }

  function debateRoleSelect(role, label, sel, models) {
    var html = '<div class="chat-modes-sub">' + label + '</div>';
    html += '<select class="chat-modes-select" data-role="' + role + '">';
    html += '<option value="">请选择模型</option>';
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      var v = selKey(m);
      html += '<option value="' + esc(v) + '"' + (sel && selKey(sel) === v ? ' selected' : '') + '>' + esc(m.name) + '</option>';
    }
    html += '</select>';
    return html;
  }

  function findModel(key) {
    var models = availableModels();
    for (var i = 0; i < models.length; i++) {
      if (selKey(models[i]) === key) return models[i];
    }
    return null;
  }

  function onConfigChange(e) {
    var t = e.target;
    if (t.dataset.multi) {
      // 多模型勾选
      var sel = findModel(t.dataset.multi);
      if (!sel) return;
      var list = multiCfg().models;
      var idx = -1;
      for (var i = 0; i < list.length; i++) {
        if (sameSel(list[i], sel)) idx = i;
      }
      if (t.checked && idx === -1) {
        if (list.length >= 8) {
          t.checked = false;
          Toast.show(ChatI18n.t('modelLimit'), 'error');
          return;
        }
        list.push({ provider: sel.provider, model: sel.model });
      } else if (!t.checked && idx !== -1) {
        list.splice(idx, 1);
      }
      var countEl = document.getElementById('chatMultiCount');
      if (countEl) countEl.textContent = list.length;
      Store.save();
    } else if (t.dataset.role) {
      // 辩论角色选择
      var d = debateCfg();
      var picked = findModel(t.value);
      d[t.dataset.role] = picked ? { provider: picked.provider, model: picked.model } : null;
      Store.save();
    }
  }

  function onConfigClick(e) {
    var t = e.target;
    if (t.closest('#chatMultiOk')) {
      if (multiCfg().models.length < 2) {
        Toast.show(ChatI18n.t('needTwoModels'), 'error');
        return;
      }
      closeConfig();
      cs().mode = 'multi';
      Store.save();
      renderModeBar();
      ChatModule.renderMessages();
      return;
    }
    if (t.closest('#chatDebateOk')) {
      var d = debateCfg();
      if (!d.pro || !d.con || !d.judge) {
        Toast.show(ChatI18n.t('needDebateConfig'), 'error');
        return;
      }
      closeConfig();
      cs().mode = 'debate';
      Store.save();
      renderModeBar();
      ChatModule.renderMessages();
      return;
    }
    if (t.closest('#chatCollabOk')) {
      if (!collabCfg().workers.length) {
        Toast.show(ChatI18n.t('needWorkers'), 'error');
        return;
      }
      closeConfig();
      cs().mode = 'collab';
      Store.save();
      renderModeBar();
      ChatModule.renderMessages();
      return;
    }
    var fmt = t.closest('[data-format]');
    if (fmt) {
      var dc = debateCfg();
      dc.format = fmt.dataset.format;
      dc.rounds = FORMATS[dc.format].rounds;
      Store.save();
      renderConfig('debate');
      return;
    }
    var roundsBtn = t.closest('[data-rounds]');
    if (roundsBtn) {
      var dr = debateCfg();
      dr.rounds = Math.min(5, Math.max(1, dr.rounds + parseInt(roundsBtn.dataset.rounds, 10)));
      Store.save();
      var rEl = document.getElementById('chatDebateRounds');
      if (rEl) rEl.textContent = dr.rounds;
      return;
    }
    var wBtn = t.closest('[data-worker]');
    if (wBtn) {
      var sel = findModel(wBtn.dataset.wkey);
      if (!sel) return;
      var workers = collabCfg().workers;
      var delta = parseInt(wBtn.dataset.worker, 10);
      if (delta > 0) {
        if (workers.length >= 8) {
          Toast.show(ChatI18n.t('modelLimit'), 'error');
          return;
        }
        workers.push({ provider: sel.provider, model: sel.model });
      } else {
        for (var i = workers.length - 1; i >= 0; i--) {
          if (sameSel(workers[i], sel)) {
            workers.splice(i, 1);
            break;
          }
        }
      }
      Store.save();
      renderConfig('collab');
    }
  }

  /* ---------- 气泡渲染器 ---------- */

  /* 多模型：横向滑动并排卡片，每卡模型名 + 内容 + usage，失败标红 */
  function renderMultiBubble(msg) {
    var html = '<div class="chat-multi-strip">';
    for (var i = 0; i < (msg.results || []).length; i++) {
      var r = msg.results[i];
      html += '<div class="chat-multi-card' + (r.error ? ' fail' : '') + '">';
      html += '<div class="chat-multi-head">' + esc(r.name) + '</div>';
      html += '<div class="chat-multi-body">';
      if (r.error) {
        html += '<div class="chat-error-text">' + esc(r.error) + '</div>';
      } else if (r.loading && !r.content) {
        html += '<span class="chat-typing"><i></i><i></i><i></i></span>';
      } else {
        html += ChatModule.renderContent(r.content || '');
      }
      html += '</div>';
      if (r.usage) {
        html += '<div class="chat-multi-usage">↑' + (r.usage.input | 0) + ' ↓' + (r.usage.output | 0) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* 角色气泡（辩论正方/反方/裁判，协同主持人/工作者/评审/汇总） */
  function renderRoleBubble(msg) {
    var badge = msg.badge || {};
    var html = '<div class="chat-role-badge ' + esc(badge.cls || '') + '">' + esc(badge.text || '') +
      (msg.modelName ? '<span class="chat-role-model">' + esc(msg.modelName) + '</span>' : '') + '</div>';
    if (msg.error) {
      html += '<div class="chat-error-text">' + esc(msg.error) + '</div>';
      return html;
    }
    if (msg.loading && !msg.content) {
      html += '<span class="chat-typing"><i></i><i></i><i></i></span>';
      return html;
    }
    if (msg.thinking) {
      html += '<div class="chat-thinking">';
      html += '<div class="chat-thinking-head">💭 思考过程<span class="chat-thinking-arrow">▸</span></div>';
      html += '<div class="chat-thinking-body">' + ChatModule.renderContent(msg.thinking) + '</div></div>';
    }
    html += ChatModule.renderContent(msg.content || '');
    if (msg.usage) {
      html += '<div class="chat-role-usage">↑' + (msg.usage.input | 0) + ' ↓' + (msg.usage.output | 0) + '</div>';
    }
    return html;
  }

  /* ---------- 发送入口（chat.js 委托） ---------- */

  /* 返回 true 表示已接管本次发送 */
  function handleSend(conv, userMsg, tool) {
    var mode = currentMode();
    if (mode === 'multi') return runMulti(conv, userMsg, tool);
    if (mode === 'debate') return runDebate(conv, userMsg);
    if (mode === 'collab') return runCollab(conv, userMsg);
    return false;
  }

  function isAbort(err) {
    return err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
  }

  /* 单次任务消耗上限检查：sessionTokens 累计，超限返回 true */
  function overTaskLimit(sessionTokens) {
    var limit = limits().maxTaskTokens || 1000000;
    return sessionTokens.total >= limit;
  }

  /* ---------- 多模型并行 ---------- */

  function runMulti(conv, userMsg, tool) {
    var sels = multiCfg().models;
    if (sels.length < 2) {
      Toast.show(ChatI18n.t('needTwoModels'), 'error');
      openConfig('multi');
      return true;
    }
    var msg = {
      id: ChatModule.uid(),
      role: 'assistant',
      modeKind: 'multi',
      results: sels.map(function(s) {
        return { provider: s.provider, model: s.model, name: modelLabel(s), content: '', loading: true };
      }),
      tools: tool ? (Array.isArray(tool) ? tool : [tool]) : null,
      loading: true,
      ts: Date.now()
    };
    conv.messages.push(msg);
    conv.updatedAt = Date.now();
    Store.save();
    ChatModule.renderMessages();
    ChatModule.setSending(true);

    var ctrl = new AbortController();
    ChatModule.setAborter(ctrl);
    var sessionTokens = { total: 0 };
    var baseMsgs = ChatModule.buildMessages(conv);

    var jobs = msg.results.map(function(r) {
      return ChatModule.callModel({
        providerSlug: r.provider,
        model: r.model,
        messages: baseMsgs,
        signal: ctrl.signal,
        onChunk: function(full, thinking) {
          r.content = full;
          ChatModule.updateBubble(msg);
        }
      }).then(function(res) {
        r.content = res.content;
        if (res.usage) {
          var n = TokenMeter.record(r.model, res.usage, conv);
          r.usage = n;
          sessionTokens.total += n.input + n.output;
        }
        r.loading = false;
      }).catch(function(err) {
        r.loading = false;
        if (isAbort(err)) {
          if (!r.content) r.content = '（已停止生成）';
        } else {
          r.error = (err && err.message) || '请求失败';
        }
      }).then(function() {
        ChatModule.updateBubble(msg);
      });
    });

    Promise.allSettled(jobs).then(function() {
      msg.loading = false;
      conv.updatedAt = Date.now();
      Store.save();
      ChatModule.updateBubble(msg);
      ChatModule.setSending(false);
    });
    return true;
  }

  /* ---------- 辩论模式 ---------- */

  /* 推入一条角色消息并流式生成，resolve(msg) */
  function streamRole(conv, opts) {
    var msg = {
      id: ChatModule.uid(),
      role: 'assistant',
      modeKind: 'role',
      badge: { text: opts.badgeText, cls: opts.badgeCls },
      modelName: modelLabel(opts.sel),
      content: '',
      loading: true,
      ts: Date.now()
    };
    conv.messages.push(msg);
    conv.updatedAt = Date.now();
    Store.save();
    ChatModule.renderMessages();
    return ChatModule.callModel({
      providerSlug: opts.sel.provider,
      model: opts.sel.model,
      messages: [{ role: 'user', content: opts.prompt }],
      signal: opts.signal,
      onChunk: function(full, thinking) {
        msg.content = full;
        if (thinking) msg.thinking = thinking;
        ChatModule.updateBubble(msg);
      }
    }).then(function(res) {
      msg.content = res.content;
      if (res.thinking) msg.thinking = res.thinking;
      msg.loading = false;
      if (res.usage) {
        var n = TokenMeter.record(opts.sel.model, res.usage, conv);
        msg.usage = n;
        if (opts.sessionTokens) opts.sessionTokens.total += n.input + n.output;
      }
      conv.updatedAt = Date.now();
      Store.save();
      ChatModule.updateBubble(msg);
      return msg;
    }).catch(function(err) {
      msg.loading = false;
      if (isAbort(err)) {
        if (!msg.content) msg.content = '（已停止生成）';
      } else {
        msg.error = (err && err.message) || '请求失败';
      }
      conv.updatedAt = Date.now();
      Store.save();
      ChatModule.updateBubble(msg);
      throw err;
    });
  }

  function runDebate(conv, userMsg) {
    var d = debateCfg();
    if (!d.pro || !d.con || !d.judge) {
      Toast.show(ChatI18n.t('needDebateConfig'), 'error');
      openConfig('debate');
      return true;
    }
    var topic = userMsg.content;
    var formatName = (FORMATS[d.format] || FORMATS.standard).name;
    var rounds = Math.min(5, Math.max(1, d.rounds || 1));
    var ctrl = new AbortController();
    ChatModule.setAborter(ctrl);
    ChatModule.setSending(true);
    var sessionTokens = { total: 0 };

    var transcript = [];  // 交锋记录文本

    async function flow() {
      // 正方立论
      var proOpen = await streamRole(conv, {
        badgeText: '正方 · 立论', badgeCls: 'pro', sel: d.pro, signal: ctrl.signal, sessionTokens: sessionTokens,
        prompt: '你是辩论赛正方辩手。辩题：「' + topic + '」。赛制：' + formatName + '。请作开篇立论（300字内）。'
      });
      transcript.push('正方立论：' + proOpen.content);
      if (overTaskLimit(sessionTokens)) throw new Error(ChatI18n.t('taskTokenLimit'));

      // 反方反驳
      var conOpen = await streamRole(conv, {
        badgeText: '反方 · 反驳', badgeCls: 'con', sel: d.con, signal: ctrl.signal, sessionTokens: sessionTokens,
        prompt: '你是辩论赛反方辩手。辩题：「' + topic + '」。正方立论如下：\n' + proOpen.content + '\n请反驳正方并陈述反方立场（300字内）。'
      });
      transcript.push('反方反驳：' + conOpen.content);

      // 按轮数循环交锋（第 2 轮起）
      var lastPro = proOpen.content;
      var lastCon = conOpen.content;
      for (var r = 2; r <= rounds; r++) {
        if (overTaskLimit(sessionTokens)) break;
        var proMsg = await streamRole(conv, {
          badgeText: '正方 · 第' + r + '轮', badgeCls: 'pro', sel: d.pro, signal: ctrl.signal, sessionTokens: sessionTokens,
          prompt: '辩论第' + r + '轮交锋。辩题：「' + topic + '」。你上一轮发言：' + lastPro + '\n反方上一轮发言：' + lastCon + '\n请针对性回应反方（200字内）。'
        });
        lastPro = proMsg.content;
        transcript.push('正方第' + r + '轮：' + lastPro);
        if (overTaskLimit(sessionTokens)) break;
        var conMsg = await streamRole(conv, {
          badgeText: '反方 · 第' + r + '轮', badgeCls: 'con', sel: d.con, signal: ctrl.signal, sessionTokens: sessionTokens,
          prompt: '辩论第' + r + '轮交锋。辩题：「' + topic + '」。你上一轮发言：' + lastCon + '\n正方刚发言：' + lastPro + '\n请针对性回应正方（200字内）。'
        });
        lastCon = conMsg.content;
        transcript.push('反方第' + r + '轮：' + lastCon);
      }

      // 裁判总结评分
      var judgeMsg = await streamRole(conv, {
        badgeText: '裁判 · 总结评分', badgeCls: 'judge', sel: d.judge, signal: ctrl.signal, sessionTokens: sessionTokens,
        prompt: '你是辩论赛裁判。辩题：「' + topic + '」。赛制：' + formatName + '。完整交锋记录：\n' + transcript.join('\n\n') + '\n请总结双方核心观点，分别打分（满分10分）并宣布胜方。'
      });
      transcript.push('裁判：' + judgeMsg.content);
    }

    flow().catch(function(err) {
      if (err && err.message === ChatI18n.t('taskTokenLimit')) {
        Toast.show(err.message);
      }
      // 中断/失败：角色消息已各自标记
    }).then(function() {
      ChatModule.setSending(false);
    });
    return true;
  }

  /* ---------- 协同模式 ---------- */

  function runCollab(conv, userMsg) {
    var workers = collabCfg().workers;
    if (!workers.length) {
      Toast.show(ChatI18n.t('needWorkers'), 'error');
      openConfig('collab');
      return true;
    }
    var topic = userMsg.content;
    var host = { provider: cs().provider, model: cs().provider === 'custom' ? (cs().customModel || '') : (cs().modelId || cs().model) };
    var ctrl = new AbortController();
    ChatModule.setAborter(ctrl);
    ChatModule.setSending(true);
    var sessionTokens = { total: 0 };

    async function hostCall(badgeText, prompt) {
      return streamRole(conv, {
        badgeText: badgeText, badgeCls: 'host', sel: host, signal: ctrl.signal, sessionTokens: sessionTokens,
        prompt: prompt
      });
    }

    async function workerCall(idx, sel, prompt) {
      return streamRole(conv, {
        badgeText: '协作者 ' + (idx + 1), badgeCls: 'worker', sel: sel, signal: ctrl.signal, sessionTokens: sessionTokens,
        prompt: prompt
      });
    }

    function joinResults(list) {
      var parts = [];
      for (var i = 0; i < list.length; i++) {
        parts.push('【子任务' + (i + 1) + '：' + list[i].task + '】\n' + list[i].result);
      }
      return parts.join('\n\n');
    }

    async function flow() {
      // 1. 主持人拆解任务（≤4 子任务）
      var split = await hostCall('主持人 · 任务拆解',
        '你是项目主持人。把用户任务拆解为不超过4个可并行执行的子任务。只输出JSON数组，例如 ["子任务1","子任务2"]，不要输出其他内容。任务：' + topic);
      var tasks = [];
      try {
        var m = /\[[\s\S]*\]/.exec(split.content);
        var parsed = JSON.parse(m ? m[0] : split.content);
        if (Array.isArray(parsed)) tasks = parsed.map(function(x) { return String(x); }).filter(Boolean);
      } catch (e) { /* 解析失败 → 整任务 */ }
      if (!tasks.length) tasks = [topic];
      tasks = tasks.slice(0, 4);
      if (overTaskLimit(sessionTokens)) throw new Error(ChatI18n.t('taskTokenLimit'));

      // 2. 工作者并行执行
      var jobs = tasks.map(function(task, i) {
        var sel = workers[i % workers.length];
        return workerCall(i, sel,
          '你是协作者，负责子任务：「' + task + '」。总任务背景：' + topic + '。请直接产出该子任务的完整成果。')
          .then(function(msg) { return { task: task, result: msg.content }; })
          .catch(function(err) { return { task: task, result: '（执行失败：' + ((err && err.message) || '') + '）' }; });
      });
      var results = await Promise.all(jobs);
      if (overTaskLimit(sessionTokens)) throw new Error(ChatI18n.t('taskTokenLimit'));

      // 3. 主持人评审
      var review = await hostCall('主持人 · 评审',
        '你是项目主持人。任务：' + topic + '\n各子任务成果如下：\n' + joinResults(results) + '\n请评审成果是否充分满足任务。若满足，只输出「通过」；否则逐条列出修改意见。');

      // 4. 不足则修订一轮
      if (review.content.indexOf('通过') === -1 && !overTaskLimit(sessionTokens)) {
        var reviseJobs = results.map(function(r, i) {
          var sel = workers[i % workers.length];
          return workerCall(i, sel,
            '你之前完成的子任务「' + r.task + '」成果：\n' + r.result + '\n主持人评审意见：\n' + review.content + '\n请输出修订后的完整成果。')
            .then(function(msg) { return { task: r.task, result: msg.content }; })
            .catch(function() { return r; });
        });
        results = await Promise.all(reviseJobs);
      }

      // 5. 主持人最终汇总
      await hostCall('主持人 · 最终汇总',
        '你是项目主持人。任务：' + topic + '\n最终子任务成果：\n' + joinResults(results) + '\n请汇总为一份完整、连贯的最终答复。');
    }

    flow().catch(function(err) {
      if (err && err.message === ChatI18n.t('taskTokenLimit')) {
        Toast.show(err.message);
      }
    }).then(function() {
      ChatModule.setSending(false);
    });
    return true;
  }

  return {
    init: init,
    currentMode: currentMode,
    setMode: setMode,
    handleSend: handleSend,
    renderModeBar: renderModeBar,
    openConfig: openConfig,
    availableModels: availableModels
  };
})();
