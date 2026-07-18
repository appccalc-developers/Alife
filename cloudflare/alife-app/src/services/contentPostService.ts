import { conditionalGet } from '../db/httpCache'
import type { ContentPostDetailDto, ContentPostSummaryDto } from '../types/contentPost'
import { groupService } from './groupService'

export const contentPostQueryKeys = {
  publicIndex: ['contentPosts', 'public'] as const,
  publicDetail: (slug: string) => ['contentPosts', 'public', 'detail', slug] as const,
}

const getChurchId = async () => (await groupService.getChurch()).id

export const contentPostService = {
  async listPublic() {
    const churchId = await getChurchId()
    return conditionalGet<ContentPostSummaryDto[]>({
      queryKey: [...contentPostQueryKeys.publicIndex, churchId],
      path: `/api/public/groups/${churchId}/posts`,
    })
  },

  async getPublicBySlug(slug: string) {
    const normalizedSlug = slug.trim().toLowerCase()
    const churchId = await getChurchId()
    return conditionalGet<ContentPostDetailDto>({
      queryKey: [...contentPostQueryKeys.publicDetail(normalizedSlug), churchId],
      path: `/api/public/groups/${churchId}/posts/${encodeURIComponent(normalizedSlug)}`,
    })
  },
}
