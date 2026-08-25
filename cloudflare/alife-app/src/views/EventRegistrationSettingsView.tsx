import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, Save, UsersRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppPageShell from '../components/layout/AppPageShell'
import EventModuleSuggestionsPanel from '../components/events/EventModuleSuggestionsPanel'
import { eventRegistrationService } from '../services/eventRegistrationService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

const toLocalInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const EventRegistrationSettingsView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const { language } = useAuthStore()
  const chinese = language === 'zh'
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const query = useQuery({
    queryKey: ['eventRegistration', eventId],
    queryFn: () => eventRegistrationService.getWorkspace(eventId),
    enabled: Boolean(eventId),
  })
  const [maxCapacity, setMaxCapacity] = useState(1)
  const [capacityUnit, setCapacityUnit] = useState<'People' | 'Families'>('People')
  const [deadline, setDeadline] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!query.data) return
    setMaxCapacity(Math.max(1, query.data.maxCapacity || 1))
    setCapacityUnit(query.data.capacityUnit)
    setDeadline(toLocalInput(query.data.registrationDeadlineUtc))
    setDirty(false)
  }, [query.data])

  useEffect(() => {
    setUnsavedChangesGuard(dirty, chinese ? '报名设置尚未保存，确定离开吗？' : 'Registration settings are not saved. Leave this page?', 'confirm')
    if (!dirty) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, dirty])

  const change = (apply: () => void) => {
    apply()
    setDirty(true)
    setSavedMessage('')
  }

  const mutation = useMutation({
    mutationFn: () => eventRegistrationService.updateSettings(eventId, {
      maxCapacity,
      capacityUnit,
      registrationDeadlineUtc: deadline ? new Date(deadline).toISOString() : null,
    }),
    onSuccess: async () => {
      setDirty(false)
      setSavedMessage(chinese ? '报名设置已保存，流程状态已重新计算。' : 'Registration settings saved and the plan status was recalculated.')
      await query.refetch()
    },
    onError: () => setSavedMessage(''),
  })

  if (query.isLoading) return <AppPageShell><p className="py-12 text-sm text-slate-600">{chinese ? '正在打开报名工作区…' : 'Opening registration workspace…'}</p></AppPageShell>
  if (query.error || !query.data) {
    const error = normalizeApiError(query.error)
    return <AppPageShell><section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">{error.status === 409 ? (chinese ? '这项活动还没有加入报名' : 'Registration is not in this event yet') : (chinese ? '无法打开报名工作区' : 'Unable to open registration workspace')}</h1><p className="mt-2 text-sm leading-6 text-amber-800">{error.status === 409 ? (chinese ? '请先回到活动设置，在“按需筹备”中加入报名；加入后再设置人数和截止时间。' : 'Return to event settings and add Registration under optional preparation before setting capacity and deadline.') : error.message}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">{chinese ? '返回活动设置' : 'Back to event settings'}</Link></section></AppPageShell>
  }

  const workspace = query.data
  const statusCopy = {
    notConfigured: chinese ? '尚未设置' : 'Not configured',
    invalid: chinese ? '需要修正' : 'Needs attention',
    open: chinese ? '报名开放中' : 'Registration open',
    closed: chinese ? '报名已截止' : 'Registration closed',
    full: chinese ? '名额已满' : 'At capacity',
  }[workspace.status]
  const unit = workspace.capacityUnit === 'Families'
    ? (chinese ? '个家庭' : 'families')
    : (chinese ? '人' : 'people')
  const blockingMessage = chinese
    ? ({
        notConfigured: '请先设置容量和报名截止时间。',
        invalid: '报名设置存在问题，请检查容量和截止时间。',
        closed: '报名截止时间已过。',
        full: '当前设置的名额已经用完。',
        open: '',
      } as const)[workspace.status]
    : workspace.blockingReason

  return <AppPageShell>
    <nav aria-label={chinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]">
      <Link to={`${eventBasePath}?section=workflow`} className="inline-flex items-center gap-2 hover:text-[#123d34]"><ArrowLeft className="h-4 w-4" />{chinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{chinese ? '报名设置' : 'Registration'}</span>
    </nav>

    <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#123d34_0%,#176b5a_58%,#2c6079_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(18,61,52,0.18)] sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/[0.035]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '按需筹备 · 报名' : 'Optional preparation · Registration'}</p><h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">{chinese ? workspace.titleZh || workspace.titleEn : workspace.titleEn || workspace.titleZh}</h1><p className="mt-3 text-sm leading-6 text-emerald-50/80">{chinese ? '报名已经加入本次活动流程。请在这里设置规则、查看容量和处理名单；若本次不需要报名，请回到活动设置移除该筹备项目。' : 'Registration is part of this event plan. Configure the rules, capacity and list here; remove the module from event setup if it is not needed.'}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-3 inline-flex text-xs font-black text-emerald-100 underline decoration-emerald-200/60 underline-offset-4">{chinese ? '调整本次筹备项目' : 'Adjust preparation modules'}</Link></div><AppBadge variant={workspace.status === 'open' ? 'success' : workspace.status === 'invalid' ? 'warning' : 'neutral'}>{statusCopy}</AppBadge></div>
    </header>

    <article className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_24px_65px_rgba(31,56,48,0.08)]">
      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <section className="p-5 sm:p-7 lg:p-8">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">01</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '设置报名规则' : 'Configure registration rules'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a73]">{chinese ? '容量和截止时间由负责人确认；这里不再重复询问是否需要报名。' : 'The leader confirms capacity and deadline here; whether the module is needed is decided once in event setup.'}</p></div>

          <div className="mt-7 border-t border-[#2f4b42]/10 pt-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#40534c]">{chinese ? '最多接收' : 'Capacity'}<input type="number" min={1} step={1} value={maxCapacity} onChange={(event) => change(() => setMaxCapacity(Number(event.target.value)))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3 outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-[#176b5a]/10" /></label><label className="text-sm font-bold text-[#40534c]">{chinese ? '按什么计算' : 'Measured in'}<select value={capacityUnit} onChange={(event) => change(() => setCapacityUnit(event.target.value as 'People' | 'Families'))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] bg-white px-3.5 py-3 outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-[#176b5a]/10"><option value="People">{chinese ? '人数' : 'People'}</option><option value="Families">{chinese ? '家庭数' : 'Families'}</option></select></label><label className="text-sm font-bold text-[#40534c] sm:col-span-2">{chinese ? '报名截止时间' : 'Registration deadline'}<input type="datetime-local" value={deadline} max={toLocalInput(workspace.startUtc)} onChange={(event) => change(() => setDeadline(event.target.value))} className="mt-1.5 w-full rounded-xl border border-[#b9c7c1] px-3.5 py-3 outline-none transition focus:border-[#176b5a] focus:ring-4 focus:ring-[#176b5a]/10" /></label></div></div>

          <div className="mt-7 flex flex-col gap-4 border-t border-[#2f4b42]/10 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-xs leading-5 text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4" />{chinese ? '容量或截止时间改变后，风险评估需要负责人重新核对。' : 'Changing capacity or deadline requires the risk assessment to be checked again.'}</p><button type="button" disabled={!dirty || mutation.isPending || !deadline || !Number.isInteger(maxCapacity) || maxCapacity < 1} onClick={() => mutation.mutate()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(23,107,90,0.22)] disabled:cursor-not-allowed disabled:opacity-45"><Save className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在保存…' : 'Saving…') : (chinese ? '保存报名设置' : 'Save settings')}</button></div>
          {mutation.error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{normalizeApiError(mutation.error).message}</p> : null}{savedMessage ? <p className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{savedMessage}</p> : null}
        </section>

        <aside className="border-t border-[#2f4b42]/10 bg-[#f6f8f5] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#176b5a] shadow-sm"><UsersRound className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a8a84]">{chinese ? '当前容量' : 'Current capacity'}</p><p className="text-lg font-black text-[#18332d]">{statusCopy}</p></div></div><dl className="mt-6 divide-y divide-[#2f4b42]/10"><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '已经报名' : 'Registered'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.reservedUnits}</dd></div><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '剩余名额' : 'Remaining'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.remainingUnits}</dd></div><div className="flex items-baseline justify-between py-3"><dt className="text-sm text-[#687a73]">{chinese ? '报名记录' : 'Submissions'}</dt><dd className="text-2xl font-black text-[#18332d]">{workspace.enrollmentCount}</dd></div></dl>{blockingMessage ? <p className="mt-4 rounded-xl bg-amber-100/70 px-3 py-2 text-sm leading-5 text-amber-950">{blockingMessage}</p> : null}
          <div className="mt-6"><EventModuleSuggestionsPanel eventId={eventId} module="registration" language={language} onApply={(suggestion) => change(() => {
            if (suggestion.key === 'maxCapacity') setMaxCapacity(Number(suggestion.value))
            if (suggestion.key === 'capacityUnit' && (suggestion.value === 'People' || suggestion.value === 'Families')) setCapacityUnit(suggestion.value)
            if (suggestion.key === 'registrationDeadlineUtc') setDeadline(toLocalInput(suggestion.value))
          })} formatValue={(suggestion) => suggestion.key === 'registrationDeadlineUtc'
            ? new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(suggestion.value))
            : suggestion.key === 'capacityUnit'
              ? (suggestion.value === 'Families' ? (chinese ? '按家庭计算' : 'Count families') : (chinese ? '按人数计算' : 'Count people'))
              : `${suggestion.value} ${chinese ? '个名额' : 'places'}`} /></div>
        </aside>
      </div>

      <section className="border-t border-[#2f4b42]/10 p-5 sm:p-7 lg:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17705d]">02</p><h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#18332d]">{chinese ? '当前报名名单' : 'Current registrations'}</h2><p className="mt-2 text-sm leading-6 text-[#687a73]">{chinese ? '只显示负责人办理报名需要的最少资料；付款凭证不会出现在这里。' : 'Only the minimum information needed by leaders is shown here. Payment evidence is not displayed.'}</p></div><span className="text-sm font-black text-[#52645d]">{workspace.enrollmentCount} {chinese ? '份' : 'total'}</span></div>{workspace.registrations.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#b9c7c1] bg-[#fafbf9] px-5 py-9 text-center text-sm text-[#718079]">{chinese ? '还没有人报名。保存有效的容量和截止时间后，名单会显示在这里。' : 'No registrations yet. Submissions will appear after valid capacity and deadline settings are saved.'}</div> : <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[#2f4b42]/10 text-xs uppercase tracking-wide text-[#718079]"><th className="px-3 py-3">{chinese ? '报名人' : 'Applicant'}</th><th className="px-3 py-3">{chinese ? '占用名额' : 'Reserved'}</th><th className="px-3 py-3">{chinese ? '最后更新' : 'Updated'}</th></tr></thead><tbody>{workspace.registrations.map((item) => <tr key={item.enrollmentId} className="border-b border-[#2f4b42]/[0.07] last:border-0"><td className="px-3 py-4 font-bold text-[#18332d]">{item.applicantName || (chinese ? '未填写姓名' : 'Name unavailable')}</td><td className="px-3 py-4 text-[#52645d]">{item.reservedUnits} {unit}</td><td className="px-3 py-4 text-[#687a73]"><CalendarClock className="mr-1 inline h-4 w-4" />{new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.updatedUtc))}</td></tr>)}</tbody></table></div>}</section>
    </article>
  </AppPageShell>
}

export default EventRegistrationSettingsView
