import { CalendarDays } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { activeEntityService } from '../../services/activeEntityService'
import { entranceAnimation, media } from './homeUtils'
import type { HomeCopy, Language } from './homeCopy'
import type { GroupEventRecord } from '../../types/event'
import GuardedLink from './LoginPromptOverlay'

type Props = {
  copy: HomeCopy
  language: Language
  upcomingEvents: GroupEventRecord[]
}

const EventsSection = ({ copy, language, upcomingEvents }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)

  return (
    <section id="events" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance}>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.eventsTitle}</h2>
        </motion.div>
        {upcomingEvents.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.85fr]">
            {upcomingEvents.map((event, index) => {
              const start = new Date(event.startDate)
              const eventImage = [media.visit, media.groups, media.message][index % 3]
              const title = (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh
              return (
                <GuardedLink key={event.id} language={language} to="/events" className="group overflow-hidden rounded-2xl border border-home-border/50 bg-white text-left transition hover:-translate-y-0.5" onBeforeNavigate={() => activeEntityService.setEvent(event.id, event.groupId)}>
                  <div className="relative h-44 overflow-hidden">
                    <img src={eventImage} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  </div>
                  <div className="p-4">
                    <span className="text-xs font-medium text-home-muted">{Number.isNaN(start.getTime()) ? '' : new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(start)}</span>
                    <h3 className="mt-1.5 text-lg font-semibold leading-snug">{title}</h3>
                  </div>
                </GuardedLink>
              )
            })}
          </div>
        ) : (
          <motion.div {...entrance} className="mt-10 rounded-2xl border border-home-border/60 bg-white/60 p-8">
            <CalendarDays className="h-7 w-7 text-home-green" />
            <p className="mt-4 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">{copy.eventsEmpty}</p>
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default EventsSection
