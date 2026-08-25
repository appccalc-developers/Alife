import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock3, Link2, Play } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { eventPreparationTaskService } from '../services/eventPreparationTaskService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventPreparationTaskStatus } from '../types/eventPreparationTask'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { localizeText } from '../utils/localizedText'

const MyEventPreparationTasksView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const zh = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({ queryKey: ['myEventPreparationTasks', eventId], queryFn: () => eventPreparationTaskService.getMine(eventId), enabled: Boolean(eventId) })
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventPreparationTaskStatus }) => eventPreparationTaskService.updateStatus(eventId, id, status),
    onSuccess: () => query.refetch(),
  })
  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{zh ? '正在整理我的任务…' : 'Loading my tasks…'}</p></AppPageShell>
  if (query.error) return <AppPageShell><AppSectionCard title={zh ? '无法打开我的任务' : 'Unable to open my tasks'}><p className="text-sm text-rose-700">{normalizeApiError(query.error).message}</p></AppSectionCard></AppPageShell>
  const tasks = query.data ?? []
  return <AppPageShell>
    <Link to={eventBasePath} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" />{zh ? '返回活动' : 'Back to event'}</Link>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{zh ? '我的下一步' : 'My next steps'}</p><h1 className="mt-2 text-3xl font-black">{zh ? '分给我的活动任务' : 'My event preparation tasks'}</h1><p className="mt-3 text-sm leading-6 text-emerald-50/85">{zh ? '这里只有分给你的工作。前置任务没有完成时会显示“等待”，不需要你猜该先找谁或做什么。' : 'This page shows only work assigned to you. When a prerequisite is pending, the task clearly waits instead of asking you to guess what comes first.'}</p></section>
    <div className="mt-6 space-y-4">{tasks.length ? tasks.map((task) => <article key={task.id} className={`rounded-2xl border bg-white p-5 ${task.isBlocked ? 'border-amber-200' : task.status === 'completed' ? 'border-emerald-200' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-slate-950">{localizeText(task.title, language)}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{localizeText(task.description, language)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{task.isBlocked ? (zh ? '等待前置任务' : 'Waiting') : task.status === 'completed' ? (zh ? '已完成' : 'Completed') : task.status === 'inProgress' ? (zh ? '进行中' : 'In progress') : (zh ? '待开始' : 'To do')}</span></div><div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500">{task.dueUtc ? <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(task.dueUtc))}</span> : null}{task.dependencyTaskIds.length ? <span className="inline-flex items-center gap-1"><Link2 className="h-4 w-4" />{zh ? `${task.dependencyTaskIds.length} 项前置工作` : `${task.dependencyTaskIds.length} prerequisites`}</span> : null}</div>{task.status !== 'completed' ? <div className="mt-4 flex justify-end gap-2">{task.status === 'todo' ? <button type="button" disabled={task.isBlocked || mutation.isPending} onClick={() => mutation.mutate({ id: task.id, status: 'inProgress' })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800 disabled:opacity-40"><Play className="h-4 w-4" />{zh ? '开始处理' : 'Start'}</button> : null}<button type="button" disabled={task.isBlocked || mutation.isPending} onClick={() => mutation.mutate({ id: task.id, status: 'completed' })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{zh ? '确认完成' : 'Complete'}</button></div> : null}</article>) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{zh ? '目前没有分给你的活动任务。' : 'No event preparation tasks are assigned to you.'}</p>}</div>
    {mutation.error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(mutation.error).message}</p> : null}
  </AppPageShell>
}

export default MyEventPreparationTasksView
