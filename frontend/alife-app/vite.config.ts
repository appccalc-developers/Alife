import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60
declare const self: { location: { origin: string } }

export default defineConfig(() => {

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
            urlPattern: ({ url }) => url.origin === self.location.origin,
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
      // proxy: {
      //   '/api': {
      //     target: proxyTarget,
      //     changeOrigin: true,
      //   },
      // },
    },
  };
})