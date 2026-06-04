import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60
declare const self: { location: { origin: string } }

export default defineConfig(() => {
  const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:7071'
  const imagesProxyTarget = process.env.IMAGES_PROXY_TARGET || 'https://images.ccalc.live'

  return {
    plugins: [react(), VitePWA({
      filename: 'sw.js',
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: null,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.mode === 'navigate' ||
                request.destination === 'document' ||
                request.destination === 'script' ||
                request.destination === 'style'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'alife-app-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: ONE_WEEK_IN_SECONDS,
              },
            },
          },
          {
            // Cover images and thumbnails - StaleWhileRevalidate for instant secondary loads
            // Serve cached instantly, update in background
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'image' || request.destination === 'font'),
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
            // API responses are managed by HTTP validators/IndexedDB and must not
            // be replayed from the PWA runtime cache after auth or permission changes.
            urlPattern: ({ url }) => url.origin === self.location.origin && !url.pathname.startsWith('/api/'),
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
    }), cloudflare()],
    server: {
      proxy: {
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
  };
})