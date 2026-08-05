const CACHE = 'cybertrmx-v31';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './mobile.css',
  './refine.css',
  './landing.css',
  './mobile-performance-v533.css',
  './app.js',
  './motion.js',
  './manifest.webmanifest',
  './icon.svg'
];
const CRITICAL = new Set([
  './',
  './index.html',
  './styles.css',
  './mobile.css',
  './refine.css',
  './landing.css',
  './mobile-performance-v533.css',
  './app.js',
  './motion.js'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const relative = `.${url.pathname.replace('/cyberxtrmx', '') || '/'}`;
  const critical = event.request.mode === 'navigate' || CRITICAL.has(relative);

  if (critical) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' }))
        .then((response) => {
          if (response?.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const refresh = fetch(event.request)
        .then((response) => {
          if (response?.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => null);
      return cached || refresh.then((response) => response || caches.match('./index.html'));
    })
  );
});