import { useCallback, useRef, useEffect } from 'react'

/**
 * Maximum number of concurrent image preloads.
 * Prevents network congestion when many images are visible at once.
 */
const MAX_CONCURRENT_PRELOADS = 4

/**
 * Tracks in-flight preloads across all component instances.
 */
const pendingPreloads = new Map<string, Promise<void>>()
let activePreloadCount = 0
const preloadQueue: Array<{ src: string; resolve: () => void }> = []

/**
 * Process the next item in the preload queue if capacity allows.
 */
function processQueue() {
  while (activePreloadCount < MAX_CONCURRENT_PRELOADS && preloadQueue.length > 0) {
    const item = preloadQueue.shift()
    if (!item) break

    activePreloadCount++
    const { src, resolve } = item

    const img = new Image()
    img.decoding = 'async'

    img.onload = () => {
      activePreloadCount--
      pendingPreloads.delete(src)
      resolve()
      processQueue()
    }

    img.onerror = () => {
      activePreloadCount--
      pendingPreloads.delete(src)
      resolve() // Resolve anyway so callers don't hang
      processQueue()
    }

    img.src = src
  }
}

/**
 * Preload an image with concurrency control to avoid network congestion.
 * 
 * Benefits:
 * - Limits simultaneous image downloads (default 4)
 * - Prevents image loading from blocking critical API calls
 * - Uses async decoding to avoid main thread blocking
 */
async function preloadImage(src: string): Promise<void> {
  // Skip if already preloaded or in progress
  if (pendingPreloads.has(src)) {
    return pendingPreloads.get(src)
  }

  // Check if image is already in browser cache
  const cached = await isImageCached(src)
  if (cached) return

  return new Promise<void>((resolve) => {
    const promise = new Promise<void>((innerResolve) => {
      preloadQueue.push({
        src,
        resolve: () => {
          innerResolve()
          resolve()
        },
      })
    })

    pendingPreloads.set(src, promise)
    processQueue()
  })
}

/**
 * Check if an image is already cached by the browser/service worker.
 */
async function isImageCached(src: string): Promise<boolean> {
  try {
    // Service Worker CacheStorage check
    if ('caches' in window) {
      const cache = await caches.open('cover-images')
      const cachedResponse = await cache.match(src)
      if (cachedResponse) return true
    }

    // Check browser HTTP cache via HEAD request (lightweight)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(src, {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response.status === 304 || response.ok
  } catch {
    return false
  }
}

/**
 * Custom hook for preloading images with concurrency control.
 * 
 * Usage:
 * ```tsx
 * const { preloadImages, preloadedImages } = useImagePreloader()
 * 
 * // Preload first N images
 * useEffect(() => {
 *   preloadImages(sermons.slice(0, 4).map(s => s.thumbnailUrl))
 * }, [sermons])
 * ```
 */
export function useImagePreloader() {
  const preloadedRef = useRef<Set<string>>(new Set())

  const preloadImages = useCallback(async (urls: (string | undefined | null)[]) => {
    const validUrls = urls.filter((url): url is string => 
      typeof url === 'string' && url.length > 0 && !preloadedRef.current.has(url)
    )

    if (validUrls.length === 0) return

    // Mark as preloaded immediately to prevent duplicate work
    validUrls.forEach((url) => preloadedRef.current.add(url))

    // Preload with concurrency limit
    const promises = validUrls.map((url) => preloadImage(url))
    await Promise.all(promises)
  }, [])

  const isPreloaded = useCallback((url: string): boolean => {
    return preloadedRef.current.has(url)
  }, [])

  const clearPreloaded = useCallback(() => {
    preloadedRef.current.clear()
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearPreloaded()
    }
  }, [clearPreloaded])

  return {
    preloadImages,
    isPreloaded,
    clearPreloaded,
  }
}
