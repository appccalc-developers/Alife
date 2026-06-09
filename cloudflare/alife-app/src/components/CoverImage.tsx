import React, { useState, useCallback, useRef, useEffect } from 'react'

interface CoverImageProps {
  src: string
  alt: string
  /** 'high' for first 2 items, 'low' for rest */
  fetchPriority?: 'high' | 'low'
  /** Used to determine loading priority */
  index?: number
  /** Aspect ratio (width/height) to prevent CLS */
  aspectRatio?: number
  /** Additional CSS classes */
  className?: string
  /** Fixed height mode (no aspect ratio padding) */
  fixedHeight?: boolean
  /** Callback when image loads */
  onLoad?: () => void
  /** Container style overrides */
  style?: React.CSSProperties
  /** Navigate to the image URL on double click or long press. */
  openOnLongPressOrDoubleClick?: boolean
  /** Optional URL to navigate to when opening differs from `src`. */
  navigationUrl?: string
}

const LONG_PRESS_MS = 650
const LONG_PRESS_MOVE_TOLERANCE_PX = 8

/**
 * Optimized CoverImage component:
 * - Uses fetchpriority="high" for first 2 images
 * - Applies loading="lazy" for non-priority images
 * - Uses decoding="async" to avoid blocking main thread
 * - Maintains aspect ratio containers to prevent CLS
 * - Fade-in animation on load
 * - Intersection Observer based lazy loading for non-priority images
 */
const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt,
  fetchPriority = 'low',
  index = 0,
  aspectRatio = 16 / 9,
  className = '',
  fixedHeight = false,
  onLoad,
  style,
  openOnLongPressOrDoubleClick = false,
  navigationUrl,
}) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const [shouldLoad, setShouldLoad] = useState(fetchPriority === 'high')
  const imageNavigationUrl = openOnLongPressOrDoubleClick ? (navigationUrl || src) : ''

  // Determine priority: first 2 images get 'high'
  const effectivePriority = index < 2 ? 'high' : fetchPriority
  const isHighPriority = effectivePriority === 'high'

  // Set up IntersectionObserver for lazy loading non-priority images
  useEffect(() => {
    if (isHighPriority) {
      setShouldLoad(true)
      return
    }

    const container = containerRef.current
    if (!container) return

    // Use IntersectionObserver to lazy load
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true)
          observerRef.current?.disconnect()
        }
      },
      {
        rootMargin: '200px 0px', // Start loading 200px before entering viewport
        threshold: 0.01,
      }
    )

    observerRef.current.observe(container)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [isHighPriority])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setError(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setError(true)
    setLoaded(true) // Mark as loaded so placeholder disappears
  }, [])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const openImageUrl = useCallback(() => {
    if (!imageNavigationUrl) {
      return
    }

    window.location.assign(imageNavigationUrl)
  }, [imageNavigationUrl])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageNavigationUrl) {
      return
    }

    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      openImageUrl()
    }, LONG_PRESS_MS)
  }, [clearLongPressTimer, imageNavigationUrl, openImageUrl])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) {
      return
    }

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x)
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y)
    if (deltaX > LONG_PRESS_MOVE_TOLERANCE_PX || deltaY > LONG_PRESS_MOVE_TOLERANCE_PX) {
      clearLongPressTimer()
    }
  }, [clearLongPressTimer])

  useEffect(() => clearLongPressTimer, [clearLongPressTimer])

  // Calculate container padding for aspect ratio
  const paddingBottom = fixedHeight ? undefined : `${(1 / aspectRatio) * 100}%`
  const minHeight = fixedHeight ? undefined : '48px'

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-100 ${imageNavigationUrl ? 'cursor-zoom-in' : ''} ${className}`}
      style={{
        minHeight,
        paddingBottom,
        ...style,
      }}
      role="img"
      aria-label={alt}
      title={imageNavigationUrl || undefined}
      onDoubleClick={imageNavigationUrl ? openImageUrl : undefined}
      onPointerDown={imageNavigationUrl ? handlePointerDown : undefined}
      onPointerMove={imageNavigationUrl ? handlePointerMove : undefined}
      onPointerUp={imageNavigationUrl ? clearLongPressTimer : undefined}
      onPointerCancel={imageNavigationUrl ? clearLongPressTimer : undefined}
      onPointerLeave={imageNavigationUrl ? clearLongPressTimer : undefined}
      onContextMenu={imageNavigationUrl ? (event) => event.preventDefault() : undefined}
    >
      {/* Image - only render when shouldLoad is true */}
      {shouldLoad && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={isHighPriority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={effectivePriority}
          onLoad={handleLoad}
          onError={handleError}
          draggable={false}
          className={`
            absolute inset-0 w-full h-full
            transition-opacity duration-300 ease-in-out
            ${loaded ? 'opacity-100' : 'opacity-0'}
            object-cover
          `}
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />
      )}

      {/* Loading placeholder - shimmer effect */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 animate-shimmer" />
      )}

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <svg
            className="w-8 h-8 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

export default React.memo(CoverImage)
