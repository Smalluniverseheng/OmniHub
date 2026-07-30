/* ==================== OmniHub Floating Navigation ==================== */

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

  // 每页容量：桌面端(≥768px) 4列×2行=8 个，手机/手表 2×2=4 个
  function pageSize() {
    return window.innerWidth >= 768 ? 8 : 4;
  }

  function init() {
    render();
    bindEvents();
  }

  function render() {
    var pages = document.getElementById('fabMenuPages');
    var dots = document.getElementById('fabMenuDots');
    if (!pages) return;

    var items = Store.state.navItems.filter(function(n) { return n.enabled; }).sort(function(a, b) { return a.order - b.order; });
    var size = pageSize();
    pageCount = Math.max(Math.ceil(items.length / size), 1);
    if (pageIndex >= pageCount) pageIndex = 0;

    var html = '';
    for (var p = 0; p < pageCount; p++) {
      var pageItems = items.slice(p * size, (p + 1) * size);
      html += '<div class="fab-page" data-page="' + p + '">';
      pageItems.forEach(function(item) {
        html += '<div class="fab-module-item ' + (item.id === currentPage ? 'active' : '') + '" data-page-id="' + item.id + '">';
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
    document.querySelectorAll('.fab-module-item').forEach(function(el) { el.classList.add('editing'); });
    Toast.show('点击 ✕ 删除模块');
  }
  function exitEdit() {
    if (!isEditing) return;
    isEditing = false;
    document.querySelectorAll('.fab-module-item').forEach(function(el) { el.classList.remove('editing'); });
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
      if (isEditing && !e.target.closest('.fab-module-item')) exitEdit();
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
            var itemEl = del.closest('.fab-module-item');
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

        var item = e.target.closest('.fab-module-item');
        if (!item) return;
        if (isEditing) return;  // 编辑模式下不跳转

        var pageId = item.dataset.pageId;
        if (pageId) {
          App.switchPage(pageId);
          close();
        }
      });

      // ---- 长按进入编辑模式（触摸 + 鼠标）----
      var pressTimer;
      function startPress(e) {
        var item = e.target.closest('.fab-module-item');
        if (!item) return;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(enterEdit, 550);
      }
      function cancelPress() { clearTimeout(pressTimer); }
      pages.addEventListener('touchstart', startPress, { passive: true });
      pages.addEventListener('touchend', cancelPress);
      pages.addEventListener('touchcancel', cancelPress);
      pages.addEventListener('mousedown', startPress);
      pages.addEventListener('mouseup', cancelPress);
      pages.addEventListener('mouseleave', cancelPress);

      // ---- 左右滑动翻页（translateX 跟随 + 吸附）----
      var startX = 0, dx = 0, swiping = false;
      pages.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        dx = 0;
        swiping = true;
      }, { passive: true });
      pages.addEventListener('touchmove', function(e) {
        if (!swiping) return;
        dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) > 10) {
          cancelPress();       // 滑动时取消长按计时
          swiped = true;
          // 跟随手指位移
          var w = pages.parentElement.clientWidth;
          var offset = -pageIndex * w + dx;
          // 边界橡皮筋阻尼
          if (pageIndex === 0 && dx > 0) offset = dx * 0.3;
          if (pageIndex === pageCount - 1 && dx < 0) offset = -pageIndex * w + dx * 0.3;
          pages.style.transition = 'none';
          pages.style.transform = 'translateX(' + offset + 'px)';
        }
      }, { passive: true });
      pages.addEventListener('touchend', function() {
        if (!swiping) return;
        swiping = false;
        if (Math.abs(dx) > 40) {
          if (dx < 0 && pageIndex < pageCount - 1) pageIndex++;
          if (dx > 0 && pageIndex > 0) pageIndex--;
        }
        setTrack(pageIndex, true);
        setTimeout(function() { swiped = false; }, 60);
      });
    }

    // ---- 悬浮球拖动 ----
    trigger.addEventListener('touchstart', function(e) {
      isDragging = false;
      var t = e.touches[0];
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      var rect = trigger.getBoundingClientRect();
      fabX = rect.left;
      fabY = rect.top;
    }, { passive: true });

    trigger.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      var dx = t.clientX - dragStartX;
      var dy = t.clientY - dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
      if (isDragging) {
        trigger.style.left = (fabX + dx) + 'px';
        trigger.style.right = 'auto';
        trigger.style.bottom = 'auto';
        trigger.style.top = (fabY + dy) + 'px';
      }
    }, { passive: true });

    trigger.addEventListener('touchend', function() {
      if (isDragging && Store.state.settings.fabSnap) snapToEdge(trigger);
      setTimeout(function() { isDragging = false; }, 50);
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

  function open() {
    isOpen = true;
    render();  // 打开时按最新数据/屏宽重绘，保证分页正确
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (mask) mask.classList.add('show');
    if (menu) menu.classList.add('open');
    if (trigger) trigger.classList.add('open');
  }

  function close() {
    isOpen = false;
    exitEdit();
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (mask) mask.classList.remove('show');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.classList.remove('open');
  }

  function updateActive(pageId) {
    currentPage = pageId;
    document.querySelectorAll('.fab-module-item').forEach(function(el) {
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
