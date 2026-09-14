import type { SectionEditModel } from '../../types/page-editor'
import type { SectionSpacing } from '../../types'

const spacingClasses: Record<SectionSpacing, string> = {
  compact: 'py-8 md:py-10',
  normal: 'py-12 md:py-20',
  large: 'py-16 md:py-28',
}

export const pageSectionShellClass = 'scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-28'
export const pageSectionsCanvasClass = 'w-full min-w-0'
export const pageSectionsChromeClass = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10'
export const pageSectionDividerClass = 'sr-only'

export const normalizeSectionSpacing = (value: unknown): SectionSpacing =>
  value === 'compact' || value === 'large' ? value : 'normal'

export const sectionSpacingClass = (section: SectionEditModel) =>
  spacingClasses[normalizeSectionSpacing(section.contentJson.spacing)]
