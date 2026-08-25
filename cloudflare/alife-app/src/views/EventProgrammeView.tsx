import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronRight, ClipboardList, Pencil, Plus, Save, UsersRound, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import EventModuleSuggestionsPanel from '../components/events/EventModuleSuggestionsPanel'
import { eventProgrammeService } from '../services/eventProgrammeService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventProgrammeItem, EventProgrammeItemStatus, SaveEventProgrammeItemPayload } from '../types/eventProgramme'
import type { EventModuleSuggestionItem } from '../types/eventModuleSuggestion'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { localizeText } from '../utils/localizedText'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const toLocalInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const toUtc = (value: string) => value ? new Date(value).toISOString() : ''
const addMinutes = (value: string, minutes: number, latest: string) => {
  const date = new Date(Math.min(new Date(value).getTime() + minutes * 60_000, new Date(latest).getTime()))
  return date.toISOString()
}

type ProgrammeForm = Omit<SaveEventProgrammeItemPayload, 'startUtc' | 'endUtc'> & { startLocal: string; endLocal: string }

const EventProgrammeView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const queryClient = useQueryClient()
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({ queryKey: ['eventProgramme', eventId], queryFn: () => eventProgrammeService.get(eventId), enabled: Boolean(eventId) })
  const workspace = query.data
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProgrammeForm | null>(null)
  const [baseline, setBaseline] = useState('')
  const [message, setMessage] = useState('')
  const dirty = Boolean(form && JSON.stringify(form) !== baseline)

  useEffect(() => {
    setUnsavedChangesGuard(dirty, chinese ? '程序单还有未保存的修改，确定离开吗？' : 'Programme changes are not saved. Leave this page?', 'confirm')
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { setUnsavedChangesGuard(false); window.removeEventListener('beforeunload', beforeUnload) }
  }, [dirty, chinese])

  const makeForm = (values?: Partial<ProgrammeForm>): ProgrammeForm => {
    const start = values?.startLocal ?? toLocalInput(workspace?.eventStartUtc ?? new Date().toISOString())
    const endUtc = addMinutes(toUtc(start), 15, workspace?.eventEndUtc ?? toUtc(start))
    return {
      eventOccurrenceId: workspace?.occurrences[0]?.id ?? null,
      rosterShiftId: null,
      ownerMemberId: null,
      sortOrder: (workspace?.items.length ?? 0) * 10,
      startLocal: start,
      endLocal: values?.endLocal ?? toLocalInput(endUtc),
      titleEn: '', titleZh: '', instructionsEn: '', instructionsZh: '',
      requiresHandover: false, handoverEn: '', handoverZh: '', status: 'draft',
      ...values,
    }
  }
  const openForm = (next: ProgrammeForm, id: string | null = null) => {
    setEditingId(id); setForm(next); setBaseline(JSON.stringify(next)); setMessage('')
  }
  const openItem = (item: EventProgrammeItem) => openForm(makeForm({
    eventOccurrenceId: item.eventOccurrenceId,
    rosterShiftId: item.rosterShiftId,
    ownerMemberId: item.ownerMemberId,
    sortOrder: item.sortOrder,
    startLocal: toLocalInput(item.startUtc), endLocal: toLocalInput(item.endUtc),
    titleEn: item.title.en, titleZh: item.title.zh,
    instructionsEn: item.instructions.en, instructionsZh: item.instructions.zh,
    requiresHandover: item.requiresHandover, handoverEn: item.handover.en, handoverZh: item.handover.zh,
    status: item.status,
  }), item.id)
  const openRoster = (shiftId: string) => {
    const option = workspace?.rosterOptions.find((item) => item.shiftId === shiftId)
    if (!option) return
    openForm(makeForm({
      rosterShiftId: option.shiftId,
      startLocal: toLocalInput(option.startUtc), endLocal: toLocalInput(option.endUtc),
      titleEn: option.name.en, titleZh: option.name.zh,
      requiresHandover: true,
    }))
  }
  const update = (next: Partial<ProgrammeForm>) => setForm((current) => current ? { ...current, ...next } : current)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('No programme item')
      const startUtc = toUtc(form.startLocal); const endUtc = toUtc(form.endLocal)
      if (!startUtc || !endUtc || Date.parse(endUtc) <= Date.parse(startUtc)) throw new Error(chinese ? '结束时间必须晚于开始时间。' : 'End time must be later than start time.')
      if (!form.titleEn.trim() && !form.titleZh.trim()) throw new Error(chinese ? '请至少填写一种语言的环节名称。' : 'Add the item title in at least one language.')
      if (form.status === 'ready' && !form.ownerMemberId && !form.rosterShiftId) throw new Error(chinese ? '确认前请指定负责人，或关联已有排班岗位。' : 'Choose an owner or link a roster shift before confirming.')
      if (form.status === 'ready' && form.requiresHandover && !form.handoverEn.trim() && !form.handoverZh.trim()) throw new Error(chinese ? '这项需要交接，请先填写交接说明。' : 'Add handover notes before confirming this item.')
      const { startLocal: _startLocal, endLocal: _endLocal, ...rest } = form
      return eventProgrammeService.saveItem(eventId, editingId, { ...rest, startUtc, endUtc })
    },
    onSuccess: async () => {
      setForm(null); setEditingId(null); setBaseline(''); setMessage(chinese ? '程序单已保存。' : 'Programme saved.')
      await queryClient.invalidateQueries({ queryKey: ['eventProgramme', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['eventPlan', eventId] })
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const linkedShiftIds = useMemo(() => new Set(workspace?.items.map((item) => item.rosterShiftId).filter(Boolean)), [workspace?.items])
  const unlinkedRosterOptions = workspace?.rosterOptions.filter((item) => !linkedShiftIds.has(item.shiftId)) ?? []
  const readyCount = workspace?.items.filter((item) => item.status === 'ready' || item.status === 'completed').length ?? 0
  const formatter = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' })
  const timeFormatter = new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { hour: '2-digit', minute: '2-digit' })
  const applyAiSuggestion = (item: EventModuleSuggestionItem) => {
    if (item.key === 'titleEn') update({ titleEn: item.value })
    if (item.key === 'titleZh') update({ titleZh: item.value })
    if (item.key === 'startUtc') update({ startLocal: toLocalInput(item.value) })
    if (item.key === 'endUtc') update({ endLocal: toLocalInput(item.value) })
    if (item.key === 'instructionsEn') update({ instructionsEn: item.value })
    if (item.key === 'instructionsZh') update({ instructionsZh: item.value })
    if (item.key === 'requiresHandover') update({ requiresHandover: item.value === 'true' })
    if (item.key === 'handoverEn') update({ handoverEn: item.value })
    if (item.key === 'handoverZh') update({ handoverZh: item.value })
  }

  if (query.isLoading) return <AppPageShell><p className="py-10 text-sm text-[#687a73]">{chinese ? '正在打开活动程序单…' : 'Opening programme…'}</p></AppPageShell>
  if (query.error || !workspace) {
    const error = normalizeApiError(query.error)
    return <AppPageShell><section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">{error.status === 409 ? (chinese ? '这项活动还没有加入程序单' : 'Programme is not in this event yet') : (chinese ? '无法打开活动程序单' : 'Unable to open programme')}</h1><p className="mt-2 text-sm leading-6 text-amber-800">{error.status === 409 ? (chinese ? '请先回到活动设置，在“按需筹备”中加入程序单；加入后再安排时间、负责人和岗位交接。' : 'Return to event settings and add Programme under optional preparation first.') : error.message}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-5 inline-flex rounded-xl bg-[#176b5a] px-4 py-2.5 text-sm font-black text-white">{chinese ? '返回活动设置' : 'Back to event settings'}</Link></section></AppPageShell>
  }

  return <AppPageShell>
    <nav aria-label={chinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="hover:text-[#123d34]">{chinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4" /><span className="text-[#123d34]">{chinese ? '程序单与交接' : 'Programme and handover'}</span></nav>
    <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(118deg,#123d34_0%,#176b5a_62%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '按需执行 · 当天程序' : 'Optional delivery · Run sheet'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{localizeText(workspace.eventTitle, language)}</h1><p className="mt-3 text-sm leading-6 text-emerald-50/80">{chinese ? '按时间列出当天真正要发生的环节。可以关联已经排好的岗位，直接看谁已接受、谁还在等待；交接说明只写现场需要知道的内容。' : 'List what actually happens on the day. Link a roster shift to see accepted and pending people without duplicating the roster workspace.'}</p></div><div className="flex flex-wrap items-center gap-3"><span className="rounded-xl bg-white/10 px-4 py-2 text-sm font-black">{readyCount}/{workspace.items.length} {chinese ? '项已确认' : 'confirmed'}</span><button type="button" onClick={() => openForm(makeForm())} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#123d34]"><Plus className="h-4 w-4" />{chinese ? '增加环节' : 'Add item'}</button></div></div>
    </header>
    {message ? <p role="status" className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{message}</p> : null}

    <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#ded6cb] bg-white shadow-[0_18px_45px_rgba(31,56,48,0.06)]" aria-labelledby="programme-timeline-title">
      <div className="flex flex-wrap items-end justify-between gap-4 bg-[#fbfaf7] px-5 py-5 sm:px-7"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#176b5a]">{chinese ? '一张时间轴' : 'One timeline'}</p><h2 id="programme-timeline-title" className="mt-1 text-xl font-black text-[#18332d]">{chinese ? '活动程序与岗位交接' : 'Programme and role handover'}</h2><p className="mt-1 text-sm text-[#71827b]">{formatter.format(new Date(workspace.eventStartUtc))} → {formatter.format(new Date(workspace.eventEndUtc))}</p></div><AppBadge variant={workspace.status === 'ready' || workspace.status === 'completed' ? 'success' : workspace.status === 'blocked' ? 'warning' : 'neutral'}>{workspace.status === 'ready' ? (chinese ? '已经就绪' : 'Ready') : workspace.status === 'blocked' ? (chinese ? '需要修正' : 'Needs attention') : (chinese ? '正在编排' : 'In progress')}</AppBadge></div>
      {workspace.items.length === 0 ? <div className="px-6 py-12 text-center"><ClipboardList className="mx-auto h-9 w-9 text-[#8fa19a]" /><p className="mt-3 font-black text-[#18332d]">{chinese ? '还没有程序环节' : 'No programme items yet'}</p><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#71827b]">{chinese ? '先增加一个实际环节，或从已有排班岗位开始。程序单不会因为创建活动而自动出现。' : 'Add a real item or start from an existing roster shift. A programme is never added automatically.'}</p></div> : <div className="divide-y divide-[#2f4b42]/10">{workspace.items.map((item) => {
        const accepted = item.roster?.assignees.filter((person) => person.status === 'accepted') ?? []
        const pending = item.roster?.assignees.filter((person) => person.status === 'confirmed' || person.status === 'changeRequested') ?? []
        return <article key={item.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:px-7"><div><p className="text-lg font-black text-[#18332d]">{timeFormatter.format(new Date(item.startUtc))}</p><p className="mt-1 text-xs text-[#82918b]">{timeFormatter.format(new Date(item.endUtc))}</p></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[#18332d]">{localizeText(item.title, language)}</h3><AppBadge variant={item.status === 'ready' || item.status === 'completed' ? 'success' : 'neutral'}>{item.status === 'completed' ? (chinese ? '已完成' : 'Completed') : item.status === 'ready' ? (chinese ? '已确认' : 'Confirmed') : (chinese ? '草稿' : 'Draft')}</AppBadge></div>{localizeText(item.instructions, language) ? <p className="mt-2 text-sm leading-6 text-[#60726b]">{localizeText(item.instructions, language)}</p> : null}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-[#60726b]"><span>{chinese ? '负责人：' : 'Owner: '}{item.ownerDisplayName || (accepted.length ? accepted.map((person) => person.displayName).join('、') : (chinese ? '待确认' : 'To confirm'))}</span>{item.roster ? <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{localizeText(item.roster.name, language)} · {accepted.length} {chinese ? '人已接受' : 'accepted'}{pending.length ? ` · ${pending.length} ${chinese ? '人待回复' : 'pending'}` : ''}</span> : null}</div>{item.requiresHandover ? <details className="mt-3 border-l-2 border-[#f4c46a] pl-3 text-xs leading-5 text-[#60726b]"><summary className="cursor-pointer font-black text-[#72561b]">{chinese ? '查看交接说明' : 'View handover'}</summary><p className="mt-1 whitespace-pre-wrap">{localizeText(item.handover, language) || (chinese ? '尚未填写' : 'Not added yet')}</p></details> : null}</div><button type="button" onClick={() => openItem(item)} className="inline-flex h-fit items-center gap-1 text-sm font-black text-[#176b5a]"><Pencil className="h-4 w-4" />{chinese ? '编辑' : 'Edit'}</button></article>
      })}</div>}
      {unlinkedRosterOptions.length ? <div className="border-t border-[#2f4b42]/10 bg-[#f7faf8] px-5 py-5 sm:px-7"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-[#176b5a]" /><div><h3 className="text-sm font-black text-[#18332d]">{chinese ? '从已排岗位加入程序单' : 'Add from existing roster'}</h3><p className="mt-1 text-xs leading-5 text-[#71827b]">{chinese ? '只带入岗位名称和时间，不会自动确认程序，也不会改动排班。' : 'Copies the role name and time only. It does not confirm the programme or change the roster.'}</p><div className="mt-3 flex flex-wrap gap-2">{unlinkedRosterOptions.map((option) => <button key={option.shiftId} type="button" onClick={() => openRoster(option.shiftId)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-800">+ {localizeText(option.name, language)}</button>)}</div></div></div></div> : null}
    </section>

    {form ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="programme-form-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2f4b42]/10 bg-white px-5 py-4 sm:px-7"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#176b5a]">{editingId ? (chinese ? '修改环节' : 'Edit item') : (chinese ? '增加环节' : 'Add item')}</p><h2 id="programme-form-title" className="mt-1 text-xl font-black text-[#18332d]">{form.titleZh || form.titleEn || (chinese ? '新的程序环节' : 'New programme item')}</h2></div><button type="button" aria-label={chinese ? '关闭' : 'Close'} onClick={() => { setForm(null); setBaseline('') }} className="rounded-xl p-2 text-[#60726b] hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]"><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40554e]">English<input value={form.titleEn} onChange={(event) => update({ titleEn: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">中文<input value={form.titleZh} onChange={(event) => update({ titleZh: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '开始' : 'Start'}<input type="datetime-local" value={form.startLocal} onChange={(event) => update({ startLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '结束' : 'End'}<input type="datetime-local" value={form.endLocal} onChange={(event) => update({ endLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '场次' : 'Session'}<select value={form.eventOccurrenceId ?? ''} onChange={(event) => update({ eventOccurrenceId: event.target.value || null })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"><option value="">{chinese ? '整个活动' : 'Whole event'}</option>{workspace.occurrences.map((item) => <option key={item.id} value={item.id}>{localizeText(item.name, language)}</option>)}</select></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '直接负责人' : 'Direct owner'}<select value={form.ownerMemberId ?? ''} onChange={(event) => update({ ownerMemberId: event.target.value || null })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"><option value="">{chinese ? '由关联岗位负责／稍后确认' : 'Linked roster / confirm later'}</option>{workspace.members.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label className="text-sm font-bold text-[#40554e] sm:col-span-2">{chinese ? '关联排班岗位（可选）' : 'Linked roster shift (optional)'}<select value={form.rosterShiftId ?? ''} onChange={(event) => update({ rosterShiftId: event.target.value || null })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"><option value="">{chinese ? '不关联' : 'Not linked'}</option>{workspace.rosterOptions.map((item) => <option key={item.shiftId} value={item.shiftId}>{localizeText(item.name, language)}</option>)}</select><span className="mt-1 block text-xs font-normal text-[#82918b]">{chinese ? '关联后只显示岗位与回复状态，排班仍在排班页面维护。' : 'The programme displays role response status; roster changes still happen in the roster workspace.'}</span></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '英文现场说明' : 'English instructions'}<textarea rows={3} value={form.instructionsEn} onChange={(event) => update({ instructionsEn: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">{chinese ? '中文现场说明' : 'Chinese instructions'}<textarea rows={3} value={form.instructionsZh} onChange={(event) => update({ instructionsZh: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={form.requiresHandover} onChange={(event) => update({ requiresHandover: event.target.checked })} className="mt-1 h-4 w-4 accent-amber-700" /><span><span className="block text-sm font-black text-amber-950">{chinese ? '这个环节需要岗位交接' : 'This item needs a handover'}</span><span className="mt-1 block text-xs leading-5 text-amber-800">{chinese ? '只记录钥匙、设备状态、集合点、联系人或下一班需要知道的现场信息，不记录私人原因。' : 'Record keys, equipment state, meeting point, contact or next-shift operational information—never private reasons.'}</span></span></label>{form.requiresHandover ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40554e]">English<textarea rows={3} value={form.handoverEn} onChange={(event) => update({ handoverEn: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><label className="text-sm font-bold text-[#40554e]">中文<textarea rows={3} value={form.handoverZh} onChange={(event) => update({ handoverZh: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div> : null}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2f4b42]/10 pt-5"><label className="text-sm font-bold text-[#40554e]">{chinese ? '状态' : 'Status'}<select value={form.status} onChange={(event) => update({ status: event.target.value as EventProgrammeItemStatus })} className="ml-2 rounded-xl border border-slate-300 px-3 py-2"><option value="draft">{chinese ? '草稿' : 'Draft'}</option><option value="ready">{chinese ? '负责人确认' : 'Leader confirmed'}</option>{editingId && Date.parse(form.startLocal) <= Date.now() ? <option value="completed">{chinese ? '现场已完成' : 'Completed on site'}</option> : null}</select></label><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex items-center gap-2 rounded-xl bg-[#176b5a] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在保存…' : 'Saving…') : (chinese ? '保存环节' : 'Save item')}</button></div></div><aside className="rounded-[1.25rem] bg-[#f7f4ee] p-5"><div className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-violet-700" /><div><h3 className="text-sm font-black text-[#18332d]">{chinese ? 'AI 只协助起草' : 'AI drafts only'}</h3><p className="mt-1 text-xs leading-5 text-[#687a73]">{chinese ? '不会选择负责人、不会确认排班、不会把草稿变成正式程序。' : 'It never chooses owners, confirms roster assignments, or turns a draft into a confirmed programme.'}</p></div></div><EventModuleSuggestionsPanel eventId={eventId} module="programme" language={language} onApply={applyAiSuggestion} guidancePlaceholder={{ zh: '例如：活动开始前安排 15 分钟同工简报，并准备签到台交接。', en: 'For example: add a 15-minute team briefing and registration-desk handover before the event.' }} /></aside></div></section></div> : null}
  </AppPageShell>
}

export default EventProgrammeView
