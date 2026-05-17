import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { SermonDto } from '../../services/sermonService'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

export const sermonsQueryKey = ['sermons'] as const

export const sermonsCollection = createCollection(
  queryCollectionOptions({
    queryClient,
    queryKey: sermonsQueryKey,
    getKey: (item) => item.id,
    queryFn: async () =>
      conditionalGet<SermonDto[]>({
        queryKey: sermonsQueryKey,
        path: '/api/sermons',
      }),
  }),
)

export const getCachedSermons = async () => (await getCachedRecord<SermonDto[]>(sermonsQueryKey))?.data ?? []
