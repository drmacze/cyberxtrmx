const CACHE = 'cybertrmx-v38';
const ASSETS = ['./', './index.html', './styles.css', './intel.css', './intel-workspace.css', './mobile.css', './refine.css', './landing.css', './profile.css', './system-upgrade.css', './tracker-engine.css', './tracker-engine.js', './tracker-v2.css', './cloud-core.css', './security-v52.css', './app.js', './intel.js', './intel-workspace.js', './guide.js', './profile.js', './system-upgrade.js', './tracker-v2.js', './patch-page.js', './terminal-v2.js', './command-hints.js', './command-hints-v52.js', './copy-refresh.js', './cloud-bootstrap.js', './backend-config.js', './auth-redirect-fix.js', './security-utils.js', './transport-v523.js', './security-v52.js', './cloud-core.js', './motion.js', './checkin.html', './checkin.css', './checkin.js', './manifest.webmanifest', './icon.svg'];
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