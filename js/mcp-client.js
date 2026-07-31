/* ==================== OmniHub MCPClient - MCP 协议客户端骨架 ====================
 * JSON-RPC 2.0 over Streamable HTTP：initialize / tools/list / tools/call，单请求超时 15s
 * 服务器配置存 Store.state.chat.mcp = { servers: [{id,name,url,type:'http'|'stdio'}] }
 * stdio 为本地进程连接，浏览器端无法直连 → 显示「需云端代理转发（会员功能）」占位
 * 暴露：
 *   MCPClient.listServers() / addServer() / removeServer()
 *   MCPClient.rpc(url, method, params)       → JSON-RPC 请求（Promise）
 *   MCPClient.initialize(url) / listTools(url) / callTool(url, name, args)
 *   MCPClient.openManager()                  → 打开 MCP 服务器管理弹层
 */

const MCPClient = (() => {
  'use strict';

  var TIMEOUT = 15000;  // 单请求超时 15s
  var PROTOCOL_VERSION = '2025-06-18';
  var rpcSeq = 0;

  /* ---------- 配置存取 ---------- */

  function store() {
    var c = Store.state.chat;
    if (!c.mcp) c.mcp = { servers: [] };
    if (!c.mcp.servers) c.mcp.servers = [];
    return c.mcp;
  }

  function listServers() {
    return store().servers;
  }

  function addServer(opts) {
    var servers = store().servers;
    var server = {
      id: 'mcp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: (opts && opts.name) || 'MCP 服务器',
      url: (opts && opts.url) || '',
      type: (opts && opts.type) || 'http'
    };
    servers.push(server);
    try { Store.save(); } catch (e) { /* ignore */ }
    return server;
  }

  function removeServer(id) {
    var servers = store().servers;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].id === id) {
        servers.splice(i, 1);
        break;
      }
    }
    try { Store.save(); } catch (e) { /* ignore */ }
  }

  /* ---------- JSON-RPC 2.0 ---------- */

  function rpc(url, method, params) {
    return new Promise(function(resolve, reject) {
      rpcSeq++;
      var ctrl = new AbortController();
      var timer = setTimeout(function() {
        ctrl.abort();
        reject(new Error('MCP 请求超时（15s）'));
      }, TIMEOUT);
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: rpcSeq,
          method: method,
          params: params || {}
        }),
        signal: ctrl.signal
      }).then(function(res) {
        clearTimeout(timer);
        if (!res.ok) {
          return res.text().then(function(t) {
            reject(new Error('HTTP ' + res.status + '：' + (t || '').slice(0, 120)));
          });
        }
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('text/event-stream') !== -1) {
          // Streamable HTTP：SSE 帧内取最后一个 data 载荷
          return res.text().then(function(text) {
            var last = null;
            var lines = String(text || '').split('\n');
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim();
              if (line.indexOf('data:') === 0) {
                try { last = JSON.parse(line.slice(5).trim()); } catch (e) { /* ignore */ }
              }
            }
            if (last) handleReply(last, resolve, reject);
            else reject(new Error('MCP 响应为空'));
          });
        }
        return res.json().then(function(json) {
          handleReply(json, resolve, reject);
        });
      }).catch(function(err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') return;  // 已 reject 超时
        reject(err);
      });
    });
  }

  function handleReply(json, resolve, reject) {
    if (json && json.error) {
      reject(new Error('MCP 错误 ' + json.error.code + '：' + (json.error.message || '')));
    } else if (json && 'result' in json) {
      resolve(json.result);
    } else {
      reject(new Error('MCP 响应格式异常'));
    }
  }

  function initialize(url) {
    return rpc(url, 'initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'OmniHub', version: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '8.0' }
    });
  }

  function listTools(url) {
    return rpc(url, 'tools/list', {}).then(function(result) {
      return (result && result.tools) || [];
    });
  }

  function callTool(url, name, args) {
    return rpc(url, 'tools/call', { name: name, arguments: args || {} });
  }

  /* ---------- 管理弹层（动态创建 DOM） ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;');
  }

  function ensureLayer() {
    var layer = document.getElementById('mcpManagerLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'mcpManagerLayer';
    layer.className = 'mcp-layer';
    layer.innerHTML =
      '<div class="mcp-layer-mask" id="mcpLayerMask"></div>' +
      '<div class="mcp-layer-sheet">' +
        '<div class="mcp-layer-head"><span>MCP 服务器</span><button class="mcp-layer-close" id="mcpLayerClose">✕</button></div>' +
        '<div class="mcp-layer-body" id="mcpLayerBody"></div>' +
      '</div>';
    document.body.appendChild(layer);
    layer.querySelector('#mcpLayerMask').addEventListener('click', closeManager);
    layer.querySelector('#mcpLayerClose').addEventListener('click', closeManager);
    layer.querySelector('#mcpLayerBody').addEventListener('click', onBodyClick);
    return layer;
  }

  function openManager() {
    var layer = ensureLayer();
    renderBody();
    // 强制重排后加 open 触发滑入动画
    layer.classList.remove('open');
    void layer.offsetWidth;
    layer.classList.add('open');
  }

  function closeManager() {
    var layer = document.getElementById('mcpManagerLayer');
    if (layer) layer.classList.remove('open');
  }

  function renderBody() {
    var body = document.getElementById('mcpLayerBody');
    if (!body) return;
    var servers = listServers();
    var html = '';

    // 第三方安全警告
    html += '<div class="mcp-warn">⚠️ 此服务器可能访问您的本地文件，请确认信任。仅连接您了解并信任的 MCP 服务器。</div>';

    // 新增表单
    html += '<div class="mcp-add-card">';
    html += '<input type="text" id="mcpAddName" placeholder="服务器名称">';
    html += '<input type="url" id="mcpAddUrl" placeholder="服务器 URL（https://…/mcp）">';
    html += '<div class="mcp-add-row">';
    html += '<select id="mcpAddType"><option value="http">HTTP（远程）</option><option value="stdio">stdio（本地）</option></select>';
    html += '<button class="btn-primary" id="mcpAddBtn">＋ 添加</button>';
    html += '</div></div>';

    // 服务器列表
    if (!servers.length) {
      html += '<div class="empty-state"><div class="empty-icon">🔌</div><div class="empty-text">尚未添加 MCP 服务器</div></div>';
    } else {
      for (var i = 0; i < servers.length; i++) {
        var s = servers[i];
        html += '<div class="mcp-server" data-sid="' + s.id + '">';
        html += '<div class="mcp-server-info">';
        html += '<div class="mcp-server-name">' + esc(s.name) + '<span class="mcp-server-type">' + (s.type === 'stdio' ? 'stdio' : 'HTTP') + '</span></div>';
        html += '<div class="mcp-server-url">' + esc(s.url || '（未填写地址）') + '</div>';
        html += '</div>';
        html += '<div class="mcp-server-actions">';
        if (s.type === 'stdio') {
          html += '<div class="mcp-stdio-note">需云端代理转发（会员功能）</div>';
        } else {
          html += '<button class="source-item-btn mcp-test-btn" data-sid="' + s.id + '">连接测试</button>';
        }
        html += '<button class="source-item-btn danger mcp-del-btn" data-sid="' + s.id + '">删除</button>';
        html += '</div>';
        html += '<div class="mcp-server-detail hidden" id="mcpDetail_' + s.id + '"></div>';
        html += '</div>';
      }
    }
    body.innerHTML = html;
  }

  function onBodyClick(e) {
    if (e.target.closest('#mcpAddBtn')) {
      var name = document.getElementById('mcpAddName');
      var url = document.getElementById('mcpAddUrl');
      var type = document.getElementById('mcpAddType');
      var u = url ? url.value.trim() : '';
      var t = type ? type.value : 'http';
      if (t === 'http' && !/^https?:\/\//.test(u)) {
        Toast.show('请填写合法的 http(s) 服务器地址', 'error');
        return;
      }
      addServer({ name: name ? name.value.trim() : '', url: u, type: t });
      renderBody();
      Toast.show('已添加 MCP 服务器', 'success');
      return;
    }
    var del = e.target.closest('.mcp-del-btn');
    if (del) {
      if (confirm('删除该 MCP 服务器？')) {
        removeServer(del.dataset.sid);
        renderBody();
      }
      return;
    }
    var test = e.target.closest('.mcp-test-btn');
    if (test) {
      testServer(test.dataset.sid);
    }
  }

  /* 连接测试：initialize → tools/list，结果（含工具列表）展示在条目下方 */
  function testServer(sid) {
    var servers = listServers();
    var server = null;
    for (var i = 0; i < servers.length; i++) {
      if (servers[i].id === sid) server = servers[i];
    }
    if (!server || !server.url) {
      Toast.show('服务器地址为空', 'error');
      return;
    }
    var detail = document.getElementById('mcpDetail_' + sid);
    if (!detail) return;
    detail.classList.remove('hidden');
    detail.innerHTML = '<div class="mcp-detail-line"><span class="chat-spin"></span>正在连接…</div>';
    initialize(server.url).then(function(initRes) {
      var serverName = (initRes && initRes.serverInfo && initRes.serverInfo.name) || server.name;
      return listTools(server.url).then(function(tools) {
        var html = '<div class="mcp-detail-line ok">✓ 已连接：' + esc(serverName) + '</div>';
        if (!tools.length) {
          html += '<div class="mcp-detail-line">该服务器未暴露任何工具</div>';
        } else {
          html += '<div class="mcp-detail-line">发现 ' + tools.length + ' 个工具：</div>';
          for (var j = 0; j < tools.length; j++) {
            html += '<div class="mcp-tool"><div class="mcp-tool-name">🛠 ' + esc(tools[j].name || '?') + '</div>' +
              '<div class="mcp-tool-desc">' + esc((tools[j].description || '').slice(0, 120)) + '</div></div>';
          }
        }
        detail.innerHTML = html;
      });
    }).catch(function(err) {
      detail.innerHTML = '<div class="mcp-detail-line fail">✗ 连接失败：' + esc((err && err.message) || '网络错误') + '</div>';
    });
  }

  return {
    listServers: listServers,
    addServer: addServer,
    removeServer: removeServer,
    rpc: rpc,
    initialize: initialize,
    listTools: listTools,
    callTool: callTool,
    openManager: openManager,
    closeManager: closeManager
  };
})();
