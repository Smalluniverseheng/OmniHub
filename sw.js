const VERSION = 'v7.2';
const CACHE_NAME = 'omnihub-' + VERSION;

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/store.js',
  '/js/ai-providers.js',
  '/js/ai-api.js',
  '/js/app.js',
  '/js/modules/nav.js',
  '/js/modules/profile.js',
  '/js/modules/read.js',
  '/js/modules/reader.js',
  '/js/modules/chat.js',
  '/js/modules/novel-reader.js',
  '/js/changelog.js',
  '/js/venera-engine.js',
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
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
