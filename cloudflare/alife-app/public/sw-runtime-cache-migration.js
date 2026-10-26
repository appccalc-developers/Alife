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
  event.waitUntil(caches.keys().then(names => Promise.all(names.map(async name => {
    if (legacyRuntimeCaches.has(name)) return caches.delete(name)
    // Preserve public assets while retiring album originals cached by v2 workers.
    if (!/^alife-.*-cache-v2$/.test(name)) return
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      let path
      try { path = decodeURIComponent(new URL(request.url).pathname) } catch { continue }
      if (/(?:^|\/)groups\/[^/]+\/albums(?:\/|$)/i.test(path)) await cache.delete(request)
    }
  }))))
})
