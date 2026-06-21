import type { SectionEditModel } from '../../types/page-editor'
import type { SectionSpacing } from '../../types'

const spacingClasses: Record<SectionSpacing, string> = {
  compact: 'py-6 md:py-8',
  normal: 'py-8 md:py-16',
  large: 'py-10 md:py-24',
}

export const normalizeSectionSpacing = (value: unknown): SectionSpacing =>
  value === 'compact' || value === 'large' ? value : 'normal'

export const sectionSpacingClass = (section: SectionEditModel) =>
  spacingClasses[normalizeSectionSpacing(section.contentJson.spacing)]
