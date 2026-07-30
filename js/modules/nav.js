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
    const pages = document.getElementById('fabMenuPages');
    const dots = document.getElementById('fabMenuDots');
    if (!pages) return;

    const items = Store.state.navItems.filter(n => n.enabled).sort((a, b) => a.order - b.order);
    const pageSize = window.innerWidth < 400 ? 4 : 6;
    const pageCount = Math.ceil(items.length / pageSize);

    // 分页渲染
    let html = '';
    for (let p = 0; p < pageCount; p++) {
      const pageItems = items.slice(p * pageSize, (p + 1) * pageSize);
      html += `<div class="fab-page" data-page="${p}">${pageItems.map(item => `
        <div class="fab-module-item ${item.id === currentPage ? 'active' : ''}" data-page-id="${item.id}">
          <div class="fab-module-icon">${item.icon}</div>
          <div class="fab-module-name">${item.name}</div>
          <div class="delete-badge" data-del="${item.id}">✕</div>
        </div>
      `).join('')}</div>`;
    }
    pages.innerHTML = html;

    // 分页指示器
    dots.innerHTML = Array.from({length: Math.max(pageCount, 1)}, (_, i) =>
      `<div class="fab-menu-dot ${i === 0 ? 'active' : ''}" data-dot="${i}"></div>`
    ).join('');
  }

  function bindEvents() {
    const trigger = document.getElementById('fabTrigger');
    const mask = document.getElementById('fabMask');
    const menu = document.getElementById('fabMenu');
    const closeBtn = document.getElementById('fabMenuClose');
    const pages = document.getElementById('fabMenuPages');

    if (!trigger) return;

    // 点击展开/收起
    trigger.addEventListener('click', () => {
      if (isDragging) return;
      isOpen ? close() : open();
    });

    // 关闭按钮
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (mask) mask.addEventListener('click', close);

    // 模块点击
    if (pages) {
      pages.addEventListener('click', e => {
        const item = e.target.closest('.fab-module-item');
        if (!item) return;

        // 删除模式
        if (item.classList.contains('editing')) {
          const del = e.target.closest('.delete-badge');
          if (del) {
            const id = del.dataset.del;
            if (id === 'profile') return Toast.show('「我的」不能删除');
            if (confirm('删除「' + getModuleName(id) + '」模块？')) {
              Store.state.navItems = Store.state.navItems.filter(n => n.id !== id);
              Store.state.modules[id].enabled = false;
              Store.save();
              render();
              Toast.show('已删除');
            }
            return;
          }
        }

        // 切换页面
        const pageId = item.dataset.pageId;
        if (pageId) {
          App.switchPage(pageId);
          close();
        }
      });

      // 长按进入编辑模式
      let pressTimer;
      pages.addEventListener('touchstart', e => {
        const item = e.target.closest('.fab-module-item');
        if (!item) return;
        pressTimer = setTimeout(() => {
          document.querySelectorAll('.fab-module-item').forEach(el => el.classList.add('editing'));
          Toast.show('点击 ✕ 删除模块');
        }, 600);
      });
      pages.addEventListener('touchend', () => clearTimeout(pressTimer));
      pages.addEventListener('touchmove', () => clearTimeout(pressTimer));
    }

    // 拖动悬浮球
    trigger.addEventListener('touchstart', e => {
      isDragging = false;
      const t = e.touches[0];
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      const rect = trigger.getBoundingClientRect();
      fabX = rect.left;
      fabY = rect.top;
    }, { passive: true });

    trigger.addEventListener('touchmove', e => {
      const t = e.touches[0];
      const dx = t.clientX - dragStartX;
      const dy = t.clientY - dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
      if (isDragging) {
        trigger.style.left = (fabX + dx) + 'px';
        trigger.style.right = 'auto';
        trigger.style.bottom = 'auto';
        trigger.style.top = (fabY + dy) + 'px';
      }
    }, { passive: true });

    trigger.addEventListener('touchend', () => {
      if (isDragging && Store.state.settings.fabSnap) {
        snapToEdge(trigger);
      }
      setTimeout(() => isDragging = false, 50);
    });

    // 分页滑动
    if (pages) {
      let startX = 0;
      let currentPageIndex = 0;
      pages.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
      pages.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dots = document.querySelectorAll('.fab-menu-dot');
        if (Math.abs(dx) > 50) {
          if (dx < 0 && currentPageIndex < dots.length - 1) currentPageIndex++;
          if (dx > 0 && currentPageIndex > 0) currentPageIndex--;
          pages.scrollTo({ left: currentPageIndex * pages.clientWidth, behavior: 'smooth' });
          dots.forEach((d, i) => d.classList.toggle('active', i === currentPageIndex));
        }
      });
    }
  }

  function snapToEdge(el) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // 吸附到最近的边缘
    let left = rect.left, top = rect.top;
    if (cx < ww / 2) {
      left = 20;
    } else {
      left = ww - rect.width - 20;
    }
    if (cy < wh / 3) {
      top = 20;
    } else if (cy > wh * 2 / 3) {
      top = wh - rect.height - 30;
    }

    el.style.transition = 'left 0.3s, top 0.3s';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    setTimeout(() => el.style.transition = '', 300);

    Store.state.settings.fabPosition = { x: left, y: top };
    Store.save();
  }

  function open() {
    isOpen = true;
    document.getElementById('fabMask').classList.add('show');
    document.getElementById('fabMenu').classList.add('open');
    document.getElementById('fabTrigger').classList.add('open');
  }

  function close() {
    isOpen = false;
    document.getElementById('fabMask').classList.remove('show');
    document.getElementById('fabMenu').classList.remove('open');
    document.getElementById('fabTrigger').classList.remove('open');
    document.querySelectorAll('.fab-module-item').forEach(el => el.classList.remove('editing'));
  }

  function updateActive(pageId) {
    currentPage = pageId;
    document.querySelectorAll('.fab-module-item').forEach(el => {
      el.classList.toggle('active', el.dataset.pageId === pageId);
    });
    // 更新图标
    const item = Store.state.navItems.find(n => n.id === pageId);
    if (item) {
      document.getElementById('fabIcon').textContent = item.icon;
    }
  }

  function getModuleName(id) {
    const item = Store.state.navItems.find(n => n.id === id);
    return item ? item.name : id;
  }

  return { init, render, open, close, updateActive };
})();
