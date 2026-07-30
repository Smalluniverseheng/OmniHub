/* ==================== OmniHub Chat Module ==================== */

const ChatModule = (() => {
  'use strict';

  var conversations = Store.state.chat.conversations || [];
  var currentConversationId = null;

  function init() {
    renderChat();
    bindEvents();
  }

  function renderChat() {
    var body = document.getElementById('chatBody');
    if (!body) return;

    var html = '';

    // 对话列表 + 聊天区域
    html += '<div class="chat-container">';

    // 侧边栏 - 对话列表（移动端隐藏）
    html += '<div class="chat-sidebar" id="chatSidebar">';
    html += '<div class="chat-sidebar-header">';
    html += '<button class="btn-primary" id="newChatBtn">+ 新对话</button>';
    html += '</div>';
    html += '<div class="chat-conversations" id="chatConversations">';
    html += renderConversationList();
    html += '</div></div>';

    // 主聊天区域
    html += '<div class="chat-main">';
    html += '<div class="chat-messages" id="chatMessages">';
    if (currentConversationId) {
      var conv = conversations.find(function(c) { return c.id === currentConversationId; });
      if (conv) html += renderMessages(conv.messages);
      else html += '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">开始新对话</div></div>';
    } else {
      html += '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">开始新对话</div></div>';
    }
    html += '</div>';

    // 输入区域
    html += '<div class="chat-input-area">';
    html += '<div class="chat-input-wrapper">';
    html += '<textarea id="chatInput" placeholder="输入消息..." rows="1"></textarea>';
    html += '<button id="chatSendBtn" class="chat-send-btn">➤</button>';
    html += '</div></div></div></div>';

    body.innerHTML = html;
  }

  function renderConversationList() {
    if (!conversations.length) return '<div class="chat-empty-conv">暂无对话</div>';
    var html = '';
    conversations.forEach(function(conv) {
      html += '<div class="chat-conv-item ' + (conv.id === currentConversationId ? 'active' : '') + '" data-conv-id="' + conv.id + '">';
      html += '<div class="chat-conv-title">' + esc(conv.title || '新对话') + '</div>';
      html += '<div class="chat-conv-time">' + formatTime(conv.updatedAt) + '</div>';
      html += '</div>';
    });
    return html;
  }

  function renderMessages(messages) {
    if (!messages || !messages.length) return '';
    var html = '';
    messages.forEach(function(msg) {
      html += '<div class="chat-message ' + (msg.role === 'user' ? 'chat-message-user' : 'chat-message-ai') + '">';
      html += '<div class="chat-message-avatar">' + (msg.role === 'user' ? '👤' : '🤖') + '</div>';
      html += '<div class="chat-message-content">' + esc(msg.content) + '</div>';
      html += '</div>';
    });
    return html;
  }

  function bindEvents() {
    // 新对话
    var newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', function() {
        createNewConversation();
      });
    }

    // 对话列表点击
    var convList = document.getElementById('chatConversations');
    if (convList) {
      convList.addEventListener('click', function(e) {
        var item = e.target.closest('.chat-conv-item');
        if (item) {
          currentConversationId = item.dataset.convId;
          renderChat();
        }
      });
    }

    // 发送消息
    var sendBtn = document.getElementById('chatSendBtn');
    var input = document.getElementById('chatInput');
    if (sendBtn && input) {
      sendBtn.addEventListener('click', function() {
        sendMessage(input.value.trim());
        input.value = '';
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value.trim());
          input.value = '';
        }
      });
    }
  }

  function createNewConversation() {
    var id = 'conv_' + Date.now();
    var conv = {
      id: id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    conversations.unshift(conv);
    Store.state.chat.conversations = conversations;
    Store.save();
    currentConversationId = id;
    renderChat();
  }

  async function sendMessage(text) {
    if (!text) return;

    if (!currentConversationId) {
      createNewConversation();
    }

    var conv = conversations.find(function(c) { return c.id === currentConversationId; });
    if (!conv) return;

    // 添加用户消息
    conv.messages.push({ role: 'user', content: text, time: Date.now() });
    conv.updatedAt = Date.now();
    if (conv.title === '新对话') conv.title = text.slice(0, 20);
    Store.save();
    renderChat();

    // 模拟 AI 回复（实际应调用 API）
    var messagesDiv = document.getElementById('chatMessages');
    if (messagesDiv) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // 显示加载中
    var loadingId = 'loading_' + Date.now();
    conv.messages.push({ role: 'assistant', content: '思考中...', time: Date.now(), loading: true, id: loadingId });
    renderChat();

    // 模拟延迟回复
    setTimeout(function() {
      var msg = conv.messages.find(function(m) { return m.id === loadingId; });
      if (msg) {
        msg.content = '这是 AI 的模拟回复。实际使用时需要配置 API 密钥。';
        msg.loading = false;
        Store.save();
        renderChat();
      }
    }, 1500);
  }

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
    return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init };
})();
