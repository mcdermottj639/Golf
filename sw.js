// Caddie HQ service worker — offline-first cache of the app shell.
const CACHE = 'caddiehq-v8';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './lessons.js',
  './manifest.webmanifest', './icon.svg', './coach-feed.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // no-store defeats GitHub Pages' 10-minute HTTP cache so updates land
  // immediately; the SW cache still serves everything offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
