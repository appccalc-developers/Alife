import { http } from './http'
import { groupPagesQueryKey } from '../db/collections/groupCollection'
import { globalPagesQueryKey, pageDetailQueryKey } from '../db/collections/pageCollection'
import { removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { LocalizedText, PageDetailDto, PageEditModel, PageSummaryDto, PageVisibility, SectionEditModel } from '../types'
import { toLocalizedText } from '../utils/localizedText'

export type CreateGroupPagePayload = {
  title: LocalizedText
  description?: LocalizedText
  tagsJson?: string
  titleDisplayStyle?: string
  sections: SectionEditModel[]
}

export type UpdatePagePayload = {
  title: LocalizedText
  description?: LocalizedText
  tagsJson?: string
  titleDisplayStyle?: string
  sections: SectionEditModel[]
}

export type PublishPagePayload = {
  visibility: PageVisibility
}

export type PublishPageOptimizedPayload = {
  visibility: PageVisibility
  page: {
    title: LocalizedText
    description?: LocalizedText
    tagsJson?: string
    titleDisplayStyle?: string
  }
  sections: Array<{
    id?: string
    order: number
    type: number
    contentJson: string
    styleJson: string
  }>
}

type SectionDto = {
  id?: string
  pageId: string
  order: number
  type: number | string
  contentJson: string
  styleJson: string
}

const parseJsonObject = (value: string | null | undefined): Record<string, unknown> => {
  if (!value) {
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

const toSectionEditModel = (section: SectionDto): SectionEditModel => {
  const contentJson = parseJsonObject(section.contentJson)
  const styleJson = parseJsonObject(section.styleJson)
  const normalizedType = normalizeSectionType(section.type)
  const layout = typeof styleJson.layout === 'string' ? styleJson.layout : ''

  // Backend currently stores custom visual templates as Hero; restore editor types from style.
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

const toSectionPayloadType = (type: SectionEditModel['type']): number => {
  switch (type) {
    case 'Hero':
      return 0
    case 'MediaSpotlight':
      return 0
    case 'IconFeatureGrid':
      return 0
    case 'SermonSpotlight':
      return 0
    case 'RichText':
      return 1
    case 'PostFeed':
      return 2
    case 'Sermon':
      return 3
    case 'GroupList':
      return 4
    case 'PageList':
      return 5
    case 'SermonList':
      return 6
    default:
      return 1
  }
}

const buildSectionWritePayload = (section: SectionEditModel, order: number) => ({
  type: toSectionPayloadType(section.type === '' ? 'RichText' : section.type),
  contentJson: JSON.stringify(section.contentJson ?? {}),
  styleJson: JSON.stringify(section.styleJson ?? {}),
  order,
})

const toSectionPublishPayload = (sections: SectionEditModel[]) =>
  sections.map((section, index) => ({
    id: section.id,
    ...buildSectionWritePayload(section, index + 1),
  }))

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

const invalidateQueryCache = async (queryKey: readonly unknown[]) => {
  await removeCachedRecord(queryKey)
  await queryClient.invalidateQueries({ queryKey })
}

const invalidatePageSummaryCaches = async (page: PageSummaryDto | PageDetailDto) => {
  await Promise.all([
    invalidateQueryCache(page.ownerGroupId ? groupPagesQueryKey(page.ownerGroupId) : globalPagesQueryKey()),
    invalidateQueryCache(pageDetailQueryKey(page.id)),
  ])
}

export const pageService = {
  async getPageById(pageId: string): Promise<PageDetailDto> {
    const { data } = await http.get<PageDetailDto>(`/api/pages/${pageId}`)
    return {
      ...data,
      title: toLocalizedText(data.title),
      description: toLocalizedText(data.description),
      tags: parseTags((data as PageDetailDto & { tagsJson?: string }).tagsJson),
      sections: (data.sections ?? []).map((section) => toSectionEditModel(section as unknown as SectionDto)),
    }
  },

  async createGroupPage(groupId: string, payload: CreateGroupPagePayload) {
    const { data } = await http.post<PageDetailDto>(`/api/groups/${groupId}/pages`, {
      ...payload,
      sections: toSectionPublishPayload(payload.sections),
    })
    await invalidatePageSummaryCaches(data)
    return data
  },

  async updatePage(pageId: string, payload: UpdatePagePayload) {
    const { data } = await http.put<PageDetailDto>(`/api/pages/${pageId}`, {
      ...payload,
      sections: toSectionPublishPayload(payload.sections),
    })
    await invalidatePageSummaryCaches(data)
    return data
  },

  async publishPage(pageId: string, payload: PublishPagePayload) {
    const { data } = await http.post<PageSummaryDto>(`/api/pages/${pageId}/publish`, payload)
    await invalidatePageSummaryCaches(data)
    return data
  },

  async publishPageOptimized(pageId: string, payload: PublishPageOptimizedPayload) {
    const { data } = await http.put<PageDetailDto>(`/api/pages/${pageId}`, {
      ...payload.page,
      sections: payload.sections,
    })
    await pageService.publishPage(pageId, { visibility: payload.visibility })
    await invalidatePageSummaryCaches(data)
    return data
  },

  async deletePage(pageId: string) {
    await http.delete(`/api/pages/${pageId}`)
  },

  toSectionPublishPayload,
}

export const toPageEditModel = (page: PageDetailDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  title: page.title,
  description: page.description ?? { en: '', cn: '' },
  tags: page.tags,
  titleDisplayStyle: page.titleDisplayStyle,
  visibility: page.visibility,
  sections: page.sections,
})
