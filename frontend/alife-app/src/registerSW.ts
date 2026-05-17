import { registerSW } from 'virtual:pwa-register'

/**
 * Register the service worker for PWA support.
 *
 * On older iOS versions (< 11.3) the Service Worker API is not available.
 * This helper silently skips registration in that case so the app still
 * works as a normal website.
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
}
