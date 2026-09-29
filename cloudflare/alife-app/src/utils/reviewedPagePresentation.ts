import type { PagePrimaryMenuHomePlacement } from '../types'

export const REVIEWED_PAGE_PRESENTATIONS = [
  'floatingLoop',
  'carousel',
  'editorialEvents',
  'cinematicEvents',
  'eventStage',
  'editorialIndex',
] as const

export type ReviewedPagePresentation = (typeof REVIEWED_PAGE_PRESENTATIONS)[number]

export type ReviewedPageContentWidth = 'contained' | 'full'

export const resolveReviewedPageContentWidth = (value: unknown): ReviewedPageContentWidth =>
  value === 'full' ? 'full' : 'contained'

export const isReviewedPagePresentation = (value: unknown): value is ReviewedPagePresentation =>
  typeof value === 'string' && REVIEWED_PAGE_PRESENTATIONS.includes(value as ReviewedPagePresentation)

export const resolveReviewedPagePresentation = (
  configuredValue: unknown,
  homePlacement?: PagePrimaryMenuHomePlacement | null,
): ReviewedPagePresentation => {
  if (isReviewedPagePresentation(configuredValue)) return configuredValue
  if (homePlacement === 'churchOrganization') return 'floatingLoop'
  if (homePlacement === 'recentEvents') return 'editorialEvents'
  return 'editorialIndex'
}
