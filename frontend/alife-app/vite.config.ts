import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60
declare const self: { location: { origin: string } }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.API_PROXY_TARGET || 'https://api.ccalc.live').replace(/\/$/, '')

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
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'image' || request.destination === 'font'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'alife-asset-cache',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: THIRTY_DAYS_IN_SECONDS,
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
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
})