const CACHE = 'cybertrmx-v30';
const ASSETS = ['./', './index.html', './styles.css', './intel.css', './intel-workspace.css', './mobile.css', './refine.css', './landing.css', './profile.css', './system-upgrade.css', './tracker-v2.css', './cloud-core.css', './security-v52.css', './jobs-v53.css', './app.js', './intel.js', './intel-workspace.js', './guide.js', './profile.js', './system-upgrade.js', './tracker-v2.js', './patch-page.js', './terminal-v2.js', './command-hints.js', './command-hints-v52.js', './copy-refresh.js', './cloud-bootstrap.js', './backend-config.js', './auth-redirect-fix.js', './security-utils.js', './device-v531.js', './security-v52.js', './jobs-v53.js', './cloud-core.js', './motion.js', './checkin.html', './checkin.css', './checkin.js', './manifest.webmanifest', './icon.svg'];
const CRITICAL = new Set(['./', './index.html', './app.js', './motion.js', './cloud-bootstrap.js', './patch-page.js']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((asset) => cache.add(asset))))
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
  const networkRequest = critical ? new Request(event.request, { cache: 'reload' }) : event.request;

  event.respondWith(
    fetch(networkRequest)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});