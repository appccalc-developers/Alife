import { useEffect } from 'react'
import { useQuery, type QueryKey } from '@tanstack/react-query'
import { publicHomeBootstrap } from '../data/publicHomeBootstrap'
import {
  fetchPublicPageDetail,
  getCachedPublicPageDetailRecord,
  publicPageDetailQueryKey,
  isPageDeleted,
} from '../db/collections/pageCollection'
import type { CachedHttpResponse } from '../db/httpCache'
import { QUERY_STALE_TIME_MS, queryClient } from '../db/queryClient'
import {
  getCachedPublicPagesRecord,
  pageService,
  publicPagesQueryKey,
} from '../services/pageService'
import type { PageDetailDto, PageSummaryDto } from '../types'

const PUBLIC_CLIENT_CACHE_MAX_AGE_MS = 60 * 60_000

const hydrateRecentPublicCache = async <TData>(
  queryKey: QueryKey,
  readCached: () => Promise<CachedHttpResponse<TData> | undefined>,
  isSafePublicData: (data: TData) => boolean,
) => {
  const record = await readCached()
  const currentUpdatedAt = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0
  if (
    !record ||
    !Number.isFinite(record.storedAt) ||
    Date.now() - record.storedAt > PUBLIC_CLIENT_CACHE_MAX_AGE_MS ||
    !isSafePublicData(record.data) ||
    record.storedAt <= currentUpdatedAt
  ) {
    return
  }

  queryClient.setQueryData<TData>(queryKey, record.data, { updatedAt: record.storedAt })
}

export const usePublicPagesQuery = () => {
  const queryKey = publicPagesQueryKey()
  const query = useQuery<PageSummaryDto[]>({
    queryKey,
    queryFn: () => pageService.getPublicPages(),
    initialData: publicHomeBootstrap.pages.length ? publicHomeBootstrap.pages : undefined,
    // A bundled snapshot is immediately visible but intentionally stale so the
    // public ETag is checked as soon as the app is running.
    initialDataUpdatedAt: 0,
    staleTime: QUERY_STALE_TIME_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: 'always',
  })

  useEffect(() => {
    void hydrateRecentPublicCache(
      queryKey,
      getCachedPublicPagesRecord,
      (pages) => pages.every((page) => page.visibility === 'public'),
    )
  }, [])

  return query
}

export const usePublicPageDetailQuery = (pageId: string) => {
  const queryKey = publicPageDetailQueryKey(pageId)
  const retainedHomePage = publicHomeBootstrap.homePage
    ? queryClient.getQueryData<PageDetailDto | null>(
        publicPageDetailQueryKey(publicHomeBootstrap.homePage.id),
      )
    : undefined
  const query = useQuery<PageDetailDto | null>({
    queryKey,
    queryFn: ({ signal }) => fetchPublicPageDetail(pageId, signal),
    enabled: Boolean(pageId),
    initialData: pageId && !isPageDeleted(pageId) && publicHomeBootstrap.homePage?.id === pageId
      ? publicHomeBootstrap.homePage
      : undefined,
    initialDataUpdatedAt: 0,
    // PageView retains its previous public page. A navigation from the root can
    // also retain the already-rendered homepage, while a cold deep link never
    // shows unrelated bootstrap content.
    placeholderData: (previousPage) =>
      (previousPage && !isPageDeleted(previousPage.id) ? previousPage : undefined) ??
      (retainedHomePage && !isPageDeleted(retainedHomePage.id) ? retainedHomePage : undefined),
    staleTime: QUERY_STALE_TIME_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: 'always',
  })

  useEffect(() => {
    if (!pageId) {
      return
    }

    void hydrateRecentPublicCache(
      queryKey,
      () => getCachedPublicPageDetailRecord(pageId),
      (page) => !isPageDeleted(pageId) && page?.visibility === 'public',
    )
  }, [pageId])

  return query
}
