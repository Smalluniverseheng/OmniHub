/* ==================== Verifier v3 - I18n / Store 单元测试（Node 运行） ==================== */
/* 覆盖：
   1) I18n fallback：当前语 → zh-CN → en → key 本身；{var} 插值
   2) I18n.setLang：写 Store / <html lang> / dir(ar=rtl) / EventBus.emit('i18n:changed')
   3) Store.subscribe：'a.b.*' 通配与 'a.b.c' 精确
   4) Store.save 500ms 防抖 + flush 立即写
   5) theme/language 统一 settings.*（旧顶层字段迁移 + 兼容访问器 + 不双写入盘）
   运行：node verifier/v3/test_i18n_store.mjs */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* ---- 浏览器环境桩 ---- */
const storageMap = new Map();
const localStorageStub = {
  getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: k => storageMap.delete(k)
};
const documentElement = { lang: '', dir: '' };
const documentStub = {
  documentElement,
  readyState: 'loading',              // GlobalFX 走 DOMContentLoaded 分支，只注册不执行
  addEventListener() {},               // DOMContentLoaded / visibilitychange 注册桩
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, addEventListener() {} }; },
  body: null
};
const sandbox = {
  console,
  localStorage: localStorageStub,
  document: documentStub,
  window: { addEventListener() {}, innerWidth: 390, innerHeight: 844 },
  navigator: { userAgent: 'node-test' },
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: fn => setTimeout(fn, 0)
};
vm.createContext(sandbox);

function loadJs(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  vm.runInContext(src, sandbox, { filename: rel });
}

// 旧版数据预置：顶层 theme/language 与 settings 双写不一致场景
storageMap.set('omnihub_v7', JSON.stringify({
  theme: 'light', language: 'en',
  settings: { notifications: false }   // settings 内无 theme/language → 应从顶层迁移
}));

loadJs('js/event-bus.js');
loadJs('js/store.js');
loadJs('js/i18n.js');
vm.runInContext('globalThis.__api = { Store, I18n, EventBus };', sandbox);
const { Store, I18n, EventBus } = sandbox.__api;

console.log('== 1. theme/language 迁移与统一 ==');
ok(Store.state.settings.theme === 'light', '旧顶层 theme=light 已迁入 settings.theme', Store.state.settings.theme);
ok(Store.state.settings.language === 'en', '旧顶层 language=en 已迁入 settings.language', Store.state.settings.language);
ok(Store.state.theme === 'light', '兼容 getter：state.theme === settings.theme', Store.state.theme);
Store.patch({ theme: 'dark' });
ok(Store.state.settings.theme === 'dark', 'patch({theme}) 归一写入 settings.theme', Store.state.settings.theme);
ok(Store.state.theme === 'dark', 'patch 后兼容 getter 一致', Store.state.theme);
const exported = JSON.parse(Store.exportData());
ok(!Object.prototype.hasOwnProperty.call(exported, 'theme'), '持久化不再双写顶层 theme');
Store.patch({ theme: 'dark', language: 'en' });  // 复位，避免影响后续

console.log('== 2. I18n fallback ==');
I18n.register('test', {
  'zh-CN': { hello: '你好', hi: '你好{name}' },
  'en': { hello: 'Hello', bye: 'Bye' },
  'fr': { bonjour: 'Bonjour' }
});
I18n.setLang('fr');
ok(I18n.t('test.bonjour') === 'Bonjour', '当前语命中 fr', I18n.t('test.bonjour'));
ok(I18n.t('test.hello') === '你好', 'fr 缺失回退 zh-CN', I18n.t('test.hello'));
ok(I18n.t('test.bye') === 'Bye', 'fr/zh-CN 缺失回退 en', I18n.t('test.bye'));
ok(I18n.t('test.nothing') === 'test.nothing', '全缺失回退 key 本身', I18n.t('test.nothing'));
ok(I18n.t('test.hi', { name: '小明' }) === '你好小明', '{name} 插值', I18n.t('test.hi', { name: '小明' }));
ok(I18n.t('common.ok') === 'OK', '内置 common 当前语(fr)命中', I18n.t('common.ok'));
I18n.setLang('ar');
ok(documentElement.dir === 'rtl', 'setLang(ar) → dir=rtl', documentElement.dir);
ok(documentElement.lang === 'ar', 'setLang(ar) → <html lang=ar>', documentElement.lang);
I18n.setLang('en');
ok(documentElement.dir === 'ltr', 'setLang(en) → dir=ltr', documentElement.dir);

console.log('== 3. EventBus 契约 ==');
let busHit = 0, busPayload = null;
const busFn = p => { busHit++; busPayload = p; };
EventBus.on('demo', busFn);
EventBus.emit('demo', { a: 1 });
EventBus.off('demo', busFn);
EventBus.emit('demo', { a: 2 });
ok(busHit === 1 && busPayload.a === 1, 'on/emit/off 正常', { busHit, busPayload });
let i18nEvt = null;
EventBus.on('i18n:changed', p => { i18nEvt = p; });
I18n.setLang('es');
ok(i18nEvt && i18nEvt.lang === 'es', 'setLang 触发 i18n:changed', i18nEvt);

console.log('== 4. Store.subscribe 通配/精确 ==');
const hits = { shelf: 0, theme: 0, shelfVal: null, themeVal: null };
const unShelf = Store.subscribe('read.shelf.*', v => { hits.shelf++; hits.shelfVal = v; });
Store.subscribe('settings.theme', v => { hits.theme++; hits.themeVal = v; });
Store.patch({ read: { shelf: [{ id: 1 }] } });
ok(hits.shelf === 1 && Array.isArray(hits.shelfVal) && hits.shelfVal.length === 1, "通配 'read.shelf.*' 命中 patch(read.shelf)", hits);
ok(hits.theme === 0, "精确 'settings.theme' 不被 read 变化触发", hits);
Store.patch({ settings: { theme: 'light' } });
ok(hits.theme === 1 && hits.themeVal === 'light', "精确 'settings.theme' 命中", hits.themeVal);
ok(hits.shelf === 1, '通配 shelf 不被 settings 变化触发', hits.shelf);
unShelf();
Store.patch({ read: { shelf: [] } });
ok(hits.shelf === 1, '取消订阅后不再触发', hits.shelf);

console.log('== 5. save 防抖 + flush ==');
storageMap.clear();
Store.patch({ user: { balance: 99 } });
ok(!storageMap.has('omnihub_v7'), 'save() 防抖：patch 后未立即落盘');
await new Promise(r => setTimeout(r, 650));
ok(storageMap.has('omnihub_v7'), '防抖 500ms 后已落盘');
const disk1 = JSON.parse(storageMap.get('omnihub_v7'));
ok(disk1.user.balance === 99 && disk1.settings.theme === 'light', '落盘内容正确', disk1.settings.theme);
storageMap.clear();
Store.patch({ user: { balance: 100 } });
ok(!storageMap.has('omnihub_v7'), 'flush 前仍未落盘');
Store.flush();
ok(storageMap.has('omnihub_v7'), 'flush() 立即落盘');
ok(JSON.parse(storageMap.get('omnihub_v7')).user.balance === 100, 'flush 内容正确');

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed ? 1 : 0);
