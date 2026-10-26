/* global caches, self */

// Keep this value synchronized with VIRTUAL_CHURCH_CACHE_NAME in vite.config.ts.
// A release bump creates a fresh CacheFirst namespace. Activation also scrubs
// malformed HTML from current 3D caches without touching API or user data.
const CURRENT_VIRTUAL_CHURCH_CACHE =
  'alife-virtual-church-assets-gate-a-baseline-r9'
const VIRTUAL_CHURCH_LEGACY_CACHE = 'alife-virtual-church-assets'
const VIRTUAL_CHURCH_CACHE_PREFIX = `${VIRTUAL_CHURCH_LEGACY_CACHE}-`
const CURRENT_VIRTUAL_CHURCH_CODE_CACHE =
  'alife-virtual-church-code-gate-a-baseline-r9'
const VIRTUAL_CHURCH_CODE_LEGACY_CACHE = 'alife-virtual-church-code'
const VIRTUAL_CHURCH_CODE_CACHE_PREFIX =
  `${VIRTUAL_CHURCH_CODE_LEGACY_CACHE}-`
const APP_SHELL_CACHE = 'alife-app-cache'

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              (
                (
                  cacheName === VIRTUAL_CHURCH_LEGACY_CACHE
                  || cacheName.startsWith(VIRTUAL_CHURCH_CACHE_PREFIX)
                )
                && cacheName !== CURRENT_VIRTUAL_CHURCH_CACHE
              )
              || (
                (
                  cacheName === VIRTUAL_CHURCH_CODE_LEGACY_CACHE
                  || cacheName.startsWith(VIRTUAL_CHURCH_CODE_CACHE_PREFIX)
                )
                && cacheName !== CURRENT_VIRTUAL_CHURCH_CODE_CACHE
              ),
          )
          .map((cacheName) => caches.delete(cacheName)),
      )

      // Earlier Worker fallbacks could return 200 HTML for a missing GLB or
      // route chunk. Remove invalid public entries while retaining valid
      // offline assets, page documents and every unrelated/API cache.
      await Promise.all(
        [CURRENT_VIRTUAL_CHURCH_CACHE, CURRENT_VIRTUAL_CHURCH_CODE_CACHE, APP_SHELL_CACHE]
          .filter((cacheName) => cacheNames.includes(cacheName))
          .map(async (cacheName) => {
            const cache = await caches.open(cacheName)
            const requests = await cache.keys()
            await Promise.all(requests.map(async (request) => {
              const response = await cache.match(request)
              if (!response) return
              const contentType = response.headers.get('content-type') || ''
              const pathname = new URL(request.url).pathname
              const invalid = cacheName === APP_SHELL_CACHE
                ? (/\.js$/i.test(pathname) && !/^(?:application|text)\/(?:javascript|ecmascript)\b/i.test(contentType))
                  || (/\.css$/i.test(pathname) && !/^text\/css\b/i.test(contentType))
                : /^text\/html\b/i.test(contentType)
              if (invalid) {
                await cache.delete(request)
              }
            }))
          }),
      )
    }),
  )
})
