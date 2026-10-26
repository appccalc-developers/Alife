import type { PageDetailDto } from '../../types'
import { normalizePageDetail } from '../../utils/pageDetail'
import { conditionalGet, getCachedRecord, removeCachedRecords } from '../httpCache'
import { QUERY_STALE_TIME_MS, queryClient } from '../queryClient'
import { http } from '../../services/http'
import { activeEntityService } from '../../services/activeEntityService'
import { HttpStatusError } from '../httpError'

export const pageDetailQueryKey = (pageId: string, viewerId: string) => ['pageDetail', pageId, 'viewer', viewerId] as const
export const pageReviewCopyQueryKey = (pageId: string, viewerId: string) => ['pagePublicationReviewCopy', pageId, 'viewer', viewerId] as const
export const publicPageDetailQueryKey = (pageId: string) => ['publicPageDetail', pageId] as const
const privateReads = new Map<AbortController, string>()
let privateCacheGeneration = 0
export const getPrivatePageCacheGeneration = () => privateCacheGeneration
const deletedPages = new Set<string>()
export const isPageDeleted = (pageId: string) => deletedPages.has(pageId)
const assertAvailablePage = (pageId: string) => {
  if (isPageDeleted(pageId)) throw new HttpStatusError(pageDetailPath(pageId), 404)
}

export const pageDetailPath = (pageId: string) => `/api/pages/${pageId}/working-copy`

const fetchPrivatePage = async (pageId: string, viewerId: string, path: string, signal?: AbortSignal) => {
  assertAvailablePage(pageId)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.throwIfAborted()
  signal?.addEventListener('abort', abort, { once: true })
  privateReads.set(controller, pageId)
  try {
    const { data } = await http.get<PageDetailDto>(path, { signal: controller.signal })
    controller.signal.throwIfAborted()
    assertAvailablePage(pageId)
    if (activeEntityService.getViewerId() !== viewerId) throw new DOMException('Viewer changed', 'AbortError')
    return normalizePageDetail(data as PageDetailDto & { tagsJson?: string })
  } finally {
    privateReads.delete(controller)
    signal?.removeEventListener('abort', abort)
  }
}

export const fetchPageDetail = (pageId: string, viewerId: string, signal?: AbortSignal) =>
  fetchPrivatePage(pageId, viewerId, pageDetailPath(pageId), signal)

export const fetchPageReviewCopy = (pageId: string, viewerId: string, signal?: AbortSignal) =>
  fetchPrivatePage(pageId, viewerId, `/api/admin/pages/${pageId}/publication-review/copy`, signal)

export const clearPrivatePageCaches = async () => {
  ++privateCacheGeneration
  for (const controller of privateReads.keys()) controller.abort()
  const privateQuery = { predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] === 'pageDetail' || query.queryKey[0] === 'pagePublicationReviewCopy' }
  await queryClient.cancelQueries(privateQuery)
  queryClient.removeQueries(privateQuery)
  await Promise.all([removeCachedRecords(['pageDetail']), removeCachedRecords(['pagePublicationReviewCopy'])])
}

export const removeDeletedPageCaches = async (pageId: string) => {
  deletedPages.add(pageId)
  for (const [controller, id] of privateReads) if (id === pageId) controller.abort()
  await Promise.all(['pageDetail', 'pagePublicationReviewCopy', 'publicPageDetail'].map(async kind => {
    const queryKey = [kind, pageId]
    // Start HTTP/IDB invalidation before awaiting Query cancellation.
    const removal = removeCachedRecords(queryKey)
    await queryClient.cancelQueries({ queryKey })
    // Notify mounted observers before removing entries from the query cache.
    queryClient.setQueriesData({ queryKey }, null)
    queryClient.removeQueries({ queryKey })
    await removal
  }))
}

export const getCachedPublicPageDetailRecord = async (pageId: string) => {
  if (isPageDeleted(pageId)) return undefined
  const record = await getCachedRecord<PageDetailDto | null>(publicPageDetailQueryKey(pageId))
  if (!record || isPageDeleted(pageId)) {
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

export const fetchPublicPageDetail = async (pageId: string, signal?: AbortSignal) => {
  assertAvailablePage(pageId)
  const page = await conditionalGet<PageDetailDto | null>({
    queryKey: publicPageDetailQueryKey(pageId),
    path: `/api/pages/public/${pageId}`,
    signal,
    parser: (data) => {
      const page = normalizePageDetail(data as PageDetailDto & { tagsJson?: string })
      return page.visibility === 'public' ? page : null
    },
  })
  assertAvailablePage(pageId)
  return page
}

export const getFreshPageDetail = (pageId: string, viewerId: string) => {
  if (isPageDeleted(pageId)) return null
  const queryKey = pageDetailQueryKey(pageId, viewerId)
  const state = queryClient.getQueryState<PageDetailDto>(queryKey)
  const data = queryClient.getQueryData<PageDetailDto>(queryKey)

  if (!data || !state?.dataUpdatedAt) {
    return null
  }

  return Date.now() - state.dataUpdatedAt < QUERY_STALE_TIME_MS ? data : null
}

export const ensureFreshPageDetail = (pageId: string, viewerId: string) =>
  queryClient.fetchQuery({
    queryKey: pageDetailQueryKey(pageId, viewerId),
    queryFn: ({ signal }) => fetchPageDetail(pageId, viewerId, signal),
    staleTime: QUERY_STALE_TIME_MS,
  })

export const ensureFreshPublicPageDetail = (pageId: string) =>
  queryClient.fetchQuery({
    queryKey: publicPageDetailQueryKey(pageId),
    queryFn: ({ signal }) => fetchPublicPageDetail(pageId, signal),
    staleTime: QUERY_STALE_TIME_MS,
  })

export const setPageDetailCache = (page: PageDetailDto, viewerId: string, generation = privateCacheGeneration) => {
  if (generation !== privateCacheGeneration || isPageDeleted(page.id) || activeEntityService.getViewerId() !== viewerId) return
  queryClient.setQueryData(pageDetailQueryKey(page.id, viewerId), page)
}
