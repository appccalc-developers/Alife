// These runtime caches could contain API files from the pre-v2 matching rules.
// New workers use separate names, so an old worker cannot refill a v2 cache.
self.addEventListener('activate', event => {
  const legacyRuntimeCaches = new Set([
    'alife-video-cache',
    'alife-app-cache',
    'alife-image-cache',
    'alife-external-image-cache',
    'alife-runtime-cache',
  ])
  event.waitUntil(caches.keys().then(names =>
    Promise.all(names.filter(name => legacyRuntimeCaches.has(name)).map(name => caches.delete(name))),
  ))
})
