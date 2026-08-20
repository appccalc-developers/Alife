import type { AlbumSummary } from './albumService'
import type { AnnouncementDto } from '../types/announcement'
import type { GroupEventRecord } from '../types/event'
import type { ForumPostDetailDto, ForumPostSummaryDto } from '../types/forum'
import type { LocalizedText, PageSummaryDto } from '../types'
import { normalizePageSummary } from '../utils/apiEnums'
import { queryClient } from '../db/queryClient'
import { churchLifeQueryKeys } from './contentQueryKeys'
import { http } from './http'

export type ChurchLifeGroup = {
  id: string
  parentGroupId?: string | null
  name: LocalizedText
  pathIds: string[]
  canManage: boolean
  isSelectable?: boolean
}

export type ChurchLifeList<T> = {
  items: T[]
  groups: ChurchLifeGroup[]
}

export type ChurchLifePagedList<T> = ChurchLifeList<T> & {
  page: number
  pageSize: number
  totalCount: number
}

export { churchLifeQueryKeys } from './contentQueryKeys'

const list = async <T>(path: string, ownerGroupId?: string): Promise<ChurchLifeList<T>> => {
  const { data } = await http.get<ChurchLifeList<T>>(path, {
    params: { ownerGroupId: ownerGroupId || undefined },
  })
  return data
}

export const invalidateChurchLifeQueries = async () => {
  await queryClient.invalidateQueries({ queryKey: churchLifeQueryKeys.all })
}

export const churchLifeService = {
  async listPages(ownerGroupId?: string): Promise<ChurchLifeList<PageSummaryDto>> {
    const data = await list<PageSummaryDto>('/api/church-life/pages', ownerGroupId)
    return { ...data, items: data.items.map(normalizePageSummary) }
  },

  listEvents: (ownerGroupId?: string) =>
    list<GroupEventRecord>('/api/church-life/events', ownerGroupId),

  listAnnouncements: (ownerGroupId?: string) =>
    list<AnnouncementDto>('/api/church-life/announcements', ownerGroupId),

  listAlbums: (ownerGroupId?: string) =>
    list<AlbumSummary>('/api/church-life/albums', ownerGroupId),

  async listForumPosts(params: {
    ownerGroupId?: string
    categoryId?: string
    page?: number
    pageSize?: number
  } = {}): Promise<ChurchLifePagedList<ForumPostSummaryDto>> {
    const { data } = await http.get<ChurchLifePagedList<ForumPostSummaryDto>>('/api/church-life/forum/posts', {
      params: {
        ownerGroupId: params.ownerGroupId || undefined,
        categoryId: params.categoryId || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    })
    return data
  },

  async getForumPost(postId: string): Promise<ForumPostDetailDto> {
    const { data } = await http.get<ForumPostDetailDto>(
      `/api/church-life/forum/posts/${encodeURIComponent(postId)}`,
    )
    return data
  },
}
