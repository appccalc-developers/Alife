import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarCheck2, CheckCircle2, Clock3, Save, ShieldCheck, UserCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { eventAttendanceService } from '../services/eventAttendanceService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventAttendanceEnrollment, EventAttendanceRecord } from '../types/eventAttendance'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

type RowDraft = { units: string; notes: string }

const rowKey = (occurrenceId: string, enrollmentId?: string | null) => `${occurrenceId}:${enrollmentId ?? 'additional'}`
const localize = (value: { en: string; zh: string }, chinese: boolean) => (chinese ? value.zh : value.en) || value.en || value.zh
const formatDateTime = (value: string, chinese: boolean) => new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))

const EventAttendanceView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({
    queryKey: ['eventAttendance', eventId],
    queryFn: () => eventAttendanceService.getWorkspace(eventId),
    enabled: Boolean(eventId),
  })
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [pendingKey, setPendingKey] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const workspace = query.data
    if (!workspace) return
    setDrafts((current) => {
      const next = { ...current }
      workspace.occurrences.forEach((occurrence) => {
        const rows: Array<EventAttendanceEnrollment | null> = [...workspace.enrollments, null]
        rows.forEach((enrollment) => {
          const key = rowKey(occurrence.id, enrollment?.id)
          if (dirtyKeys.has(key)) return
          const record = workspace.records.find((item) => item.eventOccurrenceId === occurrence.id
            && (item.eventEnrollmentId ?? null) === (enrollment?.id ?? null))
          next[key] = { units: record ? String(record.attendedUnits) : '0', notes: record?.notes ?? '' }
        })
      })
      return next
    })
  }, [dirtyKeys, query.data])

  useEffect(() => {
    const dirty = dirtyKeys.size > 0
    setUnsavedChangesGuard(dirty, chinese ? '还有未保存的出席记录，确定离开吗？' : 'Attendance changes are not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirtyKeys.size])

  const mutation = useMutation({
    mutationFn: ({ occurrenceId, enrollmentId, key }: { occurrenceId: string; enrollmentId?: string | null; key: string }) => {
      const draft = drafts[key] ?? { units: '0', notes: '' }
      return eventAttendanceService.saveRecord(eventId, {
        eventOccurrenceId: occurrenceId,
        eventEnrollmentId: enrollmentId ?? null,
        attendedUnits: Number(draft.units),
        notes: draft.notes,
      })
    },
    onMutate: ({ key }) => { setPendingKey(key); setMessage('') },
    onSuccess: (record, variables) => {
      setDrafts((current) => ({ ...current, [variables.key]: { units: String(record.attendedUnits), notes: record.notes } }))
      setDirtyKeys((current) => { const next = new Set(current); next.delete(variables.key); return next })
      setMessage(chinese ? '出席记录已保存；如结项已经确认，系统会要求重新确认。' : 'Attendance saved. A previously confirmed closure now requires confirmation again.')
    },
    onSettled: () => setPendingKey(''),
  })

  const savedRecords = useMemo(() => new Map((query.data?.records ?? []).map((record) => [rowKey(record.eventOccurrenceId, record.eventEnrollmentId), record])), [query.data?.records])
  const updateDraft = (key: string, patch: Partial<RowDraft>) => {
    setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? { units: '0', notes: '' }), ...patch } }))
    setDirtyKeys((current) => new Set(current).add(key))
    setMessage('')
  }

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{chinese ? '正在打开出席记录…' : 'Opening attendance records…'}</p></AppPageShell>
  if (query.error || !query.data) return <AppPageShell><AppSectionCard title={chinese ? '无法打开出席记录' : 'Unable to open attendance'}><p className="text-sm text-rose-700">{normalizeApiError(query.error).message}</p></AppSectionCard></AppPageShell>

  const workspace = query.data
  const title = localize(workspace.title, chinese)
  const unitLabel = workspace.capacityUnit === 'Families' ? (chinese ? '家庭' : 'families') : (chinese ? '人' : 'people')

  return <AppPageShell>
    <Link to={`${eventBasePath}?section=workflow`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />{chinese ? '返回活动流程' : 'Back to event plan'}</Link>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '活动举办 · 出席记录' : 'Event delivery · Attendance'}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85">{chinese ? '按实际场次记录报名者出席数量和额外现场人数。这里只记录已经发生的事实，不由 AI 猜测。' : 'Record registered attendance and additional walk-ins for each real session. This workspace records verified facts; AI does not infer them.'}</p></div><AppBadge variant="neutral"><ShieldCheck className="mr-1 inline h-4 w-4" />{chinese ? '仅活动负责人可见' : 'Leaders only'}</AppBadge></div>
    </section>

    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <AppSectionCard dense title={chinese ? '实际出席' : 'Actual attendance'}><p className="text-3xl font-black text-slate-950">{workspace.totalAttendedUnits}</p><p className="mt-1 text-xs text-slate-500">{unitLabel}</p></AppSectionCard>
      <AppSectionCard dense title={chinese ? '报名数量' : 'Registered units'}><p className="text-3xl font-black text-slate-950">{workspace.totalRegisteredUnits}</p><p className="mt-1 text-xs text-slate-500">{unitLabel}</p></AppSectionCard>
      <AppSectionCard dense title={chinese ? '已开始场次' : 'Started sessions'}><p className="text-3xl font-black text-slate-950">{workspace.occurrences.filter((item) => item.canRecord).length}/{workspace.occurrences.length}</p><p className="mt-1 text-xs text-slate-500">{chinese ? '未开始的场次不能填写' : 'Future sessions stay locked'}</p></AppSectionCard>
    </div>

    <div className="mt-6 space-y-5">
      {workspace.occurrences.map((occurrence) => {
        const rows: Array<EventAttendanceEnrollment | null> = [...workspace.enrollments, null]
        return <AppSectionCard key={occurrence.id} title={localize(occurrence.name, chinese)} subtitle={`${formatDateTime(occurrence.startUtc, chinese)} → ${formatDateTime(occurrence.endUtc, chinese)}`} action={<AppBadge variant={occurrence.canRecord ? 'success' : 'neutral'}>{occurrence.canRecord ? (chinese ? `已记录 ${occurrence.attendedUnits}` : `${occurrence.attendedUnits} recorded`) : (chinese ? '尚未开始' : 'Not started')}</AppBadge>}>
          {!occurrence.canRecord ? <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><p>{chinese ? '场次开始后才可记录出席，避免把预计人数当作实际结果。' : 'Attendance unlocks after the session starts so estimates are not stored as actual results.'}</p></div> : (
            <div className="space-y-3">
              {rows.map((enrollment) => {
                const key = rowKey(occurrence.id, enrollment?.id)
                const draft = drafts[key] ?? { units: '0', notes: '' }
                const existing = savedRecords.get(key) as EventAttendanceRecord | undefined
                const units = Number(draft.units)
                const invalid = !Number.isInteger(units) || units < 0 || units > 10000
                return <div key={key} className={['grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(12rem,1fr)_8rem_minmax(14rem,1.3fr)_auto]', enrollment ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50/50'].join(' ')}>
                  <div className="flex items-start gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-700">{enrollment ? <UserCheck className="h-4 w-4" /> : <CalendarCheck2 className="h-4 w-4" />}</span><div><p className="text-sm font-black text-slate-950">{enrollment ? enrollment.applicantName || (chinese ? '未填写报名姓名' : 'Registration without a name') : (workspace.enrollments.length ? (chinese ? '额外现场参加' : 'Additional walk-ins') : (chinese ? '本场总出席' : 'Total session attendance'))}</p><p className="mt-1 text-xs text-slate-500">{enrollment ? `${chinese ? '报名' : 'Reserved'} ${enrollment.reservedUnits} ${unitLabel}` : (chinese ? '不属于上述报名记录的人数' : 'People not represented by registrations')}</p></div></div>
                  <label className="text-xs font-bold text-slate-600">{chinese ? '实际数量' : 'Actual units'}<input type="number" min={0} max={10000} step={1} value={draft.units} onChange={(event) => updateDraft(key, { units: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
                  <label className="text-xs font-bold text-slate-600">{chinese ? '备注（可选）' : 'Notes (optional)'}<input maxLength={1000} value={draft.notes} onChange={(event) => updateDraft(key, { notes: event.target.value })} placeholder={chinese ? '例如：临时离场、现场报名' : 'For example: left early or registered on site'} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
                  <div className="flex items-end"><button type="button" disabled={pendingKey === key || !dirtyKeys.has(key) || invalid} onClick={() => mutation.mutate({ occurrenceId: occurrence.id, enrollmentId: enrollment?.id ?? null, key })} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{pendingKey === key ? (chinese ? '保存中…' : 'Saving…') : existing ? (chinese ? '更新' : 'Update') : (chinese ? '保存' : 'Save')}</button></div>
                  {invalid ? <p className="text-xs font-bold text-rose-700 lg:col-start-2 lg:col-span-3">{chinese ? '请输入 0 到 10,000 之间的整数。' : 'Enter a whole number from 0 to 10,000.'}</p> : null}
                </div>
              })}
            </div>
          )}
        </AppSectionCard>
      })}
    </div>

    {mutation.error ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(mutation.error).message}</p> : null}
    {message ? <p className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}
  </AppPageShell>
}

export default EventAttendanceView
