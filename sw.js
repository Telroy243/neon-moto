const CACHE_NAME = 'neon-fleet-v2';
const ASSETS = [
  './',
  './index.html',
  './dash.html',
  './garage.html',
  './rh.html',
  './finances.html',
  './settings.html',
  './database.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Ignorer les requêtes avec des schémas non supportés par le cache (ex: chrome-extension://)
  if (!e.request.url.startsWith('http')) return;
  
  e.respondWith(
    caches.match(e.request)
      .then((response) => response || fetch(e.request))
  );
});
