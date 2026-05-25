import { http } from './http'
import { groupPagesQueryKey } from '../db/collections/groupCollection'
import { globalPagesQueryKey, pageDetailQueryKey, setPageDetailCache } from '../db/collections/pageCollection'
import { removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { LocalizedText, PageDetailDto, PageEditModel, PageSummaryDto, PageVisibility, SectionEditModel } from '../types'
import { normalizePageDetail } from '../utils/pageDetail'

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

const invalidateQueryCache = async (queryKey: readonly unknown[]) => {
  await removeCachedRecord(queryKey)
  await queryClient.invalidateQueries({ queryKey })
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
    return normalized
  },

  async updatePage(pageId: string, payload: UpdatePagePayload) {
    const { data } = await http.put<PageDetailDto>(`/api/pages/${pageId}`, {
      ...payload,
      sections: toSectionPublishPayload(payload.sections),
    })
    const normalized = cachePageDetail(data as PageDetailDto & { tagsJson?: string })
    await invalidatePageListCache(normalized)
    return normalized
  },

  async publishPage(pageId: string, payload: PublishPagePayload) {
    const { data } = await http.post<PageSummaryDto>(`/api/pages/${pageId}/publish`, payload)
    const existingDetail = queryClient.getQueryData<PageDetailDto>(pageDetailQueryKey(pageId))
    if (existingDetail) {
      setPageDetailCache({
        ...existingDetail,
        visibility: data.visibility,
        title: data.title ?? existingDetail.title,
        description: data.description ?? existingDetail.description,
        titleDisplayStyle: data.titleDisplayStyle ?? existingDetail.titleDisplayStyle,
        ownerGroupId: data.ownerGroupId ?? existingDetail.ownerGroupId,
      })
    }
    await invalidatePageListCache(data)
    return data
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
    return published
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
