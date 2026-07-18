const CACHE = 'storytime-v2';
const SHELL = ['/', '/library'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept API calls or non-GET requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Network-first with cache fallback. Page navigations bypass the HTTP
  // cache outright (not just the SW's own Cache Storage) — iOS Home Screen
  // apps can otherwise get stuck replaying a stale cached document forever.
  const fetchOptions = request.mode === 'navigate' ? { cache: 'no-store' } : {};

  e.respondWith(
    fetch(request, fetchOptions)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
