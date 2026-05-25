import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { PageDetailDto, PageSummaryDto } from '../../types'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

export const globalPagesQueryKey = () => ['globalPages'] as const

export const globalPagesCollection = () =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: globalPagesQueryKey(),
      getKey: (item: PageSummaryDto) => item.id,
      queryFn: async () =>
        conditionalGet<PageSummaryDto[]>({
          queryKey: globalPagesQueryKey(),
          path: '/api/pages/global',
        }),
    }),
  )

export const getCachedGlobalPages = async () =>
  (await getCachedRecord<PageSummaryDto[]>(globalPagesQueryKey()))?.data ?? []

export const pageDetailQueryKey = (pageId: string) => ['pageDetail', pageId] as const

export const getCachedPageDetail = async (pageId: string) =>
  (await getCachedRecord<PageDetailDto>(pageDetailQueryKey(pageId)))?.data ?? null
