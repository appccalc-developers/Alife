import { useMemo, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import type { FeaturedCarouselItem } from './FeaturedCarousel'

type Props = {
  items: FeaturedCarouselItem[]
  ariaLabel: string
  actionLabel: string
  compact?: boolean
  linksDisabled?: boolean
  onActiveItemChange?: (item: FeaturedCarouselItem) => void
}

export const reviewedPageFallbackImages = [
  '/media/alife-groups.jpg',
  '/media/alife-visit.jpg',
  '/media/alife-church-community-hero.jpg',
  '/media/alife-message-poster.jpg',
]

const cardRhythm = [
  { offset: '-1.8rem', tilt: '-1.4deg', float: '0s' },
  { offset: '1.15rem', tilt: '1.15deg', float: '-1.3s' },
  { offset: '-0.4rem', tilt: '-0.7deg', float: '-2.7s' },
  { offset: '1.9rem', tilt: '1.45deg', float: '-3.8s' },
  { offset: '-1.1rem', tilt: '0.65deg', float: '-4.9s' },
]

const FloatingCardLoop = ({
  items,
  ariaLabel,
  actionLabel,
  compact = false,
  linksDisabled = false,
  onActiveItemChange,
}: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = items.length > 1 && !prefersReducedMotion && !linksDisabled
  const duration = Math.max(30, items.length * 3.2)
  const trackStyle = useMemo(
    () => ({ '--alife-loop-duration': `${duration}s` }) as CSSProperties,
    [duration],
  )

  const activate = (item: FeaturedCarouselItem) => onActiveItemChange?.(item)
  const preventEditorNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (linksDisabled) event.preventDefault()
  }
  const handleFocus = (event: FocusEvent<HTMLAnchorElement>, item: FeaturedCarouselItem) => {
    if (event.currentTarget === event.target) activate(item)
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      className={`alife-floating-loop ${compact ? 'alife-floating-loop--compact' : ''}`}
    >
      <div className="alife-floating-loop__glow" aria-hidden="true" />
      <div className="alife-floating-loop__viewport">
        <div
          className="alife-floating-loop__track"
          data-animated={shouldAnimate || undefined}
          style={trackStyle}
        >
          {(shouldAnimate ? [false, true] : [false]).map((duplicate) => (
            <div
              key={duplicate ? 'duplicate' : 'primary'}
              className="alife-floating-loop__set"
              aria-hidden={duplicate || undefined}
            >
              {items.map((item, index) => {
                const rhythm = cardRhythm[index % cardRhythm.length]
                const imageUrl = item.imageUrl?.trim() || reviewedPageFallbackImages[index % reviewedPageFallbackImages.length]
                const cardStyle = {
                  '--alife-card-offset': rhythm.offset,
                  '--alife-card-tilt': rhythm.tilt,
                  '--alife-card-float-delay': rhythm.float,
                } as CSSProperties

                return (
                  <article
                    key={`${duplicate ? 'duplicate' : 'primary'}-${item.id}`}
                    className="alife-floating-card__position"
                    style={cardStyle}
                  >
                    <Link
                      to={item.to}
                      tabIndex={duplicate ? -1 : undefined}
                      aria-disabled={linksDisabled || undefined}
                      onClick={(event) => {
                        preventEditorNavigation(event)
                        if (!linksDisabled) item.onActivate?.()
                      }}
                      onMouseEnter={() => activate(item)}
                      onFocus={(event) => handleFocus(event, item)}
                      className="alife-floating-card group"
                    >
                      <img
                        src={imageUrl}
                        alt={duplicate ? '' : item.title}
                        className="alife-floating-card__image"
                        loading={index < 2 && !duplicate ? 'eager' : 'lazy'}
                      />
                      <span className="alife-floating-card__shade" aria-hidden="true" />
                      <span className="alife-floating-card__content">
                        {item.badge ? <span className="alife-floating-card__badge">{item.badge}</span> : null}
                        <span className="alife-floating-card__title">{item.title}</span>
                        {item.description ? (
                          <span className="alife-floating-card__description">{item.description}</span>
                        ) : null}
                        <span className="alife-floating-card__action">
                          {actionLabel}
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </span>
                    </Link>
                  </article>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FloatingCardLoop
