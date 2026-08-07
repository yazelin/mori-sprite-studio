const CACHE_NAME = 'mori-sprite-studio-v2'
const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/favicon-192.png', '/favicon-512.png', '/favicon-32.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // 只清自己的 mori-sprite-studio-*:CacheStorage 是 per-origin,yazelin.github.io
      // 底下所有專案共用同一份(SW 的 scope 只管 fetch,管不到快取)。無差別刪會把
      // gewu 的 33MB、neko 等別站的離線包整包清掉,而且功能完全正常、毫無徵兆。
      Promise.all(
        keys.filter((key) => key.startsWith('mori-sprite-studio-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
