import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from '@tanstack/react-db'
import { getCachedSermons, sermonsCollection, sermonsQueryKey } from '../../db/collections/sermonsCollection'
import SermonCardSkeleton from './SermonCardSkeleton'
import { useImagePreloader } from '../../hooks/useImagePreloader'
import CoverImage from '../CoverImage'
import { useUiText } from '../../i18n/uiText'

const SermonList = () => {
  const t = useUiText()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useLiveQuery(sermonsCollection)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cachedSermons, setCachedSermons] = useState<Awaited<ReturnType<typeof getCachedSermons>>>([])
  const { preloadImages } = useImagePreloader()
  const initialLoadDone = useRef(false)

  useEffect(() => {
    let cancelled = false
    getCachedSermons().then((cached) => {
      if (!cancelled) {
        setCachedSermons(cached)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const sermons = useMemo(() => {
    if (data && data.length > 0) {
      return data
    }
    return cachedSermons
  }, [cachedSermons, data])

  // Preload first 4 sermon images after initial data load
  useEffect(() => {
    if (sermons.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true
      const imageUrls = sermons.slice(0, 4).map((s) => s.thumbnailUrl)
      preloadImages(imageUrls).catch(() => undefined)
    }
  }, [sermons, preloadImages])

  const loadSermons = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: sermonsQueryKey })
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient])

  const errorMessage = isError ? t('sermonsLoadFailed') : ''
  const initialLoading = isLoading && sermons.length === 0

  if (initialLoading) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SermonCardSkeleton key={index} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('latestSermons')}</h1>
          <p className="text-sm text-slate-600">{t('latestSermonsDescription')}</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRefreshing || isLoading}
          onClick={() => {
            loadSermons().catch(() => undefined)
          }}
        >
          {isRefreshing ? t('refreshing') : t('refresh')}
        </button>
      </header>

      {errorMessage && sermons.length === 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {!errorMessage && sermons.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{t('noSermons')}</p>
      ) : null}

      {errorMessage && sermons.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{errorMessage}</p>
      ) : null}

      {sermons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sermons.map((sermon, index) => (
            <article
              key={sermon.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <figure className="relative">
                {sermon.thumbnailUrl ? (
                  <CoverImage
                    src={sermon.thumbnailUrl}
                    alt={sermon.title}
                    index={index}
                    aspectRatio={16 / 9}
                    className="h-44 w-full"
                    fixedHeight
                  />
                ) : (
                  <div className="h-44 w-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                )}
              </figure>

              <div className="space-y-2 p-4">
                <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{sermon.title}</h2>
                <p className="text-sm text-slate-600">{sermon.speakerName || t('guestSpeaker')}</p>

                {sermon.videoUrl ? (
                  <a
                    href={sermon.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-600"
                  >
                    {t('watchSermon')}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default SermonList
