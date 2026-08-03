const CACHE = 'cybertrmx-v16';
const ASSETS = ['./', './index.html', './styles.css', './intel.css', './intel-workspace.css', './mobile.css', './refine.css', './landing.css', './profile.css', './system-upgrade.css', './tracker-v2.css', './app.js', './intel.js', './intel-workspace.js', './guide.js', './profile.js', './motion.js', './system-upgrade.js', './tracker-v2.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});