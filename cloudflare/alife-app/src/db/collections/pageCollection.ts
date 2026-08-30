import type { PageDetailDto } from '../../types'
import { normalizePageDetail } from '../../utils/pageDetail'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { QUERY_STALE_TIME_MS, queryClient } from '../queryClient'

export const pageDetailQueryKey = (pageId: string) => ['pageDetail', pageId] as const
export const publicPageDetailQueryKey = (pageId: string) => ['publicPageDetail', pageId] as const

export const getCachedPageDetail = async (pageId: string) =>
  normalizeNullablePageDetail((await getCachedRecord<PageDetailDto>(pageDetailQueryKey(pageId)))?.data)

export const pageDetailPath = (pageId: string) => `/api/pages/${pageId}/working-copy`

export const fetchPageDetail = async (pageId: string) =>
  conditionalGet<PageDetailDto>({
    queryKey: pageDetailQueryKey(pageId),
    path: pageDetailPath(pageId),
    parser: (data) => normalizePageDetail(data as PageDetailDto & { tagsJson?: string }),
  })

export const getCachedPublicPageDetailRecord = async (pageId: string) => {
  const record = await getCachedRecord<PageDetailDto | null>(publicPageDetailQueryKey(pageId))
  if (!record) {
    return undefined
  }

  const page = record.data
    ? normalizePageDetail(record.data as PageDetailDto & { tagsJson?: string })
    : null
  return {
    ...record,
    data: page?.visibility === 'public' ? page : null,
  }
}

export const fetchPublicPageDetail = async (pageId: string) =>
  conditionalGet<PageDetailDto | null>({
    queryKey: publicPageDetailQueryKey(pageId),
    path: `/api/pages/public/${pageId}`,
    parser: (data) => {
      const page = normalizePageDetail(data as PageDetailDto & { tagsJson?: string })
      return page.visibility === 'public' ? page : null
    },
  })

export const getFreshPageDetail = (pageId: string) => {
  const queryKey = pageDetailQueryKey(pageId)
  const state = queryClient.getQueryState<PageDetailDto>(queryKey)
  const data = queryClient.getQueryData<PageDetailDto>(queryKey)

  if (!data || !state?.dataUpdatedAt) {
    return null
  }

  return Date.now() - state.dataUpdatedAt < QUERY_STALE_TIME_MS ? data : null
}

export const ensureFreshPageDetail = (pageId: string) =>
  queryClient.fetchQuery({
    queryKey: pageDetailQueryKey(pageId),
    queryFn: () => fetchPageDetail(pageId),
    staleTime: QUERY_STALE_TIME_MS,
  })

export const ensureFreshPublicPageDetail = (pageId: string) =>
  queryClient.fetchQuery({
    queryKey: publicPageDetailQueryKey(pageId),
    queryFn: () => fetchPublicPageDetail(pageId),
    staleTime: QUERY_STALE_TIME_MS,
  })

export const setPageDetailCache = (page: PageDetailDto) => {
  queryClient.setQueryData(pageDetailQueryKey(page.id), page)
}

const normalizeNullablePageDetail = (page: PageDetailDto | undefined) => page ? normalizePageDetail(page) : null
