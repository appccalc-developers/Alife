import { http } from './http'

export type SermonDto = {
  id: string
  title: string
  speakerName: string
  thumbnailUrl?: string | null
  videoUrl?: string | null
  preachedAt?: string | null
}

export type SermonPagedResult = {
  items: SermonDto[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

const normalizeSermonPage = (payload: SermonPagedResult | SermonDto[], fallbackPage: number, fallbackPageSize: number): SermonPagedResult => {
  if (Array.isArray(payload)) {
    return {
      items: payload.slice(0, fallbackPageSize),
      page: fallbackPage,
      pageSize: fallbackPageSize,
      totalCount: payload.length,
      totalPages: Math.max(1, Math.ceil(payload.length / fallbackPageSize)),
      hasPreviousPage: fallbackPage > 1,
      hasNextPage: payload.length > fallbackPage * fallbackPageSize,
    }
  }

  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    page: payload.page,
    pageSize: payload.pageSize,
    totalCount: payload.totalCount,
    totalPages: payload.totalPages,
    hasPreviousPage: payload.hasPreviousPage,
    hasNextPage: payload.hasNextPage,
  }
}

export const sermonService = {
  async getById(sermonId: string) {
    const { data } = await http.get<SermonDto>(`/api/sermons/${sermonId}`)
    return data
  },

  async list(params: { page?: number; pageSize?: number } = {}) {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 12
    const { data } = await http.get<SermonPagedResult | SermonDto[]>('/api/sermons', {
      params: {
        page,
        pageSize,
      },
    })
    return normalizeSermonPage(data, page, pageSize)
  },

  async getLatest(limit = 3) {
    const data = await this.list({ page: 1, pageSize: limit })
    return data.items
  },
}
