const CACHE = 'mania-brain-v2';
const BASE = '/mania-brain/';
const APP_SHELL = [BASE, `${BASE}manifest.webmanifest`];
self.addEventListener('install', (event) => event.waitUntil(
  caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
));
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const request = event.request.mode === 'navigate'
    ? new Request(event.request, { cache: 'no-store' })
    : event.request;
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match(BASE))));
});
