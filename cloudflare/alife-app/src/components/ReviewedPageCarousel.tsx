import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import CinematicEventGallery from './CinematicEventGallery'
import EditorialPageIndex from './EditorialPageIndex'
import EventEditorialShowcase from './EventEditorialShowcase'
import EventPageStage from './EventPageStage'
import FloatingCardLoop from './FloatingCardLoop'
import { localizeText } from '../utils/localizedText'
import {
  getPublicReviewedPages,
  publicPageHomePath,
  publicPageMenuName,
  sortPublicReviewedPages,
} from '../utils/publicPageMenus'
import type { PageSummaryDto } from '../types'
import type { ReviewedPagePresentation } from '../utils/reviewedPagePresentation'
import { EditableText } from './page-sections/sectionUtils'

const entranceAnimation = (prefersReducedMotion: boolean | null) =>
  prefersReducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-80px' },
      transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }

type Props = {
  language: string
  pages: PageSummaryDto[]
  sectionId: string
  eyebrow: string
  title: string
  body: string
  action: string
  emptyState: string
  badge: string
  compact?: boolean
  presentation?: ReviewedPagePresentation
  ordered?: boolean
  showAll?: boolean
  shellClassName?: string
  interactionDisabled?: boolean
  onTitleChange?: (value: string) => void
  onBodyChange?: (value: string) => void
}

const ReviewedPageCarousel = ({
  language,
  pages,
  sectionId,
  eyebrow,
  title,
  body,
  action,
  emptyState,
  badge,
  compact = false,
  presentation = 'floatingLoop',
  ordered = false,
  showAll = false,
  shellClassName,
  interactionDisabled = false,
  onTitleChange,
  onBodyChange,
}: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const orderedPages = ordered ? getPublicReviewedPages(pages) : sortPublicReviewedPages(pages, language)
  const cards = showAll ? orderedPages : orderedPages.slice(0, 6)
  const carouselItems = cards.map((page) => ({
    id: page.id,
    title: publicPageMenuName(page, language),
    description: localizeText(page.cardText, language) || localizeText(page.description, language) || body,
    imageUrl: page.cardImageUrl,
    to: publicPageHomePath(page, language),
    badge,
  }))
  const [activeItemId, setActiveItemId] = useState(carouselItems[0]?.id ?? '')
  useEffect(() => {
    if (!carouselItems.some((item) => item.id === activeItemId)) {
      setActiveItemId(carouselItems[0]?.id ?? '')
    }
  }, [activeItemId, carouselItems])
  const activePath = carouselItems.find((item) => item.id === activeItemId)?.to ?? carouselItems[0]?.to ?? ''
  const updateActiveItem = useCallback((item: { id: string }) => setActiveItemId(item.id), [])
  const preventEditorNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (interactionDisabled) event.preventDefault()
  }
  const shellClass = shellClassName || (compact
    ? 'px-4 py-8 sm:px-5 lg:py-10'
    : 'px-5 py-20 sm:px-8 lg:px-10 lg:py-28')
  const carouselMargin = compact ? 'mt-6' : 'mt-10'
  const showcaseProps = {
    items: carouselItems,
    ariaLabel: eyebrow,
    actionLabel: action,
    compact,
    linksDisabled: interactionDisabled,
    onActiveItemChange: updateActiveItem,
  }

  const heading = (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{eyebrow}</p>
      <EditableText
        as="h2"
        value={title}
        fallback=""
        className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
        onChange={onTitleChange}
      />
      <EditableText
        as="p"
        multiline
        value={body}
        fallback=""
        className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted"
        onChange={onBodyChange}
      />
    </div>
  )

  if (carouselItems.length === 0) {
    return (
      <section id={sectionId} className={`${shellClass} alife-reviewed-showcase ${compact ? 'alife-reviewed-showcase--compact' : ''}`}>
        <div className="mx-auto max-w-6xl">
          <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            {heading}
          </motion.div>
          <motion.div {...entrance} className={`${carouselMargin} rounded-2xl border border-home-border/60 bg-white/70 p-8`}>
            <Sparkles className="h-7 w-7 text-home-green" />
            <p className="mt-4 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">
              {emptyState}
            </p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section id={sectionId} className={`${shellClass} alife-reviewed-showcase ${compact ? 'alife-reviewed-showcase--compact' : ''}`}>
      <div className="alife-reviewed-showcase__header mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {heading}
          <Link
            to={activePath}
            aria-disabled={interactionDisabled || undefined}
            onClick={preventEditorNavigation}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover"
          >
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>

      <motion.div {...entrance} className={carouselMargin}>
        <div className="alife-reviewed-showcase__stage">
          {presentation === 'editorialEvents' ? (
            <EventEditorialShowcase {...showcaseProps} language={language} />
          ) : presentation === 'cinematicEvents' ? (
            <CinematicEventGallery {...showcaseProps} language={language} />
          ) : presentation === 'eventStage' ? (
            <EventPageStage {...showcaseProps} language={language} />
          ) : presentation === 'editorialIndex' ? (
            <EditorialPageIndex {...showcaseProps} />
          ) : (
            <FloatingCardLoop {...showcaseProps} />
          )}
        </div>
      </motion.div>
    </section>
  )
}

export default ReviewedPageCarousel
