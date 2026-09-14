import { useEffect, useState, type FocusEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react'
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

const AUTO_INTERVAL = 6200

const EventPageStage = ({
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
  const activeItem = items[activeIndex]

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
  const imageUrl = activeItem.imageUrl?.trim() || reviewedPageFallbackImages[activeIndex % reviewedPageFallbackImages.length]
  const previousLabel = language === 'zh' ? `上一项${ariaLabel}` : `Previous ${ariaLabel}`
  const nextLabel = language === 'zh' ? `下一项${ariaLabel}` : `Next ${ariaLabel}`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`alife-event-stage ${compact ? 'alife-event-stage--compact' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={releaseFocusPause}
    >
      <div className="alife-event-stage__frame" aria-live="off">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeItem.id}
            custom={direction}
            initial={prefersReducedMotion ? false : { opacity: 0, x: direction > 0 ? 44 : -44 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -34 : 34 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="alife-event-stage__slide"
          >
            <div className="alife-event-stage__media">
              <img src={imageUrl} alt={activeItem.title} loading="lazy" />
              <span aria-hidden="true" />
            </div>
            <div className="alife-event-stage__copy">
              <span className="alife-event-stage__eyebrow">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {activeItem.badge}
              </span>
              <h3>{activeItem.title}</h3>
              {activeItem.description ? <p>{activeItem.description}</p> : null}
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
          </motion.div>
        </AnimatePresence>
      </div>

      {items.length > 1 ? (
        <div className="alife-event-stage__navigation">
          <div className="alife-event-stage__steps" aria-label={ariaLabel}>
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
          <div className="alife-event-stage__arrows">
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

export default EventPageStage
