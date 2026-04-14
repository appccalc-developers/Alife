import { http } from './http'
import type { PageDetailDto, PageEditModel, PageSummaryDto, PageVisibility, SectionEditModel } from '../types'

export type CreateGroupPagePayload = {
  title: string
  slug: string
  language: string
  description?: string
  tagsJson?: string
  titleDisplayStyle?: string
}

export type UpdatePagePayload = {
  title: string
  description?: string
  tagsJson?: string
  titleDisplayStyle?: string
}

export type PublishPagePayload = {
  visibility: PageVisibility
}

type SectionDto = {
  id: string
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
  const values = ['Hero', 'RichText', 'PostFeed', 'Sermon', 'GroupList', 'PageList', 'SermonList'] as const
  return values.includes(normalized as (typeof values)[number]) ? (normalized as SectionEditModel['type']) : 'RichText'
}

const toSectionEditModel = (section: SectionDto): SectionEditModel => ({
  id: section.id,
  order: section.order,
  type: normalizeSectionType(section.type),
  contentJson: parseJsonObject(section.contentJson),
  styleJson: parseJsonObject(section.styleJson),
})

const toSectionPayloadType = (type: SectionEditModel['type']): number => {
  switch (type) {
    case 'Hero':
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

const toPageDetail = (page: PageSummaryDto): PageDetailDto => ({
  id: page.id,
  title: page.title,
  description: page.description ?? '',
  tags: parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  language: page.language,
  visibility: page.visibility,
  sections: [],
  slug: page.slug,
  createdByMemberId: page.createdByMemberId,
  ownerGroupId: page.ownerGroupId ?? null,
})

export const pageService = {
  async getPageBySlug(slug: string, lang = 'en') {
    const { data } = await http.get<PageSummaryDto>(`/api/pages/${slug}`, { params: { lang } })
    return toPageDetail(data)
  },

  async getPageById(_pageId: string): Promise<PageDetailDto> {
    // TODO: backend endpoint is not available yet for get page by id.
    throw new Error('Get page by id endpoint is not implemented on the backend.')
  },

  async createGroupPage(groupId: string, payload: CreateGroupPagePayload) {
    const { data } = await http.post<PageSummaryDto>(`/api/groups/${groupId}/pages`, payload)
    return data
  },

  async updatePage(pageId: string, payload: UpdatePagePayload) {
    const { data } = await http.put<PageSummaryDto>(`/api/pages/${pageId}`, payload)
    return data
  },

  async publishPage(pageId: string, payload: PublishPagePayload) {
    const { data } = await http.post<PageSummaryDto>(`/api/pages/${pageId}/publish`, payload)
    return data
  },

  async deletePage(pageId: string) {
    await http.delete(`/api/pages/${pageId}`)
  },

  async getPageSections(pageId: string) {
    const { data } = await http.get<SectionDto[]>(`/api/pages/${pageId}/sections`)
    return data
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toSectionEditModel)
  },

  async savePageSections(pageId: string, sections: SectionEditModel[]) {
    const existing = await pageService.getPageSections(pageId)
    const existingById = new Map(existing.filter((x) => x.id).map((x) => [x.id as string, x]))

    const incomingWithOrder = sections.map((section, index) => ({
      ...section,
      order: index + 1,
    }))

    for (const section of incomingWithOrder) {
      const payload = {
        type: toSectionPayloadType(section.type === '' ? 'RichText' : section.type),
        contentJson: JSON.stringify(section.contentJson ?? {}),
        styleJson: JSON.stringify(section.styleJson ?? {}),
        order: section.order,
      }

      if (!section.id) {
        await http.post(`/api/pages/${pageId}/sections`, payload)
        continue
      }

      existingById.delete(section.id)
      await http.put(`/api/sections/${section.id}`, payload)
    }

    for (const [sectionId] of existingById) {
      await http.delete(`/api/sections/${sectionId}`)
    }
  },
}

export const toPageEditModel = (page: PageDetailDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  slug: page.slug,
  title: page.title,
  description: page.description ?? '',
  tags: page.tags,
  titleDisplayStyle: page.titleDisplayStyle,
  language: page.language,
  visibility: page.visibility,
  sections: page.sections,
})
