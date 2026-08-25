import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Bot, CalendarClock, CheckCircle2, ChevronRight, Edit3, Link2, Save, UserRound, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import { eventPreparationTaskService } from '../services/eventPreparationTaskService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventPreparationTask, SaveEventPreparationTaskPayload } from '../types/eventPreparationTask'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { localizeText } from '../utils/localizedText'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

type FormState = SaveEventPreparationTaskPayload & { id: string | null; dueLocal: string }
const emptyForm = (): FormState => ({ id: null, moduleKey: 'general', titleEn: '', titleZh: '', descriptionEn: '', descriptionZh: '', assignedMemberId: null, dueUtc: null, dueLocal: '', isRequired: true, dependencyTaskIds: [] })
const toLocal = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const statusCopy = (task: EventPreparationTask, zh: boolean) => task.isBlocked
  ? (zh ? '等待前置任务' : 'Waiting for prerequisite')
  : ({ todo: zh ? '待开始' : 'To do', inProgress: zh ? '进行中' : 'In progress', completed: zh ? '已完成' : 'Completed', cancelled: zh ? '已取消' : 'Cancelled' }[task.status])
const moduleNames: Record<string, { en: string; zh: string }> = {
  general: { en: 'General preparation', zh: '综合筹备' }, core: { en: 'Event facts', zh: '活动资料' }, communications: { en: 'Notice and poster', zh: '通知与海报' }, venue: { en: 'Venue', zh: '场地' }, registration: { en: 'Registration', zh: '报名' }, finance: { en: 'Finance', zh: '费用' }, ram: { en: 'Risk assessment', zh: '风险评估' }, roster: { en: 'Roster', zh: '排班' }, programme: { en: 'Programme and handover', zh: '程序单与交接' }, closure: { en: 'Closure', zh: '结项' }, tasks: { en: 'Task coordination', zh: '任务协调' },
}

const EventPreparationTasksView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const zh = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const editPath = groupId ? `${eventBasePath}/edit` : `/events/${encodeURIComponent(eventId)}/edit`
  const query = useQuery({ queryKey: ['eventPreparationTasks', eventId], queryFn: () => eventPreparationTaskService.getWorkspace(eventId), enabled: Boolean(eventId) })
  const [form, setForm] = useState<FormState>(emptyForm)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const workspace = query.data
  const availableModules = useMemo(() => ['general', ...(workspace?.moduleKeys ?? []).filter((key) => key !== 'tasks')].filter((value, index, all) => all.indexOf(value) === index), [workspace])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, zh ? '任务内容尚未保存，确定离开吗？' : 'The task is not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [dirty, zh])

  const saveMutation = useMutation({
    mutationFn: () => eventPreparationTaskService.save(eventId, form.id, {
      moduleKey: form.moduleKey, titleEn: form.titleEn, titleZh: form.titleZh,
      descriptionEn: form.descriptionEn, descriptionZh: form.descriptionZh,
      assignedMemberId: form.assignedMemberId || null,
      dueUtc: form.dueLocal ? new Date(form.dueLocal).toISOString() : null,
      isRequired: form.isRequired, dependencyTaskIds: form.dependencyTaskIds,
    }),
    onSuccess: async () => {
      setForm(emptyForm()); setDirty(false)
      setMessage(zh ? '任务已保存；被指派的成员会在“当前事务”中看到下一步。' : 'Task saved. The assignee will see it in Current tasks.')
      await query.refetch()
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'todo' | 'completed' | 'cancelled' }) => eventPreparationTaskService.updateStatus(eventId, id, status),
    onSuccess: () => query.refetch(),
  })
  const edit = (task: EventPreparationTask) => {
    setForm({ id: task.id, moduleKey: task.moduleKey, titleEn: task.title.en, titleZh: task.title.zh, descriptionEn: task.description.en, descriptionZh: task.description.zh, assignedMemberId: task.assignedMemberId, dueUtc: task.dueUtc, dueLocal: toLocal(task.dueUtc), isRequired: task.isRequired, dependencyTaskIds: task.dependencyTaskIds })
    setDirty(false); setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{zh ? '正在打开任务看板…' : 'Opening task board…'}</p></AppPageShell>
  if (query.error || !workspace) return <AppPageShell><div className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><h1 className="font-black text-rose-950">{zh ? '无法打开任务看板' : 'Unable to open task board'}</h1><p className="mt-2 text-sm text-rose-700">{normalizeApiError(query.error).message}</p></div></AppPageShell>

  const candidateDependencies = workspace.tasks.filter((task) => task.id !== form.id && task.status !== 'cancelled')
  const activeTaskCount = workspace.tasks.filter((task) => task.status !== 'cancelled').length
  const requiredTasks = workspace.tasks.filter((task) => task.isRequired && task.status !== 'cancelled')
  const unassignedCount = requiredTasks.filter((task) => !task.assignedMemberId).length
  const unscheduledCount = requiredTasks.filter((task) => !task.dueUtc || new Date(task.dueUtc) > new Date(workspace.eventStartUtc)).length
  const overdueCount = requiredTasks.filter((task) => task.status !== 'completed' && task.dueUtc && new Date(task.dueUtc) < new Date()).length
  const blockedCount = requiredTasks.filter((task) => task.isBlocked).length
  const dateTimeFormatter = new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' })
  const dependencyNames = (task: EventPreparationTask) => task.dependencyTaskIds
    .map((id) => workspace.tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is EventPreparationTask => Boolean(candidate))
    .filter((candidate) => candidate.status !== 'completed')
    .map((candidate) => localizeText(candidate.title, language))
  return <AppPageShell>
    <nav aria-label={zh ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="inline-flex items-center gap-2 hover:text-[#123d34]"><ArrowLeft className="h-4 w-4" />{zh ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{zh ? '任务协调' : 'Task coordination'}</span></nav>
    <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#123d34_0%,#176b5a_58%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9"><div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" /><div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{zh ? '按需筹备 · 任务协调' : 'Optional preparation · Task coordination'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{localizeText(workspace.eventTitle, language)}</h1><p className="mt-3 text-sm leading-6 text-emerald-50/80">{zh ? '把真正需要交给某个人的工作列出来，说明截止时间和前置条件。这里不是重复活动流程，而是把流程里的具体工作落实到人。' : 'List only work that needs a clear owner, due date and prerequisite. This does not repeat the event plan; it assigns concrete work within it.'}</p></div></header>

    <article className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_24px_65px_rgba(31,56,48,0.08)]">
      <section aria-label={zh ? '任务准备状态' : 'Task readiness'} className="grid border-b border-[#2f4b42]/10 bg-[#f7faf8] sm:grid-cols-4 sm:divide-x sm:divide-[#2f4b42]/10">
        <div className="px-5 py-4"><p className="text-2xl font-black text-[#18332d]">{requiredTasks.filter((task) => task.status === 'completed').length}/{requiredTasks.length}</p><p className="mt-1 text-xs font-bold text-[#687a73]">{zh ? '必要任务完成' : 'required complete'}</p></div>
        <div className="border-t border-[#2f4b42]/10 px-5 py-4 sm:border-t-0"><p className={['text-2xl font-black', unassignedCount ? 'text-rose-700' : 'text-[#18332d]'].join(' ')}>{unassignedCount}</p><p className="mt-1 text-xs font-bold text-[#687a73]">{zh ? '缺少负责人' : 'without owner'}</p></div>
        <div className="border-t border-[#2f4b42]/10 px-5 py-4 sm:border-t-0"><p className={['text-2xl font-black', unscheduledCount + overdueCount ? 'text-rose-700' : 'text-[#18332d]'].join(' ')}>{unscheduledCount + overdueCount}</p><p className="mt-1 text-xs font-bold text-[#687a73]">{zh ? '截止时间需处理' : 'due dates to fix'}</p></div>
        <div className="border-t border-[#2f4b42]/10 px-5 py-4 sm:border-t-0"><p className={['text-2xl font-black', blockedCount ? 'text-amber-700' : 'text-[#18332d]'].join(' ')}>{blockedCount}</p><p className="mt-1 text-xs font-bold text-[#687a73]">{zh ? '等待前置任务' : 'waiting on prerequisites'}</p></div>
      </section>
      <section className="p-5 sm:p-7 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">01</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{form.id ? (zh ? '修改任务' : 'Edit task') : (zh ? '增加一项具体工作' : 'Add concrete work')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a73]">{zh ? 'AI 可以建议如何拆分，但不会自动指派、保存或标记完成。' : 'AI may suggest a breakdown, but cannot assign, save or complete work.'}</p></div><Link to={`${editPath}?step=assistant&module=tasks`} className="inline-flex items-center gap-2 text-sm font-black text-violet-700 hover:text-violet-900"><Bot className="h-4 w-4" />{zh ? '查看 AI 任务建议' : 'Review AI task ideas'}<ChevronRight className="h-4 w-4" /></Link></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40534c]">{zh ? '标题 · 中文' : 'Title · Chinese'}<input value={form.titleZh} onChange={(e) => { setForm({ ...form, titleZh: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3 focus:border-[#176b5a] focus:outline-none focus:ring-4 focus:ring-[#176b5a]/10" /></label><label className="text-sm font-bold text-[#40534c]">{zh ? '标题 · 英文' : 'Title · English'}<input value={form.titleEn} onChange={(e) => { setForm({ ...form, titleEn: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3 focus:border-[#176b5a] focus:outline-none focus:ring-4 focus:ring-[#176b5a]/10" /></label><label className="text-sm font-bold text-[#40534c]">{zh ? '属于哪项筹备' : 'Preparation area'}<select value={form.moduleKey} onChange={(e) => { setForm({ ...form, moduleKey: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] bg-white px-3.5 py-3">{availableModules.map((key) => <option key={key} value={key}>{localizeText(moduleNames[key] ?? { en: key, zh: key }, language)}</option>)}</select></label><label className="text-sm font-bold text-[#40534c]">{zh ? '负责人' : 'Assignee'}<select value={form.assignedMemberId ?? ''} onChange={(e) => { setForm({ ...form, assignedMemberId: e.target.value || null }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] bg-white px-3.5 py-3"><option value="">{zh ? '暂不指派' : 'Unassigned'}</option>{workspace.members.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}</select></label><label className="text-sm font-bold text-[#40534c]">{zh ? '截止时间' : 'Due date'}<input type="datetime-local" max={form.isRequired ? toLocal(workspace.eventStartUtc) : undefined} value={form.dueLocal} onChange={(e) => { setForm({ ...form, dueLocal: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="flex items-center gap-2 self-end rounded-xl bg-[#f3f6f3] px-4 py-3 text-sm font-bold text-[#40534c]"><input type="checkbox" checked={form.isRequired} onChange={(e) => { setForm({ ...form, isRequired: e.target.checked }); setDirty(true) }} className="accent-[#176b5a]" />{zh ? '活动就绪前必须完成' : 'Required before the event is ready'}</label><label className="text-sm font-bold text-[#40534c] sm:col-span-2">{zh ? '说明 · 中文' : 'Description · Chinese'}<textarea rows={3} value={form.descriptionZh} onChange={(e) => { setForm({ ...form, descriptionZh: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label><label className="text-sm font-bold text-[#40534c] sm:col-span-2">{zh ? '说明 · 英文' : 'Description · English'}<textarea rows={3} value={form.descriptionEn} onChange={(e) => { setForm({ ...form, descriptionEn: e.target.value }); setDirty(true) }} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3" /></label></div>
        {form.isRequired ? <p className="mt-4 flex items-start gap-2 text-xs font-bold leading-5 text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{zh ? '必要任务可以先保存为未完整状态，但必须补齐负责人，并把截止时间设在活动开始之前，才会满足“可以举办”。' : 'A required task may be saved while incomplete, but it needs an owner and a due date before the event can satisfy “Can run”.'}</p> : null}
        {candidateDependencies.length ? <fieldset className="mt-5 border-t border-[#2f4b42]/10 pt-5"><legend className="text-sm font-black text-[#18332d]">{zh ? '必须先完成' : 'Prerequisites'}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{candidateDependencies.map((task) => <label key={task.id} className="flex items-start gap-2 text-sm text-[#52645d]"><input type="checkbox" className="mt-1 accent-[#176b5a]" checked={form.dependencyTaskIds.includes(task.id)} onChange={(e) => { setForm({ ...form, dependencyTaskIds: e.target.checked ? [...form.dependencyTaskIds, task.id] : form.dependencyTaskIds.filter((id) => id !== task.id) }); setDirty(true) }} /><span>{localizeText(task.title, language)}</span></label>)}</div></fieldset> : null}
        <div className="mt-6 flex justify-end gap-3">{form.id ? <button type="button" onClick={() => { setForm(emptyForm()); setDirty(false) }} className="rounded-xl border border-[#b9c7c1] px-4 py-2.5 text-sm font-black text-[#40534c]">{zh ? '取消修改' : 'Cancel edit'}</button> : null}<button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (!form.titleZh.trim() && !form.titleEn.trim())} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_25px_rgba(23,107,90,0.2)] disabled:opacity-45"><Save className="h-4 w-4" />{zh ? '保存任务' : 'Save task'}</button></div>
      </section>

      <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">02</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{zh ? '当前任务' : 'Current tasks'}</h2></div><span className="text-sm font-bold text-[#687a73]">{activeTaskCount} {zh ? '项' : 'total'}</span></div>
        <div className="mt-5 divide-y divide-[#2f4b42]/10">{workspace.tasks.length ? workspace.tasks.map((task) => {
          const dueAfterEvent = Boolean(task.dueUtc && new Date(task.dueUtc) > new Date(workspace.eventStartUtc))
          const overdue = Boolean(task.status !== 'completed' && task.dueUtc && new Date(task.dueUtc) < new Date())
          const waitingNames = dependencyNames(task)
          const planningIssue = task.isRequired && (!task.assignedMemberId || !task.dueUtc || dueAfterEvent || overdue || task.isBlocked)
          return <article key={task.id} className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-[#17705d]">{localizeText(moduleNames[task.moduleKey] ?? { en: task.moduleKey, zh: task.moduleKey }, language)}</span><span className={['rounded-full px-2.5 py-1 text-[11px] font-black', planningIssue ? 'bg-amber-100 text-amber-900' : task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'].join(' ')}>{planningIssue ? (zh ? '影响活动就绪' : 'Affects readiness') : statusCopy(task, zh)}</span></div>
                <h3 className="mt-2 text-base font-black text-[#18332d]">{localizeText(task.title, language)}</h3>
                <p className="mt-1 text-sm leading-6 text-[#687a73]">{localizeText(task.description, language)}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[#718079]">
                  <span className={['inline-flex items-center gap-1', task.isRequired && !task.assignedMemberId ? 'text-rose-700' : ''].join(' ')}><UserRound className="h-4 w-4" />{task.assignedDisplayName || (zh ? '缺少负责人' : 'Owner missing')}</span>
                  {task.dueUtc ? <span className={['inline-flex items-center gap-1', dueAfterEvent || overdue ? 'text-rose-700' : ''].join(' ')}><CalendarClock className="h-4 w-4" />{dateTimeFormatter.format(new Date(task.dueUtc))}{dueAfterEvent ? (zh ? ' · 晚于活动开始' : ' · after event start') : overdue ? (zh ? ' · 已逾期' : ' · overdue') : ''}</span> : task.isRequired ? <span className="inline-flex items-center gap-1 text-rose-700"><CalendarClock className="h-4 w-4" />{zh ? '缺少截止时间' : 'Due date missing'}</span> : null}
                  {task.dependencyTaskIds.length ? <span className={['inline-flex items-center gap-1', task.isBlocked ? 'text-amber-800' : ''].join(' ')}><Link2 className="h-4 w-4" />{waitingNames.length ? (zh ? `等待：${waitingNames.join('、')}` : `Waiting for: ${waitingNames.join(', ')}`) : (zh ? `${task.dependencyTaskIds.length} 项前置任务已完成` : `${task.dependencyTaskIds.length} prerequisites complete`)}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => edit(task)} className="inline-flex items-center gap-1 rounded-lg border border-[#b9c7c1] px-3 py-2 text-xs font-black text-[#40534c]"><Edit3 className="h-4 w-4" />{zh ? '修改' : 'Edit'}</button>{task.status !== 'completed' && task.status !== 'cancelled' ? <button type="button" disabled={task.isBlocked} onClick={() => statusMutation.mutate({ id: task.id, status: 'completed' })} className="inline-flex items-center gap-1 rounded-lg bg-[#176b5a] px-3 py-2 text-xs font-black text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{zh ? '完成' : 'Complete'}</button> : null}{task.status !== 'cancelled' ? <button type="button" onClick={() => statusMutation.mutate({ id: task.id, status: 'cancelled' })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50"><XCircle className="h-4 w-4" />{zh ? '取消' : 'Cancel'}</button> : null}</div>
            </div>
          </article>
        }) : <p className="rounded-2xl border border-dashed border-[#b9c7c1] bg-[#fafbf9] p-8 text-center text-sm text-[#718079]">{zh ? '还没有任务。只添加真正需要负责人和完成结果的工作。' : 'No tasks yet. Add only work that needs an owner and a clear outcome.'}</p>}</div>
      </section>
    </article>
    {saveMutation.error || statusMutation.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(saveMutation.error ?? statusMutation.error).message}</p> : null}{message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}
  </AppPageShell>
}

export default EventPreparationTasksView
