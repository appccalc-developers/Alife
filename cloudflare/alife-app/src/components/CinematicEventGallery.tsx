import { useEffect, useState, type FocusEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { FeaturedCarouselItem } from './FeaturedCarousel'
import { reviewedPageFallbackImages } from './FloatingCardLoop'

type Props = {
  items: FeaturedCarouselItem[]
  ariaLabel: string
  actionLabel: string
  language: string
  compact?: boolean
  linksDisabled?: boolean
  onActiveItemChange?: (item: FeaturedCarouselItem) => void
}

const AUTO_INTERVAL = 6800

const CinematicEventGallery = ({
  items,
  ariaLabel,
  actionLabel,
  language,
  compact = false,
  linksDisabled = false,
  onActiveItemChange,
}: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [paused, setPaused] = useState(false)
  const activeItem = items[activeIndex] ?? items[0]
  const autoplay = items.length > 1 && !prefersReducedMotion && !linksDisabled

  useEffect(() => {
    if (activeIndex < items.length) return
    setActiveIndex(0)
  }, [activeIndex, items.length])

  useEffect(() => {
    if (activeItem) onActiveItemChange?.(activeItem)
  }, [activeItem, onActiveItemChange])

  useEffect(() => {
    if (!autoplay || paused) return undefined
    const timer = window.setInterval(() => {
      setDirection(1)
      setActiveIndex((current) => (current + 1) % items.length)
    }, AUTO_INTERVAL)
    return () => window.clearInterval(timer)
  }, [autoplay, items.length, paused])

  if (!activeItem) return null

  const goTo = (nextIndex: number) => {
    setDirection(nextIndex >= activeIndex ? 1 : -1)
    setActiveIndex(((nextIndex % items.length) + items.length) % items.length)
  }
  const preventEditorNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (linksDisabled) event.preventDefault()
  }
  const releaseFocusPause = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
  }
  const imageUrl = activeItem.imageUrl?.trim() || reviewedPageFallbackImages[activeIndex % reviewedPageFallbackImages.length]
  const previousLabel = language === 'zh' ? `上一项${ariaLabel}` : `Previous ${ariaLabel}`
  const nextLabel = language === 'zh' ? `下一项${ariaLabel}` : `Next ${ariaLabel}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`alife-cinematic-events ${compact ? 'alife-cinematic-events--compact' : ''}`}
      data-paused={paused || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={releaseFocusPause}
    >
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.article
          key={activeItem.id}
          custom={direction}
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.035, x: direction > 0 ? 24 : -24 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015, x: direction > 0 ? -18 : 18 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="alife-cinematic-events__scene"
        >
          <img
            src={imageUrl}
            alt={activeItem.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = reviewedPageFallbackImages[activeIndex % reviewedPageFallbackImages.length]
            }}
          />
          <span className="alife-cinematic-events__wash" aria-hidden="true" />
          <div className="alife-cinematic-events__copy">
            <p className="alife-cinematic-events__meta">
              <span>{activeItem.badge}</span>
              <span>{String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
            </p>
            <h3>{activeItem.title}</h3>
            {activeItem.description ? <p className="alife-cinematic-events__description">{activeItem.description}</p> : null}
            <Link
              to={activeItem.to}
              aria-disabled={linksDisabled || undefined}
              onClick={(event) => {
                preventEditorNavigation(event)
                if (!linksDisabled) activeItem.onActivate?.()
              }}
            >
              {actionLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </motion.article>
      </AnimatePresence>

      {items.length > 1 ? (
        <div className="alife-cinematic-events__rail">
          <div className="alife-cinematic-events__rail-heading">
            <span>{language === 'zh' ? '正在发生' : 'Now showing'}</span>
            <strong>{String(activeIndex + 1).padStart(2, '0')}</strong>
          </div>
          <div className="alife-cinematic-events__nav" aria-label={ariaLabel}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => goTo(index)}
              >
                <span aria-hidden="true" />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
          <div className="alife-cinematic-events__controls">
            <button type="button" aria-label={previousLabel} onClick={() => goTo(activeIndex - 1)}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label={nextLabel} onClick={() => goTo(activeIndex + 1)}>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {autoplay ? (
        <span key={activeItem.id} className="alife-cinematic-events__progress" aria-hidden="true" />
      ) : null}
    </div>
  )
}

export default CinematicEventGallery
