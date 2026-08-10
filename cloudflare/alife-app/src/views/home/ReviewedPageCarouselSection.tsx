import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import FeaturedCarousel from '../../components/FeaturedCarousel'
import { localizeText } from '../../utils/localizedText'
import {
  entranceAnimation,
  publicPageHomePath,
  publicPageMenuName,
  sortPublicReviewedPages,
} from './homeUtils'
import type { Language } from './homeCopy'
import type { PageSummaryDto } from '../../types'

type Props = {
  language: Language
  pages: PageSummaryDto[]
  sectionId: string
  eyebrow: string
  title: string
  body: string
  action: string
  emptyState: string
  badge: string
}

const ReviewedPageCarouselSection = ({ language, pages, sectionId, eyebrow, title, body, action, emptyState, badge }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const cards = sortPublicReviewedPages(pages, language).slice(0, 6)
  const carouselItems = cards.map((page) => ({
    id: page.id,
    title: publicPageMenuName(page, language),
    description: localizeText(page.cardText, language) || localizeText(page.description, language) || body,
    imageUrl: page.cardImageUrl,
    to: publicPageHomePath(page, language),
    badge,
  }))
  const [activeItemId, setActiveItemId] = useState(carouselItems[0]?.id ?? '')
  const activePath = carouselItems.find((item) => item.id === activeItemId)?.to ?? carouselItems[0]?.to ?? ''
  const updateActiveItem = useCallback((item: { id: string }) => setActiveItemId(item.id), [])

  if (carouselItems.length === 0) {
    return (
      <section id={sectionId} className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
              <p className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted">{body}</p>
            </div>
          </motion.div>
          <motion.div {...entrance} className="mt-10 rounded-2xl border border-home-border/60 bg-white/70 p-8">
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
    <section id={sectionId} className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted">{body}</p>
          </div>
          <Link to={activePath} className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        <motion.div {...entrance} className="mt-10">
          <FeaturedCarousel
            items={carouselItems}
            ariaLabel={eyebrow}
            previousLabel={`Previous ${eyebrow}`}
            nextLabel={`Next ${eyebrow}`}
            onActiveItemChange={updateActiveItem}
          />
        </motion.div>
      </div>
    </section>
  )
}

export default ReviewedPageCarouselSection
