import { registerSW } from 'virtual:pwa-register'
import { createServiceWorkerControllerChangeHandler, prepareDevelopmentServiceWorker } from './serviceWorkerControllerChange'

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
export function registerServiceWorker(): boolean | Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return true
  }

  if (import.meta.env.DEV) {
    return prepareDevelopmentServiceWorker({
      wasControlled: Boolean(navigator.serviceWorker.controller),
      cleanup: async () => {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      },
      // Read storage inside the guarded preparation step: privacy-restricted
      // browsers may throw even when merely accessing sessionStorage.
      storage: {
        getItem: key => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem: key => sessionStorage.removeItem(key),
      },
      reload: () => window.location.reload(),
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.warn('Failed to clear development service worker cache:', err)
      },
    })
  }

  registerSW({
    onRegisterError(err: unknown) {
      // eslint-disable-next-line no-console
      console.warn('Service worker registration failed:', err)
    },
  })

  // A first install may claim this page. Reload only when an existing
  // controller is replaced, so an in-progress 3D visit is not interrupted.
  const handleControllerChange = createServiceWorkerControllerChangeHandler(
    navigator.serviceWorker.controller,
    () => window.location.reload(),
  )
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    handleControllerChange(navigator.serviceWorker.controller)
  })
  return true
}
