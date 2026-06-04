import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker for PWA support.
 *
 * On older iOS versions (< 11.3) the Service Worker API is not available.
 * This helper silently skips registration in that case so the app still
 * works as a normal website.
 *
 * After registration, the service worker intercepts cover image URLs
 * and stores them in CacheStorage using a Stale-While-Revalidate strategy.
 * This enables:
 * - Instant secondary loads (images appear immediately from cache)
 * - Offline support for previously viewed images
 * - Reduced network bandwidth (no repeated downloads)
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return
  }

  registerSW({
    onRegisterError(err: unknown) {
      // eslint-disable-next-line no-console
      console.warn('Service worker registration failed:', err)
    },
  })

  // Listen for controller change to notify app of updates
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    // A new service worker has taken over - optionally refresh to load new content
    window.location.reload()
  })
}
