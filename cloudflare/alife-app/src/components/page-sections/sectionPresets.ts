import type { SectionEditModel } from '../../types/page-editor'
import type { SectionSpacing } from '../../types'

const spacingClasses: Record<SectionSpacing, string> = {
  compact: 'py-6 md:py-8',
  normal: 'py-8 md:py-16',
  large: 'py-10 md:py-24',
}

export const pageSectionShellClass = 'scroll-mt-24 px-5 py-20 sm:px-8 lg:px-10 lg:py-28'
export const pageSectionsCanvasClass = 'w-full min-w-0'
export const pageSectionsChromeClass = 'mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10'

export const normalizeSectionSpacing = (value: unknown): SectionSpacing =>
  value === 'compact' || value === 'large' ? value : 'normal'

export const sectionSpacingClass = (section: SectionEditModel) =>
  spacingClasses[normalizeSectionSpacing(section.contentJson.spacing)]
