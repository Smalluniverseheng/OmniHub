/* ==================== OmniHub EventBus - 全局事件总线 ==================== */
/* 模块间一次性通信统一走事件总线，不直接引用对方全局变量。
   用法：
     EventBus.on('reader:open', function(payload){ ... });
     EventBus.off('reader:open', fn);          // 传入同一引用移除
     EventBus.emit('reader:open', { id: 1 });  // 单个监听器异常不影响其他监听器 */

const EventBus = (() => {
  'use strict';

  // 事件名 -> 监听器数组（{fn} 结构便于后续扩展 once 等能力）
  var handlers = Object.create(null);

  function on(evt, fn) {
    if (!evt || typeof fn !== 'function') return;
    if (!handlers[evt]) handlers[evt] = [];
    // 同一函数重复订阅只保留一份，避免重复触发
    for (var i = 0; i < handlers[evt].length; i++) {
      if (handlers[evt][i] === fn) return;
    }
    handlers[evt].push(fn);
  }

  function off(evt, fn) {
    var list = handlers[evt];
    if (!list) return;
    if (!fn) { delete handlers[evt]; return; }  // 不传 fn 则清空该事件全部监听
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] === fn) list.splice(i, 1);
    }
    if (!list.length) delete handlers[evt];
  }

  function emit(evt, payload) {
    var list = handlers[evt];
    if (!list || !list.length) return;
    // 拷贝一份再遍历，防止监听器内部 off/on 改变数组导致漏触发
    var snapshot = list.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (e) {
        console.error('[EventBus] 监听器执行失败 (' + evt + '):', e);
      }
    }
  }

  // 调试用：查看当前已注册事件
  function events() {
    return Object.keys(handlers);
  }

  return { on: on, off: off, emit: emit, events: events };
})();
