import type { PageDetailDto, SectionEditModel } from '../types'
import { toLocalizedText } from './localizedText'

type SectionDto = {
  id?: string
  pageId?: string
  order: number
  type: number | string
  contentJson: string | Record<string, unknown>
  styleJson: string | Record<string, unknown>
}

const parseJsonObject = (value: string | Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!value) {
    return {}
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

const sectionTypeMapByNumber: Record<number, SectionEditModel['type']> = {
  0: 'Hero',
  1: 'RichText',
  2: 'PostFeed',
  3: 'Sermon',
  4: 'GroupList',
  5: 'PageList',
  6: 'SermonList',
}

const normalizeSectionType = (value: number | string): SectionEditModel['type'] => {
  if (typeof value === 'number') {
    return sectionTypeMapByNumber[value] ?? 'RichText'
  }

  const normalized = String(value)
  const values = ['Hero', 'MediaSpotlight', 'IconFeatureGrid', 'SermonSpotlight', 'RichText', 'PostFeed', 'Sermon', 'GroupList', 'PageList', 'SermonList'] as const
  return values.includes(normalized as (typeof values)[number]) ? (normalized as SectionEditModel['type']) : 'RichText'
}

export const normalizePageSection = (section: SectionDto): SectionEditModel => {
  const contentJson = parseJsonObject(section.contentJson)
  const styleJson = parseJsonObject(section.styleJson)
  const normalizedType = normalizeSectionType(section.type)
  const layout = typeof styleJson.layout === 'string' ? styleJson.layout : ''

  const type =
    normalizedType === 'Hero' && (layout === 'mediaSpotlight' || layout === 'split')
      ? 'MediaSpotlight'
      : normalizedType === 'Hero' && layout === 'iconFeatureGrid'
        ? 'IconFeatureGrid'
        : normalizedType === 'Hero' && layout === 'sermonSpotlight'
          ? 'SermonSpotlight'
          : normalizedType

  return {
    id: section.id,
    order: section.order,
    type,
    contentJson,
    styleJson,
  }
}

const parseTags = (tagsJson: string | undefined) => {
  if (!tagsJson) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

export const normalizePageDetail = (page: PageDetailDto & { tagsJson?: string }): PageDetailDto => ({
  ...page,
  title: toLocalizedText(page.title),
  description: toLocalizedText(page.description),
  tags: Array.isArray(page.tags) ? page.tags : parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  sections: (page.sections ?? []).map((section) => normalizePageSection(section as unknown as SectionDto)),
})
