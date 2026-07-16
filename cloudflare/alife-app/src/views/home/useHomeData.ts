import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCachedPublicPages, pageService, publicPagesQueryKey } from '../../services/pageService'
import { sermonService, type SermonDto } from '../../services/sermonService'
import type { PageSummaryDto } from '../../types'

const retryDelaysMs = [250, 750]

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

const withRetry = async <T>(request: () => Promise<T>): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await request()
    } catch (error) {
      lastError = error
      if (attempt < retryDelaysMs.length) {
        await wait(retryDelaysMs[attempt])
      }
    }
  }
  throw lastError
}

const withPublicCacheFallback = async <T>(request: () => Promise<T>, readCached: () => Promise<T | null>): Promise<T> => {
  try {
    return await withRetry(request)
  } catch (error) {
    const cached = await readCached()
    if (cached !== null && cached !== undefined && (!Array.isArray(cached) || cached.length > 0)) {
      return cached as T
    }
    throw error
  }
}

export const useHomeData = () => {
  const [sermons, setSermons] = useState<SermonDto[]>([])
  const [sermonsLoading, setSermonsLoading] = useState(true)
  const { data: publicPages = [] } = useQuery<PageSummaryDto[]>({
    queryKey: publicPagesQueryKey(),
    queryFn: () => withPublicCacheFallback(() => pageService.getPublicPages(), getCachedPublicPages),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const result = await withPublicCacheFallback(
          () => sermonService.getLatest(3),
          () => sermonService.getCachedLatest(3),
        )
        if (!cancelled) setSermons(result)
      } finally {
        if (!cancelled) setSermonsLoading(false)
      }
    }

    load().catch((err) => console.error('[useHomeData] load failed:', err))
    return () => { cancelled = true }
  }, [])

  const recentSermons = useMemo(
    () => [...sermons]
      .sort((left, right) => {
        const leftDate = left.preachedAt ? new Date(left.preachedAt).getTime() : 0
        const rightDate = right.preachedAt ? new Date(right.preachedAt).getTime() : 0
        return rightDate - leftDate
      })
      .slice(0, 3),
    [sermons],
  )

  return { publicPages, recentSermons, sermonsLoading }
}
