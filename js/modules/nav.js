/* ==================== OmniHub Floating Navigation ==================== */
/* v8.2 增强：
   - init 恢复 Store.state.settings.fabPosition（此前只写不读）；RTL 默认吸附左侧
   - 鼠标拖拽与触摸共用一套吸附逻辑；拖拽中 scale(1.1) + 阴影扩散
   - 扇形模式：启用模块 ≤5 个时菜单项绕球按上方 120° 弧均布，逐项 scale(0)→1 错开 30ms；
     >5 保持分页（每页 6 手机 / 4 手表）
   - 编辑模式拖动排序：长按图标后拖动，其余图标 FLIP 让位，松手写回 navItems order；
     「我的」fixed 不可删不可拖、固定首位
*/

const Nav = (() => {
  'use strict';

  let isOpen = false;
  let isDragging = false;
  let dragStartX, dragStartY;
  let fabX, fabY;
  let currentPage = 'profile';
  let isEditing = false;      // 长按编辑模式
  let pageIndex = 0;          // 面板当前页码
  let pageCount = 1;          // 面板总页数
  let swiped = false;         // 翻页滑动后抑制误触点击

  // 每页容量：手表(<360) 4 个，手机 6 个（桌面端悬浮球隐藏，不参与分页）
  function pageSize() {
    return window.innerWidth < 360 ? 4 : 6;
  }

  // 启用模块（按 order 排序）
  function enabledItems() {
    return Store.state.navItems.filter(function(n) { return n.enabled; })
      .sort(function(a, b) { return a.order - b.order; });
  }

  // 扇形模式：模块 ≤5 个
  function isFanMode() {
    return enabledItems().length <= 5;
  }

  function init() {
    restorePosition();   // 恢复上次悬浮球位置 / RTL 默认左吸
    render();
    bindEvents();
  }

  /* ---- 悬浮球位置恢复 ---- */
  function restorePosition() {
    var trigger = document.getElementById('fabTrigger');
    if (!trigger) return;
    var pos = (Store.state.settings && Store.state.settings.fabPosition) || {};
    if (typeof pos.x === 'number' && typeof pos.y === 'number') {
      // 钳制在可视区内，防止改窗口后球跑出屏幕
      var w = window.innerWidth, h = window.innerHeight;
      var x = Math.max(0, Math.min(pos.x, w - 56));
      var y = Math.max(0, Math.min(pos.y, h - 56));
      trigger.style.left = x + 'px';
      trigger.style.top = y + 'px';
      trigger.style.right = 'auto';
      trigger.style.bottom = 'auto';
    } else if (document.documentElement.dir === 'rtl') {
      // RTL 默认吸附左侧
      trigger.style.left = '20px';
      trigger.style.right = 'auto';
    }
  }

  function render() {
    var pages = document.getElementById('fabMenuPages');
    var dots = document.getElementById('fabMenuDots');
    var menu = document.getElementById('fabMenu');
    if (!pages) return;

    var items = enabledItems();

    if (isFanMode()) {
      /* ---- 扇形模式：单项绕球分布，位置在 open() 时按球心计算 ---- */
      if (menu) menu.classList.add('fan-mode');
      var fanHtml = '';
      items.forEach(function(item) {
        fanHtml += '<div class="fab-fan-item ' + (item.id === currentPage ? 'active' : '') + (isEditing ? ' editing' : '') + '" data-page-id="' + item.id + '">';
        fanHtml += '<div class="fab-module-icon">' + item.icon + '</div>';
        fanHtml += '<div class="fab-module-name">' + item.name + '</div>';
        if (!item.fixed) fanHtml += '<div class="delete-badge" data-del="' + item.id + '">✕</div>';
        fanHtml += '</div>';
      });
      pages.innerHTML = fanHtml;
      if (dots) dots.style.display = 'none';
      return;
    }

    if (menu) menu.classList.remove('fan-mode');
    var size = pageSize();
    pageCount = Math.max(Math.ceil(items.length / size), 1);
    if (pageIndex >= pageCount) pageIndex = 0;

    var html = '';
    for (var p = 0; p < pageCount; p++) {
      var pageItems = items.slice(p * size, (p + 1) * size);
      html += '<div class="fab-page" data-page="' + p + '">';
      pageItems.forEach(function(item) {
        html += '<div class="fab-module-item ' + (item.id === currentPage ? 'active' : '') + (isEditing ? ' editing' : '') + '" data-page-id="' + item.id + '">';
        html += '<div class="fab-module-icon">' + item.icon + '</div>';
        html += '<div class="fab-module-name">' + item.name + '</div>';
        // fixed（我的）不渲染删除角标，不可删除
        if (!item.fixed) html += '<div class="delete-badge" data-del="' + item.id + '">✕</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    pages.innerHTML = html;
    // 复位轨道位置到当前页
    setTrack(pageIndex, false);

    if (dots) {
      // 只有一页时隐藏分页圆点
      dots.style.display = pageCount > 1 ? 'flex' : 'none';
      dots.innerHTML = '';
      for (var i = 0; i < pageCount; i++) {
        dots.innerHTML += '<div class="fab-menu-dot ' + (i === pageIndex ? 'active' : '') + '" data-dot="' + i + '"></div>';
      }
    }
  }

  // 轨道位移：translateX 跟随 + 吸附到指定页
  function setTrack(index, animate) {
    var track = document.getElementById('fabMenuPages');
    if (!track || !track.parentElement) return;
    var w = track.parentElement.clientWidth;
    track.style.transition = animate ? 'transform 0.25s ease' : 'none';
    track.style.transform = 'translateX(' + (-index * w) + 'px)';
    var dotEls = document.querySelectorAll('.fab-menu-dot');
    dotEls.forEach(function(d, i) { d.classList.toggle('active', i === index); });
  }

  // 进入/退出长按编辑模式
  function enterEdit() {
    if (isEditing) return;
    isEditing = true;
    document.querySelectorAll('.fab-module-item, .fab-fan-item').forEach(function(el) { el.classList.add('editing'); });
    Toast.show('拖动排序，点击 ✕ 删除');
  }
  function exitEdit() {
    if (!isEditing) return;
    isEditing = false;
    document.querySelectorAll('.fab-module-item, .fab-fan-item').forEach(function(el) { el.classList.remove('editing'); });
  }

  function bindEvents() {
    var trigger = document.getElementById('fabTrigger');
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var pages = document.getElementById('fabMenuPages');
    var dots = document.getElementById('fabMenuDots');

    if (!trigger) return;

    trigger.addEventListener('click', function() {
      if (isDragging) return;
      isOpen ? close() : open();
    });

    // 点遮罩：编辑模式下先退出编辑，否则关闭面板
    if (mask) mask.addEventListener('click', function() {
      if (isEditing) exitEdit();
      else close();
    });

    // 点击面板空白处：退出编辑模式
    if (menu) menu.addEventListener('click', function(e) {
      if (isEditing && !e.target.closest('.fab-module-item') && !e.target.closest('.fab-fan-item')) exitEdit();
    });

    if (dots) {
      // 桌面端可点击圆点翻页
      dots.addEventListener('click', function(e) {
        var dot = e.target.closest('.fab-menu-dot');
        if (!dot) return;
        pageIndex = parseInt(dot.dataset.dot, 10) || 0;
        setTrack(pageIndex, true);
      });
    }

    if (pages) {
      // ---- 图标点击：导航 / 删除 ----
      pages.addEventListener('click', function(e) {
        if (swiped) return;  // 翻页滑动后抑制点击
        var del = e.target.closest('.delete-badge');
        if (del) {
          if (!isEditing) return;
          var id = del.dataset.del;
          var navItem = Store.state.navItems.find(function(n) { return n.id === id; });
          if (navItem && navItem.fixed) return Toast.show('「我的」不能删除');
          if (confirm('删除「' + getModuleName(id) + '」模块？')) {
            var itemEl = del.closest('.fab-module-item') || del.closest('.fab-fan-item');
            // 删除角标动画：scale → 0 后再移除数据并重绘
            if (itemEl) {
              itemEl.classList.remove('editing');
              itemEl.classList.add('removing');
            }
            setTimeout(function() {
              Store.state.navItems = Store.state.navItems.filter(function(n) { return n.id !== id; });
              if (Store.state.modules[id]) Store.state.modules[id].enabled = false;
              Store.save();
              render();
              Toast.show('已删除');
            }, 200);
          }
          return;
        }

        var item = e.target.closest('.fab-module-item') || e.target.closest('.fab-fan-item');
        if (!item) return;
        if (isEditing) return;  // 编辑模式下不跳转

        var pageId = item.dataset.pageId;
        if (pageId) {
          App.switchPage(pageId);
          close();
        }
      });

      bindPressAndSort(pages);
    }

    bindTriggerDrag(trigger);
  }

  /* ==================== 长按编辑 + 编辑模式拖动排序（FLIP 让位） ==================== */
  var pressTimer = null;
  var sortDrag = null;   // {id, el, active, startX, startY, baseIndex}

  function bindPressAndSort(pages) {
    function candidateFrom(e) {
      var item = e.target.closest('.fab-module-item');
      return item || null;
    }
    function pointX(e) { return e.touches ? e.touches[0].clientX : e.clientX; }
    function pointY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

    function startPress(e) {
      if (e.type === 'mousedown' && e.button !== 0) return;
      var item = candidateFrom(e);
      if (!item) return;
      if (e.target.closest('.delete-badge')) return;
      clearTimeout(pressTimer);
      var id = item.dataset.pageId;
      var sx = pointX(e), sy = pointY(e);
      sortDrag = { id: id, active: false, startX: sx, startY: sy };
      pressTimer = setTimeout(function() {
        enterEdit();
        // 长按成功后保持按住即可直接拖动排序
      }, 550);
    }
    function cancelPress() {
      clearTimeout(pressTimer);
      if (sortDrag && !sortDrag.active) sortDrag = null;
    }

    pages.addEventListener('touchstart', startPress, { passive: true });
    pages.addEventListener('touchend', cancelPress);
    pages.addEventListener('touchcancel', cancelPress);
    pages.addEventListener('mousedown', startPress);
    pages.addEventListener('mouseup', cancelPress);
    pages.addEventListener('mouseleave', cancelPress);

    // ---- 拖动排序：编辑模式下拖动图标，其他图标 FLIP 让位 ----
    function onMove(e) {
      if (!sortDrag) return;
      var x = pointX(e), y = pointY(e);
      if (!sortDrag.active) {
        if (!isEditing) return;
        if (Math.abs(x - sortDrag.startX) < 8 && Math.abs(y - sortDrag.startY) < 8) return;
        var navItem = Store.state.navItems.find(function(n) { return n.id === sortDrag.id; });
        if (navItem && navItem.fixed) { sortDrag = null; return; }  // 「我的」不可拖
        var el = pages.querySelector('.fab-module-item[data-page-id="' + sortDrag.id + '"]');
        if (!el) { sortDrag = null; return; }
        sortDrag.active = true;
        sortDrag.el = el;
        el.classList.add('dragging');
        clearTimeout(pressTimer);
        if (e.cancelable && e.type === 'touchmove') e.preventDefault();
      }
      var dx = x - sortDrag.startX;
      var dy = y - sortDrag.startY;
      sortDrag.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.1)';
      maybeReorder(x, y);
      if (e.cancelable && e.type === 'touchmove') e.preventDefault();
    }

    function onUp() {
      if (!sortDrag) return;
      if (sortDrag.active) {
        commitOrder();
        swiped = true;
        setTimeout(function() { swiped = false; }, 60);
      }
      sortDrag = null;
    }

    pages.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mousemove', onMove);
    pages.addEventListener('touchend', onUp);
    document.addEventListener('mouseup', onUp);

    // ---- 左右滑动翻页（translateX 跟随 + 吸附；编辑模式/扇形模式/排序拖动中禁用）----
    var swipeStartX = 0, swipeDx = 0, swiping = false;
    pages.addEventListener('touchstart', function(e) {
      if (isEditing || isFanMode()) return;
      swipeStartX = e.touches[0].clientX;
      swipeDx = 0;
      swiping = true;
    }, { passive: true });
    pages.addEventListener('touchmove', function(e) {
      if (!swiping || isEditing || isFanMode() || (sortDrag && sortDrag.active)) return;
      swipeDx = e.touches[0].clientX - swipeStartX;
      if (Math.abs(swipeDx) > 10) {
        clearTimeout(pressTimer);  // 滑动时取消长按计时
        swiped = true;
        // 跟随手指位移
        var w = pages.parentElement.clientWidth;
        var offset = -pageIndex * w + swipeDx;
        // 边界橡皮筋阻尼
        if (pageIndex === 0 && swipeDx > 0) offset = swipeDx * 0.3;
        if (pageIndex === pageCount - 1 && swipeDx < 0) offset = -pageIndex * w + swipeDx * 0.3;
        pages.style.transition = 'none';
        pages.style.transform = 'translateX(' + offset + 'px)';
      }
    }, { passive: true });
    pages.addEventListener('touchend', function() {
      if (!swiping) return;
      swiping = false;
      if (Math.abs(swipeDx) > 40) {
        if (swipeDx < 0 && pageIndex < pageCount - 1) pageIndex++;
        if (swipeDx > 0 && pageIndex > 0) pageIndex--;
      }
      setTrack(pageIndex, true);
      setTimeout(function() { swiped = false; }, 60);
    });
  }

  // 拖动中：按指针位置计算目标槽位，变化时 FLIP 让位
  function maybeReorder(x, y) {
    var pages = document.getElementById('fabMenuPages');
    if (!pages) return;
    var pageEl = pages.querySelector('.fab-page[data-page="' + pageIndex + '"]');
    if (!pageEl) return;
    var nodes = Array.prototype.slice.call(pageEl.querySelectorAll('.fab-module-item'));
    if (nodes.length < 2) return;

    // 目标插入位：最近的其他图标中心
    var target = 0;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].dataset.pageId === sortDrag.id) continue;
      var r = nodes[i].getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (y > cy || (Math.abs(y - cy) < r.height / 2 && x > cx)) target = i + 1;
    }

    // 当前页 id 序列 → 重排
    var order = nodes.map(function(n) { return n.dataset.pageId; });
    var from = order.indexOf(sortDrag.id);
    if (from < 0) return;
    order.splice(from, 1);
    if (target > from) target--;
    target = Math.max(0, Math.min(target, order.length));
    // 「我的」fixed 固定首位：不允许任何项插到它前面
    var firstItem = Store.state.navItems.find(function(n) { return n.id === order[0]; });
    if (firstItem && firstItem.fixed && target === 0) target = 1;
    if (order[target] === sortDrag.id) return;
    order.splice(target, 0, sortDrag.id);

    // FLIP：先记录旧位置 → DOM 重排 → 反向位移后过渡到 0
    var firstRects = {};
    nodes.forEach(function(n) { firstRects[n.dataset.pageId] = n.getBoundingClientRect(); });
    order.forEach(function(id) {
      var el = pageEl.querySelector('.fab-module-item[data-page-id="' + id + '"]');
      if (el) pageEl.appendChild(el);
    });
    nodes.forEach(function(n) {
      if (n.dataset.pageId === sortDrag.id) return;
      var f = firstRects[n.dataset.pageId];
      var l = n.getBoundingClientRect();
      var ddx = f.left - l.left, ddy = f.top - l.top;
      if (!ddx && !ddy) return;
      n.style.transition = 'none';
      n.style.transform = 'translate(' + ddx + 'px,' + ddy + 'px)';
      requestAnimationFrame(function() {
        n.style.transition = 'transform 0.2s ease';
        n.style.transform = '';
      });
    });

    // 记录新序列供松手写回
    sortDrag.pendingOrder = order;
  }

  // 松手：把当前页序列合并回整体 order 并写回 Store
  function commitOrder() {
    if (!sortDrag || !sortDrag.pendingOrder) { render(); return; }
    var items = enabledItems();
    var size = pageSize();
    var pageIds = sortDrag.pendingOrder;
    var merged = [];
    for (var i = 0; i < items.length; i++) {
      if (i >= pageIndex * size && i < pageIndex * size + pageIds.length) {
        merged.push(pageIds[i - pageIndex * size]);
      } else {
        merged.push(items[i].id);
      }
    }
    // fixed 强制首位
    var fixedIdx = merged.findIndex(function(id) {
      var it = Store.state.navItems.find(function(n) { return n.id === id; });
      return it && it.fixed;
    });
    if (fixedIdx > 0) {
      var fixedId = merged.splice(fixedIdx, 1)[0];
      merged.unshift(fixedId);
    }
    merged.forEach(function(id, idx) {
      var it = Store.state.navItems.find(function(n) { return n.id === id; });
      if (it) it.order = idx;
    });
    Store.save();
    render();
    Toast.show('顺序已保存');
  }

  /* ==================== 悬浮球拖动（触摸 + 鼠标共用一套吸附逻辑） ==================== */
  function bindTriggerDrag(trigger) {
    function setPos(x, y) {
      var w = window.innerWidth, h = window.innerHeight;
      var rect = trigger.getBoundingClientRect();
      x = Math.max(0, Math.min(x, w - rect.width));
      y = Math.max(0, Math.min(y, h - rect.height));
      trigger.style.left = x + 'px';
      trigger.style.right = 'auto';
      trigger.style.bottom = 'auto';
      trigger.style.top = y + 'px';
    }
    function start(x, y) {
      isDragging = false;
      dragStartX = x;
      dragStartY = y;
      var rect = trigger.getBoundingClientRect();
      fabX = rect.left;
      fabY = rect.top;
    }
    function move(x, y) {
      var dx = x - dragStartX;
      var dy = y - dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        if (!isDragging) trigger.classList.add('fab-dragging');  // 拖拽中 scale(1.1)+阴影扩散
        isDragging = true;
      }
      if (isDragging) setPos(fabX + dx, fabY + dy);
    }
    function end() {
      if (isDragging && Store.state.settings.fabSnap) snapToEdge(trigger);
      trigger.classList.remove('fab-dragging');
      setTimeout(function() { isDragging = false; }, 50);
    }

    // 触摸
    trigger.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });
    trigger.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      move(t.clientX, t.clientY);
    }, { passive: true });
    trigger.addEventListener('touchend', end);

    // 鼠标（同一套吸附逻辑）
    var mouseDown = false;
    trigger.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      mouseDown = true;
      start(e.clientX, e.clientY);
      e.preventDefault();  // 阻止文本选择
    });
    document.addEventListener('mousemove', function(e) {
      if (!mouseDown) return;
      move(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function() {
      if (!mouseDown) return;
      mouseDown = false;
      end();
    });
  }

  function snapToEdge(el) {
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var ww = window.innerWidth;
    var wh = window.innerHeight;
    var left = rect.left, top = rect.top;
    if (cx < ww / 2) left = 20;
    else left = ww - rect.width - 20;
    if (top < wh / 3) top = 20;
    else if (top > wh * 2 / 3) top = wh - rect.height - 30;
    el.style.transition = 'left 0.3s, top 0.3s';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    setTimeout(function() { el.style.transition = ''; }, 300);
    Store.state.settings.fabPosition = { x: left, y: top };
    Store.save();
  }

  /* ---- 扇形布局：菜单移到球心，菜单项上方 120° 弧均布，逐项弹出错开 30ms ---- */
  function layoutFan() {
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (!menu || !trigger) return;
    var rect = trigger.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    menu.style.left = cx + 'px';
    menu.style.top = cy + 'px';

    var items = menu.querySelectorAll('.fab-fan-item');
    var n = items.length;
    var radius = Math.min(120, window.innerHeight / 4);
    for (var i = 0; i < n; i++) {
      // 上方 120° 弧：-150° … -30°（0°=x 轴正向，-90°=正上方）
      var angle = n === 1 ? -90 : -150 + (120 * i / (n - 1));
      var rad = angle * Math.PI / 180;
      items[i].style.left = (Math.cos(rad) * radius) + 'px';
      items[i].style.top = (Math.sin(rad) * radius) + 'px';
      // 逐项 scale(0)→1 错开 30ms
      (function(el, idx) {
        setTimeout(function() { if (isOpen) el.classList.add('open'); }, 60 + idx * 30);
      })(items[i], i);
    }
  }

  function open() {
    isOpen = true;
    render();  // 打开时按最新数据/屏宽重绘，保证分页正确
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (mask) mask.classList.add('show');
    if (menu) menu.classList.add('open');
    if (trigger) trigger.classList.add('open');
    if (isFanMode()) layoutFan();
  }

  function close() {
    isOpen = false;
    exitEdit();
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    var fanItems = menu ? menu.querySelectorAll('.fab-fan-item.open') : [];
    if (trigger) trigger.classList.remove('open');
    if (fanItems.length) {
      // 扇形模式：菜单项先 scale(1)→0 向球收缩，再收面板
      fanItems.forEach(function(el) { el.classList.remove('open'); });
      setTimeout(function() {
        if (mask) mask.classList.remove('show');
        if (menu) menu.classList.remove('open');
      }, 180);
    } else {
      if (mask) mask.classList.remove('show');
      if (menu) menu.classList.remove('open');
    }
  }

  function updateActive(pageId) {
    currentPage = pageId;
    document.querySelectorAll('.fab-module-item, .fab-fan-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.pageId === pageId);
    });
    var item = Store.state.navItems.find(function(n) { return n.id === pageId; });
    if (item) {
      var icon = document.getElementById('fabIcon');
      if (icon) icon.textContent = item.icon;
    }
  }

  function getModuleName(id) {
    var item = Store.state.navItems.find(function(n) { return n.id === id; });
    return item ? item.name : id;
  }

  // 沉浸阅读联动：显示/隐藏悬浮球
  function setVisible(visible) {
    var nav = document.getElementById('fabNav');
    if (!nav) return;
    if (!visible && isOpen) close();  // 隐藏前先收起面板
    nav.classList.toggle('fab-hidden', !visible);
  }

  return { init, render, open, close, updateActive, setVisible };
})();
