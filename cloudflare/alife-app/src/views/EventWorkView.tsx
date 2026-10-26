import { eventWorkViewText } from '../i18n/eventWorkView.ts'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Search, UsersRound } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { eventWorkService, workStages, workStageText, type WorkSummary } from '../services/eventWorkService'
import { normalizeApiError } from '../services/http'
import { normalizeImageUrl } from '../services/imageWorkerApi'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import RamEventPlanContext from '../components/events/RamEventPlanContext'
import EventReportPanel from '../components/events/EventReportPanel'
import { eventStageHelp } from '../utils/eventActionGuidance'

const eventArtwork = {
  preparation: { gradient: 'from-[#312e81] via-[#4f46e5] to-[#7c3aed]', glow: 'bg-[#c4b5fd]', label: 'text-[#3730a3] bg-[#eef2ff]' },
  registration: { gradient: 'from-[#164e63] via-[#0284c7] to-[#2563eb]', glow: 'bg-[#bae6fd]', label: 'text-[#1e40af] bg-[#eff6ff]' },
  execution: { gradient: 'from-[#134e4a] via-[#0f766e] to-[#059669]', glow: 'bg-[#a7f3d0]', label: 'text-[#065f46] bg-[#ecfdf5]' },
  followup: { gradient: 'from-[#881337] via-[#be123c] to-[#e11d48]', glow: 'bg-[#fecdd3]', label: 'text-[#9f1239] bg-[#fff1f2]' },
} as const

const eventDateText = (item: WorkSummary, language: 'en' | 'zh') => {
  const start = new Date(item.startUtc)
  const end = new Date(item.endUtc)
  if (Number.isNaN(start.getTime())) return language === 'zh' ? eventWorkViewText.dateToBeConfirmed.zh : eventWorkViewText.dateToBeConfirmed.en
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'
  const day = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  if (Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) return day.format(start)
  return `${day.format(start)} – ${day.format(end)}`
}

const EventWorkArtwork = ({ item, title, language }: { item: WorkSummary; title: string; language: 'en' | 'zh' }) => {
  const [posterFailed, setPosterFailed] = useState(false)
  const visual = eventArtwork[item.stage as keyof typeof eventArtwork] ?? eventArtwork.preparation
  const start = new Date(item.startUtc)
  const hasDate = !Number.isNaN(start.getTime())
  const locale = language === 'zh' ? 'zh-CN' : 'en-NZ'

  return (
    <div className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${visual.gradient}`}>
      <div className={`absolute -right-10 -top-14 h-44 w-44 rounded-full ${visual.glow} opacity-35 blur-3xl`} aria-hidden="true" />
      <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.16)_0%,transparent_42%,rgba(9,30,25,0.2)_100%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white" aria-hidden="true">
        <CalendarDays className="h-9 w-9 text-white/75" />
        {hasDate ? (
          <span className="text-right leading-none">
            <strong className="block text-4xl font-black tabular-nums">{start.getDate()}</strong>
            <span className="mt-1 block text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/75">{start.toLocaleDateString(locale, { month: 'short' })}</span>
          </span>
        ) : <BriefcaseBusiness className="h-12 w-12 text-white/80" />}
      </div>
      {item.posterImageUrl && !posterFailed ? (
        <img
          src={normalizeImageUrl(item.posterImageUrl)}
          alt={language === 'zh' ? eventWorkViewText.eventPoster.zh(title) : eventWorkViewText.eventPoster.en(title)}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          loading="lazy"
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/38 to-transparent" aria-hidden="true" />
      <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-[#102a24]/70 px-3 py-1.5 text-[0.68rem] font-black text-white shadow-sm backdrop-blur-md">
        {workStageText(item.stage, language === 'zh')}
      </span>
    </div>
  )
}

const EventWorkCard = ({ item, language }: { item: WorkSummary; language: 'en' | 'zh' }) => {
  const zh = language === 'zh'
  const title = item.title[language] || item.title.en || item.title.zh
  const visual = eventArtwork[item.stage as keyof typeof eventArtwork] ?? eventArtwork.preparation
  const responsibility = item.canManage
    ? (zh ? eventWorkViewText.eventOwner.zh : eventWorkViewText.eventOwner.en)
    : item.roles.length
      ? (zh ? eventWorkViewText.event.zh(item.roles.length) : eventWorkViewText.event.en(item.roles.length, item.roles.length === 1 ? 'responsibility' : 'responsibilities'))
      : (zh ? eventWorkViewText.myEventParticipation.zh : eventWorkViewText.myEventParticipation.en)

  return (
    <article className="group relative overflow-hidden rounded-[1.4rem] border border-[#dce5e0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition duration-200 hover:-translate-y-1 hover:border-[#aacfc2] hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] focus-within:ring-[3px] focus-within:ring-[#1d4ed8]/30 motion-reduce:transform-none motion-reduce:transition-none">
      <EventWorkArtwork item={item} title={title} language={language} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#66766f]">
          <span className={`rounded-full px-2.5 py-1 ${visual.label}`}>{workStageText(item.stage, zh)}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{eventDateText(item, language)}</span>
        </div>
        <h2 className="mt-4 line-clamp-2 text-xl font-black leading-tight tracking-[-0.025em] text-[#18332d]">{title}</h2>
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#596a63]"><UsersRound className="h-4 w-4 shrink-0 text-[#176b5a]" aria-hidden="true" />{responsibility}</p>
        <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173f36] px-4 py-2 text-sm font-bold text-white shadow-[0_8px_18px_rgba(23,63,54,0.18)] transition hover:bg-[#176b5a] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1d4ed8]/35" to={`/events/${item.eventId}/work`}>
          {zh ? eventWorkViewText.openEventWorkspace.zh : eventWorkViewText.openEventWorkspace.en}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

const EventWorkListSkeleton = () => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    {[0, 1, 2].map(item => <div key={item} className="overflow-hidden rounded-[1.4rem] border border-[#dfe7e3] bg-white"><div className="aspect-[16/9] animate-pulse bg-[#e5ede9] motion-reduce:animate-none" /><div className="space-y-3 p-5"><div className="h-4 w-2/5 rounded bg-[#e5ede9]" /><div className="h-6 w-4/5 rounded bg-[#d8e3de]" /><div className="h-4 w-3/5 rounded bg-[#e5ede9]" /></div></div>)}
  </div>
)

export function EventReportView() {
  const { eventId = '', moduleCode = '' } = useParams(), zh = useAuthStore().language === 'zh'
  return <AppPageShell title={zh ? eventWorkViewText.moduleReportWorkspace.zh : eventWorkViewText.moduleReportWorkspace.en} backLink={{ to: `/events/${eventId}/work`, label: zh ? eventWorkViewText.backToEventWork.zh : eventWorkViewText.backToEventWork.en }}><EventReportPanel key={eventId + moduleCode} {...{ eventId, moduleCode }} /></AppPageShell>
}
export default function EventWorkView() {
  const { eventId } = useParams(), [params, setParams] = useSearchParams(), { me, language } = useAuthStore(), zh = language === 'zh'
  const page = Math.max(1, Number(params.get('page')) || 1), search = params.get('search') || ''
  const query = useQuery({ queryKey: ['event-work', me?.id, eventId, page, search], queryFn: async () => eventId ? await eventWorkService.get(eventId, page) : await eventWorkService.list(page, search), retry: false, gcTime: 0, refetchOnWindowFocus: true })
  const data = query.data
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); if (key !== 'page') next.delete('page'); return next })
  const title = eventId && data && 'event' in data ? (data.event.title[language] || data.event.title.en || data.event.title.zh) : zh ? eventWorkViewText.myEventWork.zh : eventWorkViewText.myEventWork.en
  return <AppPageShell title={title} subtitle={eventId ? (zh ? eventWorkViewText.eventWorkspacePreparationPublicationDeliveryAndFollowUp.zh : eventWorkViewText.eventWorkspacePreparationPublicationDeliveryAndFollowUp.en) : (zh ? eventWorkViewText.workOnYourResponsibilitiesHandoffsAndNextActions.zh : eventWorkViewText.workOnYourResponsibilitiesHandoffsAndNextActions.en)} backLink={{ to: eventId ? '/event-work' : '/profile', label: zh ? eventWorkViewText.back.zh : eventWorkViewText.back.en }}>
    {query.error ? <AppSectionCard title={zh ? eventWorkViewText.unableToLoadWorkspace.zh : eventWorkViewText.unableToLoadWorkspace.en}><p role="alert">{normalizeApiError(query.error).message}</p><AppActionButton onClick={() => void query.refetch()}>{zh ? eventWorkViewText.retry.zh : eventWorkViewText.retry.en}</AppActionButton></AppSectionCard> : !data ? <div role="status" aria-label={zh ? eventWorkViewText.loadingEventWork.zh : eventWorkViewText.loadingEventWork.en}><EventWorkListSkeleton /></div> : 'items' in data ? <>
      <section className="flex flex-col gap-3 rounded-[1.25rem] border border-[#dce5e0] bg-[#fffdf8] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between" aria-label={zh ? eventWorkViewText.searchAndSorting.zh : eventWorkViewText.searchAndSorting.en}>
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">{zh ? eventWorkViewText.searchEvents.zh : eventWorkViewText.searchEvents.en}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718079]" aria-hidden="true" />
          <input type="search" className="min-h-11 w-full rounded-xl border border-[#cddbd5] bg-white py-2 pl-10 pr-3 text-sm text-[#18332d] outline-none transition placeholder:text-[#8b9892] focus:border-[#176b5a] focus:ring-[3px] focus:ring-[#176b5a]/15" placeholder={zh ? eventWorkViewText.searchEventNames.zh : eventWorkViewText.searchEventNames.en} value={search} onChange={e => update('search', e.target.value)} />
        </label>
        <p className="shrink-0 text-xs font-semibold text-[#66766f]">{zh ? eventWorkViewText.recentlyUpdatedOnThisPage.zh(data.items.length) : eventWorkViewText.recentlyUpdatedOnThisPage.en(data.items.length)}</p>
      </section>
      {data.items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.items.map(item => <EventWorkCard key={item.eventId} item={item} language={language} />)}</div> : <AppEmptyState title={zh ? eventWorkViewText.noEventWorkFound.zh : eventWorkViewText.noEventWorkFound.en} description={zh ? eventWorkViewText.completingADutyDoesNotRemoveAnActiveEvent.zh : eventWorkViewText.completingADutyDoesNotRemoveAnActiveEvent.en} />}
      {(page > 1 || data.hasMore) ? <div className="flex items-center justify-center gap-3"><AppActionButton disabled={page <= 1} onClick={() => update('page', String(page - 1))}>{zh ? eventWorkViewText.previous.zh : eventWorkViewText.previous.en}</AppActionButton><span className="min-w-9 text-center text-sm font-bold text-[#40554e]" aria-label={zh ? eventWorkViewText.page.zh(page) : eventWorkViewText.page.en(page)}>{page}</span><AppActionButton disabled={!data.hasMore} onClick={() => update('page', String(page + 1))}>{zh ? eventWorkViewText.next.zh : eventWorkViewText.next.en}</AppActionButton></div> : null}
    </> : (() => {
      const requestedStage = params.get('stage') || data.event.stage
      const stage = workStages.includes(requestedStage as typeof workStages[number]) ? requestedStage : 'preparation'
      const links = data.links.filter(x => x.stage === stage || x.key === 'tasks' || x.key === 'published-event')
      return <><nav className="flex gap-2 overflow-x-auto" aria-label={zh ? eventWorkViewText.eventStages.zh : eventWorkViewText.eventStages.en}>{workStages.map(s => <button key={s} onClick={() => update('stage', s)} aria-current={s === stage ? 'page' : undefined} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${s === stage ? 'bg-[#176b5a] text-white' : 'border bg-white text-[#18332d]'}`}>{workStageText(s, zh)}</button>)}</nav>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce5e0] bg-[#fffdf8] p-4"><div><h2 className="font-bold">{workStageText(stage, zh)}</h2><p className="mt-1 text-sm text-[#40554e]">{eventStageHelp(stage, zh)}</p><p className="mt-1 text-xs text-[#596a63]">{zh ? eventWorkViewText.switchingViewsDoesNotPublishOpenRegistrationOrEnd.zh : eventWorkViewText.switchingViewsDoesNotPublishOpenRegistrationOrEnd.en}</p></div>{stage === 'preparation' && data.event.canManage ? <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#173f36] px-4 py-2 text-sm font-bold text-white" to={`/groups/${encodeURIComponent(data.event.groupId)}/events/${encodeURIComponent(data.event.eventId)}/workspace?flow=setup&stage=arrangements`}>{zh ? eventWorkViewText.continuePreparation.zh : eventWorkViewText.continuePreparation.en}</Link> : null}</section>
        {data.preparationProgress ? <AppSectionCard title={zh ? eventWorkViewText.overallPreparationProgress.zh : eventWorkViewText.overallPreparationProgress.en}><p className="text-sm">{data.preparationProgress.blockers.length ? (zh ? eventWorkViewText.itemsStillNeedAttention.zh(data.preparationProgress.blockers.length) : eventWorkViewText.itemsStillNeedAttention.en(data.preparationProgress.blockers.length)) : (zh ? eventWorkViewText.currentPreparationChecksAreSatisfiedFormalApprovalAndPublication.zh : eventWorkViewText.currentPreparationChecksAreSatisfiedFormalApprovalAndPublication.en)}</p><ul className="mt-3 space-y-2 text-sm">{data.preparationProgress.blockers.map((b, i) => <li key={i} className="rounded-xl bg-amber-50 p-3">{b[language] || b.en || b.zh}</li>)}</ul></AppSectionCard> : null}
        {data.duties.length ? <AppSectionCard title={zh ? eventWorkViewText.myNextActions.zh : eventWorkViewText.myNextActions.en}>{data.duties.map(duty => <Link key={duty.task.taskKey} className="block min-h-11 border-b py-3 font-semibold text-[#176b5a]" to={duty.task.actionUrl}>{duty.task.actionLabel[language] || duty.task.actionLabel.en}</Link>)}</AppSectionCard> : null}
        {links.map(link => <AppSectionCard key={link.key} title={link.title[language] || link.title.en}><Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={link.url}>{link.canEdit ? (zh ? eventWorkViewText.openWork.zh : eventWorkViewText.openWork.en) : (zh ? eventWorkViewText.view.zh : eventWorkViewText.view.en)}</Link></AppSectionCard>)}
        {!links.length ? <p className="py-5 text-sm">{zh ? eventWorkViewText.noWorkIsAssignedToYouInThisStage.zh : eventWorkViewText.noWorkIsAssignedToYouInThisStage.en}</p> : null}
        {params.get('plan') === '1' && data.planContext ? <RamEventPlanContext context={data.planContext} zh={zh} review={false} /> : null}
        {stage === 'execution' || stage === 'followup' ? <AppSectionCard title={zh ? eventWorkViewText.occurrences.zh : eventWorkViewText.occurrences.en}>{data.occurrences.map(o => <div key={o.id} className="border-b py-3 text-sm"><p>{new Date(o.startUtc).toLocaleString(language)} · {workStageText(o.stage, zh)}</p>{data.links.some(x => x.key === 'roster') ? <Link className="inline-flex min-h-11 items-center text-[#176b5a]" to={`/events/${eventId}/workspace/roster?occurrenceId=${o.id}`}>{zh ? eventWorkViewText.rosterForThisDate.zh : eventWorkViewText.rosterForThisDate.en}</Link> : null}{data.links.some(x => x.key.startsWith('tasks:')) ? <Link className="ml-3 inline-flex min-h-11 items-center text-[#176b5a]" to={'/events/' + eventId + '/workspace?tab=team&occurrenceId=' + o.id + '&taskStage=' + (o.stage === 'followup' ? 'followup' : 'execution')}>{zh ? eventWorkViewText.tasksAndFollowUpForThisDate.zh : eventWorkViewText.tasksAndFollowUpForThisDate.en}</Link> : null}</div>)}<div className="mt-3 flex gap-2"><AppActionButton disabled={page <= 1} onClick={() => update('page', String(page - 1))}>{zh ? eventWorkViewText.previous.zh : eventWorkViewText.previous.en}</AppActionButton><AppActionButton disabled={!data.hasMoreOccurrences} onClick={() => update('page', String(page + 1))}>{zh ? eventWorkViewText.next.zh : eventWorkViewText.next.en}</AppActionButton></div></AppSectionCard> : null}
      </>
    })()}
  </AppPageShell>
}
