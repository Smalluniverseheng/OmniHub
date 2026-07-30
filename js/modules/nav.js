/* ==================== OmniHub Floating Navigation ==================== */

const Nav = (() => {
  'use strict';

  let isOpen = false;
  let isDragging = false;
  let dragStartX, dragStartY;
  let fabX, fabY;
  let currentPage = 'profile';

  function init() {
    render();
    bindEvents();
  }

  function render() {
    var pages = document.getElementById('fabMenuPages');
    var dots = document.getElementById('fabMenuDots');
    if (!pages) return;

    var items = Store.state.navItems.filter(function(n) { return n.enabled; }).sort(function(a, b) { return a.order - b.order; });
    var pageSize = window.innerWidth < 400 ? 4 : 6;
    var pageCount = Math.ceil(items.length / pageSize);

    var html = '';
    for (var p = 0; p < pageCount; p++) {
      var pageItems = items.slice(p * pageSize, (p + 1) * pageSize);
      html += '<div class="fab-page" data-page="' + p + '">';
      pageItems.forEach(function(item) {
        html += '<div class="fab-module-item ' + (item.id === currentPage ? 'active' : '') + '" data-page-id="' + item.id + '">';
        html += '<div class="fab-module-icon">' + item.icon + '</div>';
        html += '<div class="fab-module-name">' + item.name + '</div>';
        html += '<div class="delete-badge" data-del="' + item.id + '">✕</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    pages.innerHTML = html;

    if (dots) {
      dots.innerHTML = '';
      for (var i = 0; i < Math.max(pageCount, 1); i++) {
        dots.innerHTML += '<div class="fab-menu-dot ' + (i === 0 ? 'active' : '') + '" data-dot="' + i + '"></div>';
      }
    }
  }

  function bindEvents() {
    var trigger = document.getElementById('fabTrigger');
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var closeBtn = document.getElementById('fabMenuClose');
    var pages = document.getElementById('fabMenuPages');

    if (!trigger) return;

    trigger.addEventListener('click', function() {
      if (isDragging) return;
      isOpen ? close() : open();
    });

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (mask) mask.addEventListener('click', close);

    if (pages) {
      pages.addEventListener('click', function(e) {
        var item = e.target.closest('.fab-module-item');
        if (!item) return;

        if (item.classList.contains('editing')) {
          var del = e.target.closest('.delete-badge');
          if (del) {
            var id = del.dataset.del;
            if (id === 'profile') return Toast.show('「我的」不能删除');
            if (confirm('删除「' + getModuleName(id) + '」模块？')) {
              Store.state.navItems = Store.state.navItems.filter(function(n) { return n.id !== id; });
              Store.state.modules[id].enabled = false;
              Store.save();
              render();
              Toast.show('已删除');
            }
            return;
          }
        }

        var pageId = item.dataset.pageId;
        if (pageId) {
          App.switchPage(pageId);
          close();
        }
      });

      var pressTimer;
      pages.addEventListener('touchstart', function(e) {
        var item = e.target.closest('.fab-module-item');
        if (!item) return;
        pressTimer = setTimeout(function() {
          document.querySelectorAll('.fab-module-item').forEach(function(el) { el.classList.add('editing'); });
          Toast.show('点击 ✕ 删除模块');
        }, 600);
      });
      pages.addEventListener('touchend', function() { clearTimeout(pressTimer); });
      pages.addEventListener('touchmove', function() { clearTimeout(pressTimer); });
    }

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

    if (pages) {
      var startX = 0;
      var currentPageIndex = 0;
      pages.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; });
      pages.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - startX;
        var dotEls = document.querySelectorAll('.fab-menu-dot');
        if (Math.abs(dx) > 50) {
          if (dx < 0 && currentPageIndex < dotEls.length - 1) currentPageIndex++;
          if (dx > 0 && currentPageIndex > 0) currentPageIndex--;
          pages.scrollTo({ left: currentPageIndex * pages.clientWidth, behavior: 'smooth' });
          dotEls.forEach(function(d, i) { d.classList.toggle('active', i === currentPageIndex); });
        }
      });
    }
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
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (mask) mask.classList.add('show');
    if (menu) menu.classList.add('open');
    if (trigger) trigger.classList.add('open');
  }

  function close() {
    isOpen = false;
    var mask = document.getElementById('fabMask');
    var menu = document.getElementById('fabMenu');
    var trigger = document.getElementById('fabTrigger');
    if (mask) mask.classList.remove('show');
    if (menu) menu.classList.remove('open');
    if (trigger) trigger.classList.remove('open');
    document.querySelectorAll('.fab-module-item').forEach(function(el) { el.classList.remove('editing'); });
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

  return { init, render, open, close, updateActive };
})();
