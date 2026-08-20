import type {
  ForumCategoryDto,
  ForumCommentDto,
  ForumCommentRequest,
  ForumPagedResult,
  ForumPostDetailDto,
  ForumPostRequest,
  ForumPostSummaryDto,
} from '../types/forum'
import { http, normalizeApiError } from './http'
import { invalidateChurchLifeQueries } from './churchLifeService'
import { invalidateForumPostQueries } from './forumCache'

export { forumQueryKeys } from './contentQueryKeys'
export { invalidateForumPostQueries } from './forumCache'

export const forumService = {
  listCategories: async (): Promise<ForumCategoryDto[]> => {
    const { data } = await http.get<ForumCategoryDto[]>('/api/forum/categories')
    return data
  },

  listPosts: async (params: { categoryId?: string; groupId?: string; page?: number; pageSize?: number } = {}): Promise<ForumPagedResult<ForumPostSummaryDto>> => {
    const { data } = await http.get<ForumPagedResult<ForumPostSummaryDto>>('/api/forum/posts', {
      params: {
        categoryId: params.categoryId || undefined,
        groupId: params.groupId || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    })
    return data
  },

  getPost: async (postId: string): Promise<ForumPostDetailDto> => {
    const { data } = await http.get<ForumPostDetailDto>(`/api/forum/posts/${postId}`)
    return data
  },

  createPost: async (payload: ForumPostRequest): Promise<ForumPostDetailDto> => {
    const { data } = await http.post<ForumPostDetailDto>('/api/forum/posts', payload)
    await invalidateChurchLifeQueries()
    return data
  },

  createComment: async (postId: string, payload: ForumCommentRequest): Promise<ForumCommentDto> => {
    const { data } = await http.post<ForumCommentDto>(`/api/forum/posts/${postId}/comments`, payload)
    await invalidateForumPostQueries(postId)
    return data
  },

  getSermonPost: async (sermonId: string): Promise<ForumPostDetailDto | null> => {
    try {
      const { data } = await http.get<ForumPostDetailDto>(`/api/sermons/${sermonId}/forum-post`)
      return data
    } catch (error) {
      if (normalizeApiError(error).status === 404) {
        return null
      }

      throw error
    }
  },

  createSermonComment: async (sermonId: string, payload: ForumCommentRequest): Promise<ForumPostDetailDto> => {
    const { data } = await http.post<ForumPostDetailDto>(`/api/sermons/${sermonId}/comments`, payload)
    await invalidateForumPostQueries(data.id)
    return data
  },
}
