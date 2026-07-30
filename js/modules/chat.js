/* ==================== OmniHub Chat Module - AI 对话 ==================== */

const ChatModule = (() => {
  'use strict';

  var currentId = null;
  var aborter = null;
  var sending = false;
  var modelTab = 'all';
  var modelSearch = '';
  var quickChecking = false;
  var pendingAttachments = []; // 待发送附件 [{id,kind:'image'|'file',name,dataUrl?,text?}]
  var attSeq = 0;

  var SUGGESTIONS = ['帮我制定一周学习计划', '解释一下什么是量子纠缠', '推荐三部高分科幻电影'];

  var TRASH_TTL = 15 * 24 * 3600 * 1000;  // 对话回收站 15 天过期

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
    if (typeof Voice !== 'undefined') {
      Voice.onStateChange = function() { updateSpeakButtons(); };
    }
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
    // 附件预览条
    html += '<div class="chat-attach-strip hidden" id="chatAttachStrip"></div>';
    // 输入卡片
    html += '<div class="chat-input-card">';
    html += '<button class="chat-plus-btn" id="chatPlusBtn" title="更多功能">+</button>';
    html += '<textarea id="chatInput" placeholder="输入消息..." rows="1"></textarea>';
    html += '<button class="chat-send-btn" id="chatSendBtn">➤</button>';
    html += '</div>';
    // 隐藏文件选择器
    html += '<input type="file" id="chatCameraInput" accept="image/' + '*" capture="environment" class="hidden">';
    html += '<input type="file" id="chatPhotosInput" accept="image/' + '*" multiple class="hidden">';
    html += '<input type="file" id="chatFileInput" accept=".txt,.md,.json,.js,.ts,.html,.css,.py,.java,.c,.cpp,.xml,.yaml,.yml,.csv,.log,.ini,.conf,.sh" class="hidden">';
    // Kimi 式加号面板（遮罩 + 底部半屏面板）
    html += '<div class="chat-plus-mask" id="chatPlusMask"></div>';
    html += '<div class="chat-plus-sheet" id="chatPlusSheet">';
    // 主视图
    html += '<div id="chatPlusMain">';
    html += '<div class="chat-plus-grid">';
    html += '<button class="chat-plus-cell" data-plus="camera"><span class="chat-plus-icon">📷</span><span class="chat-plus-label">拍照</span></button>';
    html += '<button class="chat-plus-cell" data-plus="photos"><span class="chat-plus-icon">🖼️</span><span class="chat-plus-label">照片</span></button>';
    html += '<button class="chat-plus-cell" data-plus="file"><span class="chat-plus-icon">📄</span><span class="chat-plus-label">本地文件</span></button>';
    html += '<button class="chat-plus-cell" data-plus="presets"><span class="chat-plus-icon">💬</span><span class="chat-plus-label">常用语</span></button>';
    html += '</div>';
    html += '<div class="chat-plus-settings">';
    html += '<div class="chat-plus-row">';
    html += '<div class="chat-plus-row-info"><div class="chat-plus-row-name">深度思考</div><div class="chat-plus-row-sub" id="chatThinkingSub"></div></div>';
    html += '<div class="toggle-switch" id="chatThinkingToggle"></div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    // 常用语二级视图
    html += '<div id="chatPresetView" class="hidden">';
    html += '<div class="chat-plus-subhead"><button class="chat-plus-back" id="chatPresetBack">←</button><span>常用语</span></div>';
    html += '<div class="chat-preset-list" id="chatPresetList"></div>';
    html += '<div class="chat-preset-new">';
    html += '<input type="text" id="chatPresetTitle" placeholder="标题">';
    html += '<textarea id="chatPresetContent" rows="3" placeholder="内容"></textarea>';
    html += '<button class="btn-primary chat-preset-add" id="chatPresetAdd">＋ 新建常用语</button>';
    html += '</div>';
    html += '</div>';
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

    // 加号按钮与面板
    var plusBtn = document.getElementById('chatPlusBtn');
    if (plusBtn) {
      plusBtn.addEventListener('click', function() { openPlus(); });
    }
    var plusMask = document.getElementById('chatPlusMask');
    if (plusMask) {
      plusMask.addEventListener('click', function() { closePlus(); });
    }
    var plusSheet = document.getElementById('chatPlusSheet');
    if (plusSheet) {
      plusSheet.addEventListener('click', function(e) {
        var cell = e.target.closest('.chat-plus-cell');
        if (cell) {
          onPlusAction(cell.dataset.plus);
          return;
        }
        if (e.target.closest('#chatThinkingToggle')) {
          toggleThinking();
          return;
        }
        if (e.target.closest('#chatPresetBack')) {
          showPlusMain();
          return;
        }
        if (e.target.closest('#chatPresetAdd')) {
          addPreset();
          return;
        }
        var presetDel = e.target.closest('.chat-preset-del');
        if (presetDel) {
          e.stopPropagation();
          deletePreset(presetDel.dataset.del);
          return;
        }
        var presetItem = e.target.closest('.chat-preset-item');
        if (presetItem) {
          applyPreset(presetItem.dataset.pid);
        }
      });
    }

    // 文件选择器
    var cameraInput = document.getElementById('chatCameraInput');
    if (cameraInput) {
      cameraInput.addEventListener('change', function() {
        if (this.files && this.files.length) addImageFiles(this.files);
        this.value = '';
      });
    }
    var photosInput = document.getElementById('chatPhotosInput');
    if (photosInput) {
      photosInput.addEventListener('change', function() {
        if (this.files && this.files.length) addImageFiles(this.files);
        this.value = '';
      });
    }
    var fileInput = document.getElementById('chatFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        if (this.files && this.files.length) addTextFile(this.files[0]);
        this.value = '';
      });
    }

    // 附件预览条：删除
    var attachStrip = document.getElementById('chatAttachStrip');
    if (attachStrip) {
      attachStrip.addEventListener('click', function(e) {
        var del = e.target.closest('[data-att-del]');
        if (del) removeAttachment(del.dataset.attDel);
      });
    }

    // 消息区事件委托：重试 / 建议 / 图片全屏 / 朗读 / 思考折叠
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
          return;
        }
        var speakBtn = e.target.closest('.chat-speak-btn');
        if (speakBtn) {
          toggleSpeak(speakBtn.dataset.speak);
          return;
        }
        var thinkHead = e.target.closest('.chat-thinking-head');
        if (thinkHead && thinkHead.parentNode) {
          thinkHead.parentNode.classList.toggle('open');
          return;
        }
        var attImg = e.target.closest('.chat-msg-attach-img');
        if (attImg) {
          openLightbox(attImg.src);
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

    // 对话回收站子页面事件委托
    var chatTrashBody = document.getElementById('chatTrashBody');
    if (chatTrashBody) {
      chatTrashBody.addEventListener('click', function(e) {
        var check = e.target.closest('.trash-item-check');
        if (check) {
          e.stopPropagation();
          check.classList.toggle('on');
          return;
        }
        var restore = e.target.closest('.chat-trash-restore');
        if (restore) {
          restoreChatTrashItem(parseInt(restore.dataset.idx, 10));
          return;
        }
        var del = e.target.closest('.chat-trash-del');
        if (del) {
          if (confirm('彻底删除该对话？不可恢复')) deleteChatTrashItem(parseInt(del.dataset.idx, 10));
          return;
        }
        if (e.target.closest('#chatTrashRestoreSel')) {
          var rIdxs = selectedChatTrashIdxs();
          if (!rIdxs.length) return Toast.show('请先勾选要恢复的对话');
          rIdxs.forEach(function(i) { restoreChatTrashItem(i); });
          return;
        }
        if (e.target.closest('#chatTrashDeleteSel')) {
          var dIdxs = selectedChatTrashIdxs();
          if (!dIdxs.length) return Toast.show('请先勾选要删除的对话');
          if (confirm('彻底删除选中的 ' + dIdxs.length + ' 条对话？不可恢复')) {
            dIdxs.forEach(function(i) { chat().trash.splice(i, 1); });
            Store.save();
            renderChatTrash();
          }
          return;
        }
        if (e.target.closest('#chatTrashClear')) {
          if (!(chat().trash || []).length) return Toast.show('回收站已经是空的');
          if (confirm('清空回收站？所有对话将被彻底删除')) {
            chat().trash = [];
            Store.save();
            renderChatTrash();
            Toast.show('回收站已清空');
          }
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
        } else if (t.id === 'chatVoiceEngine') {
          ensureVoice();
          c.voice.engine = t.value;
          Store.save();
          renderSettings();
        } else if (t.id === 'chatVoiceName') {
          ensureVoice();
          if ((c.voice.engine || 'browser') === 'openai') c.voice.ttsVoice = t.value;
          else c.voice.voiceURI = t.value;
          Store.save();
        } else if (t.id === 'chatVoiceRate') {
          ensureVoice();
          c.voice.rate = parseFloat(t.value);
          var rlabel = document.getElementById('chatVoiceRateValue');
          if (rlabel) rlabel.textContent = c.voice.rate.toFixed(1);
          Store.save();
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
        if (e.target.closest('#chatVoicePreview')) {
          previewVoice();
          return;
        }
        var autoSpeak = e.target.closest('#chatAutoSpeakToggle');
        if (autoSpeak) {
          ensureVoice();
          chat().voice.autoSpeak = !chat().voice.autoSpeak;
          Store.save();
          autoSpeak.classList.toggle('on', chat().voice.autoSpeak);
          return;
        }
        if (e.target.closest('#chatClearAll')) {
          if (confirm('确定清除所有对话？将移入回收站保留 15 天')) {
            var now = Date.now();
            if (!chat().trash) chat().trash = [];
            conversations().forEach(function(conv) {
              chat().trash.unshift(Object.assign({}, conv, { deletedAt: now }));
            });
            chat().conversations = [];
            currentId = null;
            Store.save();
            renderMessages();
            Toast.show('已移入回收站');
          }
        }
      });
    }
  }

  // 自动匹配：并行探测全部厂商 models 端点，命中的全部写入 keys
  function doQuickCheck() {
    if (quickChecking) return;
    var keyInput = document.getElementById('chatQuickKey');
    var sel = document.getElementById('chatQuickProvider');
    var btn = document.getElementById('chatQuickBtn');
    var status = document.getElementById('chatQuickStatus');
    if (!keyInput) return;
    var key = keyInput.value.trim();
    if (!key) {
      Toast.show('请先粘贴 API Key', 'error');
      return;
    }

    // 前缀猜测保留为下拉默认项提示
    if (sel) sel.value = AIProviders.guessKeyProvider(key);

    quickChecking = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="chat-spin"></span>匹配中…';
    }
    if (status) {
      status.className = 'chat-quick-status';
      status.textContent = '正在匹配…';
    }

    // custom 厂商不参与自动匹配（保留手动配置）
    var providers = AIProviders.list().filter(function(p) { return p.keySlug !== 'custom'; });
    var jobs = providers.map(function(p) {
      return AIAPI.validateKey(p, key, '', 5000).then(function(res) {
        // HTTP 200 且返回体含 data/models 字段（解析出模型列表）即命中
        return { slug: p.keySlug, name: p.name, ok: !!(res.ok && res.models && res.models.length) };
      }).catch(function() {
        return { slug: p.keySlug, name: p.name, ok: false };
      });
    });

    Promise.all(jobs).then(function(results) {
      quickChecking = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '自动匹配';
      }
      var hits = results.filter(function(r) { return r.ok; });
      if (hits.length) {
        var c = chat();
        if (!c.keys) c.keys = {};
        var names = [];
        for (var i = 0; i < hits.length; i++) {
          c.keys[hits[i].slug] = key;
          names.push(hits[i].name);
        }
        Store.save();
        if (status) {
          status.className = 'chat-quick-status ok';
          status.textContent = '✓ 已匹配并保存：' + names.join('、');
        }
        Toast.show('✓ 已匹配并保存：' + names.join('、'), 'success');
      } else if (status) {
        status.className = 'chat-quick-status fail';
        status.textContent = '✗ 未匹配到任何厂商，请检查 Key 是否有效';
      }
    }).catch(function() {
      quickChecking = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '自动匹配';
      }
      if (status) {
        status.className = 'chat-quick-status fail';
        status.textContent = '✗ 未匹配到任何厂商，请检查 Key 是否有效';
      }
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
    if (msg.loading && !msg.content && !msg.thinking) {
      return '<span class="chat-typing"><i></i><i></i><i></i></span>';
    }
    var html = '';
    // 思考过程（可折叠，默认折叠）
    if (msg.thinking) {
      html += '<div class="chat-thinking">';
      html += '<div class="chat-thinking-head">💭 思考过程<span class="chat-thinking-arrow">▸</span></div>';
      html += '<div class="chat-thinking-body">' + renderContent(msg.thinking) + '</div>';
      html += '</div>';
    }
    // 用户消息的图片附件缩略图
    if (msg.images && msg.images.length) {
      html += '<div class="chat-msg-attach">';
      for (var i = 0; i < msg.images.length; i++) {
        html += '<img class="chat-msg-attach-img" src="' + msg.images[i] + '" alt="附件图片">';
      }
      html += '</div>';
    }
    html += renderContent(msg.content || '');
    // AI 消息右下角朗读按钮
    if (msg.role === 'assistant' && !msg.loading && msg.content) {
      var speaking = typeof Voice !== 'undefined' && Voice.isSpeaking(msg.id);
      html += '<button class="chat-speak-btn' + (speaking ? ' speaking' : '') + '" data-speak="' + msg.id + '" title="朗读">' + (speaking ? '⏸' : '🔊') + '</button>';
    }
    return html;
  }

  // 基础渲染：先 esc，再 ```code``` → pre，「code」→ code，换行 → <br>
  function renderContent(text) {
    var s = esc(text);
    var blocks = [];
    s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, function(m, lang, code) {
      blocks.push('<pre><code>' + code.replace(/\n$/, '') + '</code></pre>');
      return '￿' + (blocks.length - 1) + '￿';
    });
    var BT = String.fromCharCode(96);   // 反引号（用变量拼接，避免静态检查误判）
    s = s.replace(new RegExp(BT + '([^' + BT + '\\n]+)' + BT, 'g'), '<code>$1</code>');
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

  /* 删除会话 → 软删除，移入对话回收站（15 天过期自动清除） */
  function deleteConversation(id) {
    var list = conversations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var conv = list[i];
        list.splice(i, 1);
        if (!chat().trash) chat().trash = [];
        chat().trash.unshift(Object.assign({}, conv, { deletedAt: Date.now() }));
        break;
      }
    }
    if (currentId === id) {
      currentId = null;
      renderMessages();
    }
    Store.save();
    renderHistory();
    Toast.show('已移入回收站');
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
    if (!text && !pendingAttachments.length) return;
    var atts = pendingAttachments.slice();
    pendingAttachments = [];
    renderAttachStrip();
    input.value = '';
    autoGrow(input);
    sendText(text, atts);
  }

  function sendText(text, atts) {
    atts = atts || [];
    if ((!text && !atts.length) || sending) return;
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

    // 拆分附件
    var images = [];
    var files = [];
    for (var i = 0; i < atts.length; i++) {
      if (atts[i].kind === 'image') images.push(atts[i].dataUrl);
      else files.push({ name: atts[i].name, text: atts[i].text });
    }

    // 视觉检查：带图片但当前模型不支持识图 → 警告并中止（恢复附件与输入）
    if (images.length && c.mode !== 'image') {
      var entry = currentModelEntry();
      if (!entry || entry.vision !== true) {
        Toast.show('当前模型不支持识图，请切换带视觉的模型', 'error');
        pendingAttachments = atts.concat(pendingAttachments);
        renderAttachStrip();
        var inp = document.getElementById('chatInput');
        if (inp && text) {
          inp.value = text;
          autoGrow(inp);
        }
        return;
      }
    }

    // 文本附件拼进用户消息末尾
    var content = text || '';
    for (var j = 0; j < files.length; j++) {
      content += '\n\n【附件：' + files[j].name + '】\n' + files[j].text;
    }
    if (!content) content = '（发送了图片）';

    var conv = ensureConversation(content);
    var userMsg = { id: uid(), role: 'user', content: content, ts: Date.now() };
    if (images.length) userMsg.images = images;
    if (files.length) userMsg.files = files;
    conv.messages.push(userMsg);
    // 首条用户消息后自动命名（前 20 字）
    if (conv.title === '新对话') conv.title = content.slice(0, 20);
    conv.updatedAt = Date.now();
    Store.save();

    if (c.mode === 'image') {
      doImage(conv, content);
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
      if (h.image) {
        msgs.push({ role: h.role, content: '[生成了一张图片]' });
      } else {
        var hm = { role: h.role, content: h.content };
        if (h.images && h.images.length) hm.images = h.images;
        msgs.push(hm);
      }
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
      thinking: !!(c.thinkingEnabled && isThinkingModel()),
      signal: aborter.signal,
      onChunk: function(full, thinking) {
        assistant.content = full;
        if (thinking) assistant.thinking = thinking;
        updateBubble(assistant);
      }
    }).then(function(res) {
      assistant.content = res.content;
      if (res.thinking) assistant.thinking = res.thinking;
      assistant.loading = false;
      if (res.usage) assistant.usage = res.usage;
      conv.updatedAt = Date.now();
      Store.save();
      updateBubble(assistant);
      setSending(false);
      // 自动播报：AI 回复完成后自动朗读全文
      var vc = c.voice;
      if (vc && vc.autoSpeak && assistant.content && typeof Voice !== 'undefined') {
        Voice.speak(assistant.content, assistant.id);
      }
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

  /* ==================== 对话回收站 ==================== */

  function purgeChatTrash() {
    var trash = chat().trash || [];
    var now = Date.now();
    var kept = trash.filter(function(t) { return now - (t.deletedAt || 0) < TRASH_TTL; });
    if (kept.length !== trash.length) {
      chat().trash = kept;
      Store.save();
    }
  }

  function renderChatTrash() {
    purgeChatTrash();
    var body = document.getElementById('chatTrashBody');
    if (!body) return;
    var trash = chat().trash || [];

    var html = '';
    html += '<div class="trash-toolbar">';
    html += '<button id="chatTrashRestoreSel">恢复选中</button>';
    html += '<button id="chatTrashDeleteSel">彻底删除选中</button>';
    html += '<button id="chatTrashClear" class="danger">清空回收站</button>';
    html += '</div>';

    if (!trash.length) {
      html += '<div class="empty-state"><div class="empty-icon">🗑️</div><div class="empty-text">回收站为空</div><div class="empty-sub">删除的对话会保留 15 天</div></div>';
    } else {
      // 删除时间倒序
      var sorted = trash.map(function(t, i) { return { t: t, i: i }; }).sort(function(a, b) {
        return (b.t.deletedAt || 0) - (a.t.deletedAt || 0);
      });
      sorted.forEach(function(entry) {
        var t = entry.t;
        var left = Math.max(0, Math.ceil((TRASH_TTL - (Date.now() - (t.deletedAt || 0))) / (24 * 3600 * 1000)));
        var msgCount = (t.messages && t.messages.length) || 0;
        html += '<div class="source-item" data-chat-trash="' + entry.i + '">';
        html += '<span class="trash-item-check" data-check="' + entry.i + '"></span>';
        html += '<div class="source-item-info">';
        html += '<div class="source-item-name">' + esc(t.title || '新对话') + '<span class="source-item-tag">' + msgCount + ' 条消息</span></div>';
        html += '<div class="trash-item-time">删除于 ' + new Date(t.deletedAt || 0).toLocaleString('zh-CN') + ' · ' + left + ' 天后彻底清除</div>';
        html += '</div>';
        html += '<div class="source-item-actions">';
        html += '<button class="source-item-btn chat-trash-restore" data-idx="' + entry.i + '">恢复</button>';
        html += '<button class="source-item-btn danger chat-trash-del" data-idx="' + entry.i + '">彻底删除</button>';
        html += '</div></div>';
      });
    }
    body.innerHTML = html;
  }

  function restoreChatTrashItem(idx) {
    var t = (chat().trash || [])[idx];
    if (!t) return;
    var conv = Object.assign({}, t);
    delete conv.deletedAt;
    if (!conversations().find(function(c) { return c.id === conv.id; })) {
      chat().conversations.unshift(conv);
    }
    chat().trash.splice(idx, 1);
    Store.save();
    renderChatTrash();
    renderHistory();
    Toast.show('已恢复');
  }

  function deleteChatTrashItem(idx) {
    chat().trash.splice(idx, 1);
    Store.save();
    renderChatTrash();
  }

  function selectedChatTrashIdxs() {
    var box = document.getElementById('chatTrashBody');
    if (!box) return [];
    var out = [];
    box.querySelectorAll('.trash-item-check.on').forEach(function(c) {
      out.push(parseInt(c.dataset.check, 10));
    });
    return out.sort(function(a, b) { return b - a; });  // 倒序，splice 不移位
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
    var brandSvg = (typeof BrandIcons !== 'undefined') ? BrandIcons.svg(m.provider) : null;
    html += '<div class="chat-model-icon' + (brandSvg ? ' has-brand' : '') + '" style="background:' + meta.color + '">' + (brandSvg || esc(meta.abbr)) + '</div>';
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

    // 自动匹配：粘贴 Key 并行探测全部厂商
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">一键配置</div>';
    html += '<div class="chat-quick-card">';
    html += '<textarea id="chatQuickKey" rows="2" placeholder="粘贴 API Key，自动匹配全部厂商"></textarea>';
    html += '<div class="chat-quick-row">';
    html += '<select id="chatQuickProvider">';
    for (i = 0; i < providers.length; i++) {
      html += '<option value="' + providers[i].keySlug + '"' + (providers[i].keySlug === 'openai' ? ' selected' : '') + '>' + esc(providers[i].name) + '</option>';
    }
    html += '</select>';
    html += '<button class="btn-primary chat-quick-btn" id="chatQuickBtn">自动匹配</button>';
    html += '</div>';
    html += '<div class="chat-quick-status hidden" id="chatQuickStatus"></div>';
    html += '</div></div>';

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

    // 语音播报
    html += renderVoiceSettings(c);

    // 危险操作
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title" style="color:var(--danger)">危险操作</div>';
    html += '<button class="btn-secondary chat-clear-btn" id="chatClearAll">🗑 清除所有对话</button>';
    html += '</div>';

    body.innerHTML = html;
  }

  /* ---------- 加号面板 ---------- */

  function isThinkingModel() {
    var entry = currentModelEntry();
    return !!(entry && entry.thinking === true);
  }

  function openPlus() {
    var mask = document.getElementById('chatPlusMask');
    var sheet = document.getElementById('chatPlusSheet');
    if (!mask || !sheet) return;
    renderThinkingRow();
    showPlusMain();
    mask.classList.add('open');
    sheet.classList.add('open');
  }

  function closePlus() {
    var mask = document.getElementById('chatPlusMask');
    var sheet = document.getElementById('chatPlusSheet');
    if (mask) mask.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
  }

  function showPlusMain() {
    var main = document.getElementById('chatPlusMain');
    var preset = document.getElementById('chatPresetView');
    if (main) main.classList.remove('hidden');
    if (preset) preset.classList.add('hidden');
  }

  function showPresetView() {
    var main = document.getElementById('chatPlusMain');
    var preset = document.getElementById('chatPresetView');
    if (main) main.classList.add('hidden');
    if (preset) preset.classList.remove('hidden');
    renderPresetList();
  }

  function onPlusAction(action) {
    if (action === 'camera') {
      var cam = document.getElementById('chatCameraInput');
      if (cam) cam.click();
      closePlus();
    } else if (action === 'photos') {
      var photos = document.getElementById('chatPhotosInput');
      if (photos) photos.click();
      closePlus();
    } else if (action === 'file') {
      var file = document.getElementById('chatFileInput');
      if (file) file.click();
      closePlus();
    } else if (action === 'presets') {
      showPresetView();
    }
  }

  // 深度思考开关：仅选中 thinking:true 的模型可用
  function renderThinkingRow() {
    var toggle = document.getElementById('chatThinkingToggle');
    var sub = document.getElementById('chatThinkingSub');
    if (!toggle) return;
    var supported = isThinkingModel();
    var enabled = supported && !!chat().thinkingEnabled;
    toggle.classList.toggle('on', enabled);
    toggle.classList.toggle('disabled', !supported);
    if (sub) {
      sub.textContent = supported ? (enabled ? '已开启' : '已关闭') : '当前模型不支持';
    }
  }

  function toggleThinking() {
    if (!isThinkingModel()) {
      Toast.show('当前模型不支持深度思考');
      renderThinkingRow();
      return;
    }
    var c = chat();
    c.thinkingEnabled = !c.thinkingEnabled;
    Store.save();
    renderThinkingRow();
    Toast.show(c.thinkingEnabled ? '已开启深度思考' : '已关闭深度思考');
  }

  /* ---------- 附件 ---------- */

  function attId() {
    attSeq++;
    return 'att' + Date.now().toString(36) + '_' + attSeq;
  }

  // 图片附件：canvas 压缩到最长边 1024px JPEG 0.8，控制 localStorage 体积
  function compressImageFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var img = new Image();
        img.onload = function() {
          var max = 1024;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = function() { reject(new Error('图片读取失败')); };
        img.src = reader.result;
      };
      reader.onerror = function() { reject(new Error('文件读取失败')); };
      reader.readAsDataURL(file);
    });
  }

  function addImageFiles(fileList) {
    var room = 4 - pendingAttachments.filter(function(a) { return a.kind === 'image'; }).length;
    var files = [];
    for (var i = 0; i < fileList.length && files.length < room; i++) files.push(fileList[i]);
    if (fileList.length > files.length) Toast.show('图片最多添加 4 张');
    if (!files.length) {
      if (room <= 0) Toast.show('图片最多添加 4 张');
      return;
    }
    var chain = Promise.resolve();
    files.forEach(function(file) {
      chain = chain.then(function() {
        return compressImageFile(file).then(function(dataUrl) {
          pendingAttachments.push({ id: attId(), kind: 'image', name: file.name || '图片', dataUrl: dataUrl });
          renderAttachStrip();
        }).catch(function() {
          Toast.show('图片处理失败：' + (file.name || ''), 'error');
        });
      });
    });
  }

  // 文本附件：读取文本内容，超过 8000 字截断并提示
  function addTextFile(file) {
    var reader = new FileReader();
    reader.onload = function() {
      var text = String(reader.result || '');
      if (text.length > 8000) {
        text = text.slice(0, 8000);
        Toast.show('文件内容过长，已截取前 8000 字');
      }
      pendingAttachments.push({ id: attId(), kind: 'file', name: file.name || '文件', text: text });
      renderAttachStrip();
    };
    reader.onerror = function() {
      Toast.show('文件读取失败', 'error');
    };
    reader.readAsText(file);
  }

  function removeAttachment(id) {
    for (var i = 0; i < pendingAttachments.length; i++) {
      if (pendingAttachments[i].id === id) {
        pendingAttachments.splice(i, 1);
        break;
      }
    }
    renderAttachStrip();
  }

  function renderAttachStrip() {
    var strip = document.getElementById('chatAttachStrip');
    if (!strip) return;
    if (!pendingAttachments.length) {
      strip.innerHTML = '';
      strip.classList.add('hidden');
      return;
    }
    strip.classList.remove('hidden');
    var html = '';
    for (var i = 0; i < pendingAttachments.length; i++) {
      var a = pendingAttachments[i];
      if (a.kind === 'image') {
        html += '<div class="chat-attach-item"><img src="' + a.dataUrl + '" alt="' + esc(a.name) + '">';
      } else {
        html += '<div class="chat-attach-item chat-attach-file"><span class="chat-attach-file-icon">📄</span>' +
          '<span class="chat-attach-file-name">' + esc(a.name) + '</span>';
      }
      html += '<button class="chat-attach-del" data-att-del="' + a.id + '">✕</button></div>';
    }
    strip.innerHTML = html;
  }

  /* ---------- 常用语 ---------- */

  function presetList() {
    var c = chat();
    if (!c.presets) c.presets = [];
    return c.presets;
  }

  function renderPresetList() {
    var box = document.getElementById('chatPresetList');
    if (!box) return;
    var list = presetList();
    var html = '';
    if (!list.length) {
      html = '<div class="chat-preset-empty">暂无常用语，点击下方新建</div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        html += '<div class="chat-preset-item" data-pid="' + p.id + '">';
        html += '<div class="chat-preset-info">';
        html += '<div class="chat-preset-title">' + esc(p.title) + '</div>';
        html += '<div class="chat-preset-preview">' + esc((p.content || '').slice(0, 60)) + '</div>';
        html += '</div>';
        html += '<button class="chat-preset-del" data-del="' + p.id + '">🗑</button>';
        html += '</div>';
      }
    }
    box.innerHTML = html;
  }

  function addPreset() {
    var titleInput = document.getElementById('chatPresetTitle');
    var contentInput = document.getElementById('chatPresetContent');
    if (!titleInput || !contentInput) return;
    var title = titleInput.value.trim();
    var content = contentInput.value.trim();
    if (!title || !content) {
      Toast.show('请填写标题和内容', 'error');
      return;
    }
    presetList().push({ id: 'preset_' + Date.now().toString(36), title: title, content: content });
    Store.save();
    titleInput.value = '';
    contentInput.value = '';
    renderPresetList();
    Toast.show('已保存常用语', 'success');
  }

  function deletePreset(id) {
    var list = presetList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        break;
      }
    }
    Store.save();
    renderPresetList();
  }

  function applyPreset(id) {
    var list = presetList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var input = document.getElementById('chatInput');
        if (input) {
          input.value = list[i].content;
          autoGrow(input);
          input.focus();
        }
        closePlus();
        return;
      }
    }
  }

  /* ---------- 图片全屏查看 ---------- */

  function openLightbox(src) {
    closeLightbox();
    var box = document.createElement('div');
    box.className = 'chat-lightbox';
    box.id = 'chatLightbox';
    box.innerHTML = '<img src="' + src + '" alt="查看图片">';
    box.addEventListener('click', function() { closeLightbox(); });
    document.body.appendChild(box);
  }

  function closeLightbox() {
    var box = document.getElementById('chatLightbox');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  /* ---------- 语音播报 ---------- */

  function ensureVoice() {
    var c = chat();
    if (!c.voice) {
      c.voice = { engine: 'browser', voiceURI: '', ttsVoice: 'alloy', rate: 1, autoSpeak: false };
    }
    return c.voice;
  }

  function toggleSpeak(msgId) {
    if (typeof Voice === 'undefined') return;
    if (Voice.isSpeaking(msgId)) {
      Voice.stopSpeak();
      return;
    }
    var conv = currentConv();
    if (!conv) return;
    for (var i = 0; i < conv.messages.length; i++) {
      if (conv.messages[i].id === msgId) {
        Voice.speak(conv.messages[i].content || '', msgId);
        return;
      }
    }
  }

  function updateSpeakButtons() {
    var btns = document.querySelectorAll('.chat-speak-btn');
    for (var i = 0; i < btns.length; i++) {
      var speaking = typeof Voice !== 'undefined' && Voice.isSpeaking(btns[i].dataset.speak);
      btns[i].textContent = speaking ? '⏸' : '🔊';
      btns[i].classList.toggle('speaking', speaking);
    }
  }

  function previewVoice() {
    if (typeof Voice === 'undefined') return;
    if (Voice.isSpeaking()) {
      Voice.stopSpeak();
      return;
    }
    Voice.speak('你好，我是 OmniHub，这是语音播报试听。', 'preview');
  }

  // 设置页「语音播报」分区
  function renderVoiceSettings(c) {
    var vc = ensureVoice();
    var engine = vc.engine || 'browser';
    var html = '';
    html += '<div class="settings-group">';
    html += '<div class="settings-group-title">语音播报</div>';

    // 引擎下拉
    var openaiKey = (c.keys && c.keys.openai) || '';
    html += '<div class="chat-param-row">';
    html += '<div class="chat-param-label">引擎</div>';
    html += '<select id="chatVoiceEngine" class="chat-voice-select">';
    html += '<option value="browser"' + (engine === 'browser' ? ' selected' : '') + '>浏览器内置</option>';
    html += '<option value="openai"' + (engine === 'openai' ? ' selected' : '') + '>OpenAI TTS' + (openaiKey ? '' : '（未配置 Key）') + '</option>';
    html += '</select></div>';

    // 音色下拉
    html += '<div class="chat-param-row">';
    html += '<div class="chat-param-label">音色</div>';
    html += '<select id="chatVoiceName" class="chat-voice-select">';
    if (engine === 'openai') {
      var voices = (typeof Voice !== 'undefined') ? Voice.OPENAI_VOICES : ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      for (var i = 0; i < voices.length; i++) {
        html += '<option value="' + voices[i] + '"' + (vc.ttsVoice === voices[i] ? ' selected' : '') + '>' + voices[i] + '</option>';
      }
    } else {
      var local = (typeof Voice !== 'undefined') ? Voice.getVoices(true) : [];
      if (!local.length) {
        html += '<option value="">系统默认</option>';
      } else {
        for (var j = 0; j < local.length; j++) {
          html += '<option value="' + esc(local[j].voiceURI) + '"' + (vc.voiceURI === local[j].voiceURI ? ' selected' : '') + '>' + esc(local[j].name) + '</option>';
        }
      }
    }
    html += '</select></div>';

    // 语速滑块
    html += '<div class="chat-param-row">';
    html += '<div class="chat-param-label">语速 <span id="chatVoiceRateValue">' + (vc.rate || 1).toFixed(1) + '</span></div>';
    html += '<input type="range" id="chatVoiceRate" min="0.5" max="2" step="0.1" value="' + (vc.rate || 1) + '">';
    html += '</div>';

    // 试听 + 自动播报
    html += '<div class="chat-voice-row">';
    html += '<button class="btn-secondary" id="chatVoicePreview">🔊 试听</button>';
    html += '<div class="chat-voice-auto"><span>自动播报</span><div class="toggle-switch' + (vc.autoSpeak ? ' on' : '') + '" id="chatAutoSpeakToggle"></div></div>';
    html += '</div>';
    html += '</div>';
    return html;
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
      .replace(/\x22/g, '&quot;');
  }

  return { init: init, renderChatTrash: renderChatTrash, purgeChatTrash: purgeChatTrash };
})();
