import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { FeaturedCarouselItem } from './FeaturedCarousel'
import { reviewedPageFallbackImages } from './FloatingCardLoop'

type Props = {
  items: FeaturedCarouselItem[]
  ariaLabel: string
  actionLabel: string
  compact?: boolean
  linksDisabled?: boolean
  onActiveItemChange?: (item: FeaturedCarouselItem) => void
}

const EditorialPageIndex = ({
  items,
  ariaLabel,
  actionLabel,
  compact = false,
  linksDisabled = false,
  onActiveItemChange,
}: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const activeItem = items[activeIndex] ?? items[0]
  if (!activeItem) return null

  const activate = (item: FeaturedCarouselItem, index: number) => {
    setActiveIndex(index)
    onActiveItemChange?.(item)
  }
  const preventEditorNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (linksDisabled) event.preventDefault()
  }
  const imageUrl = activeItem.imageUrl?.trim() || reviewedPageFallbackImages[activeIndex % reviewedPageFallbackImages.length]

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`alife-editorial-index ${compact ? 'alife-editorial-index--compact' : ''}`}
    >
      <div className="alife-editorial-index__visual" aria-hidden="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.img
            key={activeItem.id}
            src={imageUrl}
            alt=""
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          />
        </AnimatePresence>
        <span>{String(activeIndex + 1).padStart(2, '0')}</span>
      </div>

      <ol className="alife-editorial-index__list">
        {items.map((item, index) => (
          <li key={item.id} data-active={index === activeIndex || undefined}>
            <Link
              to={item.to}
              aria-disabled={linksDisabled || undefined}
              onClick={(event) => {
                preventEditorNavigation(event)
                if (!linksDisabled) item.onActivate?.()
              }}
              onMouseEnter={() => activate(item, index)}
              onFocus={() => activate(item, index)}
            >
              <span className="alife-editorial-index__number">{String(index + 1).padStart(2, '0')}</span>
              <span className="alife-editorial-index__text">
                <strong>{item.title}</strong>
                {item.description ? <span>{item.description}</span> : null}
              </span>
              <span className="alife-editorial-index__action">
                <span>{actionLabel}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default EditorialPageIndex
