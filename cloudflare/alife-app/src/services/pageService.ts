import { http } from './http'
import { groupPagesQueryKey } from '../db/collections/groupCollection'
import { globalPagesQueryKey, pageDetailQueryKey, setPageDetailCache } from '../db/collections/pageCollection'
import { conditionalGet, removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { LocalizedText, PageDetailDto, PageEditModel, PageSummaryDto, PageVisibility, SectionEditModel } from '../types'
import { normalizePageSummary } from '../utils/apiEnums'
import { normalizePageDetail } from '../utils/pageDetail'
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
    type: string
    contentJson: string
    styleJson: string
  }>
}

const toSectionPayloadType = (type: SectionEditModel['type']): string => {
  switch (type) {
    case 'LandingHero':
      return 'landingHero'
    case 'Countdown':
      return 'countdown'
    case 'ContactLocation':
      return 'contactLocation'
    case 'Spotlight':
      return 'spotlight'
    case 'RichText':
      return 'richText'
    case 'ListView':
      return 'listView'
    default:
      return 'richText'
  }
}

const contentJsonForWrite = (section: SectionEditModel) => {
  const contentJson = section.contentJson ?? {}
  if (section.type === 'LandingHero') {
    return { ...contentJson, sectionKind: 'landingHero' }
  }

  if (section.type === 'Countdown') {
    return { ...contentJson, sectionKind: 'countdown' }
  }

  if (section.type === 'ContactLocation') {
    return { ...contentJson, sectionKind: 'contactLocation', datasource: 'custom' }
  }

  return contentJson
}

const styleJsonForWrite = (section: SectionEditModel) => {
  const styleJson = section.styleJson ?? {}
  if (section.type === 'LandingHero') {
    return { ...styleJson, layout: 'landingHero', frontendType: 'LandingHero' }
  }

  if (section.type === 'Countdown') {
    return { ...styleJson, layout: 'countdown', frontendType: 'Countdown' }
  }

  if (section.type === 'ContactLocation') {
    return { ...styleJson, layout: 'contactLocation', frontendType: 'ContactLocation' }
  }

  return styleJson
}

const buildSectionWritePayload = (section: SectionEditModel, order: number) => ({
  type: toSectionPayloadType(section.type === '' ? 'RichText' : section.type),
  contentJson: JSON.stringify(contentJsonForWrite(section)),
  styleJson: JSON.stringify(styleJsonForWrite(section)),
  order,
})

const toSectionPublishPayload = (sections: SectionEditModel[]) =>
  sections.map((section, index) => ({
    id: section.id,
    ...buildSectionWritePayload(section, index + 1),
  }))

const invalidateQueryCache = async (queryKey: readonly unknown[]) => {
  await removeCachedRecord(queryKey)
  await queryClient.invalidateQueries({ queryKey })
}

export const publicPagesQueryKey = () => ['publicPages'] as const

const invalidatePublicPagesCache = async () => {
  await invalidateQueryCache(publicPagesQueryKey())
}

const invalidatePageListCache = async (page: PageSummaryDto | PageDetailDto) => {
  await invalidateQueryCache(page.ownerGroupId ? groupPagesQueryKey(page.ownerGroupId) : globalPagesQueryKey())
}

const cachePageDetail = (page: PageDetailDto & { tagsJson?: string }) => {
  const normalized = normalizePageDetail(page)
  setPageDetailCache(normalized)
  return normalized
}

export const pageService = {
  async getPublicPages(): Promise<PageSummaryDto[]> {
    const data = await conditionalGet<PageSummaryDto[]>({
      queryKey: publicPagesQueryKey(),
      path: '/api/pages/public',
    })
    return data.map(normalizePageSummary)
  },

  async getPageById(pageId: string): Promise<PageDetailDto> {
    const { data } = await http.get<PageDetailDto>(`/api/pages/${pageId}`)
    return cachePageDetail(data as PageDetailDto & { tagsJson?: string })
  },

  async createGroupPage(groupId: string, payload: CreateGroupPagePayload) {
    const { data } = await http.post<PageDetailDto>(`/api/groups/${groupId}/pages`, {
      ...payload,
      sections: toSectionPublishPayload(payload.sections),
    })
    const normalized = cachePageDetail(data as PageDetailDto & { tagsJson?: string })
    await invalidatePageListCache(normalized)
    await invalidatePublicPagesCache()
    return normalized
  },

  async updatePage(pageId: string, payload: UpdatePagePayload) {
    const { data } = await http.put<PageDetailDto>(`/api/pages/${pageId}`, {
      ...payload,
      sections: toSectionPublishPayload(payload.sections),
    })
    const normalized = cachePageDetail(data as PageDetailDto & { tagsJson?: string })
    await invalidatePageListCache(normalized)
    await invalidatePublicPagesCache()
    return normalized
  },

  async publishPage(pageId: string, payload: PublishPagePayload) {
    const { data } = await http.post<PageSummaryDto>(`/api/pages/${pageId}/publish`, payload)
    const normalized = normalizePageSummary(data)
    const existingDetail = queryClient.getQueryData<PageDetailDto>(pageDetailQueryKey(pageId))
    if (existingDetail) {
      setPageDetailCache({
        ...existingDetail,
        visibility: normalized.visibility,
        title: normalized.title ?? existingDetail.title,
        description: normalized.description ?? existingDetail.description,
        titleDisplayStyle: normalized.titleDisplayStyle ?? existingDetail.titleDisplayStyle,
        ownerGroupId: normalized.ownerGroupId ?? existingDetail.ownerGroupId,
      })
    }
    await invalidatePageListCache(normalized)
    await invalidatePublicPagesCache()
    return normalized
  },

  async publishPageOptimized(pageId: string, payload: PublishPageOptimizedPayload) {
    const { data } = await http.put<PageDetailDto>(`/api/pages/${pageId}`, {
      ...payload.page,
      sections: payload.sections,
    })
    const normalized = cachePageDetail(data as PageDetailDto & { tagsJson?: string })
    await pageService.publishPage(pageId, { visibility: payload.visibility })
    const published = { ...normalized, visibility: payload.visibility }
    setPageDetailCache(published)
    await invalidatePublicPagesCache()
    return published
  },

  async deletePage(pageId: string) {
    await http.delete(`/api/pages/${pageId}`)
    await invalidatePublicPagesCache()
  },

  toSectionPublishPayload,
}

export const toPageEditModel = (page: PageDetailDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  title: toLocalizedText(page.title),
  description: toLocalizedText(page.description),
  tags: page.tags,
  titleDisplayStyle: page.titleDisplayStyle,
  visibility: page.visibility,
  sections: page.sections,
})
