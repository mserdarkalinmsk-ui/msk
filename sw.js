/* Optional offline shell for hosted use; the exported HTML also works alone. */
const CACHE = 'portfolio-ledger-workspace-v5';
const ROOT = new URL('./', self.location.href).href;
const INDEX = new URL('index.html', ROOT).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([ROOT, INDEX])));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => (key.startsWith('portfolio-ledger-refined-') || key.startsWith('portfolio-ledger-workspace-')) && key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Cache only this app's document; never store imported files or other sites.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || ![ROOT, INDEX].includes(url.origin + url.pathname)) return;
  event.respondWith(
    fetch(event.request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match(INDEX))
  );
});
