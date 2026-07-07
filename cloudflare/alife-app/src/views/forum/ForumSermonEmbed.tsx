import { CalendarDays, MessageCircle, MicVocal, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import type { ForumSermonDto } from '../../types/forum'
import { buildSermonVideoPath, extractYouTubeVideoId, toYouTubeEmbedUrl } from '../../utils/youtube'

const formatSermonDate = (value: string | null | undefined) => {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

type Props = {
  sermon: ForumSermonDto
  mode?: 'compact' | 'detail'
}

const ForumSermonEmbed = ({ sermon, mode = 'detail' }: Props) => {
  const { language } = useAuthStore()
  const label = language === 'zh' ? '讲道' : 'Sermon'
  const sourceLabel = language === 'zh' ? '讲道讨论帖' : 'Sermon discussion'
  const watchLabel = language === 'zh' ? '打开讲道页面' : 'Open sermon page'
  const videoId = extractYouTubeVideoId(sermon.videoUrl)
  const embedUrl = toYouTubeEmbedUrl(videoId)
  const sermonPath = buildSermonVideoPath(sermon.id, videoId)
  const meta = [sermon.speakerName, formatSermonDate(sermon.preachedAt)].filter(Boolean).join(' · ')

  if (mode === 'compact') {
    return (
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#176b5a]/15 bg-[#f6fbf8]">
        <div className="grid gap-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="group relative block aspect-video overflow-hidden bg-slate-200 sm:aspect-auto sm:min-h-28">
            {sermon.thumbnailUrl ? (
              <img src={sermon.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white">
                <PlayCircle className="h-9 w-9" aria-hidden="true" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/10 text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#176b5a] shadow-sm backdrop-blur">
                <PlayCircle className="h-5 w-5" aria-hidden="true" />
              </span>
            </span>
            <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur">
              {label}
            </span>
          </div>
          <div className="min-w-0 p-3.5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#176b5a] ring-1 ring-[#176b5a]/10">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {sourceLabel}
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-slate-950">{sermon.title}</p>
            {meta ? <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-500">{meta}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#176b5a]/15 bg-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <p className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">
          <PlayCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{sourceLabel}</span>
        </p>
        <Link
          to={sermonPath}
          onClick={() => activeEntityService.setSermon(sermon.id)}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#176b5a] transition hover:bg-[#e3f0eb]"
        >
          {watchLabel}
        </Link>
      </div>

      {embedUrl ? (
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={embedUrl}
            title={sermon.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : sermon.thumbnailUrl ? (
        <Link
          to={sermonPath}
          onClick={() => activeEntityService.setSermon(sermon.id)}
          className="group relative block aspect-video overflow-hidden"
        >
          <img src={sermon.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03]" />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-white">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#176b5a] shadow-sm backdrop-blur">
              <PlayCircle className="h-7 w-7" aria-hidden="true" />
            </span>
          </span>
        </Link>
      ) : null}

      <div className="bg-white p-4 sm:p-5">
        <Link
          to={sermonPath}
          onClick={() => activeEntityService.setSermon(sermon.id)}
          className="group block"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f0eb] px-3 py-1 text-xs font-black text-[#176b5a]">
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </p>
          <h2 className="mt-3 text-xl font-black leading-tight text-slate-950 transition group-hover:text-[#176b5a]">{sermon.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-500">
            {sermon.speakerName ? (
              <span className="inline-flex items-center gap-1.5">
                <MicVocal className="h-4 w-4 text-[#176b5a]" aria-hidden="true" />
                {sermon.speakerName}
              </span>
            ) : null}
            {sermon.preachedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[#176b5a]" aria-hidden="true" />
                {formatSermonDate(sermon.preachedAt)}
              </span>
            ) : null}
          </div>
        </Link>
      </div>
    </section>
  )
}

export default ForumSermonEmbed
