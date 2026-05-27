import type { PageDetailDto, SectionEditModel } from '../types'
import { normalizePageVisibility } from './apiEnums'
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
  4: 'ListView',
  5: 'ListView',
  6: 'ListView',
}

const legacyListSourceType = (value: number | string) => {
  if (value === 5 || value === 'PageList' || value === 'pageList') {
    return 'pages'
  }

  if (value === 6 || value === 'SermonList' || value === 'sermonList') {
    return 'sermons'
  }

  return ''
}

const normalizeSectionType = (value: number | string): SectionEditModel['type'] => {
  if (typeof value === 'number') {
    return sectionTypeMapByNumber[value] ?? 'RichText'
  }

  const normalized = String(value)
  const sectionTypeMapByName: Record<string, SectionEditModel['type']> = {
    hero: 'Hero',
    richText: 'RichText',
    postFeed: 'PostFeed',
    sermon: 'Sermon',
    groupList: 'ListView',
    listView: 'ListView',
    pageList: 'ListView',
    sermonList: 'ListView',
  }
  if (sectionTypeMapByName[normalized]) {
    return sectionTypeMapByName[normalized]
  }

  const values = ['Hero', 'MediaSpotlight', 'IconFeatureGrid', 'SermonSpotlight', 'RichText', 'PostFeed', 'Sermon', 'ListView'] as const
  return values.includes(normalized as (typeof values)[number]) ? (normalized as SectionEditModel['type']) : 'RichText'
}

export const normalizePageSection = (section: SectionDto): SectionEditModel => {
  const contentJson = parseJsonObject(section.contentJson)
  const styleJson = parseJsonObject(section.styleJson)
  const normalizedType = normalizeSectionType(section.type)
  const legacySourceType = legacyListSourceType(section.type)
  if (legacySourceType && !contentJson.sourceType) {
    contentJson.sourceType = legacySourceType
    contentJson.sourceScope = typeof contentJson.sourceScope === 'string' ? contentJson.sourceScope : 'global'
  }
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
  visibility: normalizePageVisibility(page.visibility),
  sections: (page.sections ?? []).map((section) => normalizePageSection(section as unknown as SectionDto)),
})
