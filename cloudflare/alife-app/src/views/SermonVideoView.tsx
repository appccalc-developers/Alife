import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { getCachedSermons, sermonsCollection } from '../db/collections/sermonsCollection'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from '../utils/youtube'

const SermonVideoView = () => {
  const t = useUiText()
  const { sermonId: routeSermonId } = useParams<{ sermonId: string }>()
  const { sermonId: activeSermonId } = useActiveEntityIds({ sermonId: routeSermonId })
  const [searchParams] = useSearchParams()
  const { data, isLoading, isError } = useLiveQuery(sermonsCollection)
  const [cachedSermons, setCachedSermons] = useState<Awaited<ReturnType<typeof getCachedSermons>>>([])
  const requestedVideoId = searchParams.get('videoId')?.trim() ?? ''
  const sermonId = routeSermonId || (requestedVideoId ? '' : activeSermonId)

  useEffect(() => {
    let cancelled = false

    getCachedSermons().then((items) => {
      if (!cancelled) {
        setCachedSermons(items)
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

  const sermon = useMemo(() => {
    if (sermonId) {
      return sermons.find((item) => item.id === sermonId) ?? null
    }

    if (requestedVideoId) {
      return sermons.find((item) => extractYouTubeVideoId(item.videoUrl) === requestedVideoId) ?? null
    }

    return null
  }, [requestedVideoId, sermonId, sermons])

  const videoId = requestedVideoId || extractYouTubeVideoId(sermon?.videoUrl)
  const embedUrl = toYouTubeEmbedUrl(videoId)
  const pageTitle = sermon?.title || t('watchSermon')

  if (!sermonId && !requestedVideoId) {
    return <Navigate to="/sermons" replace />
  }

  if (!embedUrl && isLoading && sermons.length === 0) {
    return (
      <AppPageShell>
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">{t('loadingPage')}</p>
        </AppSectionCard>
      </AppPageShell>
    )
  }

  if (!embedUrl && isError && sermons.length === 0) {
    return (
      <AppPageShell>
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{t('sermonsLoadFailed')}</p>
        </AppSectionCard>
      </AppPageShell>
    )
  }

  if (!sermon && !embedUrl) {
    return (
      <AppPageShell>
        <AppEmptyState title={t('sermonNotFound')} description={t('sermonNotFoundDescription')} />
      </AppPageShell>
    )
  }

  return (
    <AppPageShell>
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t('watchSermon')}</p>
          <h1 className="text-3xl font-bold text-slate-950">{pageTitle}</h1>
          {sermon ? <p className="text-sm text-slate-600">{sermon.speakerName || t('guestSpeaker')}</p> : null}
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          {embedUrl ? (
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={pageTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-slate-200">
              {t('noYoutubeVideoLinked')}
            </div>
          )}
        </section>

        {sermon ? (
          <AppSectionCard dense title={t('details')}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('speaker')}</dt>
                <dd className="mt-1 text-sm text-slate-900">{sermon.speakerName || t('guestSpeaker')}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('date')}</dt>
                <dd className="mt-1 text-sm text-slate-900">{sermon.preachedAt ? new Date(sermon.preachedAt).toLocaleDateString() : t('noDate')}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('referenceId')}</dt>
                <dd className="mt-1 break-all text-sm text-slate-900">{sermon.id}</dd>
              </div>
            </dl>
          </AppSectionCard>
        ) : null}
      </section>
    </AppPageShell>
  )
}

export default SermonVideoView
