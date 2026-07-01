import { useEffect, useState } from 'react'
import { ExternalLink, PlayCircle } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { entranceAnimation, getServiceCountdown, media, youtubeLiveUrl, youtubeVideosUrl } from './homeUtils'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
}

const AboutAndLiveSection = ({ copy }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const [countdown, setCountdown] = useState(() => getServiceCountdown())

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown(getServiceCountdown()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section id="about" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.36fr_0.64fr]">
        <motion.div {...entrance}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-accent">{copy.nav.about}</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{copy.contemplationTitle}</h2>
          <p className="mt-4 max-w-[50ch] text-[0.94rem] leading-7 text-home-muted">{copy.contemplationBody}</p>
          <div className="mt-6 grid gap-2.5">
            {[copy.contemplationOne, copy.contemplationTwo, copy.contemplationThree].map((item, index) => (
              <article key={item} className="flex gap-3 rounded-xl border border-home-border/60 bg-white/60 p-3.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-home-green text-xs font-semibold text-white">{index + 1}</span>
                <p className="text-sm leading-6 text-home-muted">{item}</p>
              </article>
            ))}
          </div>
        </motion.div>

        <motion.div {...entrance} id="live" className="grid gap-5">
          <article className="overflow-hidden rounded-2xl border border-home-border bg-home-dark text-white shadow-[0_16px_48px_rgba(30,18,10,0.18)]">
            <div className="grid lg:grid-cols-[0.58fr_0.42fr]">
              <a className="group relative min-h-[18rem] overflow-hidden bg-black" href={countdown.isLive ? youtubeLiveUrl : youtubeVideosUrl} target="_blank" rel="noreferrer">
                <img src={media.message} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-home-dark/84 via-home-dark/18 to-transparent" />
                <span className="absolute left-5 top-5 rounded-lg bg-home-gold px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-home-gold-text">
                  {countdown.isLive ? copy.liveNowLabel : copy.liveEyebrow}
                </span>
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/90 text-home-dark shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition group-hover:scale-105">
                    <PlayCircle className="h-9 w-9" />
                  </span>
                </span>
                <span className="absolute inset-x-5 bottom-5 text-sm font-bold leading-6 text-white/82">
                  {countdown.isLive ? copy.liveOpen : copy.liveUnavailable}
                </span>
              </a>
              <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-home-gold">{copy.liveEyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold leading-tight">{copy.liveTitle}</h3>
                  <p className="mt-4 text-sm font-semibold leading-7 text-white/72">{copy.liveBody}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-home-gold">
                    {countdown.isLive ? copy.liveNowLabel : copy.liveCountdownLabel}
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: copy.liveCountdownDayShort, value: countdown.days },
                      { label: copy.liveCountdownHourShort, value: countdown.hours },
                      { label: copy.liveCountdownMinuteShort, value: countdown.minutes },
                      { label: copy.liveCountdownSecondShort, value: countdown.seconds },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-white/[0.06] px-2 py-3">
                        <span className="block text-2xl font-bold tabular-nums">{String(item.value).padStart(2, '0')}</span>
                        <span className="mt-1 block text-[0.68rem] font-medium uppercase tracking-wide text-white/40">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/40">{copy.liveChannelLabel}</p>
                  <p className="mt-2 text-sm font-semibold text-white">@ChineseAbundantLifeChurch</p>
                  <p className="mt-3 text-xs font-semibold leading-5 text-white/52">{copy.liveUnavailable}</p>
                  <a className="mt-5 inline-flex items-center gap-2 rounded-lg bg-home-gold px-4 py-2.5 text-sm font-semibold text-home-gold-text transition hover:-translate-y-0.5" href={countdown.isLive ? youtubeLiveUrl : youtubeVideosUrl} target="_blank" rel="noreferrer">
                    {countdown.isLive ? copy.liveOpen : copy.liveWatchLatestVideos} <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        </motion.div>
      </div>
    </section>
  )
}

export default AboutAndLiveSection
