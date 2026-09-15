import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { eventWorkService, workStages, workStageText } from '../services/eventWorkService'
import { normalizeApiError } from '../services/http'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppActionButton from '../components/layout/AppActionButton'
import RamEventPlanContext from '../components/events/RamEventPlanContext'
import EventReportPanel from '../components/events/EventReportPanel'

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
  return <AppPageShell title={title} subtitle={zh ? '按你的职责处理活动，跟进交接与下一步。' : 'Work on your responsibilities, handoffs and next actions.'} backLink={{ to: eventId ? '/event-work' : '/profile', label: zh ? '返回' : 'Back' }}>
    {query.error ? <AppSectionCard title={zh ? '无法读取工作空间' : 'Unable to load workspace'}><p role="alert">{normalizeApiError(query.error).message}</p><AppActionButton onClick={() => void query.refetch()}>{zh ? '重试' : 'Retry'}</AppActionButton></AppSectionCard> : !data ? <p role="status">{zh ? '正在读取…' : 'Loading…'}</p> : 'items' in data ? <>
      <label className="grid gap-2 text-sm">{zh ? '搜索活动' : 'Search events'}<input className="rounded-xl border p-3" value={search} onChange={e => update('search', e.target.value)} /></label>
      <p className="text-xs text-[#66766f]">{zh ? '按最近更新排序' : 'Most recently updated first'}</p>
      {data.items.map(item => <AppSectionCard key={item.eventId} title={item.title[language] || item.title.en || item.title.zh}><p className="text-sm">{workStageText(item.stage, zh)}</p><Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a]" to={`/events/${item.eventId}/work`}>{zh ? '进入工作空间' : 'Open workspace'}</Link></AppSectionCard>)}
      {!data.items.length ? <p>{zh ? '当前没有活动工作。已完成待办不会移除仍有效的职责入口。' : 'No event work found. Completing a duty does not remove an active responsibility.'}</p> : null}
      <div className="flex gap-3"><AppActionButton disabled={page <= 1} onClick={() => update('page', String(page - 1))}>{zh ? '上一页' : 'Previous'}</AppActionButton><span>{page}</span><AppActionButton disabled={!data.hasMore} onClick={() => update('page', String(page + 1))}>{zh ? '下一页' : 'Next'}</AppActionButton></div>
    </> : (() => {
      const stage = params.get('stage') || data.event.stage
      const links = data.links.filter(x => x.stage === stage || x.key === 'tasks')
      return <><nav className="flex gap-2 overflow-x-auto" aria-label={zh ? '活动阶段' : 'Event stages'}>{workStages.map(s => <button key={s} onClick={() => update('stage', s)} aria-current={s === stage ? 'page' : undefined} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${s === stage ? 'bg-[#176b5a] text-white' : 'border bg-white text-[#18332d]'}`}>{workStageText(s, zh)}</button>)}</nav>
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
