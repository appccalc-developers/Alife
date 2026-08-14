import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { activeEntityService } from '../../services/activeEntityService'
import { entranceAnimation, media } from './homeUtils'
import GuardedLink from './LoginPromptOverlay'
import type { HomeCopy, Language } from './homeCopy'
import type { GroupEventRecord } from '../../types/event'

type Props = {
  copy: HomeCopy
  language: Language
  upcomingEvents: GroupEventRecord[]
  loading?: boolean
}

type EventDetails = {
  description: string
  location: string
  posterImageUrl: string
  galleryUrls: string[]
}

const AUTO_INTERVAL = 5600
const fallbackImages = [media.visit, media.groups, media.message, media.hero]

const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.onerror = null
  event.currentTarget.src = fallbackImages[0]
}

const canShowPreviewEvents = () => {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

const parseLocalizedField = (value: unknown, language: Language) => {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''

  const source = value as Record<string, unknown>
  const preferred = language === 'zh' ? source.zh : source.en
  const fallback = language === 'zh' ? source.en : source.zh

  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
  return typeof fallback === 'string' ? fallback.trim() : ''
}

const readEventDetails = (event: GroupEventRecord, language: Language): EventDetails => {
  try {
    const data = JSON.parse(event.eventDataJson || '{}') as Record<string, unknown>
    const galleryUrls = Array.isArray(data.galleryUrls)
      ? data.galleryUrls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []

    return {
      description: parseLocalizedField(data.description, language),
      location: parseLocalizedField(data.locationName, language),
      posterImageUrl: typeof data.posterImageUrl === 'string' ? data.posterImageUrl.trim() : '',
      galleryUrls,
    }
  } catch {
    return { description: '', location: '', posterImageUrl: '', galleryUrls: [] }
  }
}

const formatEventDay = (value: string, language: Language) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', { day: 'numeric' }).format(date)
}

const formatEventMonth = (value: string, language: Language) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', { month: 'short' }).format(date)
}

const formatEventTime = (value: string, language: Language) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const readEventTitle = (event: GroupEventRecord, language: Language) =>
  (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh

const getEventImage = (event: GroupEventRecord, language: Language, index: number) => {
  const details = readEventDetails(event, language)
  return details.posterImageUrl || details.galleryUrls[0] || fallbackImages[index % fallbackImages.length]
}

const buildPreviewEvents = (): GroupEventRecord[] => {
  const first = new Date()
  first.setDate(first.getDate() + 9)
  first.setHours(14, 30, 0, 0)

  const second = new Date()
  second.setDate(second.getDate() + 18)
  second.setHours(10, 0, 0, 0)

  const third = new Date()
  third.setDate(third.getDate() + 26)
  third.setHours(18, 30, 0, 0)

  const fourth = new Date()
  fourth.setDate(fourth.getDate() + 34)
  fourth.setHours(19, 15, 0, 0)

  const now = new Date().toISOString()

  return [
    {
      id: 'preview-family-picnic',
      groupId: 'preview-church',
      createdByMemberId: 'preview',
      titleEn: 'Family Picnic & Prayer Walk',
      titleZh: '家庭野餐与祷告同行',
      startDate: first.toISOString(),
      endDate: new Date(first.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      eventDataJson: JSON.stringify({
        description: {
          en: 'A relaxed afternoon for families, newcomers, and small groups to share food and pray for the city.',
          zh: '给家庭、新朋友和小组预备的轻松下午，一起分享食物，也为城市祷告。',
        },
        locationName: { en: 'Church lawn and nearby walk', zh: '教会草地与附近步道' },
      }),
      createdUtc: now,
      updatedUtc: now,
    },
    {
      id: 'preview-new-friends-lunch',
      groupId: 'preview-church',
      createdByMemberId: 'preview',
      titleEn: 'New Friends Lunch',
      titleZh: '新朋友午餐',
      startDate: second.toISOString(),
      endDate: new Date(second.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      eventDataJson: JSON.stringify({
        description: {
          en: 'A simple table after worship for visitors to meet leaders, ask questions, and feel at home.',
          zh: '主日后为新朋友预备的餐桌，可以认识同工、提问，也自然地融入教会。',
        },
        locationName: { en: 'Fellowship hall', zh: '团契厅' },
      }),
      createdUtc: now,
      updatedUtc: now,
    },
    {
      id: 'preview-worship-night',
      groupId: 'preview-church',
      createdByMemberId: 'preview',
      titleEn: 'Worship & Testimony Night',
      titleZh: '敬拜与见证之夜',
      startDate: third.toISOString(),
      endDate: new Date(third.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      eventDataJson: JSON.stringify({
        description: {
          en: 'An evening of songs, stories, and prayer across generations.',
          zh: '一个跨世代一起敬拜、分享见证和祷告的晚上。',
        },
        locationName: { en: 'Main sanctuary', zh: '主堂' },
      }),
      createdUtc: now,
      updatedUtc: now,
    },
    {
      id: 'preview-evening-table',
      groupId: 'preview-church',
      createdByMemberId: 'preview',
      titleEn: 'Evening Table Gathering',
      titleZh: '晚间餐桌相聚',
      startDate: fourth.toISOString(),
      endDate: new Date(fourth.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      eventDataJson: JSON.stringify({
        description: {
          en: 'A smaller evening gathering with dinner, conversation, and prayer for people exploring community.',
          zh: '较小型的晚间聚会，有晚餐、交流和祷告，适合正在认识社区的人。',
        },
        locationName: { en: 'Community room', zh: '社区活动室' },
      }),
      createdUtc: now,
      updatedUtc: now,
    },
  ]
}

const EventsSection = ({ copy, language, upcomingEvents, loading = false }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const events = useMemo(() => {
    if (!canShowPreviewEvents()) return upcomingEvents
    const previewEvents = buildPreviewEvents().filter(
      (preview) => !upcomingEvents.some((event) => event.id === preview.id),
    )
    return [...upcomingEvents, ...previewEvents].slice(0, 4)
  }, [upcomingEvents])
  const displayEvents = useMemo(() => events.slice(0, 4), [events])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeEvent = displayEvents[activeIndex]
  const activeDetails = activeEvent ? readEventDetails(activeEvent, language) : null
  const activeImage = activeEvent ? getEventImage(activeEvent, language, activeIndex) : fallbackImages[0]

  const goTo = useCallback((nextIndex: number) => {
    if (displayEvents.length === 0) return
    setActiveIndex(((nextIndex % displayEvents.length) + displayEvents.length) % displayEvents.length)
  }, [displayEvents.length])

  const previousIndex = displayEvents.length > 1
    ? (activeIndex - 1 + displayEvents.length) % displayEvents.length
    : 0
  const nextIndex = displayEvents.length > 1
    ? (activeIndex + 1) % displayEvents.length
    : 0
  const previousEvent = displayEvents[previousIndex]
  const nextEvent = displayEvents[nextIndex]
  const hasMultipleEvents = displayEvents.length > 1

  useEffect(() => {
    setActiveIndex((current) => displayEvents.length === 0 ? 0 : Math.min(current, displayEvents.length - 1))
  }, [displayEvents.length])

  useEffect(() => {
    if (displayEvents.length <= 1 || prefersReducedMotion) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % displayEvents.length)
    }, AUTO_INTERVAL)
    return () => window.clearInterval(timer)
  }, [displayEvents.length, prefersReducedMotion])

  const renderEventEcho = (side: 'previous' | 'next') => (
    <motion.div
      aria-hidden="true"
      className="relative min-h-[36rem] w-full overflow-hidden rounded-[1.5rem] border border-white/70 bg-home-green shadow-[0_22px_70px_rgba(34,25,17,0.1)]"
      initial={prefersReducedMotion ? false : { opacity: 0, x: side === 'previous' ? -22 : 22, scale: 0.9 }}
      animate={{ opacity: 0.3, x: 0, scale: 0.92 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <img src={activeImage} alt="" className="absolute inset-0 h-full w-full object-cover blur-[1px]" loading="lazy" onError={handleImageError} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,63,55,0.08),rgba(23,63,55,0.78))]" />
      <div className="absolute inset-x-6 bottom-6 h-24 rounded-[1.2rem] bg-white/10 backdrop-blur-sm" />
    </motion.div>
  )

  const renderSideCard = (event: GroupEventRecord | undefined, index: number, side: 'previous' | 'next') => {
    if (!event) return null
    const details = readEventDetails(event, language)
    const image = getEventImage(event, language, index)
    const Icon = side === 'previous' ? ChevronLeft : ChevronRight

    return (
      <motion.button
        type="button"
        onClick={() => goTo(index)}
        className="group relative hidden min-h-[36rem] w-full overflow-hidden rounded-[1.5rem] border border-white bg-home-green text-left shadow-[0_22px_70px_rgba(34,25,17,0.13)] transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-home-green/35 lg:block"
        initial={prefersReducedMotion ? false : { opacity: 0, x: side === 'previous' ? -28 : 28, scale: 0.94 }}
        animate={{ opacity: 0.58, x: 0, scale: 0.92 }}
        whileHover={prefersReducedMotion ? {} : { opacity: 0.86, scale: 0.95 }}
        transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        aria-label={`${side === 'previous' ? 'Previous' : 'Next'} ${readEventTitle(event, language)}`}
      >
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" onError={handleImageError} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,63,55,0.12),rgba(23,63,55,0.82))]" />
        <div className="absolute inset-x-4 bottom-4 text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/16 text-home-gold backdrop-blur">
            <Icon className="h-5 w-5" />
          </span>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-home-gold">
            {formatEventMonth(event.startDate, language)} {formatEventDay(event.startDate, language)}
          </p>
          <p className="mt-2 line-clamp-2 text-xl font-black leading-tight">
            {readEventTitle(event, language)}
          </p>
          <p className="mt-2 truncate text-sm text-white/72">
            {details.location || copy.eventsLocationFallback}
          </p>
        </div>
      </motion.button>
    )
  }

  return (
    <section id="events" className="relative overflow-hidden bg-[#f6efe3] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(47,111,98,0.18),transparent_28%),radial-gradient(circle_at_84%_28%,rgba(245,215,152,0.45),transparent_24%)]" />
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-7 text-left sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[46rem]">
            <p className="text-left text-sm font-semibold uppercase tracking-[0.22em] text-home-green">
              {copy.eventsEyebrow}
            </p>
            <h2 className="mt-4 max-w-[11ch] text-left text-4xl font-black leading-[0.96] text-home-gold-text sm:text-5xl lg:text-6xl">
              {copy.eventsTitle}
            </h2>
            <p className="mt-5 max-w-[42rem] text-left text-base leading-8 text-home-muted">
              {copy.eventsLead}
            </p>
          </div>

          <GuardedLink language={language} to="/events" className="inline-flex min-h-12 w-fit shrink-0 items-center justify-center gap-2 self-start rounded-full bg-home-gold px-5 text-sm font-black text-[#173f37] shadow-[0_16px_42px_rgba(245,215,152,0.32)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_20px_54px_rgba(47,111,98,0.16)] focus:outline-none focus:ring-2 focus:ring-home-green/[0.35] sm:self-end">
            {copy.eventsViewAll}
            <ArrowRight className="h-4 w-4" />
          </GuardedLink>
        </motion.div>

        {loading ? (
          <div className="mt-12 animate-pulse rounded-[2rem] border border-home-border/60 bg-white/70 p-6 shadow-[0_18px_52px_rgba(34,25,17,0.06)]">
            <div className="h-64 rounded-[1.5rem] bg-home-green/10" />
            <div className="mt-6 h-5 w-28 rounded-full bg-home-green/10" />
            <div className="mt-4 h-9 w-2/3 rounded-lg bg-home-green/10" />
            <div className="mt-4 h-4 w-full rounded bg-home-green/10" />
          </div>
        ) : activeEvent && activeDetails ? (
          <motion.div {...entrance} className="relative left-1/2 right-1/2 mt-12 -ml-[50vw] -mr-[50vw] w-screen">
            <div className="relative mx-auto min-h-[42rem] w-full overflow-hidden lg:min-h-[44rem]">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-[linear-gradient(90deg,#f6efe3,rgba(246,239,227,0))]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-24 bg-[linear-gradient(270deg,#f6efe3,rgba(246,239,227,0))]" />

              <div className="relative mx-auto h-[42rem] w-[min(100vw,88rem)] lg:h-[44rem]">
                <div
                  className="absolute left-1/2 top-10 hidden w-[30rem] lg:block xl:w-[32rem]"
                  style={{ transform: 'translateX(calc(-50% - 26rem))' }}
                >
                  {hasMultipleEvents ? renderSideCard(previousEvent, previousIndex, 'previous') : renderEventEcho('previous')}
                </div>

                <div className="absolute left-1/2 top-0 z-10 w-[min(84vw,38rem)] -translate-x-1/2">
                  <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[1.75rem] bg-home-green/10" />
                  <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-[1.75rem] border border-home-gold/40 bg-white/35" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeEvent.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, x: 96, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -96, scale: 0.985 }}
                      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-10 overflow-hidden rounded-[1.75rem] border border-home-border bg-white/86 p-6 shadow-[0_28px_82px_rgba(34,25,17,0.14)] backdrop-blur sm:p-8"
                    >
                      <div className="relative -m-6 mb-6 h-52 overflow-hidden bg-home-green sm:-m-8 sm:mb-8 sm:h-64">
                        <motion.img
                          src={activeImage}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={handleImageError}
                          animate={prefersReducedMotion ? {} : { scale: [1, 1.055, 1], x: [0, -8, 0] }}
                          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,63,55,0.03),rgba(23,63,55,0.7))]" />
                        <div className="absolute left-5 top-5 flex max-w-[calc(100%-2.5rem)] flex-wrap gap-2">
                          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-home-green shadow-sm">
                            {formatEventMonth(activeEvent.startDate, language)} {formatEventDay(activeEvent.startDate, language)}
                          </span>
                          <span className="rounded-full bg-home-gold px-3 py-1.5 text-xs font-black text-[#173f37] shadow-sm">
                            {formatEventTime(activeEvent.startDate, language) || copy.eventsTimeTbd}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-home-green px-4 text-xs font-black uppercase tracking-[0.16em] text-white">
                        <CalendarDays className="h-4 w-4 text-home-gold" />
                        {hasMultipleEvents
                          ? copy.eventsFeaturedCurrent
                          : copy.eventsFeaturedSingle}
                      </span>
                      <h3 className="mt-6 line-clamp-2 text-left text-4xl font-black leading-[0.94] text-home-gold-text sm:text-5xl">
                        {readEventTitle(activeEvent, language)}
                      </h3>
                      <p className="mt-5 line-clamp-3 max-w-[62ch] text-left text-base leading-8 text-home-muted">
                        {activeDetails.description || copy.eventsDetailsFallback}
                      </p>
                      <div className="mt-7 flex flex-wrap items-center gap-3 text-left">
                        <span className="inline-flex min-h-11 max-w-full items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-home-border bg-[#fffaf0] px-4 text-sm font-bold text-home-gold-text">
                          <MapPin className="h-4 w-4 shrink-0 text-home-green" />
                          {activeDetails.location || copy.eventsLocationFallback}
                        </span>
                        <Link
                          to={`/groups/${encodeURIComponent(activeEvent.groupId)}/events/${encodeURIComponent(activeEvent.id)}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-home-gold px-5 text-sm font-black text-[#173f37] shadow-[0_18px_52px_rgba(245,215,152,0.24)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-home-green/35"
                          onClick={() => activeEntityService.setEvent(activeEvent.id)}
                        >
                          {copy.eventsOpen}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div
                  className="absolute left-1/2 top-10 hidden w-[30rem] lg:block xl:w-[32rem]"
                  style={{ transform: 'translateX(calc(-50% + 26rem))' }}
                >
                  {hasMultipleEvents ? renderSideCard(nextEvent, nextIndex, 'next') : renderEventEcho('next')}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div {...entrance} className="mt-12 rounded-[2rem] border border-home-border bg-[#fffaf0] p-8 text-center shadow-[0_18px_52px_rgba(34,25,17,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-home-green/10">
              <CalendarDays className="h-8 w-8 text-home-green" />
            </div>
            <h3 className="mt-5 text-2xl font-black text-home-gold-text">
              {copy.eventsPreparingTitle}
            </h3>
            <p className="mx-auto mt-3 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">{copy.eventsEmpty}</p>
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default EventsSection
