import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarPlus2, Check, CheckCircle2, ChevronRight, CircleAlert, Plus, Repeat2, Save, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import EventWorkspaceNav from '../components/events/EventWorkspaceNav'
import AppPageShell from '../components/layout/AppPageShell'
import { activeEntityService } from '../services/activeEntityService'
import { eventSeriesService } from '../services/eventSeriesService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { EventSeries, EventSeriesModule, SaveEventSeries } from '../types/eventSeries'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

type SeriesForm = SaveEventSeries & { id: string | null; startTime: string }

const moduleOptions: Array<{ key: EventSeriesModule; en: string; zh: string; detailEn: string; detailZh: string }> = [
  { key: 'venue', en: 'Venue request', zh: '场地申请', detailEn: 'Each event makes its own request.', detailZh: '每次活动分别提出申请。' },
  { key: 'registration', en: 'Registration', zh: '开放报名', detailEn: 'Capacity and deadline stay per event.', detailZh: '容量和截止时间按每次活动核对。' },
  { key: 'finance', en: 'Finance', zh: '费用与财务', detailEn: 'Charges and reconciliation stay per event.', detailZh: '收费与对账按每次活动处理。' },
  { key: 'ram', en: 'Risk assessment', zh: '风险评估', detailEn: 'Approval never carries to another event.', detailZh: '批准结果不会沿用到下一次。' },
  { key: 'roster', en: 'Volunteer roster', zh: '同工排班', detailEn: 'Members still confirm each assignment.', detailZh: '成员仍需确认每次安排。' },
  { key: 'programme', en: 'Programme and handover', zh: '程序单与交接', detailEn: 'Each generated event builds and confirms its own run sheet.', detailZh: '每次生成的活动分别编排并确认当天程序。' },
]

const emptyForm = (): SeriesForm => ({
  id: null,
  nameEn: '', nameZh: '', descriptionEn: '', descriptionZh: '',
  timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  anchorLocalDate: '', startTime: '', startTimeMinutes: 0,
  durationMinutes: 90, intervalWeeks: 1, generationHorizonWeeks: 8, lowHorizonWeeks: 4,
  visibility: 'groupVisible', defaultModules: [], isActive: true,
})

const minutesToTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1
}
const toForm = (series: EventSeries): SeriesForm => ({
  id: series.id,
  nameEn: series.name.en, nameZh: series.name.zh,
  descriptionEn: series.description.en, descriptionZh: series.description.zh,
  timeZoneId: series.timeZoneId, anchorLocalDate: series.anchorLocalDate,
  startTime: minutesToTime(series.startTimeMinutes), startTimeMinutes: series.startTimeMinutes,
  durationMinutes: series.durationMinutes, intervalWeeks: series.intervalWeeks,
  generationHorizonWeeks: series.generationHorizonWeeks, lowHorizonWeeks: series.lowHorizonWeeks,
  visibility: series.visibility, defaultModules: series.defaultModules, isActive: series.isActive,
})

const inputClass = 'mt-1.5 w-full rounded-xl border border-[#d7dfdb] bg-white px-3.5 py-2.5 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'

const EventSeriesView = () => {
  const { groupId: routeGroupId = '' } = useParams<{ groupId?: string }>()
  const groupId = routeGroupId || activeEntityService.getAll().groupId
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const [form, setForm] = useState<SeriesForm>(emptyForm)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const initializedSelection = useRef(false)
  const query = useQuery({
    queryKey: eventSeriesService.key(groupId),
    queryFn: () => eventSeriesService.list(groupId),
    enabled: Boolean(groupId),
  })

  useEffect(() => {
    if (initializedSelection.current || !query.data) return
    initializedSelection.current = true
    if (query.data[0]) setForm(toForm(query.data[0]))
  }, [query.data])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, chinese ? '活动系列设置尚未保存，确定离开吗？' : 'The event series is not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirty])

  const update = (patch: Partial<SeriesForm>) => {
    setForm((current) => ({ ...current, ...patch }))
    setDirty(true)
    setMessage('')
  }
  const chooseSeries = (series: EventSeries) => {
    if (dirty && !window.confirm(chinese ? '当前修改尚未保存，确定切换系列吗？' : 'Current changes are not saved. Switch series?')) return
    setForm(toForm(series)); setDirty(false); setMessage('')
  }
  const createNew = () => {
    if (dirty && !window.confirm(chinese ? '当前修改尚未保存，确定新建系列吗？' : 'Current changes are not saved. Create a new series?')) return
    setForm(emptyForm()); setDirty(false); setMessage('')
  }
  const valid = Boolean(groupId && (form.nameEn.trim() || form.nameZh.trim()) && form.anchorLocalDate && form.startTime
    && timeToMinutes(form.startTime) >= 0 && form.durationMinutes >= 15
    && form.lowHorizonWeeks <= form.generationHorizonWeeks)
  const selectedSeries = query.data?.find((series) => series.id === form.id) ?? null
  const saveMutation = useMutation({
    mutationFn: () => eventSeriesService.save(groupId, form.id, { ...form, startTimeMinutes: timeToMinutes(form.startTime) }),
    onSuccess: async (saved) => {
      setForm(toForm(saved)); setDirty(false)
      setMessage(chinese ? '系列已保存。系统没有自动创建活动。' : 'Series saved. No events were generated automatically.')
      await query.refetch()
    },
  })
  const generateMutation = useMutation({
    mutationFn: (series: EventSeries) => eventSeriesService.generate(groupId, series.id, series.generationHorizonWeeks),
    onSuccess: async (result) => {
      setMessage(chinese
        ? `已生成 ${result.createdCount} 个活动草稿；${result.existingCount} 个已有日期没有重复创建。`
        : `Created ${result.createdCount} event drafts; ${result.existingCount} existing dates were not duplicated.`)
      const refreshed = await query.refetch()
      const current = refreshed.data?.find((series) => series.id === result.seriesId)
      if (current) setForm(toForm(current))
    },
  })
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }), [chinese])

  if (!groupId) return <AppPageShell><div className="rounded-3xl border border-amber-200 bg-amber-50 p-8"><h1 className="text-xl font-black text-amber-950">{chinese ? '请先选择小组' : 'Select a group first'}</h1><Link to="/groups/select" className="mt-4 inline-flex font-black text-emerald-800">{chinese ? '选择小组' : 'Select group'}</Link></div></AppPageShell>

  return <AppPageShell>
    <EventWorkspaceNav groupId={groupId} currentGroupRoute={!routeGroupId} active="series" language={language} />

    <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#123d34_0%,#176b5a_58%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '可选结构 · 重复活动' : 'Optional structure · Recurring events'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{chinese ? '用系列管理重复，不复制决定' : 'Repeat the schedule, not the decisions'}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/80">{chinese ? '系列只保存重复规则和默认筹备起点。真实活动由负责人明确生成，并分别完成场地、报名、财务、风险、排班和发布。一次性活动不需要进入这里。' : 'A series stores recurrence and default preparation only. A leader explicitly generates real events, and each event separately completes venue, registration, finance, risk, roster and publication.'}</p></div>
        <button type="button" onClick={createNew} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#123d34] shadow-lg transition hover:-translate-y-0.5"><Plus className="h-4 w-4" />{chinese ? '新建活动系列' : 'New event series'}</button>
      </div>
    </header>

    {saveMutation.error || generateMutation.error || query.error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{normalizeApiError(saveMutation.error ?? generateMutation.error ?? query.error).message}</p> : null}
    {message ? <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</p> : null}

    <section className="min-h-[44rem] overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_22px_55px_rgba(31,56,48,0.08)] xl:grid xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="border-b border-[#2f4b42]/10 bg-[#f3f7f5] p-4 xl:border-b-0 xl:border-r xl:p-5">
        <div className="flex items-center justify-between gap-3 px-1"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d7e77]">{chinese ? '系列目录' : 'Series directory'}</p><p className="mt-1 text-sm font-bold text-[#18332d]">{query.data?.length ?? 0} {chinese ? '个系列' : 'series'}</p></div><Repeat2 className="h-5 w-5 text-[#176b5a]" /></div>
        <div className="mt-4 space-y-1.5" role="listbox" aria-label={chinese ? '选择活动系列' : 'Select event series'}>
          {query.isLoading ? <p className="px-3 py-6 text-sm text-[#71827b]">{chinese ? '正在读取…' : 'Loading…'}</p> : query.data?.length ? query.data.map((series) => {
            const selected = form.id === series.id
            const name = chinese ? series.name.zh || series.name.en : series.name.en || series.name.zh
            return <button key={series.id} type="button" role="option" aria-selected={selected} onClick={() => chooseSeries(series)} className={['group w-full rounded-2xl px-3.5 py-3 text-left transition', selected ? 'bg-[#173f36] text-white shadow-[0_10px_26px_rgba(23,63,54,0.18)]' : 'text-[#40554e] hover:bg-white'].join(' ')}>
              <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-black">{name}</span><span className={['mt-1 block text-[11px] font-semibold', selected ? 'text-emerald-100/75' : 'text-[#82918b]'].join(' ')}>{series.intervalWeeks === 1 ? (chinese ? '每周' : 'Weekly') : (chinese ? `每 ${series.intervalWeeks} 周` : `Every ${series.intervalWeeks} weeks`)} · {minutesToTime(series.startTimeMinutes)}</span></span><ChevronRight className={['mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5', selected ? 'text-emerald-200' : 'text-[#9aa7a2]'].join(' ')} /></span>
              <span className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em]">{series.needsGeneration ? <><CircleAlert className="h-3.5 w-3.5 text-amber-400" /><span className={selected ? 'text-amber-200' : 'text-amber-700'}>{chinese ? '未来覆盖不足' : 'Low coverage'}</span></> : <><Check className="h-3.5 w-3.5 text-emerald-500" /><span className={selected ? 'text-emerald-200' : 'text-emerald-700'}>{chinese ? '未来覆盖充足' : 'Coverage ready'}</span></>}</span>
            </button>
          }) : <div className="px-2 py-8 text-center"><p className="text-sm font-bold text-[#40554e]">{chinese ? '还没有活动系列' : 'No event series yet'}</p><p className="mt-2 text-xs leading-5 text-[#82918b]">{chinese ? '只有真正重复举办的活动才需要建立。' : 'Create one only for genuinely recurring events.'}</p></div>}
        </div>
      </aside>

      <main className="min-w-0 px-5 py-6 sm:px-7 sm:py-8 lg:px-9">
        <div className="flex flex-col gap-4 border-b border-[#2f4b42]/10 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#176b5a]">{form.id ? (chinese ? '系列设置' : 'Series settings') : (chinese ? '新系列' : 'New series')}</p><h2 className="mt-1 text-2xl font-black tracking-[-0.025em] text-[#18332d]">{form.id ? (chinese ? form.nameZh || form.nameEn : form.nameEn || form.nameZh) : (chinese ? '建立重复活动规则' : 'Create a recurrence rule')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#71827b]">{chinese ? '保存不会创建活动；生成是另一个明确动作。' : 'Saving creates no events; generation is a separate explicit action.'}</p></div><button type="button" disabled={!dirty || !valid || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(23,107,90,0.2)] transition hover:bg-[#0f574a] disabled:cursor-not-allowed disabled:opacity-40"><Save className="h-4 w-4" />{saveMutation.isPending ? (chinese ? '保存中…' : 'Saving…') : (chinese ? '保存系列' : 'Save series')}</button></div>

        {selectedSeries ? <div className="grid border-b border-[#2f4b42]/10 py-5 md:grid-cols-[1fr_1fr_1fr_auto] md:divide-x md:divide-[#2f4b42]/10"><div className="px-1 py-2 md:px-4 md:first:pl-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#82918b]">{chinese ? '未来覆盖' : 'Future coverage'}</p><p className="mt-1 text-sm font-black text-[#18332d]">{selectedSeries.generatedThroughLocalDate || (chinese ? '尚未生成' : 'Not generated')}</p></div><div className="px-1 py-2 md:px-4"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#82918b]">{chinese ? '已生成活动' : 'Generated events'}</p><p className="mt-1 text-sm font-black text-[#18332d]">{selectedSeries.instances.length}</p></div><div className="px-1 py-2 md:px-4"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#82918b]">{chinese ? '状态' : 'Status'}</p><p className="mt-1 text-sm font-black text-[#18332d]">{selectedSeries.isActive ? (selectedSeries.needsGeneration ? (chinese ? '需要补充未来活动' : 'Needs more coverage') : (chinese ? '正常' : 'Ready')) : (chinese ? '已停用' : 'Inactive')}</p></div><div className="flex items-center px-1 py-2 md:pl-5"><button type="button" disabled={dirty || !selectedSeries.isActive || generateMutation.isPending} onClick={() => generateMutation.mutate(selectedSeries)} className="inline-flex items-center gap-2 rounded-xl border border-[#176b5a]/20 bg-[#e8f5ef] px-4 py-2.5 text-xs font-black text-[#0f574a] transition hover:bg-[#d9eee5] disabled:opacity-40"><CalendarPlus2 className="h-4 w-4" />{chinese ? `生成 ${selectedSeries.generationHorizonWeeks} 周` : `Generate ${selectedSeries.generationHorizonWeeks} weeks`}</button></div></div> : null}

        {selectedSeries?.instances.length ? <details className="border-b border-[#2f4b42]/10 py-4"><summary className="cursor-pointer text-sm font-black text-[#40554e]">{chinese ? '查看最近生成的活动' : 'View recently generated events'}</summary><div className="mt-3 divide-y divide-[#2f4b42]/10">{selectedSeries.instances.slice(-8).map((instance) => <div key={instance.eventId} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-[#60726b]">{dateFormatter.format(new Date(instance.startUtc))}</span><Link to={routeGroupId ? `/groups/${encodeURIComponent(groupId)}/events/${instance.eventId}` : `/events/${instance.eventId}`} className="font-black text-[#176b5a] hover:underline">{chinese ? '打开活动' : 'Open event'}</Link></div>)}</div></details> : null}

        <div className="space-y-8 pt-7">
          <section aria-labelledby="series-identity-title"><div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"><div><h3 id="series-identity-title" className="text-sm font-black text-[#18332d]">{chinese ? '名称与说明' : 'Name and description'}</h3><p className="mt-1 text-xs leading-5 text-[#82918b]">{chinese ? '这是系列共用的基本内容。' : 'Shared identity for the series.'}</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#53665f]">系列名称 · 中文<input value={form.nameZh} maxLength={300} onChange={(e) => update({ nameZh: e.target.value })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">Series name · English<input value={form.nameEn} maxLength={300} onChange={(e) => update({ nameEn: e.target.value })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">说明 · 中文<textarea rows={3} value={form.descriptionZh} maxLength={2000} onChange={(e) => update({ descriptionZh: e.target.value })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">Description · English<textarea rows={3} value={form.descriptionEn} maxLength={2000} onChange={(e) => update({ descriptionEn: e.target.value })} className={inputClass} /></label></div></div></section>

          <section aria-labelledby="series-time-title" className="border-t border-[#2f4b42]/10 pt-8"><div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"><div><h3 id="series-time-title" className="text-sm font-black text-[#18332d]">{chinese ? '重复时间' : 'Recurrence'}</h3><p className="mt-1 text-xs leading-5 text-[#82918b]">{chinese ? '第一次日期决定星期几；每次只生成有限周数。' : 'The first date sets the weekday; generation is always bounded.'}</p></div><div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><label className="text-sm font-bold text-[#53665f]">{chinese ? '第一次日期' : 'First date'}<input type="date" value={form.anchorLocalDate} onChange={(e) => update({ anchorLocalDate: e.target.value })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">{chinese ? '开始时间' : 'Start time'}<input type="time" value={form.startTime} onChange={(e) => update({ startTime: e.target.value })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">{chinese ? '持续分钟' : 'Duration (minutes)'}<input type="number" min={15} max={4320} value={form.durationMinutes} onChange={(e) => update({ durationMinutes: Number(e.target.value) })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">{chinese ? '每几周一次' : 'Every N weeks'}<input type="number" min={1} max={12} value={form.intervalWeeks} onChange={(e) => update({ intervalWeeks: Number(e.target.value) })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">{chinese ? '生成未来周数' : 'Generation horizon'}<input type="number" min={1} max={52} value={form.generationHorizonWeeks} onChange={(e) => update({ generationHorizonWeeks: Number(e.target.value) })} className={inputClass} /></label><label className="text-sm font-bold text-[#53665f]">{chinese ? '低于几周时提醒' : 'Warn below weeks'}<input type="number" min={1} max={26} value={form.lowHorizonWeeks} onChange={(e) => update({ lowHorizonWeeks: Number(e.target.value) })} className={inputClass} /></label></div><label className="mt-4 block text-sm font-bold text-[#53665f]">{chinese ? '时区' : 'Time zone'}<input value={form.timeZoneId} maxLength={100} onChange={(e) => update({ timeZoneId: e.target.value })} className={inputClass} /></label></div></div></section>

          <section aria-labelledby="series-visibility-title" className="border-t border-[#2f4b42]/10 pt-8"><div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"><div><h3 id="series-visibility-title" className="text-sm font-black text-[#18332d]">{chinese ? '默认可见范围' : 'Default visibility'}</h3><p className="mt-1 text-xs leading-5 text-[#82918b]">{chinese ? '生成后仍可逐次调整。' : 'Review it again per event.'}</p></div><div className="inline-grid overflow-hidden rounded-xl border border-[#d7dfdb] sm:grid-cols-3">{([['groupVisible', '小组内', 'Group'], ['churchVisible', '教会内', 'Church'], ['public', '公开', 'Public']] as const).map(([value, zh, en]) => <label key={value} className={['cursor-pointer px-5 py-3 text-center text-sm font-black transition', form.visibility === value ? 'bg-[#173f36] text-white' : 'bg-white text-[#60726b] hover:bg-[#f3f7f5]'].join(' ')}><input type="radio" name="series-visibility" checked={form.visibility === value} onChange={() => update({ visibility: value })} className="sr-only" />{chinese ? zh : en}</label>)}</div></div></section>

          <section aria-labelledby="series-modules-title" className="border-t border-[#2f4b42]/10 pt-8"><div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"><div><h3 id="series-modules-title" className="text-sm font-black text-[#18332d]">{chinese ? '默认筹备项目' : 'Default preparation'}</h3><p className="mt-1 text-xs leading-5 text-[#82918b]">{chinese ? '默认全不选。只复制起点，不复制结果。' : 'All start off. Copy the starting point, never the outcome.'}</p></div><div className="divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">{moduleOptions.map((option) => { const selected = form.defaultModules.includes(option.key); return <label key={option.key} className="flex cursor-pointer items-center gap-4 py-3.5"><span className={['grid h-5 w-5 shrink-0 place-items-center rounded-md border transition', selected ? 'border-[#176b5a] bg-[#176b5a] text-white' : 'border-[#b9c5c0] bg-white'].join(' ')}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span><input type="checkbox" checked={selected} onChange={(e) => update({ defaultModules: e.target.checked ? [...form.defaultModules, option.key] : form.defaultModules.filter((key) => key !== option.key) })} className="sr-only" /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#40554e]">{chinese ? option.zh : option.en}</span><span className="mt-0.5 block text-xs leading-5 text-[#82918b]">{chinese ? option.detailZh : option.detailEn}</span></span></label> })}</div></div></section>

          <section className="border-t border-[#2f4b42]/10 pt-8"><div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]"><div><h3 className="text-sm font-black text-[#18332d]">{chinese ? '系列状态' : 'Series status'}</h3></div><div><label className="flex cursor-pointer items-start gap-4"><span className={['relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', form.isActive ? 'bg-[#176b5a]' : 'bg-[#bdc8c4]'].join(' ')}><span className={['absolute top-1 h-4 w-4 rounded-full bg-white shadow transition', form.isActive ? 'left-6' : 'left-1'].join(' ')} /></span><input type="checkbox" checked={form.isActive} onChange={(e) => update({ isActive: e.target.checked })} className="sr-only" /><span><span className="block text-sm font-black text-[#40554e]">{form.isActive ? (chinese ? '系列已启用' : 'Series is active') : (chinese ? '系列已停用' : 'Series is inactive')}</span><span className="mt-1 block text-xs leading-5 text-[#82918b]">{chinese ? '停用后保留历史活动，但不能继续生成。' : 'Inactive series keep historical events but cannot generate more.'}</span></span></label><p className="mt-5 inline-flex items-start gap-2 text-xs font-bold leading-5 text-violet-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{chinese ? '生成的活动全部是草稿，负责人仍需逐次核对并发布。' : 'Generated events are drafts; a leader reviews and publishes each one.'}</p></div></div></section>
        </div>
      </main>
    </section>
  </AppPageShell>
}

export default EventSeriesView
