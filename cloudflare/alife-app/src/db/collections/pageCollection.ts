import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { PageDetailDto, PageSummaryDto } from '../../types'
import { normalizePageSummary } from '../../utils/apiEnums'
import { normalizePageDetail } from '../../utils/pageDetail'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { QUERY_STALE_TIME_MS, queryClient } from '../queryClient'

export const globalPagesQueryKey = () => ['globalPages'] as const

export const globalPagesCollection = () =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: globalPagesQueryKey(),
      getKey: (item: PageSummaryDto) => item.id,
      queryFn: async (): Promise<PageSummaryDto[]> => {
        const items = await conditionalGet<PageSummaryDto[]>({
          queryKey: globalPagesQueryKey(),
          path: '/api/pages/global',
        })
        return items.map(normalizePageSummary)
      },
    }),
  )

export const getCachedGlobalPages = async () =>
  ((await getCachedRecord<PageSummaryDto[]>(globalPagesQueryKey()))?.data ?? []).map(normalizePageSummary)

export const pageDetailQueryKey = (pageId: string) => ['pageDetail', pageId] as const

export const getCachedPageDetail = async (pageId: string) =>
  normalizeNullablePageDetail((await getCachedRecord<PageDetailDto>(pageDetailQueryKey(pageId)))?.data)

export const pageDetailPath = (pageId: string) => `/api/pages/${pageId}`

export const fetchPageDetail = async (pageId: string) =>
  conditionalGet<PageDetailDto>({
    queryKey: pageDetailQueryKey(pageId),
    path: pageDetailPath(pageId),
    parser: (data) => normalizePageDetail(data as PageDetailDto & { tagsJson?: string }),
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

export const setPageDetailCache = (page: PageDetailDto) => {
  queryClient.setQueryData(pageDetailQueryKey(page.id), page)
}

const normalizeNullablePageDetail = (page: PageDetailDto | undefined) => page ? normalizePageDetail(page) : null
