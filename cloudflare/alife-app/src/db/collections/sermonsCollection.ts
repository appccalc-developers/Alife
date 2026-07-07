import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { SermonDto, SermonPagedResult } from '../../services/sermonService'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

export const sermonsQueryKey = ['sermons'] as const
const sermonsFirstPageQueryKey = ['sermons', 'page', 1, 12] as const

const normalizeSermonCache = (payload: SermonDto[] | SermonPagedResult | undefined) => {
  if (!payload) return []
  return Array.isArray(payload) ? payload : payload.items
}

export const sermonsCollection = createCollection(
  queryCollectionOptions({
    queryClient,
    queryKey: sermonsFirstPageQueryKey,
    getKey: (item) => item.id,
    queryFn: async () =>
      normalizeSermonCache(await conditionalGet<SermonPagedResult>({
        queryKey: sermonsFirstPageQueryKey,
        path: '/api/sermons?page=1&pageSize=12',
      })),
  }),
)

export const getCachedSermons = async () => {
  const current = (await getCachedRecord<SermonPagedResult>(sermonsFirstPageQueryKey))?.data
  if (current) return normalizeSermonCache(current)

  const legacy = (await getCachedRecord<SermonDto[] | SermonPagedResult>(sermonsQueryKey))?.data
  return normalizeSermonCache(legacy)
}
