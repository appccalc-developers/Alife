import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, UsersRound } from 'lucide-react'
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

const AUTO_INTERVAL = 5600

const GroupsSection = ({ copy, language, groupCards }: Props) => {
  const auth = useAuthStore()
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const cards = groupCards.slice(0, 6)
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const activeCard = cards[activeIndex]

  const groupPath = useCallback((card: HomeGroupCard) => {
    const membership = auth.memberships.find((item) => item.groupId === card.group.id)
    return membership?.status === 'approved' || card.group.isChurch ? `/groups/${card.group.id}` : `/groups/${card.group.id}/join`
  }, [auth.memberships])

  const goTo = useCallback((nextIndex: number) => {
    if (cards.length === 0) return
    setDirection(nextIndex >= activeIndex ? 1 : -1)
    setActiveIndex(((nextIndex % cards.length) + cards.length) % cards.length)
  }, [activeIndex, cards.length])

  useEffect(() => {
    if (cards.length <= 1 || prefersReducedMotion) return undefined
    const timer = window.setInterval(() => {
      setDirection(1)
      setActiveIndex((current) => (current + 1) % cards.length)
    }, AUTO_INTERVAL)
    return () => window.clearInterval(timer)
  }, [cards.length, prefersReducedMotion])

  if (!activeCard) {
    return (
      <section id="groups" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{language === 'zh' ? '小组生活' : 'Group Life'}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.groupsTitle}</h2>
              <p className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted">{copy.groupsBody}</p>
            </div>
            <GuardedLink language={language} to="/groups/select" className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
              {copy.groupsAction} <ArrowRight className="h-3.5 w-3.5" />
            </GuardedLink>
          </motion.div>
          <motion.div {...entrance} className="mt-10 rounded-2xl border border-home-border/60 bg-white/70 p-8">
            <UsersRound className="h-7 w-7 text-home-green" />
            <p className="mt-4 max-w-[55ch] text-[0.94rem] leading-7 text-home-muted">
              {language === 'zh' ? '公开小组同步后，会在这里自动展示适合了解和加入的小组。' : 'Public groups will appear here automatically once they are available.'}
            </p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section id="groups" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div {...entrance} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-home-green">{language === 'zh' ? '小组生活' : 'Group Life'}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.groupsTitle}</h2>
            <p className="mt-3 max-w-[56ch] text-[0.94rem] leading-7 text-home-muted">{copy.groupsBody}</p>
          </div>
          <GuardedLink language={language} to="/groups/select" className="inline-flex items-center gap-2 self-start rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover">
            {copy.groupsAction} <ArrowRight className="h-3.5 w-3.5" />
          </GuardedLink>
        </motion.div>

        <motion.div {...entrance} className="mt-10 overflow-hidden rounded-2xl bg-home-dark text-white shadow-[0_28px_80px_rgba(34,25,17,0.18)]">
          <div className="relative min-h-[31rem]">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={activeCard.group.id}
                custom={direction}
                initial={prefersReducedMotion ? false : { opacity: 0, x: direction > 0 ? 80 : -80, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -60 : 60, scale: 0.99 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <GuardedLink
                  language={language}
                  to={groupPath(activeCard)}
                  className="group block h-full"
                  onBeforeNavigate={() => activeEntityService.setGroup(activeCard.group.id, { clearPage: true })}
                >
                  <img src={activeCard.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-90" loading="lazy" />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,21,16,0.92)_0%,rgba(24,21,16,0.62)_42%,rgba(24,21,16,0.12)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 top-0 flex items-end p-6 sm:p-8 lg:p-10">
                    <div className="max-w-2xl">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                        <Sparkles className="h-3.5 w-3.5" />
                        {activeCard.group.accessType === 'public' ? (language === 'zh' ? '公开可了解' : 'Open to explore') : (language === 'zh' ? '小组空间' : 'Group space')}
                      </span>
                      <h3 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{localizeText(activeCard.group.name, language)}</h3>
                      <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-7 text-white/66">{localizeText(activeCard.group.description, language) || copy.groupsBody}</p>
                    </div>
                  </div>
                </GuardedLink>
              </motion.div>
            </AnimatePresence>

            {cards.length > 1 ? (
              <>
                <button type="button" aria-label="Previous group" onClick={() => goTo(activeIndex - 1)} className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/25 text-white/75 backdrop-blur transition hover:bg-black/45 hover:text-white">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" aria-label="Next group" onClick={() => goTo(activeIndex + 1)} className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/25 text-white/75 backdrop-blur transition hover:bg-black/45 hover:text-white">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>

          {cards.length > 1 ? (
            <div className="grid gap-3 border-t border-white/10 bg-white/[0.04] p-3 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map((card, index) => {
                const selected = index === activeIndex
                return (
                  <button
                    key={card.group.id}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`group min-h-28 overflow-hidden rounded-xl border p-2 text-left transition ${selected ? 'border-home-gold/70 bg-white/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}
                  >
                    <div className="h-16 overflow-hidden rounded-lg bg-white/10">
                      <img src={card.imageUrl} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.04]" loading="lazy" />
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs font-semibold text-white">{localizeText(card.group.name, language)}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/12">
                      <span className={`block h-full rounded-full bg-home-gold transition-all duration-500 ${selected ? 'w-full' : 'w-0'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  )
}

export default GroupsSection
