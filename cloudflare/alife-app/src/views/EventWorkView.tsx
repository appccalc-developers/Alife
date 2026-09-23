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
  if (Number.isNaN(start.getTime())) return language === 'zh' ? '日期待确认' : 'Date to be confirmed'
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
          alt={language === 'zh' ? `${title}活动海报` : `${title} event poster`}
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
    ? (zh ? '活动负责人' : 'Event owner')
    : item.roles.length
      ? (zh ? `${item.roles.length} 项活动职责` : `${item.roles.length} event ${item.roles.length === 1 ? 'responsibility' : 'responsibilities'}`)
      : (zh ? '我的参与工作' : 'My event participation')

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
          {zh ? '打开活动工作台' : 'Open event workspace'}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
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
  return <AppPageShell title={zh ? '模块报告工作空间' : 'Module report workspace'} backLink={{ to: `/events/${eventId}/work`, label: zh ? '返回活动工作' : 'Back to event work' }}><EventReportPanel key={eventId + moduleCode} {...{ eventId, moduleCode }} /></AppPageShell>
}
export default function EventWorkView() {
  const { eventId } = useParams(), [params, setParams] = useSearchParams(), { me, language } = useAuthStore(), zh = language === 'zh'
  const page = Math.max(1, Number(params.get('page')) || 1), search = params.get('search') || ''
  const query = useQuery({ queryKey: ['event-work', me?.id, eventId, page, search], queryFn: async () => eventId ? await eventWorkService.get(eventId, page) : await eventWorkService.list(page, search), retry: false, gcTime: 0, refetchOnWindowFocus: true })
  const data = query.data
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); if (key !== 'page') next.delete('page'); return next })
  const title = eventId && data && 'event' in data ? (data.event.title[language] || data.event.title.en || data.event.title.zh) : zh ? '我的活动工作' : 'My event work'
  return <AppPageShell title={title} subtitle={eventId ? (zh ? '活动工作台 · 筹备、公布、执行、收尾' : 'Event workspace · Preparation, publication, delivery and follow-up') : (zh ? '按你的职责处理活动，跟进交接与下一步。' : 'Work on your responsibilities, handoffs and next actions.')} backLink={{ to: eventId ? '/event-work' : '/profile', label: zh ? '返回' : 'Back' }}>
    {query.error ? <AppSectionCard title={zh ? '无法读取工作空间' : 'Unable to load workspace'}><p role="alert">{normalizeApiError(query.error).message}</p><AppActionButton onClick={() => void query.refetch()}>{zh ? '重试' : 'Retry'}</AppActionButton></AppSectionCard> : !data ? <div role="status" aria-label={zh ? '正在读取活动工作' : 'Loading event work'}><EventWorkListSkeleton /></div> : 'items' in data ? <>
      <section className="flex flex-col gap-3 rounded-[1.25rem] border border-[#dce5e0] bg-[#fffdf8] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between" aria-label={zh ? '搜索和排序' : 'Search and sorting'}>
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">{zh ? '搜索活动' : 'Search events'}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718079]" aria-hidden="true" />
          <input type="search" className="min-h-11 w-full rounded-xl border border-[#cddbd5] bg-white py-2 pl-10 pr-3 text-sm text-[#18332d] outline-none transition placeholder:text-[#8b9892] focus:border-[#176b5a] focus:ring-[3px] focus:ring-[#176b5a]/15" placeholder={zh ? '搜索活动名称' : 'Search event names'} value={search} onChange={e => update('search', e.target.value)} />
        </label>
        <p className="shrink-0 text-xs font-semibold text-[#66766f]">{zh ? `按最近更新排序 · 本页 ${data.items.length} 个` : `Recently updated · ${data.items.length} on this page`}</p>
      </section>
      {data.items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.items.map(item => <EventWorkCard key={item.eventId} item={item} language={language} />)}</div> : <AppEmptyState title={zh ? '当前没有活动工作' : 'No event work found'} description={zh ? '已完成待办不会移除仍然有效的活动职责入口。' : 'Completing a duty does not remove an active event responsibility.'} />}
      {(page > 1 || data.hasMore) ? <div className="flex items-center justify-center gap-3"><AppActionButton disabled={page <= 1} onClick={() => update('page', String(page - 1))}>{zh ? '上一页' : 'Previous'}</AppActionButton><span className="min-w-9 text-center text-sm font-bold text-[#40554e]" aria-label={zh ? `第 ${page} 页` : `Page ${page}`}>{page}</span><AppActionButton disabled={!data.hasMore} onClick={() => update('page', String(page + 1))}>{zh ? '下一页' : 'Next'}</AppActionButton></div> : null}
    </> : (() => {
      const requestedStage = params.get('stage') || data.event.stage
      const stage = workStages.includes(requestedStage as typeof workStages[number]) ? requestedStage : 'preparation'
      const links = data.links.filter(x => x.stage === stage || x.key === 'tasks' || x.key === 'published-event')
      return <><nav className="flex gap-2 overflow-x-auto" aria-label={zh ? '活动阶段' : 'Event stages'}>{workStages.map(s => <button key={s} onClick={() => update('stage', s)} aria-current={s === stage ? 'page' : undefined} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${s === stage ? 'bg-[#176b5a] text-white' : 'border bg-white text-[#18332d]'}`}>{workStageText(s, zh)}</button>)}</nav>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce5e0] bg-[#fffdf8] p-4"><div><h2 className="font-bold">{workStageText(stage, zh)}</h2><p className="mt-1 text-sm text-[#40554e]">{eventStageHelp(stage, zh)}</p><p className="mt-1 text-xs text-[#596a63]">{zh ? '切换阶段只查看工作，不会自动发布、开放报名或结束活动。' : 'Switching views does not publish, open registration or end the event.'}</p></div>{stage === 'preparation' && data.event.canManage ? <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#173f36] px-4 py-2 text-sm font-bold text-white" to={`/groups/${encodeURIComponent(data.event.groupId)}/events/${encodeURIComponent(data.event.eventId)}/workspace?flow=setup&stage=arrangements`}>{zh ? '继续筹备' : 'Continue preparation'}</Link> : null}</section>
        {data.preparationProgress ? <AppSectionCard title={zh ? '整体筹备进度' : 'Overall preparation progress'}><p className="text-sm">{data.preparationProgress.blockers.length ? (zh ? `尚有 ${data.preparationProgress.blockers.length} 项需要处理。` : `${data.preparationProgress.blockers.length} items still need attention.`) : (zh ? '当前筹备检查已满足；正式审批和发布仍须各自完成。' : 'Current preparation checks are satisfied. Formal approval and publication are separate steps.')}</p><ul className="mt-3 space-y-2 text-sm">{data.preparationProgress.blockers.map((b, i) => <li key={i} className="rounded-xl bg-amber-50 p-3">{b[language] || b.en || b.zh}</li>)}</ul></AppSectionCard> : null}
        {data.duties.length ? <AppSectionCard title={zh ? '等待我处理' : 'My next actions'}>{data.duties.map(duty => <Link key={duty.task.taskKey} className="block min-h-11 border-b py-3 font-semibold text-[#176b5a]" to={duty.task.actionUrl}>{duty.task.actionLabel[language] || duty.task.actionLabel.en}</Link>)}</AppSectionCard> : null}
        {links.map(link => <AppSectionCard key={link.key} title={link.title[language] || link.title.en}><Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={link.url}>{link.canEdit ? (zh ? '进入处理' : 'Open work') : (zh ? '查看' : 'View')}</Link></AppSectionCard>)}
        {!links.length ? <p className="py-5 text-sm">{zh ? '这个阶段没有分配给你的工作。' : 'No work is assigned to you in this stage.'}</p> : null}
        {params.get('plan') === '1' && data.planContext ? <RamEventPlanContext context={data.planContext} zh={zh} review={false} /> : null}
        {stage === 'execution' || stage === 'followup' ? <AppSectionCard title={zh ? '活动场次' : 'Occurrences'}>{data.occurrences.map(o => <div key={o.id} className="border-b py-3 text-sm"><p>{new Date(o.startUtc).toLocaleString(language)} · {workStageText(o.stage, zh)}</p>{data.links.some(x => x.key === 'roster') ? <Link className="inline-flex min-h-11 items-center text-[#176b5a]" to={`/events/${eventId}/workspace/roster?occurrenceId=${o.id}`}>{zh ? '此场次排班' : 'Roster for this date'}</Link> : null}{data.links.some(x => x.key.startsWith('tasks:')) ? <Link className="ml-3 inline-flex min-h-11 items-center text-[#176b5a]" to={'/events/' + eventId + '/workspace?tab=team&occurrenceId=' + o.id + '&taskStage=' + (o.stage === 'followup' ? 'followup' : 'execution')}>{zh ? '此场次任务与善后' : 'Tasks and follow-up for this date'}</Link> : null}</div>)}<div className="mt-3 flex gap-2"><AppActionButton disabled={page <= 1} onClick={() => update('page', String(page - 1))}>{zh ? '上一页' : 'Previous'}</AppActionButton><AppActionButton disabled={!data.hasMoreOccurrences} onClick={() => update('page', String(page + 1))}>{zh ? '下一页' : 'Next'}</AppActionButton></div></AppSectionCard> : null}
      </>
    })()}
  </AppPageShell>
}
