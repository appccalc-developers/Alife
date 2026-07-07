import { useEffect, useMemo, useState, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, MicVocal, PlayCircle, RefreshCw, Video } from 'lucide-react'
import { getCachedSermons } from '../../db/collections/sermonsCollection'
import SermonCardSkeleton from './SermonCardSkeleton'
import { useImagePreloader } from '../../hooks/useImagePreloader'
import CoverImage from '../CoverImage'
import { useUiText } from '../../i18n/uiText'
import { activeEntityService } from '../../services/activeEntityService'
import { sermonService, type SermonDto } from '../../services/sermonService'
import { buildSermonVideoPath, extractYouTubeVideoId } from '../../utils/youtube'

const formatSermonDate = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

const getSermonTime = (sermon: SermonDto) => sermon.preachedAt ? new Date(sermon.preachedAt).getTime() : 0
const pageSize = 12

const SermonList = () => {
  const t = useUiText()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cachedSermons, setCachedSermons] = useState<Awaited<ReturnType<typeof getCachedSermons>>>([])
  const { preloadImages } = useImagePreloader()
  const initialLoadDone = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const sermonsQuery = useInfiniteQuery({
    queryKey: ['sermons', 'paged', pageSize],
    queryFn: ({ pageParam }) => sermonService.list({ page: pageParam, pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60_000,
  })

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
    const loaded = sermonsQuery.data?.pages.flatMap((page) => Array.isArray(page.items) ? page.items : []) ?? []
    const source = loaded.length > 0 ? loaded : cachedSermons
    return [...source].sort((left, right) => getSermonTime(right) - getSermonTime(left))
  }, [cachedSermons, sermonsQuery.data])

  // Preload first 4 sermon images after initial data load
  useEffect(() => {
    if (sermons.length > 0 && !initialLoadDone.current) {
      initialLoadDone.current = true
      const imageUrls = sermons.slice(0, 4).map((s) => s.thumbnailUrl)
      preloadImages(imageUrls).catch(() => undefined)
    }
  }, [sermons, preloadImages])

  const loadSermons = async () => {
    setIsRefreshing(true)
    try {
      await sermonsQuery.refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  const errorMessage = sermonsQuery.isError ? t('sermonsLoadFailed') : ''
  const initialLoading = sermonsQuery.isLoading && sermons.length === 0
  const hasNextPage = sermonsQuery.hasNextPage ?? false
  const totalCount = sermonsQuery.data?.pages[0]?.totalCount ?? sermons.length
  const fetchNextPage = sermonsQuery.fetchNextPage
  const isFetchingNextPage = sermonsQuery.isFetchingNextPage
  const featuredSermon = sermons[0]
  const remainingSermons = sermons.slice(1)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          fetchNextPage().catch(() => undefined)
        }
      },
      { rootMargin: '360px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const renderSermonImage = (sermon: SermonDto, index: number, className: string) => (
    sermon.thumbnailUrl ? (
      <CoverImage
        src={sermon.thumbnailUrl}
        alt={sermon.title}
        index={index}
        aspectRatio={16 / 9}
        className={className}
        fixedHeight
      />
    ) : (
      <div className={`${className} flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 text-emerald-700`}>
        <Video className="h-12 w-12" strokeWidth={1.5} />
      </div>
    )
  )

  const renderMeta = (sermon: SermonDto, compact = false) => (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? 'text-xs' : 'text-sm'} text-slate-600`}>
      <span className="inline-flex items-center gap-1.5">
        <MicVocal className="h-3.5 w-3.5 text-emerald-700" />
        {sermon.speakerName || t('guestSpeaker')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
        {formatSermonDate(sermon.preachedAt, t('noDate'))}
      </span>
    </div>
  )

  if (initialLoading) {
    return (
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
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
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-emerald-100 bg-white/85 p-5 shadow-[0_18px_45px_rgba(31,56,48,0.08)] sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-800">{t('sermons')}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{t('latestSermons')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('latestSermonsDescription')}</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRefreshing || sermonsQuery.isLoading || sermonsQuery.isFetching}
          onClick={() => {
            loadSermons().catch(() => undefined)
          }}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? t('refreshing') : t('refresh')}
        </button>
      </header>

      {errorMessage && sermons.length === 0 ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{errorMessage}</p>
      ) : null}

      {!errorMessage && sermons.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600">{t('noSermons')}</p>
      ) : null}

      {errorMessage && sermons.length > 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">{errorMessage}</p>
      ) : null}

      {featuredSermon ? (
        <Link
          to={buildSermonVideoPath(featuredSermon.id, extractYouTubeVideoId(featuredSermon.videoUrl))}
          onClick={() => activeEntityService.setSermon(featuredSermon.id)}
          className="group grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-100 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]"
        >
          <figure className="relative overflow-hidden bg-slate-100">
            {renderSermonImage(featuredSermon, 0, 'h-64 w-full sm:h-80 lg:h-full')}
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-black text-white backdrop-blur">
              <PlayCircle className="h-3.5 w-3.5" />
              {t('watchSermon')}
            </span>
          </figure>
          <div className="flex flex-col justify-center p-5 sm:p-7">
            {renderMeta(featuredSermon)}
            <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{featuredSermon.title}</h2>
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition group-hover:bg-emerald-800">
              <PlayCircle className="h-4 w-4" />
              {t('watchSermon')}
            </span>
          </div>
        </Link>
      ) : null}

      {remainingSermons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {remainingSermons.map((sermon, index) => {
            const sermonPath = buildSermonVideoPath(sermon.id, extractYouTubeVideoId(sermon.videoUrl))
            const imageIndex = index + 1

            return (
              <Link
                key={sermon.id}
                to={sermonPath}
                onClick={() => activeEntityService.setSermon(sermon.id)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <figure className="relative overflow-hidden">
                  {renderSermonImage(sermon, imageIndex, 'h-44 w-full transition duration-300 group-hover:scale-[1.03]')}
                  <span className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-emerald-800 shadow-sm backdrop-blur">
                    <PlayCircle className="h-5 w-5" />
                  </span>
                </figure>

                <div className="space-y-3 p-4">
                  <h2 className="line-clamp-2 min-h-[3rem] text-base font-black leading-6 text-slate-950">{sermon.title}</h2>
                  {renderMeta(sermon, true)}
                </div>
              </Link>
            )
          })}
        </div>
      ) : null}

      {hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center pt-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isFetchingNextPage}
            onClick={() => {
              fetchNextPage().catch(() => undefined)
            }}
          >
            {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </button>
        </div>
      ) : sermons.length > 0 ? (
        <p className="text-center text-xs font-bold text-slate-400">
          {t('showingAllSermons', { count: totalCount })}
        </p>
      ) : null}
    </section>
  )
}

export default SermonList
