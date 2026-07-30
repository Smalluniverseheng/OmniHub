/* ==================== OmniHub Chat Module - AI 对话 ==================== */

const ChatModule = (() => {
  'use strict';

  var currentId = null;
  var aborter = null;
  var sending = false;
  var modelTab = 'all';
  var modelSearch = '';
  var quickChecking = false;

  var SUGGESTIONS = ['帮我制定一周学习计划', '解释一下什么是量子纠缠', '推荐三部高分科幻电影'];

  /* ---------- 数据访问 ---------- */

  function chat() { return Store.state.chat; }
  function conversations() { return chat().conversations || []; }

  function currentConv() {
    var list = conversations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === currentId) return list[i];
    }
    return null;
  }

  function currentProvider() {
    var c = chat();
    var p = AIProviders.get(c.provider);
    if (p && p.keySlug === 'custom') {
      p = Object.assign({}, p, {
        base: (c.customBase || '').replace(/\/+$/, ''),
        models: [c.customModel || 'custom-model']
      });
    }
    return p;
  }

  function currentApiKey() {
    var c = chat();
    return (c.keys && c.keys[c.provider]) || '';
  }

  function effectiveModel() {
    var c = chat();
    if (c.provider === 'custom') return c.customModel || '';
    if (c.mode === 'image') {
      var p = AIProviders.get(c.provider);
      return (p && p.imageModel) || c.model;
    }
    return c.model;
  }

  function uid() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- 初始化 ---------- */

  function init() {
    renderLayout();
    renderMessages();
    renderModelPill();
    bindEvents();
    bindSwipe();
  }

  function renderLayout() {
    var body = document.getElementById('chatBody');
    if (!body) return;
    var html = '';
    html += '<div class="chat-wrap">';
    // 顶栏
    html += '<div class="chat-topbar">';
    html += '<button class="chat-topbar-btn" id="chatHistoryBtn" title="对话历史">☰</button>';
    html += '<div class="chat-topbar-mid">';
    html += '<button class="chat-model-pill" id="chatModelPill"></button>';
    html += '<button class="chat-topbar-btn chat-settings-gear" id="chatSettingsBtn" title="API 配置">⚙</button>';
    html += '</div>';
    html += '<button class="chat-topbar-btn" id="chatNewBtn" title="新对话">＋</button>';
    html += '</div>';
    // 消息区
    html += '<div class="chat-messages" id="chatMessages"></div>';
    // 输入卡片
    html += '<div class="chat-input-card">';
    html += '<textarea id="chatInput" placeholder="输入消息..." rows="1"></textarea>';
    html += '<button class="chat-send-btn" id="chatSendBtn">➤</button>';
    html += '</div>';
    html += '</div>';
    body.innerHTML = html;
  }

  function bindEvents() {
    var historyBtn = document.getElementById('chatHistoryBtn');
    if (historyBtn) {
      historyBtn.addEventListener('click', function() {
        renderHistory();
        App.openSub('subChatHistory');
      });
    }

    var newBtn = document.getElementById('chatNewBtn');
    if (newBtn) {
      newBtn.addEventListener('click', function() {
        newConversation();
      });
    }

    var pill = document.getElementById('chatModelPill');
    if (pill) {
      pill.addEventListener('click', function() {
        renderModelPage();
        App.openSub('subChatModel');
      });
    }

    var settingsGear = document.getElementById('chatSettingsBtn');
    if (settingsGear) {
      settingsGear.addEventListener('click', function() {
        renderSettings();
        App.openSub('subChatSettings');
      });
    }

    var input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('input', function() { autoGrow(this); });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSend();
        }
      });
    }

    var sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', function() { onSend(); });
    }

    // 消息区事件委托：重试 / 图片长按提示
    var messages = document.getElementById('chatMessages');
    if (messages) {
      messages.addEventListener('click', function(e) {
        var retry = e.target.closest('.chat-retry-btn');
        if (retry) {
          retryMessage(retry.dataset.retryMsg);
          return;
        }
        var sug = e.target.closest('.chat-suggest-chip');
        if (sug) {
          sendText(sug.dataset.text || sug.textContent);
        }
      });
      messages.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG') {
          Toast.show('长按图片可保存到相册');
        }
      });
    }

    // 历史子页面事件委托
    var historyBody = document.getElementById('chatHistoryBody');
    if (historyBody) {
      historyBody.addEventListener('click', function(e) {
        var del = e.target.closest('.chat-history-del');
        if (del) {
          e.stopPropagation();
          deleteConversation(del.dataset.del);
          return;
        }
        var item = e.target.closest('.chat-history-item');
        if (item) {
          loadConversation(item.dataset.conv);
        }
      });
    }

    // 模型子页面事件委托
    var modelBody = document.getElementById('chatModelBody');
    if (modelBody) {
      modelBody.addEventListener('click', function(e) {
        var tab = e.target.closest('.chat-model-tab');
        if (tab) {
          modelTab = tab.dataset.mtab;
          renderModelPage();
          return;
        }
        var row = e.target.closest('.chat-model-row');
        if (row && !row.classList.contains('disabled')) {
          if (row.dataset.mid) {
            selectCatalogModel(row.dataset.mid);
          } else {
            selectModel(row.dataset.provider, row.dataset.model, row.dataset.mode);
          }
          return;
        }
      });
      modelBody.addEventListener('input', function(e) {
        if (e.target.id === 'chatModelSearch') {
          modelSearch = e.target.value.trim().toLowerCase();
          renderModelList();
        }
      });
    }

    // 设置子页面事件委托
    var settingsBody = document.getElementById('chatSettingsBody');
    if (settingsBody) {
      settingsBody.addEventListener('input', function(e) {
        var t = e.target;
        var c = chat();
        if (t.dataset.key) {
          c.keys[t.dataset.key] = t.value.trim();
          Store.save();
        } else if (t.dataset.field) {
          c[t.dataset.field] = t.value.trim();
          Store.save();
        } else if (t.id === 'chatTempRange') {
          c.temperature = parseFloat(t.value);
          var label = document.getElementById('chatTempValue');
          if (label) label.textContent = c.temperature.toFixed(1);
          Store.save();
        } else if (t.id === 'chatMaxTokensInput') {
          var v = parseInt(t.value, 10);
          if (!isNaN(v) && v > 0) {
            c.maxTokens = v;
            Store.save();
          }
        } else if (t.id === 'chatQuickKey') {
          // 按前缀自动选中猜测厂商
          var sel = document.getElementById('chatQuickProvider');
          if (sel) sel.value = AIProviders.guessKeyProvider(t.value);
        }
      });
      settingsBody.addEventListener('click', function(e) {
        var toggle = e.target.closest('.chat-key-toggle');
        if (toggle) {
          var input = toggle.parentNode.querySelector('input');
          if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            toggle.textContent = input.type === 'password' ? '👁' : '🙈';
          }
          return;
        }
        if (e.target.closest('#chatQuickBtn')) {
          doQuickCheck();
          return;
        }
        if (e.target.closest('#chatClearAll')) {
          if (confirm('确定清除所有对话？此操作不可恢复！')) {
            chat().conversations = [];
            currentId = null;
            Store.save();
            renderMessages();
            Toast.show('已清除所有对话');
          }
        }
      });
    }
  }

  // 一键配置：识别厂商 + 检测有效性，成功才写入
  function doQuickCheck() {
    if (quickChecking) return;
    var keyInput = document.getElementById('chatQuickKey');
    var baseInput = document.getElementById('chatQuickBase');
    var sel = document.getElementById('chatQuickProvider');
    var btn = document.getElementById('chatQuickBtn');
    if (!keyInput || !sel) return;
    var key = keyInput.value.trim();
    if (!key) {
      Toast.show('请先粘贴 API Key', 'error');
      return;
    }
    var slug = sel.value;
    var base = baseInput ? baseInput.value.trim() : '';
    var p = AIProviders.get(slug);

    quickChecking = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="chat-spin"></span>检测中…';
    }

    AIAPI.validateKey(slug, key, base).then(function(res) {
      quickChecking = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '识别并检测';
      }
      if (res.ok) {
        var c = chat();
        if (!c.keys) c.keys = {};
        c.keys[slug] = key;
        if (slug === 'custom' && base) c.customBase = base.replace(/\/+$/, '');
        Store.save();
        if (res.models && res.models.length) {
          console.log('[OmniHub] ' + (p ? p.name : slug) + ' 可用模型(' + res.models.length + '):', res.models);
        }
        Toast.show('✓ 验证有效，已配置 ' + (p ? p.name : slug), 'success');
        renderSettings();
      } else {
        Toast.show('✗ Key 无效或接口不可达：' + (res.error || '未知原因'), 'error');
      }
    }).catch(function(err) {
      quickChecking = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '识别并检测';
      }
      Toast.show('✗ Key 无效或接口不可达：' + ((err && err.message) || '网络错误'), 'error');
    });
  }

  // Kimi 式滑动历史：左边缘 30px 起手，右滑 >80px 且纵向位移 <60px
  function bindSwipe() {
    var page = document.getElementById('page-chat');
    if (!page) return;
    var sx = 0, sy = 0, tracking = false;
    page.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      if (t.clientX <= 30) {
        sx = t.clientX;
        sy = t.clientY;
        tracking = true;
      } else {
        tracking = false;
      }
    }, { passive: true });
    page.addEventListener('touchmove', function(e) {
      // 保持 passive，仅跟踪，不阻止默认滚动
    }, { passive: true });
    page.addEventListener('touchend', function(e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      if (dx > 80 && Math.abs(dy) < 60) {
        renderHistory();
        App.openSub('subChatHistory');
      }
    }, { passive: true });
  }

  /* ---------- 渲染：消息区 ---------- */

  function renderModelPill() {
    var pill = document.getElementById('chatModelPill');
    if (!pill) return;
    var p = currentProvider();
    var color = (p && p.color) || '#6366F1';
    var entry = currentModelEntry();
    var label = (entry && (entry.name || entry.id)) || effectiveModel() || '选择模型';
    if (chat().mode === 'image') label += ' · 绘画';
    pill.innerHTML = '<span class="chat-provider-dot" style="background:' + color + '"></span>' +
      '<span class="chat-pill-txt">' + esc(label) + '</span>';
  }

  function renderMessages() {
    var box = document.getElementById('chatMessages');
    if (!box) return;
    var conv = currentConv();
    var html = '';
    if (!conv || !conv.messages.length) {
      html += renderWelcome();
    } else {
      for (var i = 0; i < conv.messages.length; i++) {
        html += messageHtml(conv.messages[i]);
      }
    }
    box.innerHTML = html;
    scrollBottom();
  }

  function renderWelcome() {
    var entry = currentModelEntry();
    var name = (entry && (entry.name || entry.id)) || effectiveModel() || 'AI';
    var isImage = chat().mode === 'image';
    var sub = isImage ? '描述你想要的画面，我来帮你画' : (entry ? modelDesc(entry) : '有什么可以帮你的吗？');
    var html = '<div class="chat-welcome">';
    html += '<div class="chat-welcome-icon">' + (isImage ? '🎨' : '✦') + '</div>';
    html += '<div class="chat-welcome-text">你好，我是 ' + esc(name) + '</div>';
    html += '<div class="chat-welcome-sub">' + esc(sub) + '</div>';
    if (!isImage) {
      html += '<div class="chat-suggest">';
      for (var i = 0; i < SUGGESTIONS.length; i++) {
        html += '<button class="chat-suggest-chip" data-text="' + esc(SUGGESTIONS[i]) + '">' + esc(SUGGESTIONS[i]) + '</button>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function messageHtml(msg) {
    var isUser = msg.role === 'user';
    var html = '<div class="chat-msg ' + (isUser ? 'chat-msg-user' : 'chat-msg-ai') + '" id="chatMsg_' + msg.id + '">';
    if (!isUser) html += '<div class="chat-avatar">✦</div>';
    html += '<div class="chat-bubble' + (msg.error ? ' chat-bubble-error' : '') + '">';
    html += '<div class="chat-bubble-content">' + bubbleContentHtml(msg) + '</div>';
    html += '</div></div>';
    return html;
  }

  function bubbleContentHtml(msg) {
    if (msg.error) {
      return '<div class="chat-error-text">' + esc(msg.error) + '</div>' +
        '<button class="chat-retry-btn" data-retry-msg="' + msg.id + '">重试</button>';
    }
    if (msg.image) {
      return '<img class="chat-msg-image" src="' + msg.image + '" alt="生成图片">';
    }
    if (msg.loading && !msg.content) {
      return '<span class="chat-typing"><i></i><i></i><i></i></span>';
    }
    return renderContent(msg.content || '');
  }

  // 基础渲染：先 esc，再 ```code``` → pre，「code」→ code，换行 → <br>
  function renderContent(text) {
    var s = esc(text);
    var blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, function(m, lang, code) {
      blocks.push('<pre><code>' + code.replace(/\n$/, '') + '</code></pre>');
      return '￿' + (blocks.length - 1) + '￿';
    });
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\n/g, '<br>');
    s = s.replace(/￿(\d+)￿/g, function(m, i) { return blocks[parseInt(i, 10)]; });
    return s;
  }

  // 流式更新：只更新目标气泡，不整页重渲
  function updateBubble(msg) {
    var el = document.getElementById('chatMsg_' + msg.id);
    if (!el) { renderMessages(); return; }
    var bubble = el.querySelector('.chat-bubble');
    var content = el.querySelector('.chat-bubble-content');
    if (bubble) bubble.classList.toggle('chat-bubble-error', !!msg.error);
    if (content) content.innerHTML = bubbleContentHtml(msg);
    scrollBottom();
  }

  function scrollBottom() {
    var box = document.getElementById('chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function autoGrow(textarea) {
    textarea.style.height = 'auto';
    var max = 120; // 约 5 行
    textarea.style.height = Math.min(textarea.scrollHeight, max) + 'px';
  }

  /* ---------- 会话管理 ---------- */

  function ensureConversation(firstText) {
    var conv = currentConv();
    if (conv) return conv;
    conv = {
      id: 'conv_' + Date.now(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    conversations().unshift(conv);
    currentId = conv.id;
    return conv;
  }

  function newConversation() {
    if (sending) stopSending();
    currentId = null;
    renderMessages();
    var input = document.getElementById('chatInput');
    if (input) input.focus();
  }

  function loadConversation(id) {
    if (sending) stopSending();
    currentId = id;
    App.closeSub();
    renderMessages();
  }

  function deleteConversation(id) {
    var list = conversations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        break;
      }
    }
    if (currentId === id) {
      currentId = null;
      renderMessages();
    }
    Store.save();
    renderHistory();
  }

  /* ---------- 发送流程 ---------- */

  function onSend() {
    if (sending) {
      stopSending();
      return;
    }
    var input = document.getElementById('chatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoGrow(input);
    sendText(text);
  }

  function sendText(text) {
    if (!text || sending) return;
    var c = chat();

    // 无 key / 未配置自定义接口 → 提示并打开设置页
    if (c.provider === 'custom') {
      if (!c.customBase || !c.customModel) {
        Toast.show('请先在对话设置中填写自定义接口与模型', 'error');
        renderSettings();
        App.openSub('subChatSettings');
        return;
      }
    } else if (!currentApiKey()) {
      var p = AIProviders.get(c.provider);
      Toast.show('请先填写 ' + (p ? p.name : '') + ' 的 API Key', 'error');
      renderSettings();
      App.openSub('subChatSettings');
      return;
    }

    var conv = ensureConversation(text);
    conv.messages.push({ id: uid(), role: 'user', content: text, ts: Date.now() });
    // 首条用户消息后自动命名（前 20 字）
    if (conv.title === '新对话') conv.title = text.slice(0, 20);
    conv.updatedAt = Date.now();
    Store.save();

    if (c.mode === 'image') {
      doImage(conv, text);
    } else {
      doChat(conv);
    }
  }

  function buildMessages(conv) {
    var c = chat();
    var msgs = [];
    if (c.systemPrompt) msgs.push({ role: 'system', content: c.systemPrompt });
    var hist = [];
    for (var i = 0; i < conv.messages.length; i++) {
      var m = conv.messages[i];
      if (m.loading || m.error) continue;
      hist.push(m);
    }
    hist = hist.slice(-20);
    for (var j = 0; j < hist.length; j++) {
      var h = hist[j];
      msgs.push({ role: h.role, content: h.image ? '[生成了一张图片]' : h.content });
    }
    return msgs;
  }

  function doChat(conv) {
    var c = chat();
    var assistant = { id: uid(), role: 'assistant', content: '', loading: true, ts: Date.now() };
    conv.messages.push(assistant);
    conv.updatedAt = Date.now();
    Store.save();
    renderMessages();
    setSending(true);

    aborter = new AbortController();
    AIAPI.chat({
      provider: currentProvider(),
      model: effectiveModel(),
      apiKey: currentApiKey(),
      messages: buildMessages(conv),
      temperature: c.temperature,
      maxTokens: c.maxTokens,
      signal: aborter.signal,
      onChunk: function(full) {
        assistant.content = full;
        updateBubble(assistant);
      }
    }).then(function(res) {
      assistant.content = res.content;
      assistant.loading = false;
      if (res.usage) assistant.usage = res.usage;
      conv.updatedAt = Date.now();
      Store.save();
      updateBubble(assistant);
      setSending(false);
    }).catch(function(err) {
      assistant.loading = false;
      if (isAbort(err)) {
        if (!assistant.content) assistant.content = '（已停止生成）';
      } else {
        assistant.error = err.message || '请求失败';
      }
      conv.updatedAt = Date.now();
      Store.save();
      updateBubble(assistant);
      setSending(false);
    });
  }

  function doImage(conv, prompt) {
    var assistant = { id: uid(), role: 'assistant', content: '', image: '', loading: true, ts: Date.now() };
    conv.messages.push(assistant);
    conv.updatedAt = Date.now();
    Store.save();
    renderMessages();
    setSending(true);

    aborter = new AbortController();
    AIAPI.generateImage({
      provider: currentProvider(),
      prompt: prompt,
      apiKey: currentApiKey(),
      size: '1024x1024',
      signal: aborter.signal
    }).then(function(url) {
      assistant.image = url;
      assistant.content = prompt;
      assistant.loading = false;
      conv.updatedAt = Date.now();
      Store.save();
      updateBubble(assistant);
      setSending(false);
    }).catch(function(err) {
      assistant.loading = false;
      if (isAbort(err)) {
        assistant.content = '（已停止生成）';
      } else {
        assistant.error = err.message || '图片生成失败';
      }
      conv.updatedAt = Date.now();
      Store.save();
      updateBubble(assistant);
      setSending(false);
    });
  }

  function retryMessage(msgId) {
    if (sending) return;
    var conv = currentConv();
    if (!conv) return;
    // 移除失败的 assistant 消息后重试
    for (var i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].id === msgId) {
        var lastImage = conv.messages[i].image || '';
        var wasImageMode = !!lastImage || chat().mode === 'image';
        var lastUser = null;
        for (var j = i - 1; j >= 0; j--) {
          if (conv.messages[j].role === 'user') { lastUser = conv.messages[j]; break; }
        }
        conv.messages.splice(i, 1);
        Store.save();
        renderMessages();
        if (wasImageMode && lastUser) doImage(conv, lastUser.content);
        else doChat(conv);
        return;
      }
    }
  }

  function stopSending() {
    if (aborter) {
      try { aborter.abort(); } catch (e) { /* ignore */ }
    }
  }

  function isAbort(err) {
    return err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
  }

  function setSending(v) {
    sending = v;
    var btn = document.getElementById('chatSendBtn');
    if (btn) {
      btn.textContent = v ? '■' : '➤';
      btn.classList.toggle('stop', v);
    }
  }

  /* ---------- 历史子页面 ---------- */

  function renderHistory() {
    var body = document.getElementById('chatHistoryBody');
    if (!body) return;
    var list = conversations();
    var html = '';
    if (!list.length) {
      html = '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">暂无对话历史</div></div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var conv = list[i];
        html += '<div class="chat-history-item' + (conv.id === currentId ? ' active' : '') + '" data-conv="' + conv.id + '">';
        html += '<div class="chat-history-info">';
        html += '<div class="chat-history-title">' + esc(conv.title || '新对话') + '</div>';
        html += '<div class="chat-history-time">' + formatTime(conv.updatedAt) + ' · ' + conv.messages.length + ' 条消息</div>';
        html += '</div>';
        html += '<button class="chat-history-del" data-del="' + conv.id + '">🗑</button>';
        html += '</div>';
      }
    }
    body.innerHTML = html;
  }

  /* ---------- 模型选择子页面（流光风格） ---------- */

  // 厂商徽标：颜色 + 首字缩写（未映射厂商用名称哈希取色）
  function providerMeta(name) {
    var slug = AIProviders.mapModelProvider(name);
    var p = AIProviders.get(slug);
    var color = (p && slug !== 'custom') ? p.color : hashColor(name || '?');
    var n = String(name || '?');
    var first = n.charAt(0);
    var abbr = /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
    return { color: color, abbr: abbr, slug: slug };
  }

  function hashColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',55%,45%)';
  }

  // 一行简介：ctx / vision / thinking 拼接
  function modelDesc(m) {
    var parts = [];
    if (m.ctx) parts.push(m.ctx >= 1024 ? Math.round(m.ctx / 10.24) + '万上下文' : m.ctx + 'K上下文');
    if (m.vision) parts.push('支持视觉');
    if (m.thinking) parts.push('深度思考');
    if (parts.length) return parts.join(' · ');
    return m.desc || m.provider || 'AI 模型';
  }

  function currentModelEntry() {
    if (typeof AIModels === 'undefined') return null;
    var c = chat();
    return AIModels.get(c.modelId || c.model);
  }

  function renderModelPage() {
    var body = document.getElementById('chatModelBody');
    if (!body) return;
    var tabs = [
      { id: 'all', name: '全部' },
      { id: 'chat', name: '聊天' },
      { id: 'image', name: '图片' },
      { id: 'video', name: '视频' }
    ];
    var html = '';
    html += '<div class="chat-model-tabs">';
    for (var i = 0; i < tabs.length; i++) {
      html += '<button class="chat-model-tab' + (modelTab === tabs[i].id ? ' active' : '') + '" data-mtab="' + tabs[i].id + '">' + tabs[i].name + '</button>';
    }
    html += '</div>';
    html += '<div class="chat-model-search"><input type="text" id="chatModelSearch" placeholder="搜索模型或功能" value="' + esc(modelSearch) + '"></div>';
    html += '<div id="chatModelList"></div>';
    body.innerHTML = html;
    renderModelList();
  }

  function catalogRowHtml(m) {
    var c = chat();
    var meta = providerMeta(m.provider);
    // 仅非对话类型（tts/asr 等）不可选；已下架仅标记仍可点选
    var disabled = m.type !== 'chat' && m.type !== 'image' && m.type !== 'video';
    var active = !disabled && c.mode !== 'image' && (c.modelId === m.id || (!c.modelId && c.model === m.id && c.provider === meta.slug));
    var html = '<div class="chat-model-row' + (active ? ' active' : '') + (disabled ? ' disabled' : '') + '" data-mid="' + esc(m.id) + '">';
    html += '<div class="chat-model-icon" style="background:' + meta.color + '">' + esc(meta.abbr) + '</div>';
    html += '<div class="chat-model-info">';
    html += '<div class="chat-model-name">' + esc(m.name || m.id) + '</div>';
    var desc = modelDesc(m);
    if (disabled) desc += ' · ' + esc(m.type);
    else if (m.status === 'deprecated') desc += ' · 已下架';
    html += '<div class="chat-model-desc">' + esc(desc) + '</div>';
    html += '</div>';
    if (active) html += '<div class="chat-model-check">✓</div>';
    html += '</div>';
    return html;
  }

  function filterSearch(list) {
    if (!modelSearch) return list;
    return list.filter(function(m) {
      return (m.id || '').toLowerCase().indexOf(modelSearch) !== -1 ||
        (m.name || '').toLowerCase().indexOf(modelSearch) !== -1 ||
        (m.provider || '').toLowerCase().indexOf(modelSearch) !== -1 ||
        (m.desc || '').toLowerCase().indexOf(modelSearch) !== -1;
    });
  }

  function renderModelList() {
    var box = document.getElementById('chatModelList');
    if (!box) return;
    var c = chat();
    var html = '';
    var i;

    if (modelTab === 'video') {
      // 视频 Tab：目录中的 video 模型全部灰显「即将上线」
      html += '<div class="chat-video-coming">🎬 视频生成即将上线</div>';
      var videos = typeof AIModels !== 'undefined' ? filterSearch(AIModels.byType('video')) : [];
      for (i = 0; i < videos.length; i++) {
        var v = videos[i];
        var vMeta = providerMeta(v.provider);
        html += '<div class="chat-model-row disabled">';
        html += '<div class="chat-model-icon" style="background:' + vMeta.color + '">' + esc(vMeta.abbr) + '</div>';
        html += '<div class="chat-model-info">';
        html += '<div class="chat-model-name">' + esc(v.name || v.id) + '</div>';
        html += '<div class="chat-model-desc">' + esc(modelDesc(v)) + ' · 即将上线</div>';
        html += '</div></div>';
      }
      var planned = [
        { name: 'Sora', desc: 'OpenAI 视频生成模型' },
        { name: '可灵', desc: '快手视频生成模型' },
        { name: 'Vidu', desc: '生数科技视频生成模型' }
      ];
      for (i = 0; i < planned.length; i++) {
        if (modelSearch && planned[i].name.toLowerCase().indexOf(modelSearch) === -1 && planned[i].desc.toLowerCase().indexOf(modelSearch) === -1) continue;
        html += '<div class="chat-model-row disabled">';
        html += '<div class="chat-model-icon" style="background:#3a3a40">🎬</div>';
        html += '<div class="chat-model-info">';
        html += '<div class="chat-model-name">' + planned[i].name + '</div>';
        html += '<div class="chat-model-desc">' + planned[i].desc + ' · 即将上线</div>';
        html += '</div></div>';
      }
    } else if (modelTab === 'image') {
      var hasAny = false;
      if (typeof AIModels !== 'undefined') {
        var images = filterSearch(AIModels.byType('image'));
        for (i = 0; i < images.length; i++) { html += catalogRowHtml(images[i]); hasAny = true; }
      }
      var providers = AIProviders.list();
      for (i = 0; i < providers.length; i++) {
        var ip = providers[i];
        if (!ip.imageModel) continue;
        if (modelSearch && ip.name.toLowerCase().indexOf(modelSearch) === -1 && ip.imageModel.toLowerCase().indexOf(modelSearch) === -1) continue;
        hasAny = true;
        var iActive = c.mode === 'image' && c.provider === ip.keySlug;
        html += '<div class="chat-model-row' + (iActive ? ' active' : '') + '" data-provider="' + ip.keySlug + '" data-model="' + esc(ip.imageModel) + '" data-mode="image">';
        html += '<div class="chat-model-icon" style="background:' + ip.color + '">' + esc(ip.name.charAt(0).toUpperCase()) + '</div>';
        html += '<div class="chat-model-info">';
        html += '<div class="chat-model-name">' + esc(ip.imageModel) + '</div>';
        html += '<div class="chat-model-desc">文生图模型 · 发送消息直接出图</div>';
        html += '</div>';
        if (iActive) html += '<div class="chat-model-check">✓</div>';
        html += '</div>';
      }
      if (!hasAny) html = '<div class="empty-state"><div class="empty-text">没有匹配的图片模型</div></div>';
    } else {
      // 全部 / 聊天
      var models = [];
      if (typeof AIModels !== 'undefined') {
        models = modelTab === 'chat' ? AIModels.byType('chat') : AIModels.list();
        models = filterSearch(models);
      }
      // 自定义接口模型置顶（已配置时）
      if (c.customModel && (!modelSearch || c.customModel.toLowerCase().indexOf(modelSearch) !== -1)) {
        var cActive = c.mode !== 'image' && c.provider === 'custom' && !c.modelId;
        html += '<div class="chat-model-row' + (cActive ? ' active' : '') + '" data-provider="custom" data-model="' + esc(c.customModel) + '" data-mode="chat">';
        html += '<div class="chat-model-icon" style="background:#8B5CF6">自</div>';
        html += '<div class="chat-model-info">';
        html += '<div class="chat-model-name">' + esc(c.customModel) + '</div>';
        html += '<div class="chat-model-desc">自定义 OpenAI 兼容接口</div>';
        html += '</div>';
        if (cActive) html += '<div class="chat-model-check">✓</div>';
        html += '</div>';
      }
      for (i = 0; i < models.length; i++) html += catalogRowHtml(models[i]);
      if (!html) html = '<div class="empty-state"><div class="empty-text">没有匹配的模型</div></div>';
    }
    box.innerHTML = html;
  }

  // 选中模型目录条目：映射厂商并写入 Store
  function selectCatalogModel(mid) {
    if (typeof AIModels === 'undefined') return;
    var m = AIModels.get(mid);
    if (!m) return;
    var c = chat();
    var slug = AIProviders.mapModelProvider(m.provider);
    c.modelId = m.id;
    if (m.type === 'image') c.mode = 'image';
    else c.mode = 'chat';
    if (slug === 'custom') {
      c.provider = 'custom';
      c.customModel = m.id;
    } else {
      c.provider = slug;
      c.model = m.id;
    }
    Store.save();
    renderModelPill();
    renderMessages();
    App.closeSub();
    Toast.show('已切换到 ' + (m.name || m.id));
  }

  function selectModel(providerSlug, model, mode) {
    var c = chat();
    c.provider = providerSlug;
    c.mode = mode;
    c.modelId = '';
    if (mode === 'chat') c.model = model;
    Store.save();
    renderModelPill();
    renderMessages();
    App.closeSub();
    var p = AIProviders.get(providerSlug);
    Toast.show('已切换到 ' + (p ? p.name : providerSlug) + ' · ' + model);
  }

  /* ---------- 设置子页面 ---------- */

  function renderSettings() {
    var body = document.getElementById('chatSettingsBody');
    if (!body) return;
    var c = chat();
    var providers = AIProviders.list();
    var html = '';
    var i;

    // 一键配置：粘贴 Key 自动识别厂商并检测
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">一键配置</div>';
    html += '<div class="chat-quick-card">';
    html += '<textarea id="chatQuickKey" rows="2" placeholder="粘贴 API Key，自动识别厂商"></textarea>';
    html += '<input type="text" id="chatQuickBase" placeholder="接口地址(可选，默认官方)">';
    html += '<div class="chat-quick-row">';
    html += '<select id="chatQuickProvider">';
    for (i = 0; i < providers.length; i++) {
      html += '<option value="' + providers[i].keySlug + '"' + (providers[i].keySlug === 'openai' ? ' selected' : '') + '>' + esc(providers[i].name) + '</option>';
    }
    html += '</select>';
    html += '<button class="btn-primary chat-quick-btn" id="chatQuickBtn">识别并检测</button>';
    html += '</div></div></div>';

    // 分别配置（折叠）：各家 Key 单独输入
    html += '<details class="chat-manual">';
    html += '<summary>分别配置</summary>';

    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">API 密钥</div>';
    for (i = 0; i < providers.length; i++) {
      var p = providers[i];
      if (p.keySlug === 'custom') continue;
      var key = (c.keys && c.keys[p.keySlug]) || '';
      html += '<div class="chat-key-row">';
      html += '<div class="chat-key-label"><span class="chat-provider-dot" style="background:' + p.color + '"></span>' + esc(p.name) + '</div>';
      html += '<div class="chat-key-input">';
      html += '<input type="password" data-key="' + p.keySlug + '" value="' + esc(key) + '" placeholder="填写 ' + esc(p.name) + ' API Key">';
      html += '<button class="chat-key-toggle" type="button">👁</button>';
      html += '</div></div>';
    }
    html += '</div>';

    // 自定义厂商
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">自定义接口（OpenAI 兼容）</div>';
    html += '<div class="chat-key-row">';
    html += '<div class="chat-key-label"><span class="chat-provider-dot" style="background:#8B5CF6"></span>接口地址</div>';
    html += '<div class="chat-key-input"><input type="text" data-field="customBase" value="' + esc(c.customBase || '') + '" placeholder="https://your-api.com"></div>';
    html += '</div>';
    html += '<div class="chat-key-row">';
    html += '<div class="chat-key-label"><span class="chat-provider-dot" style="background:#8B5CF6"></span>模型名称</div>';
    html += '<div class="chat-key-input"><input type="text" data-field="customModel" value="' + esc(c.customModel || '') + '" placeholder="your-model-name"></div>';
    html += '</div>';
    html += '<div class="chat-key-row">';
    html += '<div class="chat-key-label"><span class="chat-provider-dot" style="background:#8B5CF6"></span>API Key</div>';
    html += '<div class="chat-key-input">';
    html += '<input type="password" data-key="custom" value="' + esc((c.keys && c.keys.custom) || '') + '" placeholder="可留空">';
    html += '<button class="chat-key-toggle" type="button">👁</button>';
    html += '</div></div>';
    html += '</div>';

    html += '</details>';

    // 生成参数
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">生成参数</div>';
    html += '<div class="chat-param-row">';
    html += '<div class="chat-param-label">Temperature <span id="chatTempValue">' + (c.temperature || 0).toFixed(1) + '</span></div>';
    html += '<input type="range" id="chatTempRange" min="0" max="2" step="0.1" value="' + (c.temperature || 0.7) + '">';
    html += '</div>';
    html += '<div class="chat-param-row">';
    html += '<div class="chat-param-label">最大 Token 数</div>';
    html += '<input type="number" id="chatMaxTokensInput" min="1" max="128000" value="' + (c.maxTokens || 4096) + '">';
    html += '</div>';
    html += '</div>';

    // 危险操作
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title" style="color:var(--danger)">危险操作</div>';
    html += '<button class="btn-secondary chat-clear-btn" id="chatClearAll">🗑 清除所有对话</button>';
    html += '</div>';

    body.innerHTML = html;
  }

  /* ---------- 工具 ---------- */

  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init };
})();
