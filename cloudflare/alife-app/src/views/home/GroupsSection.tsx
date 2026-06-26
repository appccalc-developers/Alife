import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, UsersRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '../../stores/auth'
import { activeEntityService } from '../../services/activeEntityService'
import { localizeText } from '../../utils/localizedText'
import { entranceAnimation } from './homeUtils'
import type { HomeGroupCard } from './homeUtils'
import type { HomeCopy, Language } from './homeCopy'
import GuardedLink from './LoginPromptOverlay'

type Props = {
  copy: HomeCopy
  language: Language
  groupCards: HomeGroupCard[]
}

const AUTO_INTERVAL = 5000

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
}

const GroupsSection = ({ copy, language, groupCards }: Props) => {
  const auth = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)

  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cards = groupCards.slice(0, 6)
  const count = cards.length

  const goto = useCallback((next: number, dir: number) => {
    setDirection(dir)
    setActiveIndex(((next % count) + count) % count)
  }, [count])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (count > 1 && !prefersReducedMotion) {
      timerRef.current = setInterval(() => goto(activeIndex + 1, 1), AUTO_INTERVAL)
    }
  }, [count, activeIndex, goto, prefersReducedMotion])

  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [resetTimer])

  const prev = () => { goto(activeIndex - 1, -1); resetTimer() }
  const next = () => { goto(activeIndex + 1, 1); resetTimer() }

  if (count === 0) {
    return (
      <section id="groups" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.groupsTitle}</h2>
              <p className="mt-3 max-w-[50ch] text-[0.94rem] leading-7 text-home-muted">{copy.groupsBody}</p>
            </div>
            <GuardedLink language={language} to="/groups/select" className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
              {copy.groupsAction} <ArrowRight className="h-3.5 w-3.5" />
            </GuardedLink>
          </motion.div>
          <motion.div {...entrance} className="mt-10 rounded-2xl border border-home-border/60 bg-white/60 p-8">
            <UsersRound className="h-7 w-7 text-home-green" />
            <p className="mt-4 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">
              {language === 'zh' ? '正在查询教会现有小组。若暂时没有公开小组，请先进入小组页面查看可加入或已加入的小组。' : 'We are checking the church groups. If no public groups are available yet, open the groups page to see groups you can join or already belong to.'}
            </p>
            <GuardedLink language={language} to="/groups/select" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
              {copy.groupsAction} <ArrowRight className="h-3.5 w-3.5" />
            </GuardedLink>
          </motion.div>
        </div>
      </section>
    )
  }

  const card = cards[activeIndex]
  const membership = auth.memberships.find((item) => item.groupId === card.group.id)
  const groupTo = membership?.status === 'approved' || card.group.isChurch ? `/groups/${card.group.id}` : `/groups/${card.group.id}/join`

  return (
    <section id="groups" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.groupsTitle}</h2>
            <p className="mt-3 max-w-[50ch] text-[0.94rem] leading-7 text-home-muted">{copy.groupsBody}</p>
          </div>
          <GuardedLink language={language} to="/groups/select" className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
            {copy.groupsAction} <ArrowRight className="h-3.5 w-3.5" />
          </GuardedLink>
        </motion.div>

        <div className="relative mt-10 overflow-hidden rounded-2xl bg-home-dark" style={{ aspectRatio: '16 / 9' }}>
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={card.group.id}
              custom={direction}
              variants={prefersReducedMotion ? undefined : slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              <GuardedLink
                language={language}
                to={groupTo}
                className="group block h-full w-full text-left"
                onBeforeNavigate={() => activeEntityService.setGroup(card.group.id, { clearPage: true })}
              >
                <img src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-85" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-home-dark via-home-dark/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 text-white sm:p-10">
                  <div className="max-w-lg">
                    <span className="inline-flex rounded-md bg-white/15 px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wide backdrop-blur-sm">
                      {card.group.accessType === 'public' ? (language === 'zh' ? '公开' : 'Public') : (language === 'zh' ? '小组' : 'Group')}
                    </span>
                    <h3 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">{localizeText(card.group.name, language)}</h3>
                    <p className="mt-2 line-clamp-2 max-w-md text-sm leading-6 text-white/55">{localizeText(card.group.description, language) || copy.groupsBody}</p>
                  </div>
                </div>
              </GuardedLink>
            </motion.div>
          </AnimatePresence>

          {count > 1 ? (
            <>
              <button type="button" aria-label="Previous" onClick={prev} className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white/70 backdrop-blur-sm transition hover:bg-black/50 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Next" onClick={next} className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white/70 backdrop-blur-sm transition hover:bg-black/50 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {cards.map((c, i) => (
                  <button
                    key={c.group.id}
                    type="button"
                    aria-label={`Go to slide ${i + 1}`}
                    onClick={() => { goto(i, i > activeIndex ? 1 : -1); resetTimer() }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/55'}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default GroupsSection
