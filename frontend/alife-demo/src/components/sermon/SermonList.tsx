import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from '@tanstack/react-db'
import { getCachedSermons, sermonsCollection, sermonsQueryKey } from '../../db/collections/sermonsCollection'
import SermonCardSkeleton from './SermonCardSkeleton'

const SermonList = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useLiveQuery(sermonsCollection)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cachedSermons, setCachedSermons] = useState<Awaited<ReturnType<typeof getCachedSermons>>>([])

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

  const loadSermons = async () => {
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: sermonsQueryKey })
    } finally {
      setIsRefreshing(false)
    }
  }

  const errorMessage = isError ? 'Failed to load sermons.' : ''
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
          <h1 className="text-2xl font-bold text-slate-900">Latest Sermons</h1>
          <p className="text-sm text-slate-600">Watch the latest messages from the Alife channel.</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRefreshing || isLoading}
          onClick={() => {
            loadSermons().catch(() => undefined)
          }}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {errorMessage && sermons.length === 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}

      {!errorMessage && sermons.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">No sermons available right now.</p>
      ) : null}

      {errorMessage && sermons.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{errorMessage}</p>
      ) : null}

      {sermons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sermons.map((sermon) => (
            <article key={sermon.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {sermon.thumbnailUrl ? (
                <img src={sermon.thumbnailUrl} alt={sermon.title} className="h-44 w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-44 w-full bg-slate-100" />
              )}

              <div className="space-y-2 p-4">
                <h2 className="line-clamp-2 text-base font-semibold text-slate-900">{sermon.title}</h2>
                <p className="text-sm text-slate-600">{sermon.speakerName || 'Guest Speaker'}</p>

                {sermon.videoUrl ? (
                  <a
                    href={sermon.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-600"
                  >
                    Watch sermon
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