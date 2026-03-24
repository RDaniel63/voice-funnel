const CACHE_NAME = 'voicefunnel-v2';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/']))));
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // Don't cache API calls
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))));
