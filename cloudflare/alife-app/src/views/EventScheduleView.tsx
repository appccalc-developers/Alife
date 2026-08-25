import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, Bot, CalendarDays, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { eventPlanService } from '../services/eventPlanService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventPlanOccurrence } from '../types/eventPlan'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

type ScheduleRow = {
  clientId: string
  id?: string | null
  nameEn: string
  nameZh: string
  startLocal: string
  endLocal: string
  timeZoneId: string
}

const clientId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
const toLocalInput = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromOccurrence = (occurrence: EventPlanOccurrence): ScheduleRow => ({
  clientId: occurrence.id,
  id: occurrence.id,
  nameEn: occurrence.name.en,
  nameZh: occurrence.name.zh,
  startLocal: toLocalInput(occurrence.startUtc),
  endLocal: toLocalInput(occurrence.endUtc),
  timeZoneId: occurrence.timeZoneId,
})

const EventScheduleView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const editPath = groupId ? `${eventBasePath}/edit` : `/events/${encodeURIComponent(eventId)}/edit`
  const query = useQuery({ queryKey: ['eventPlan', eventId], queryFn: () => eventPlanService.get(eventId), enabled: Boolean(eventId) })
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!query.data) return
    setRows(query.data.occurrences.map(fromOccurrence))
    setDirty(false)
  }, [query.data])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, chinese ? '场次安排尚未保存，确定离开吗？' : 'The session schedule is not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirty])

  const changeRows = (update: (current: ScheduleRow[]) => ScheduleRow[]) => {
    setRows(update)
    setDirty(true)
    setMessage('')
  }
  const mutation = useMutation({
    mutationFn: () => eventPlanService.updateOccurrences(eventId, rows.map((row) => ({
      id: row.id,
      nameEn: row.nameEn,
      nameZh: row.nameZh,
      startUtc: new Date(row.startLocal).toISOString(),
      endUtc: new Date(row.endLocal).toISOString(),
      timeZoneId: row.timeZoneId,
    }))),
    onSuccess: async (occurrences) => {
      setRows(occurrences.map(fromOccurrence))
      setDirty(false)
      setMessage(chinese ? '场次安排已保存，活动方案已生成新版本。' : 'Sessions saved and a new event-plan revision was recorded.')
      await query.refetch()
    },
  })

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{chinese ? '正在打开场次安排…' : 'Opening event sessions…'}</p></AppPageShell>
  if (query.error || !query.data) return <AppPageShell><AppSectionCard title={chinese ? '无法打开场次安排' : 'Unable to open event sessions'}><p className="text-sm text-rose-700">{normalizeApiError(query.error).message}</p></AppSectionCard></AppPageShell>

  const plan = query.data
  const overallStart = toLocalInput(plan.eventStartUtc)
  const overallEnd = toLocalInput(plan.eventEndUtc)
  const addRow = () => {
    const lastEnd = rows.at(-1)?.endLocal ?? overallStart
    const start = new Date(lastEnd) < new Date(overallEnd) ? lastEnd : overallStart
    const suggestedEnd = new Date(Math.min(new Date(start).getTime() + 60 * 60_000, new Date(overallEnd).getTime()))
    changeRows((current) => [...current, {
      clientId: clientId(), id: null, nameEn: '', nameZh: '', startLocal: start,
      endLocal: toLocalInput(suggestedEnd.toISOString()),
      timeZoneId: current[0]?.timeZoneId || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }])
  }
  const updateRow = (id: string, update: Partial<ScheduleRow>) => changeRows((current) => current.map((row) => row.clientId === id ? { ...row, ...update } : row))
  const move = (index: number, direction: -1 | 1) => changeRows((current) => {
    const next = [...current]
    const target = index + direction
    if (target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const dateLabel = (value: string) => new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  return <AppPageShell>
    <Link to={eventBasePath} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />{chinese ? '返回活动流程' : 'Back to event plan'}</Link>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '活动主架构 · 场次' : 'Event architecture · Sessions'}</p>
      <h1 className="mt-2 text-3xl font-black">{chinese ? '安排多日、多时段活动' : 'Plan multi-day and multi-session events'}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85">{chinese ? '一个营会仍是一项活动；每天的聚会、用餐、接待或分会场是独立场次。报名和总负责人可以共享，时间、场地和排班则可以按场次处理。' : 'A camp remains one event. Each gathering, meal, welcome period, or breakout is a session. Registration and ownership may be shared while time, venue, and roster are handled per session.'}</p>
    </section>

    <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"><CalendarDays className="mr-2 inline h-4 w-4 text-emerald-700" />{chinese ? '活动整体时间：' : 'Overall event window: '}<strong>{dateLabel(plan.eventStartUtc)} — {dateLabel(plan.eventEndUtc)}</strong><br /><span className="mt-1 inline-block text-xs text-slate-500">{chinese ? '所有场次必须在这个范围内；如需延长整个活动，请先修改基本资料。' : 'Every session must stay inside this window. Edit the basic event facts first to extend it.'}</span></p>
      <Link to={`${editPath}?step=assistant&module=schedule`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-800"><Bot className="h-4 w-4" />{chinese ? '让 AI 建议场次拆分' : 'Ask AI for a session draft'}</Link>
    </div>

    <div className="mt-6 space-y-4">{rows.map((row, index) => <article key={row.clientId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">{chinese ? `场次 ${index + 1}` : `Session ${index + 1}`}</p><p className="mt-1 text-xs text-slate-500">{chinese ? '顺序只影响展示；允许不同场次时间重叠。' : 'Order controls display only; parallel sessions may overlap.'}</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={chinese ? '上移' : 'Move up'} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={chinese ? '下移' : 'Move down'} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => rows.length > 1 && changeRows((current) => current.filter((item) => item.clientId !== row.clientId))} disabled={rows.length === 1} aria-label={chinese ? '删除场次' : 'Remove session'} className="rounded-lg border border-rose-200 p-2 text-rose-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{chinese ? '场次名称 · 中文' : 'Session name · Chinese'}<input value={row.nameZh} onChange={(event) => updateRow(row.clientId, { nameZh: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '场次名称 · 英文' : 'Session name · English'}<input value={row.nameEn} onChange={(event) => updateRow(row.clientId, { nameEn: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '开始时间' : 'Start'}<input type="datetime-local" min={overallStart} max={overallEnd} value={row.startLocal} onChange={(event) => updateRow(row.clientId, { startLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700">{chinese ? '结束时间' : 'End'}<input type="datetime-local" min={overallStart} max={overallEnd} value={row.endLocal} onChange={(event) => updateRow(row.clientId, { endLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '时区' : 'Time zone'}<input value={row.timeZoneId} onChange={(event) => updateRow(row.clientId, { timeZoneId: event.target.value })} placeholder="Pacific/Auckland" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div>
    </article>)}</div>

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={addRow} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800"><Plus className="h-4 w-4" />{chinese ? '添加场次' : 'Add session'}</button><button type="button" onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在保存…' : 'Saving…') : (chinese ? '保存场次安排' : 'Save sessions')}</button></div>
    {mutation.error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(mutation.error).message}</p> : null}
    {message ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}
  </AppPageShell>
}

export default EventScheduleView
