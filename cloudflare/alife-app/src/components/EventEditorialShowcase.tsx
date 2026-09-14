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

const AUTO_INTERVAL = 7200

const EventEditorialShowcase = ({
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

  useEffect(() => {
    if (activeIndex < items.length) return
    setActiveIndex(0)
  }, [activeIndex, items.length])

  useEffect(() => {
    if (activeItem) onActiveItemChange?.(activeItem)
  }, [activeItem, onActiveItemChange])

  useEffect(() => {
    if (items.length <= 1 || prefersReducedMotion || linksDisabled || paused) return undefined
    const timer = window.setInterval(() => {
      setDirection(1)
      setActiveIndex((current) => (current + 1) % items.length)
    }, AUTO_INTERVAL)
    return () => window.clearInterval(timer)
  }, [items.length, linksDisabled, paused, prefersReducedMotion])

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
  const fallbackImage = reviewedPageFallbackImages[activeIndex % reviewedPageFallbackImages.length]
  const imageUrl = activeItem.imageUrl?.trim() || fallbackImage
  const previousLabel = language === 'zh' ? `上一项${ariaLabel}` : `Previous ${ariaLabel}`
  const nextLabel = language === 'zh' ? `下一项${ariaLabel}` : `Next ${ariaLabel}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`alife-event-editorial ${compact ? 'alife-event-editorial--compact' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={releaseFocusPause}
    >
      <div className="alife-event-editorial__canvas">
        <span className="alife-event-editorial__wordmark" aria-hidden="true">GATHER</span>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.article
            key={activeItem.id}
            custom={direction}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="alife-event-editorial__scene"
          >
            <figure className="alife-event-editorial__figure">
              <img
                src={imageUrl}
                alt={activeItem.title}
                loading="lazy"
                onError={(event) => {
                  if (event.currentTarget.src !== new URL(fallbackImage, window.location.href).href) {
                    event.currentTarget.src = fallbackImage
                  }
                }}
              />
              <span aria-hidden="true" />
            </figure>

            <div className="alife-event-editorial__copy">
              <p className="alife-event-editorial__meta">
                <span>{language === 'zh' ? '本期活动' : 'Featured gathering'}</span>
                <span>{String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span>
              </p>
              <h3>{activeItem.title}</h3>
              {activeItem.description ? <p className="alife-event-editorial__description">{activeItem.description}</p> : null}
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
      </div>

      {items.length > 1 ? (
        <div className="alife-event-editorial__footer">
          <div className="alife-event-editorial__index" aria-label={ariaLabel}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => goTo(index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
          <div className="alife-event-editorial__arrows">
            <button type="button" aria-label={previousLabel} onClick={() => goTo(activeIndex - 1)}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label={nextLabel} onClick={() => goTo(activeIndex + 1)}>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EventEditorialShowcase
