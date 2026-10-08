import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createVirtualChurchReviewFault } from './scripts/virtualChurchReviewFault'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  virtualChurchAppShellRequestMatches,
  virtualChurchAssetRequestMatches,
  virtualChurchCodeChunkMatches,
  virtualChurchPublicImageOrFontRequestMatches,
  virtualChurchPublicRuntimeRequestMatches,
  virtualChurchPublicVideoRequestMatches,
} from './src/views/virtualChurchPwaContract'

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60
const VIRTUAL_CHURCH_ASSET_RELEASE = 'gate-a-baseline-r9'
const VIRTUAL_CHURCH_CACHE_NAME =
  `alife-virtual-church-assets-${VIRTUAL_CHURCH_ASSET_RELEASE}`
const VIRTUAL_CHURCH_CODE_CACHE_NAME =
  `alife-virtual-church-code-${VIRTUAL_CHURCH_ASSET_RELEASE}`
// A production worker from a reused localhost port otherwise serves its old
// app shell over Vite. Its update request for /sw.js must receive JavaScript,
// not Vite's HTML fallback, before current development code can clear caches.
const DEV_SERVICE_WORKER_RETIREMENT_SCRIPT = `
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    await Promise.all(windows.filter(client => {
      const url = new URL(client.url)
      const returnTo = url.searchParams.get('returnTo')
      return url.pathname === '/virtual-church'
        || url.pathname.startsWith('/virtual-church/')
        || (url.pathname === '/onboarding' && returnTo !== null && returnTo.startsWith('/virtual-church'))
    }).map(client => client.navigate(client.url).catch(() => {})))
  })())
})
`
const VIRTUAL_CHURCH_CHARACTER_REVIEW_ROUTES = {
  '/__alife-review/virtual-church/character-hero-female-v12-high.glb': 'female-v12-high',
  '/__alife-review/virtual-church/character-hero-female-v12-medium.glb': 'female-v12-medium',
  '/__alife-review/virtual-church/character-hero-female-v12-low.glb': 'female-v12-low',
  '/__alife-review/virtual-church/character-hero-male-v12-high.glb': 'male-v12-high',
  '/__alife-review/virtual-church/character-hero-male-v12-medium.glb': 'male-v12-medium',
  '/__alife-review/virtual-church/character-hero-male-v12-low.glb': 'male-v12-low',
  '/__alife-review/virtual-church/character-hero-female-v13-high.glb': 'female-v13-high',
  '/__alife-review/virtual-church/character-hero-female-v13-medium.glb': 'female-v13-medium',
  '/__alife-review/virtual-church/character-hero-female-v13-low.glb': 'female-v13-low',
  '/__alife-review/virtual-church/character-hero-male-v13-high.glb': 'male-v13-high',
  '/__alife-review/virtual-church/character-hero-male-v13-medium.glb': 'male-v13-medium',
  '/__alife-review/virtual-church/character-hero-male-v13-low.glb': 'male-v13-low',
  '/__alife-review/virtual-church/character-hero-female-v14-high.glb': 'female-v14-high',
  '/__alife-review/virtual-church/character-hero-female-v14-medium.glb': 'female-v14-medium',
  '/__alife-review/virtual-church/character-hero-female-v14-low.glb': 'female-v14-low',
  '/__alife-review/virtual-church/character-hero-male-v14-high.glb': 'male-v14-high',
  '/__alife-review/virtual-church/character-hero-male-v14-medium.glb': 'male-v14-medium',
  '/__alife-review/virtual-church/character-hero-male-v14-low.glb': 'male-v14-low',
  '/__alife-review/virtual-church/character-hero-male-v14-motion.glb': 'male-v14-motion',
  '/__alife-review/virtual-church/character-hero-male-v12-picker.webp': 'male-v12-picker',
  '/__alife-review/virtual-church/character-hero-male-v14-picker.webp': 'male-v14-picker',
} as const
declare const self: { location: { origin: string } }

const isLoopbackUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const configuredApiBaseUrl = (environment.VITE_API_BASE_URL ?? '').trim()
  const defaultFemaleCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v12-medium.glb',
    import.meta.url,
  ))
  const defaultFemaleHighCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v12-high.glb',
    import.meta.url,
  ))
  const defaultFemaleLowCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v12-low.glb',
    import.meta.url,
  ))
  const defaultMaleHighCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v12-wave-high.glb',
    import.meta.url,
  ))
  const defaultMaleMediumCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v12-wave-medium.glb',
    import.meta.url,
  ))
  const defaultMaleLowCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v12-wave-low.glb',
    import.meta.url,
  ))
  const defaultMaleCharacterReviewPickerFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v12-picker.webp',
    import.meta.url,
  ))
  const defaultMaleV14CharacterReviewPickerFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v14-picker.webp',
    import.meta.url,
  ))
  const defaultFemaleV13HighCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v13-high.glb',
    import.meta.url,
  ))
  const defaultFemaleV13MediumCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v13-medium.glb',
    import.meta.url,
  ))
  const defaultFemaleV13LowCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v13-low.glb',
    import.meta.url,
  ))
  const defaultMaleV13HighCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v13-wave-high.glb',
    import.meta.url,
  ))
  const defaultMaleV13MediumCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v13-wave-medium.glb',
    import.meta.url,
  ))
  const defaultMaleV13LowCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-male-v13-wave-low.glb',
    import.meta.url,
  ))
  const defaultFemaleV14HighCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v14-high.glb',
    import.meta.url,
  ))
  const defaultFemaleV14MediumCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v14-medium.glb',
    import.meta.url,
  ))
  const defaultFemaleV14LowCharacterReviewFile = fileURLToPath(new URL(
    '../../.tmp/virtual-church-character-review/character-hero-female-v14-low.glb',
    import.meta.url,
  ))
  const characterReviewFiles = {
    'male-v14-motion': resolve(
      (environment.ALIFE_VC_MALE_V14_MOTION_REVIEW_FILE ?? '').trim()
        || fileURLToPath(new URL('../../.tmp/virtual-church-character-review/character-hero-male-v14-motion.glb', import.meta.url)),
    ),
    'male-v14-high': resolve(
      (environment.ALIFE_VC_MALE_V14_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || fileURLToPath(new URL('../../.tmp/virtual-church-character-review/character-hero-male-v14-wave-high.glb', import.meta.url)),
    ),
    'male-v14-medium': resolve(
      (environment.ALIFE_VC_MALE_V14_CHARACTER_REVIEW_FILE ?? '').trim()
        || fileURLToPath(new URL('../../.tmp/virtual-church-character-review/character-hero-male-v14-wave-medium.glb', import.meta.url)),
    ),
    'male-v14-low': resolve(
      (environment.ALIFE_VC_MALE_V14_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || fileURLToPath(new URL('../../.tmp/virtual-church-character-review/character-hero-male-v14-wave-low.glb', import.meta.url)),
    ),
    'female-v12-high': resolve(
      (environment.ALIFE_VC_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || defaultFemaleHighCharacterReviewFile,
    ),
    'female-v12-medium': resolve(
      (environment.ALIFE_VC_CHARACTER_REVIEW_FILE ?? '').trim()
        || defaultFemaleCharacterReviewFile,
    ),
    'female-v12-low': resolve(
      (environment.ALIFE_VC_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || defaultFemaleLowCharacterReviewFile,
    ),
    'male-v12-high': resolve(
      (environment.ALIFE_VC_MALE_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || defaultMaleHighCharacterReviewFile,
    ),
    'male-v12-medium': resolve(
      (environment.ALIFE_VC_MALE_CHARACTER_REVIEW_FILE ?? '').trim()
        || defaultMaleMediumCharacterReviewFile,
    ),
    'male-v12-low': resolve(
      (environment.ALIFE_VC_MALE_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || defaultMaleLowCharacterReviewFile,
    ),
    'female-v13-high': resolve(
      (environment.ALIFE_VC_FEMALE_V13_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || defaultFemaleV13HighCharacterReviewFile,
    ),
    'female-v13-medium': resolve(
      (environment.ALIFE_VC_FEMALE_V13_CHARACTER_REVIEW_FILE ?? '').trim()
        || defaultFemaleV13MediumCharacterReviewFile,
    ),
    'female-v13-low': resolve(
      (environment.ALIFE_VC_FEMALE_V13_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || defaultFemaleV13LowCharacterReviewFile,
    ),
    'male-v13-high': resolve(
      (environment.ALIFE_VC_MALE_V13_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || defaultMaleV13HighCharacterReviewFile,
    ),
    'male-v13-medium': resolve(
      (environment.ALIFE_VC_MALE_V13_CHARACTER_REVIEW_FILE ?? '').trim()
        || defaultMaleV13MediumCharacterReviewFile,
    ),
    'male-v13-low': resolve(
      (environment.ALIFE_VC_MALE_V13_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || defaultMaleV13LowCharacterReviewFile,
    ),
    'female-v14-high': resolve(
      (environment.ALIFE_VC_FEMALE_V14_CHARACTER_REVIEW_HIGH_FILE ?? '').trim()
        || defaultFemaleV14HighCharacterReviewFile,
    ),
    'female-v14-medium': resolve(
      (environment.ALIFE_VC_FEMALE_V14_CHARACTER_REVIEW_FILE ?? '').trim()
        || defaultFemaleV14MediumCharacterReviewFile,
    ),
    'female-v14-low': resolve(
      (environment.ALIFE_VC_FEMALE_V14_CHARACTER_REVIEW_LOW_FILE ?? '').trim()
        || defaultFemaleV14LowCharacterReviewFile,
    ),
    'male-v12-picker': resolve(
      (environment.ALIFE_VC_MALE_CHARACTER_REVIEW_PICKER_FILE ?? '').trim()
        || defaultMaleCharacterReviewPickerFile,
    ),
    'male-v14-picker': resolve(
      (environment.ALIFE_VC_MALE_V14_CHARACTER_REVIEW_PICKER_FILE ?? '').trim()
        || defaultMaleV14CharacterReviewPickerFile,
    ),
  }
  if (command === 'build' && isLoopbackUrl(configuredApiBaseUrl)) {
    // A developer's ignored .env may point at the local Functions host. That
    // address must never be embedded in a browser bundle deployed to Cloudflare.
    process.env.VITE_API_BASE_URL = ''
    console.warn('Ignoring loopback VITE_API_BASE_URL for this production build; using same-origin /api.')
  }

  const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:7071'
  const aiProxyTarget = process.env.AI_PROXY_TARGET || process.env.SPEED_LAYER_PROXY_TARGET || 'http://127.0.0.1:8787'
  const imagesProxyTarget = process.env.IMAGES_PROXY_TARGET || 'https://images.ccalc.live'
  const publicDevHost = (process.env.ALIFE_PUBLIC_DEV_HOST ?? '').trim()

  return {
    plugins: [
      {
        name: 'alife-preview-static-asset-boundary',
        configurePreviewServer(server) {
          const distRoot = resolve(server.config.root, server.config.build.outDir)
          server.middlewares.use((request, response, next) => {
            if (request.method !== 'GET' && request.method !== 'HEAD') return next()
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
            if (!/^\/(?:assets|virtual-church-assets)\//u.test(pathname)) return next()

            let assetPath: string
            try {
              assetPath = resolve(distRoot, decodeURIComponent(pathname).slice(1))
            } catch {
              assetPath = distRoot
            }
            const fromDist = relative(distRoot, assetPath)
            const insideDist = fromDist !== '' && fromDist !== '..'
              && !fromDist.startsWith(`..${sep}`) && !isAbsolute(fromDist)
            if (insideDist) {
              try {
                if (statSync(assetPath).isFile()) return next()
              } catch { /* Missing files must not enter the SPA fallback. */ }
            }

            response.statusCode = 404
            response.setHeader('Content-Type', 'text/plain; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store, max-age=0')
            response.setHeader('X-Content-Type-Options', 'nosniff')
            response.end(request.method === 'HEAD' ? undefined : 'Static asset not found.')
          })
        },
      },
      {
        name: 'alife-local-character-review',
        configureServer(server) {
          const injectMotionFault = createVirtualChurchReviewFault(environment.ALIFE_VC_MOTION_REVIEW_FAULT)
          server.middlewares.use((request, response, next) => {
            const pathname = new URL(
              request.url ?? '/',
              'http://localhost',
            ).pathname
            const review = VIRTUAL_CHURCH_CHARACTER_REVIEW_ROUTES[
              pathname as keyof typeof VIRTUAL_CHURCH_CHARACTER_REVIEW_ROUTES
            ]
            if (!review) {
              next()
              return
            }
            const characterReviewFile = characterReviewFiles[review]

            if (request.method !== 'GET' && request.method !== 'HEAD') {
              response.statusCode = 405
              response.setHeader('Allow', 'GET, HEAD')
              response.end()
              return
            }

            if (!existsSync(characterReviewFile)) {
              response.statusCode = 404
              response.setHeader('Cache-Control', 'no-store, max-age=0')
              response.end(`Local ${review} review asset is not available.`)
              return
            }

            const fileStats = statSync(characterReviewFile)
            response.statusCode = 200
            response.setHeader(
              'Content-Type',
              review.endsWith('-picker') ? 'image/webp' : 'model/gltf-binary',
            )
            response.setHeader('Content-Length', fileStats.size)
            response.setHeader('Cache-Control', 'no-store, max-age=0')
            response.setHeader('X-Alife-Review-Asset', review)
            if (injectMotionFault(request.method, review, response, fileStats.size, () => readFileSync(characterReviewFile))) return
            if (request.method === 'HEAD') {
              response.end()
              return
            }
            createReadStream(characterReviewFile).pipe(response)
          })
        },
      },
      {
        name: 'alife-dev-no-store',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (new URL(request.url ?? '/', 'http://localhost').pathname === '/sw.js') {
              if (request.method !== 'GET' && request.method !== 'HEAD') {
                response.statusCode = 405
                response.setHeader('Allow', 'GET, HEAD')
                response.end()
                return
              }
              response.statusCode = 200
              response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
              response.setHeader('Cache-Control', 'no-store, max-age=0')
              response.setHeader('Service-Worker-Allowed', '/')
              response.setHeader('Content-Length', Buffer.byteLength(DEV_SERVICE_WORKER_RETIREMENT_SCRIPT))
              response.end(request.method === 'HEAD' ? undefined : DEV_SERVICE_WORKER_RETIREMENT_SCRIPT)
              return
            }
            if (!request.url?.startsWith('/api/') && !request.url?.startsWith('/images/')) {
              const setHeader = response.setHeader.bind(response)
              response.setHeader = ((name, value) =>
                setHeader(
                  name,
                  name.toLowerCase() === 'cache-control' ? 'no-store, max-age=0' : value,
                )) as typeof response.setHeader
              response.setHeader('Cache-Control', 'no-store, max-age=0')
              response.setHeader('Pragma', 'no-cache')
              response.setHeader('Expires', '0')
            }
            next()
          })
          // Vite's public middleware serves files, not directory indexes. Match
          // the Workers Static Assets URL without entering the React SPA.
          server.middlewares.use((request, response, next) => {
            const url = new URL(request.url ?? '/', 'http://localhost')
            if (url.pathname === '/project') {
              response.statusCode = 308
              response.setHeader('Location', `/project/${url.search}`)
              response.end()
              return
            }
            if (url.pathname === '/project/') {
              request.url = `/project/index.html${url.search}`
            }
            next()
          })
        },
      },
      react(), VitePWA({
      filename: 'sw.js',
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Keep the public application shell available for an offline SPA
        // navigation. Protected API responses remain network-only and are
        // explicitly denied below; this fallback never persists auth data.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/images\//,
          /^\/assets\//,
          /^\/virtual-church-assets\//,
        ],
        skipWaiting: true,
        importScripts: ['/virtual-church-cache-maintenance.js'],
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico,webp,woff2}'],
        // Historical article covers are numerous and load lazily. Keep them out
        // of the install-time precache and let the image runtime cache retain
        // only the covers a visitor actually views.
        globIgnores: [
          'article-covers/generated/**',
          'project/**',
          '**/virtual-church-cache-maintenance.js',
          // These immutable hashed chunks stay on-demand. Their dedicated
          // CacheFirst route retains them only after the first church visit.
          '**/assets/vendor-3d-*.js',
          '**/assets/VirtualChurch*.js',
          '**/assets/VirtualChurchView-*.css',
          '**/assets/virtualChurch*.css',
          '**/assets/virtualChurch*.js',
          '**/assets/vendor-postprocessing-*.js',
          // Three.js exposes bundled decoder URLs even when this app supplies
          // the runtime decoder path; keep those fallback copies out of precache.
          '**/assets/draco_*',
          '**/virtual-church-assets/**',
        ],
        runtimeCaching: [
          {
            // Bulletin PDF navigations must never enter the document/offline cache.
            urlPattern: ({ url }) => /^\/(?:images\/)?api\/(?:church-life\/bulletins(?:\/|$)|private-files\/private\/sunday-bulletins\/)/.test(url.pathname),
            handler: 'NetworkOnly',
          },
          {
            // The route and Three.js chunks are content-hashed. Keep the first
            // visit on-demand, then avoid a network-first round trip when the
            // member returns to the Virtual Church.
            urlPattern: virtualChurchCodeChunkMatches,
            handler: 'CacheFirst',
            options: {
              cacheName: VIRTUAL_CHURCH_CODE_CACHE_NAME,
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
              },
              cacheableResponse: {
                statuses: [200],
              },
              plugins: [{
                // A stale edge fallback can return the SPA shell with status
                // 200 at a hashed JS URL. Never retain it as executable code.
                cacheWillUpdate: async ({ response }) =>
                  /^(?:application|text)\/(?:javascript|ecmascript)\b/i.test(response.headers.get('content-type') ?? '')
                    ? response
                    : null,
              }],
            },
          },
          {
            // The hero MP4 is served as a full response by Workers Static Assets.
            // Cache that response once and synthesize byte-range responses for
            // reliable repeat playback, including after auth-state navigation.
            urlPattern: virtualChurchPublicVideoRequestMatches,
            handler: 'CacheFirst',
            options: {
              cacheName: 'alife-video-cache',
              rangeRequests: true,
              expiration: {
                maxEntries: 6,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            // The isolated 3D prototype is downloaded and cached only after a user opens it.
            urlPattern: virtualChurchAssetRequestMatches,
            handler: 'CacheFirst',
            options: {
              cacheName: VIRTUAL_CHURCH_CACHE_NAME,
              expiration: {
                // Keep the complete on-demand scene set, shared PBR atlas, and
                // Draco decoder available together on repeat visits. The
                // current public set has 46 files, so retain deliberate room
                // for both character LODs and the next reviewed Gate A asset.
                maxEntries: 64,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
              },
              cacheableResponse: {
                statuses: [200],
              },
              plugins: [{
                // The old public host returned 200 text/html for a missing GLB.
                // Do not let CacheFirst pin that shell at a model URL.
                cacheWillUpdate: async ({ response }) =>
                  /^text\/html\b/i.test(response.headers.get('content-type') ?? '')
                    ? null
                    : response,
              }],
            },
          },
          {
            // Never allow a direct navigation to a protected API endpoint to
            // enter CacheStorage as an application document.
            urlPattern: virtualChurchAppShellRequestMatches,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'alife-app-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: ONE_WEEK_IN_SECONDS,
              },
              plugins: [{
                cacheWillUpdate: async ({ request, response }) => {
                  if (response.status !== 200) return null
                  const pathname = new URL(request.url).pathname
                  const contentType = response.headers.get('content-type') ?? ''
                  if (/\.js$/i.test(pathname) || request.destination === 'script') {
                    return /^(?:application|text)\/(?:javascript|ecmascript)\b/i.test(contentType) ? response : null
                  }
                  if (/\.css$/i.test(pathname) || request.destination === 'style') {
                    return /^text\/css\b/i.test(contentType) ? response : null
                  }
                  return (request.mode === 'navigate' || request.destination === 'document')
                    && /^text\/html\b/i.test(contentType) ? response : null
                },
              }],
            },
          },
          {
            // Cover images and thumbnails - StaleWhileRevalidate for instant secondary loads
            // Serve cached instantly, update in background
            urlPattern: virtualChurchPublicImageOrFontRequestMatches,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'alife-image-cache',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              // Warm cache: pre-cache images on first load
              backgroundSync: {
                name: 'image-sync',
              },
            },
          },
          {
            // External images (from Cloudflare Image Service) - StaleWhileRevalidate
            urlPattern: ({ url }) =>
              url.origin !== self.location.origin &&
              (url.pathname.match(/\/images\//) || url.pathname.match(/\/covers\//)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'alife-external-image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Only public static paths enter the final shared cache. API,
            // member images and unknown same-origin downloads remain network-only.
            urlPattern: virtualChurchPublicRuntimeRequestMatches,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'alife-runtime-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: ONE_WEEK_IN_SECONDS,
              },
            },
          },
        ],
      },
      }),
    ],
    server: {
      // Local mobile Passkey testing uses one explicitly selected HTTPS tunnel
      // host. Never broadly allow every public tunnel host.
      allowedHosts: publicDevHost ? [publicDevHost] : undefined,
      // A port change creates a different browser origin. Silently falling back
      // from 5173 to 5174 can leave the old origin's PWA shell visible while its
      // lazy route chunks are no longer reachable, which looks like an app
      // failure. Fail clearly so the local-dev launcher can keep one stable URL.
      strictPort: true,
      proxy: {
        '/api/events/form-assistance': { target: aiProxyTarget, changeOrigin: true },
        '/api/events/ram-guidance': { target: aiProxyTarget, changeOrigin: true },
        '/api/ai': {
          target: aiProxyTarget,
          changeOrigin: true,
        },
        '/api/events/details-session': {
          target: aiProxyTarget,
          changeOrigin: true,
        },
        '/api/enrollments/session': {
          target: aiProxyTarget,
          changeOrigin: true,
        },
        '/api/reviews/session': {
          target: aiProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/images': {
          target: imagesProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/images/, '') || '/',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }
            if (id.includes('/node_modules/tinymce/tinymce')) {
              return 'vendor-tinymce-core'
            }
            if (id.includes('/node_modules/tinymce/themes/')) {
              return 'vendor-tinymce-theme'
            }
            if (
              id.includes('/node_modules/tinymce/icons/') ||
              id.includes('/node_modules/tinymce/models/')
            ) {
              return 'vendor-tinymce-ui'
            }
            if (id.includes('/node_modules/tinymce/plugins/')) {
              return 'vendor-tinymce-plugins'
            }
            if (
              id.includes('/node_modules/@react-three/postprocessing/') ||
              id.includes('/node_modules/postprocessing/')
            ) {
              return 'vendor-postprocessing'
            }
            if (
              id.includes('/node_modules/three/') ||
              id.includes('/node_modules/@react-three/')
            ) {
              return 'vendor-3d'
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')
            ) {
              return 'vendor-react'
            }
            if (id.includes('/node_modules/@tanstack/')) {
              return 'vendor-tanstack'
            }
            if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/lucide-react/')) {
              return 'vendor-ui'
            }
            if (
              id.includes('/node_modules/react-markdown/') ||
              id.includes('/node_modules/remark-') ||
              id.includes('/node_modules/react-easy-crop/')
            ) {
              return 'vendor-content'
            }
            return undefined
          },
        },
      },
    },
  };
})
