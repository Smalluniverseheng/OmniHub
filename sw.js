const VERSION = 'v8.2';
const CACHE_NAME = 'omnihub-' + VERSION;

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/global.css',
  '/css/read.css',
  '/css/models.css',
  '/css/chat.css',
  '/css/profile.css',
  '/js/event-bus.js',
  '/js/i18n.js',
  '/js/backend-config.js',
  '/js/ui-icons.js',
  '/js/device.js',
  '/js/auth.js',
  '/js/source-url-resolver.js',
  '/js/leaderboard-data.js',
  '/js/custom-providers.js',
  '/js/token-meter.js',
  '/js/plugins/web-search.js',
  '/js/mcp-client.js',
  '/js/modules/chat-modes.js',
  '/js/modules/models.js',
  '/js/modules/keys.js',
  '/js/store.js',
  '/js/supabase.js',
  '/js/ai-providers.js',
  '/js/ai-models.js',
  '/js/brand-icons.js',
  '/js/ai-api.js',
  '/js/voice.js',
  '/js/app.js',
  '/js/modules/nav.js',
  '/js/modules/profile.js',
  '/js/modules/read.js',
  '/js/modules/reader.js',
  '/js/modules/chat.js',
  '/js/modules/novel-reader.js',
  '/js/changelog.js',
  '/js/venera-engine.js',
  '/js/legado-engine.js',
  '/js/legado-converter.js',
  '/js/source-detect.js',
  '/js/providers.js',
  '/assets/brand.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // 云服务域名（Supabase / Cloudflare Worker / CDN）直接放行，不缓存
  if (url.indexOf('supabase.co') !== -1 || url.indexOf('workers.dev') !== -1 ||
      url.indexOf('cdn.jsdelivr.net') !== -1 || url.indexOf('unpkg.com') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
