const CACHE = 'cybertrmx-v42';
const CACHE_NAMESPACE = 'cybertrmx-v';
const ASSETS = ['./', './index.html', './styles.css', './intel.css', './intel-workspace.css', './mobile.css', './refine.css', './landing.css', './profile.css', './system-upgrade.css', './tracker-engine.css', './tracker-engine.js', './tracker-v2.css', './cloud-core.css', './security-v52.css', './guard-v528.css', './app.js', './intel.js', './intel-workspace.js', './guide.js', './profile.js', './system-upgrade.js', './tracker-v2.js', './patch-page.js', './recovery-527.js', './guard-v528.js', './terminal-v2.js', './command-hints.js', './command-hints-v52.js', './copy-refresh.js', './cloud-bootstrap.js', './backend-config.js', './auth-redirect-fix.js', './security-utils.js', './security-v52.js', './cloud-core.js', './motion.js', './checkin.html', './checkin.css', './checkin.js', './recover.html', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_NAMESPACE) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const freshAsset = /\.(?:js|css|html)$/.test(url.pathname);
  const request = freshAsset ? new Request(event.request, { cache: 'reload' }) : event.request;
  event.respondWith(fetch(request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});