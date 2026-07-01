import { ArrowRight, MicVocal, PlayCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { activeEntityService } from '../../services/activeEntityService'
import type { SermonDto } from '../../services/sermonService'
import { buildSermonVideoPath, extractYouTubeVideoId } from '../../utils/youtube'
import { entranceAnimation, media } from './homeUtils'
import type { HomeCopy, Language } from './homeCopy'
import GuardedLink from './LoginPromptOverlay'

type Props = {
  copy: HomeCopy
  language: Language
  sermons: SermonDto[]
}

const formatDate = (value: string | null | undefined, language: Language) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const RecentSermonsSection = ({ copy, language, sermons }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const featured = sermons[0]
  const rest = sermons.slice(1, 3)

  return (
    <section id="sermons" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{copy.recentSermonsEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.sermonsTitle}</h2>
            <p className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted">{copy.sermonsBody}</p>
          </div>
          <GuardedLink language={language} to="/sermons" className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
            {copy.sermonsAction} <ArrowRight className="h-3.5 w-3.5" />
          </GuardedLink>
        </motion.div>

        {featured ? (
          <motion.div {...entrance} className="mt-10 grid overflow-hidden rounded-2xl bg-home-dark text-white shadow-[0_24px_70px_rgba(34,25,17,0.18)] lg:grid-cols-[1.15fr_0.85fr]">
            <GuardedLink
              language={language}
              to={buildSermonVideoPath(featured.id, extractYouTubeVideoId(featured.videoUrl))}
              onBeforeNavigate={() => activeEntityService.setSermon(featured.id)}
              className="group relative block min-h-[19rem] overflow-hidden"
            >
              <img src={featured.thumbnailUrl || media.message} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-90" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-home-dark/90 via-home-dark/20 to-transparent" />
              <div className="absolute left-6 top-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-home-green shadow-lg">
                <PlayCircle className="h-6 w-6" />
              </div>
            </GuardedLink>

            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-home-gold">{copy.recentSermonsLatestBadge}</p>
                <h3 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{featured.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  {[featured.speakerName, formatDate(featured.preachedAt, language)].filter(Boolean).join(' · ') || copy.recentSermonsFallbackMeta}
                </p>
              </div>

              {rest.length > 0 ? (
                <div className="mt-8 grid gap-3">
                  {rest.map((sermon) => (
                    <GuardedLink
                      key={sermon.id}
                      language={language}
                      to={buildSermonVideoPath(sermon.id, extractYouTubeVideoId(sermon.videoUrl))}
                      onBeforeNavigate={() => activeEntityService.setSermon(sermon.id)}
                      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.08]"
                    >
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10">
                        <img src={sermon.thumbnailUrl || media.message} alt="" className="h-full w-full object-cover opacity-85 transition group-hover:scale-[1.04]" loading="lazy" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-white">{sermon.title}</p>
                        <p className="mt-1 text-xs text-white/50">{formatDate(sermon.preachedAt, language) || sermon.speakerName || copy.recentSermonsItemFallback}</p>
                      </div>
                    </GuardedLink>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : (
          <motion.div {...entrance} className="mt-10 rounded-2xl border border-home-border/60 bg-white/70 p-8">
            <MicVocal className="h-7 w-7 text-home-green" />
            <p className="mt-4 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">
              {copy.recentSermonsEmpty}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default RecentSermonsSection
