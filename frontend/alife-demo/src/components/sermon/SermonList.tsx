import { useEffect, useState } from 'react'
import { normalizeApiError } from '../../api/http'
import { sermonService, type SermonDto } from '../../services/sermonService'
import SermonCardSkeleton from './SermonCardSkeleton'

const SermonList = () => {
  const [sermons, setSermons] = useState<SermonDto[]>([])
  const [initialLoading, setInitialLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadSermons = async ({ initial = false }: { initial?: boolean } = {}) => {
    if (initial) {
      setInitialLoading(true)
    } else {
      setIsRefreshing(true)
    }

    setError('')

    try {
      setSermons(await sermonService.getLatest())
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      if (initial) {
        setInitialLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  useEffect(() => {
    loadSermons({ initial: true }).catch(() => undefined)
  }, [])

  if (initialLoading && sermons.length === 0) {
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
          disabled={isRefreshing || initialLoading}
          onClick={() => {
            loadSermons().catch(() => undefined)
          }}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error && sermons.length === 0 ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {!error && sermons.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">No sermons available right now.</p>
      ) : null}

      {error && sermons.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{error}</p>
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