import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export type FeaturedCarouselItem = {
  id: string
  title: string
  description?: string
  imageUrl?: string | null
  to: string
  badge?: string
  onActivate?: () => void
}

type FeaturedCarouselProps = {
  items: FeaturedCarouselItem[]
  ariaLabel: string
  previousLabel: string
  nextLabel: string
  compact?: boolean
  onActiveItemChange?: (item: FeaturedCarouselItem) => void
}

const AUTO_INTERVAL = 5600
const fallbackImages = [
  '/media/alife-groups.jpg',
  '/media/alife-visit.jpg',
  '/media/alife-church-community-hero.jpg',
  '/media/alife-message-poster.jpg',
]

const FeaturedCarousel = ({
  items,
  ariaLabel,
  previousLabel,
  nextLabel,
  compact = false,
  onActiveItemChange,
}: FeaturedCarouselProps) => {
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const activeItem = items[activeIndex]

  const imageUrl = useCallback((item: FeaturedCarouselItem, index: number) =>
    item.imageUrl?.trim() || fallbackImages[index % fallbackImages.length],
  [])

  const goTo = useCallback((nextIndex: number) => {
    if (items.length === 0) return
    setDirection(nextIndex >= activeIndex ? 1 : -1)
    setActiveIndex(((nextIndex % items.length) + items.length) % items.length)
  }, [activeIndex, items.length])

  useEffect(() => {
    if (activeIndex < items.length) return
    setActiveIndex(0)
  }, [activeIndex, items.length])

  useEffect(() => {
    if (activeItem) onActiveItemChange?.(activeItem)
  }, [activeItem, onActiveItemChange])

  useEffect(() => {
    if (items.length <= 1 || prefersReducedMotion) return undefined
    const timer = window.setInterval(() => {
      setDirection(1)
      setActiveIndex((current) => (current + 1) % items.length)
    }, AUTO_INTERVAL)
    return () => window.clearInterval(timer)
  }, [items.length, prefersReducedMotion])

  if (!activeItem) return null

  const stageHeight = compact ? 'min-h-[20rem]' : 'min-h-[31rem]'
  const contentPadding = compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8 lg:p-10'
  const titleSize = compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-5xl'
  const controlSize = compact ? 'h-9 w-9' : 'h-11 w-11'
  const thumbnailHeight = compact ? 'h-12' : 'h-16'
  const thumbnailMinHeight = compact ? 'min-h-24' : 'min-h-28'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className="overflow-hidden rounded-2xl bg-home-dark text-white shadow-[0_28px_80px_rgba(34,25,17,0.18)]"
    >
      <div className={`relative ${stageHeight}`}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeItem.id}
            custom={direction}
            initial={prefersReducedMotion ? false : { opacity: 0, x: direction > 0 ? 80 : -80, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -60 : 60, scale: 0.99 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Link
              to={activeItem.to}
              onClick={() => activeItem.onActivate?.()}
              aria-label={`${activeIndex + 1} / ${items.length}: ${activeItem.title}`}
              className="group block h-full"
            >
              <img
                src={imageUrl(activeItem, activeIndex)}
                alt={activeItem.title}
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-90"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,21,16,0.92)_0%,rgba(24,21,16,0.62)_42%,rgba(24,21,16,0.12)_100%)]" />
              <div className={`absolute inset-0 flex items-end ${contentPadding}`}>
                <div className="max-w-2xl">
                  {activeItem.badge ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                      <Sparkles className="h-3.5 w-3.5" />
                      {activeItem.badge}
                    </span>
                  ) : null}
                  <h3 className={`${activeItem.badge ? 'mt-4' : ''} font-bold leading-tight ${titleSize}`}>{activeItem.title}</h3>
                  {activeItem.description ? (
                    <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-7 text-white/66">{activeItem.description}</p>
                  ) : null}
                </div>
              </div>
            </Link>
          </motion.div>
        </AnimatePresence>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              aria-label={previousLabel}
              onClick={() => goTo(activeIndex - 1)}
              className={`absolute left-4 top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/25 text-white/75 backdrop-blur transition hover:bg-black/45 hover:text-white ${controlSize}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={nextLabel}
              onClick={() => goTo(activeIndex + 1)}
              className={`absolute right-4 top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/25 text-white/75 backdrop-blur transition hover:bg-black/45 hover:text-white ${controlSize}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-white/[0.04] p-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item, index) => {
            const selected = index === activeIndex
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.title}
                aria-current={selected ? 'true' : undefined}
                onClick={() => goTo(index)}
                className={`group overflow-hidden rounded-xl border p-2 text-left transition ${thumbnailMinHeight} ${selected ? 'border-home-gold/70 bg-white/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}
              >
                <div className={`overflow-hidden rounded-lg bg-white/10 ${thumbnailHeight}`}>
                  <img src={imageUrl(item, index)} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.04]" loading="lazy" />
                </div>
                <p className="mt-2 line-clamp-1 text-xs font-semibold text-white">{item.title}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/12">
                  <span className={`block h-full rounded-full bg-home-gold transition-all duration-500 ${selected ? 'w-full' : 'w-0'}`} />
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default FeaturedCarousel
