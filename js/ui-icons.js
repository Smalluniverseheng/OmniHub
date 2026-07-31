/* ==================== OmniHub Icons - 内联 SVG 图标集 ==================== */
/* Tabler 风格：24×24 视口、stroke-width 2、currentColor 继承主题色（换肤无需重渲）。
   用法：
     <span data-icon="search"></span>  →  Icons.render(document) 后自动替换为内联 SVG
     动态新增节点由 MutationObserver 兜底自动渲染（childList+subtree，节流 100ms）。
     未知图标名渲染为圆点占位，保证布局不塌。 */

const Icons = (() => {
  'use strict';

  /* 图标路径库：每个图标为一组 SVG 内部元素（不含 <svg> 外壳） */
  var PATHS = {
    'search': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35 -4.35"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1 -2.83 2.83l-.06 -.06a1.65 1.65 0 0 0 -1.82 -.33 1.65 1.65 0 0 0 -1 1.51V21a2 2 0 1 1 -4 0v-.09a1.65 1.65 0 0 0 -1 -1.51 1.65 1.65 0 0 0 -1.82 .33l-.06 .06a2 2 0 1 1 -2.83 -2.83l.06 -.06a1.65 1.65 0 0 0 .33 -1.82 1.65 1.65 0 0 0 -1.51 -1H3a2 2 0 1 1 0 -4h.09a1.65 1.65 0 0 0 1.51 -1 1.65 1.65 0 0 0 -.33 -1.82l-.06 -.06a2 2 0 1 1 2.83 -2.83l.06 .06a1.65 1.65 0 0 0 1.82 .33h.01a1.65 1.65 0 0 0 1 -1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82 -.33l.06 -.06a2 2 0 1 1 2.83 2.83l-.06 .06a1.65 1.65 0 0 0 -.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0 -1.51 1z"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="M12 19l-7 -7 7 -7"/>',
    'plus': '<path d="M12 5v14"/><path d="M5 12h14"/>',
    'mic': '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/>',
    'send': '<path d="M22 2L11 13"/><path d="M22 2l-7 20 -4 -9 -9 -4 20 -7z"/>',
    'trash': '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1 -2 2H8a2 2 0 0 1 -2 -2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    'edit': '<path d="M11 4H4a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1 -4 9.5 -9.5z"/>',
    'pin': '<path d="M9 4h6v6l2 4H7l2 -4V4z"/><path d="M12 14v7"/>',
    'close': '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
    'check': '<path d="M20 6L9 17l-5 -5"/>',
    'eye': '<path d="M1 12s4 -8 11 -8 11 8 11 8 -4 8 -11 8 -11 -8 -11 -8z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0 -11 -8 -11 -8a18.45 18.45 0 0 1 5.06 -5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1 -2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1 -4.24 -4.24"/><path d="M1 1l22 22"/>',
    'qr': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M21 14v3"/><path d="M14 21h3"/><path d="M18 18h3v3h-3z"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-4"/><path d="M17 8l-5 -5 -5 5"/><path d="M12 3v12"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-4"/><path d="M7 10l5 5 5 -5"/><path d="M12 15V3"/>',
    'refresh': '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85 -3.36L23 10"/><path d="M20.49 15a9 9 0 0 1 -14.85 3.36L1 14"/>',
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'compass': '<circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36 -6.36 2.12 2.12 -6.36 6.36 -2.12z"/>',
    'bookmark': '<path d="M19 21l-7 -5 -7 5V5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z"/>',
    'user': '<path d="M20 21v-2a4 4 0 0 0 -4 -4H8a4 4 0 0 0 -4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'chevron-right': '<path d="M9 18l6 -6 -6 -6"/>',
    'chevron-down': '<path d="M6 9l6 6 6 -6"/>',
    'alert': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71 -3L13.71 3.86a2 2 0 0 0 -3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'device': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    'shield': '<path d="M12 22s8 -4 8 -10V5l-8 -3 -8 3v7c0 6 8 10 8 10z"/>',
    'sync': '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15 -6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1 -15 6.7L3 16"/>',
    'sparkles': '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9 -5.1L5 10l5.1 -1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1 .9L19 21l-.9 -2.1L16 18l2.1 -.9L19 15z"/><path d="M5 4l.6 1.4L7 6l-1.4 .6L5 8l-.6 -1.4L3 6l1.4 -.6L5 4z"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5 -5L5 21"/>',
    'document': '<path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1 -4 10 15.3 15.3 0 0 1 -4 -10 15.3 15.3 0 0 1 4 -10z"/>',
    'home': '<path d="M3 9l9 -7 9 7v11a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z"/><path d="M9 22V12h6v10"/>'
  };

  /* 未知图标：圆点占位 */
  var FALLBACK = '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>';

  // 生成完整 SVG 字符串
  function svg(name) {
    var inner = PATHS[name] || FALLBACK;
    return '<svg class="oh-icon oh-icon-' + name + '" viewBox="0 0 24 24" width="24" height="24" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  // 渲染 rootEl 范围内所有 [data-icon] 占位节点（rootEl 自身带 data-icon 也会处理）
  function render(rootEl) {
    var root = rootEl || document;
    var targets = [];
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute('data-icon')) {
      targets.push(root);
    }
    if (root.querySelectorAll) {
      var found = root.querySelectorAll('[data-icon]');
      for (var i = 0; i < found.length; i++) targets.push(found[i]);
    }
    for (var j = 0; j < targets.length; j++) replaceOne(targets[j]);
  }

  function replaceOne(el) {
    if (!el || !el.parentNode && el.nodeType !== 1) return;
    var name = el.getAttribute('data-icon') || '';
    // 先移除属性防止 MutationObserver/重复调用二次渲染
    el.removeAttribute('data-icon');
    el.classList.add('oh-icon-host');
    el.innerHTML = svg(name);
  }

  /* ---- MutationObserver 兜底：动态新增的 [data-icon] 自动渲染（100ms 节流）---- */
  var pending = [];
  var timer = null;

  function schedule(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) pending.push(nodes[i]);
    }
    if (!pending.length || timer) return;
    timer = setTimeout(function() {
      timer = null;
      var batch = pending;
      pending = [];
      for (var i = 0; i < batch.length; i++) {
        try { render(batch[i]); } catch (e) {}
      }
    }, 100);
  }

  function startObserver() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    var observer = new MutationObserver(function(mutations) {
      var added = [];
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          if (nodes[j].nodeType === 1) added.push(nodes[j]);
        }
      }
      if (added.length) schedule(added);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* 启动：DOM 就绪后全量渲染一次 + 挂观察器 */
  function boot() {
    render(document);
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return { render: render, svg: svg };
})();
