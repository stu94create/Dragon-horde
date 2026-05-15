// Service worker for The Dragon's Hoard.
// Precaches the app shell so the app boots offline and so installed
// PWAs on iOS keep working when Safari ITP would otherwise dump caches.
//
// Bump CACHE_VERSION whenever any precached file changes.
const CACHE_VERSION = 'hoard-v21';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/bg.png',
  './assets/reckoning.mp3',
  './assets/coin1.mp3',
  './assets/coin2.mp3',
  './assets/coin3.mp3',
  './assets/hiss1.mp3',
  './assets/hiss2.mp3',
  './assets/hiss3.mp3',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
    // controllerchange on the page will trigger a reload — don't also
    // call client.navigate from here, that races with the page's own JS
    // and can interrupt event-listener registration mid-script.
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let the network handle Google Fonts etc.
  if (url.origin !== self.location.origin) return;

  // For navigation requests, try the network first so app updates land
  // immediately. Fall back to cache only when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For everything else: cache-first, then network.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
