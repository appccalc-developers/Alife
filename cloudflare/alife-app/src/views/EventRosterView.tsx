import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, CalendarClock, ChevronRight, Plus, Save, UserCheck, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { normalizeApiError } from '../services/http'
import { rosterService } from '../services/rosterService'
import { useAuthStore } from '../stores/auth'
import type { EventRosterPlanOptions, ManagerQualification, RosterCandidateSuggestion, RosterMember, SaveRosterShiftPayload, SchedulingUnavailableWindow } from '../types/roster'
import { localizeText } from '../utils/localizedText'
import EventModuleSuggestionsPanel from '../components/events/EventModuleSuggestionsPanel'
import type { EventModuleSuggestionItem } from '../types/eventModuleSuggestion'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { validateRosterShift, type RosterShiftValidationCode } from '../utils/eventWorkflowValidation'

const toLocalInput = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const splitTags = (value: string) => value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
const weekDays = [
  { value: 0, en: 'Sun', zh: '日' }, { value: 1, en: 'Mon', zh: '一' }, { value: 2, en: 'Tue', zh: '二' },
  { value: 3, en: 'Wed', zh: '三' }, { value: 4, en: 'Thu', zh: '四' }, { value: 5, en: 'Fri', zh: '五' },
  { value: 6, en: 'Sat', zh: '六' },
]
const newManagerWindow = (): SchedulingUnavailableWindow => ({ daysOfWeek: [0], startLocalTime: '09:00', endLocalTime: '12:00', reason: '' })

const EventRosterView = () => {
  const { eventId = '', groupId = '' } = useParams<{ eventId: string; groupId: string }>()
  const auth = useAuthStore()
  const chinese = auth.language === 'zh'
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [editingMember, setEditingMember] = useState<RosterMember | null>(null)
  const [memberLabels, setMemberLabels] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [managerWindows, setManagerWindows] = useState<SchedulingUnavailableWindow[]>([])
  const [managerConfirmationStatus, setManagerConfirmationStatus] = useState<'pending' | 'confirmed'>('pending')
  const [managerConfirmationMethod, setManagerConfirmationMethod] = useState<'' | 'inPerson' | 'phone' | 'memberPortal' | 'authorizedCarer'>('')
  const [managerReviewDate, setManagerReviewDate] = useState('')
  const [managerQualifications, setManagerQualifications] = useState<ManagerQualification[]>([])
  const [suggestionsByShift, setSuggestionsByShift] = useState<Record<string, RosterCandidateSuggestion[]>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState('')
  const [planOptions, setPlanOptions] = useState<EventRosterPlanOptions | null>(null)
  const [activePlanKey, setActivePlanKey] = useState<'balanced' | 'experienced'>('balanced')
  const [loadingPlanOptions, setLoadingPlanOptions] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [shift, setShift] = useState({ roleKey: '', nameEn: '', nameZh: '', startLocal: '', endLocal: '', requiredPeople: 1, requiredLabels: '', notes: '' })
  const query = useQuery({ queryKey: ['eventRoster', eventId], queryFn: () => rosterService.getWorkspace(eventId), enabled: Boolean(eventId) })
  const workspace = query.data
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(groupId))
  const managerProfileDirty = Boolean(editingMember && (
    memberLabels !== editingMember.managerLabels.join(', ')
    || managerNotes !== editingMember.managerNotes
    || JSON.stringify(managerWindows) !== JSON.stringify(editingMember.managerUnavailableWindows)
    || JSON.stringify(managerQualifications) !== JSON.stringify(editingMember.managerQualifications ?? [])
    || managerConfirmationStatus !== (editingMember.managerConfirmationStatus === 'confirmed' ? 'confirmed' : 'pending')
    || managerConfirmationMethod !== (editingMember.managerConfirmationMethod === 'legacy' ? 'inPerson' : editingMember.managerConfirmationMethod)
    || managerReviewDate !== (editingMember.managerReviewDueUtc?.slice(0, 10) ?? '')
  ))
  const hasUnsavedChanges = dirty || managerProfileDirty

  useEffect(() => {
    if (!workspace || shift.startLocal) return
    setShift((current) => ({ ...current, startLocal: toLocalInput(workspace.eventStartUtc), endLocal: toLocalInput(workspace.eventEndUtc) }))
  }, [shift.startLocal, workspace])

  useEffect(() => {
    setUnsavedChangesGuard(hasUnsavedChanges, chinese ? '排班设置尚未保存，确定离开吗？' : 'Roster changes are not saved. Leave this page?', 'confirm')
    if (!hasUnsavedChanges) return () => setUnsavedChangesGuard(false)
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); setUnsavedChangesGuard(false) }
  }, [chinese, hasUnsavedChanges])

  const updateShift = (changes: Partial<typeof shift>) => {
    setShift((current) => ({ ...current, ...changes }))
    setDirty(true)
    setMessage('')
  }
  const toggleShiftRequiredLabel = (key: string) => {
    const current = splitTags(shift.requiredLabels)
    updateShift({ requiredLabels: (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]).join(', ') })
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['eventRoster', eventId] })
  const shiftMutation = useMutation({
    mutationFn: () => {
      const payload: SaveRosterShiftPayload = {
        roleKey: shift.roleKey, nameEn: shift.nameEn, nameZh: shift.nameZh,
        startUtc: new Date(shift.startLocal).toISOString(), endUtc: new Date(shift.endLocal).toISOString(),
        requiredPeople: shift.requiredPeople, requiredLabels: splitTags(shift.requiredLabels), notes: shift.notes,
      }
      return rosterService.saveShift(eventId, null, payload)
    },
    onSuccess: async () => {
      setMessage(chinese ? '班次已保存。现在可以查看智能建议，再由负责人确认人员。' : 'Shift saved. Review smart suggestions, then confirm people manually.')
      setShift((current) => ({ ...current, roleKey: '', nameEn: '', nameZh: '', requiredPeople: 1, requiredLabels: '', notes: '' }))
      setDirty(false)
      await refresh()
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const labelMutation = useMutation({
    mutationFn: () => editingMember ? rosterService.saveManagerProfile(workspace!.groupId, editingMember.memberId, {
      managerLabels: splitTags(memberLabels),
      managerNotes,
      unavailableWindows: managerWindows.map((window) => ({ ...window, reason: '' })),
      confirmationStatus: managerConfirmationStatus,
      confirmationMethod: managerConfirmationStatus === 'confirmed' ? managerConfirmationMethod : '',
      reviewDueUtc: managerReviewDate ? new Date(`${managerReviewDate}T23:59:59`).toISOString() : null,
      qualifications: managerQualifications,
    }) : Promise.reject(new Error('No member selected')),
    onSuccess: async () => { setEditingMember(null); setMessage(chinese ? '代录的排班资料已保存，并记录了确认状态。' : 'The assisted scheduling profile and its confirmation status were saved.'); await refresh() },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const openManagerProfile = (member: RosterMember) => {
    setEditingMember(member)
    setMemberLabels(member.managerLabels.join(', '))
    setManagerNotes(member.managerNotes)
    setManagerWindows(member.managerUnavailableWindows)
    setManagerConfirmationStatus(member.managerConfirmationStatus === 'confirmed' ? 'confirmed' : 'pending')
    setManagerConfirmationMethod(member.managerConfirmationMethod === 'legacy' ? 'inPerson' : member.managerConfirmationMethod)
    setManagerReviewDate(member.managerReviewDueUtc ? member.managerReviewDueUtc.slice(0, 10) : '')
    setManagerQualifications(member.managerQualifications ?? [])
  }
  const updateManagerWindow = (index: number, changes: Partial<SchedulingUnavailableWindow>) =>
    setManagerWindows((current) => current.map((window, windowIndex) => windowIndex === index ? { ...window, ...changes } : window))
  const toggleManagerQualification = (key: string, selected: boolean, defaultValidityDays?: number | null) => {
    if (!selected) {
      setManagerQualifications((current) => current.filter((item) => item.key !== key))
      return
    }
    const validUntilUtc = defaultValidityDays
      ? new Date(Date.now() + defaultValidityDays * 86_400_000).toISOString()
      : null
    setManagerQualifications((current) => [...current.filter((item) => item.key !== key), { key, validUntilUtc }])
  }
  const confirmMutation = useMutation({
    mutationFn: ({ shiftId, memberId }: { shiftId: string; memberId: string }) => rosterService.confirmAssignment(eventId, shiftId, memberId, true),
    onSuccess: async (_, variables) => { setMessage(chinese ? '负责人已提出这项安排，正在等待成员本人确认。' : 'The leader proposed this assignment; the member must now respond.'); setSuggestionsByShift((current) => ({ ...current, [variables.shiftId]: [] })); setPlanOptions(null); await refresh() },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })
  const cancelMutation = useMutation({
    mutationFn: (assignmentId: string) => rosterService.cancelAssignment(eventId, assignmentId),
    onSuccess: async () => { setMessage(chinese ? '安排已取消，可以重新选择人员。' : 'Assignment cancelled. You can choose another person.'); await refresh() },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const loadSuggestions = async (shiftId: string) => {
    setLoadingSuggestions(shiftId); setMessage('')
    try {
      const suggestions = await rosterService.suggestions(eventId, shiftId)
      setSuggestionsByShift((current) => ({ ...current, [shiftId]: suggestions }))
    }
    catch (error) { setMessage(normalizeApiError(error).message) }
    finally { setLoadingSuggestions('') }
  }

  const loadPlanOptions = async () => {
    setLoadingPlanOptions(true); setMessage('')
    try {
      const options = await rosterService.planOptions(eventId)
      setPlanOptions(options)
      setActivePlanKey('balanced')
      if (options.schemes.length === 0) setMessage(chinese ? '请先增加至少一个实际需要的班次。' : 'Add at least one real shift first.')
    }
    catch (error) { setMessage(normalizeApiError(error).message) }
    finally { setLoadingPlanOptions(false) }
  }

  const applyAiSuggestion = (suggestion: EventModuleSuggestionItem) => {
    if (suggestion.key === 'roleKey') updateShift({ roleKey: suggestion.value })
    if (suggestion.key === 'nameEn') updateShift({ nameEn: suggestion.value })
    if (suggestion.key === 'nameZh') updateShift({ nameZh: suggestion.value })
    if (suggestion.key === 'startUtc') updateShift({ startLocal: toLocalInput(suggestion.value) })
    if (suggestion.key === 'endUtc') updateShift({ endLocal: toLocalInput(suggestion.value) })
    if (suggestion.key === 'requiredPeople') updateShift({ requiredPeople: Number(suggestion.value) })
    if (suggestion.key === 'requiredLabels') updateShift({ requiredLabels: suggestion.value })
    if (suggestion.key === 'notes') updateShift({ notes: suggestion.value })
  }

  const formatAiValue = (suggestion: EventModuleSuggestionItem) => {
    if (suggestion.key === 'startUtc' || suggestion.key === 'endUtc') return new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(suggestion.value))
    return suggestion.value
  }

  const rosterValidationMessage = (code: RosterShiftValidationCode) => ({
    roleRequired: chinese ? '请填写岗位代号。' : 'Add a role key.',
    nameRequired: chinese ? '请至少填写一种语言的岗位名称。' : 'Add the shift name in at least one language.',
    invalidTime: chinese ? '请填写有效的班次开始和结束时间。' : 'Enter a valid shift start and end time.',
    endBeforeStart: chinese ? '班次结束时间必须晚于开始时间。' : 'The shift end must be later than its start.',
    outsideEvent: chinese ? '班次时间必须在活动开始和结束时间内。' : 'The shift must stay inside the event time.',
    peopleRequired: chinese ? '需要人数必须是 1 至 100 之间的整数。' : 'People needed must be a whole number from 1 to 100.',
  })[code]

  const saveShift = () => {
    if (!workspace) return
    const issue = validateRosterShift({ ...shift, eventStartUtc: workspace.eventStartUtc, eventEndUtc: workspace.eventEndUtc })
    if (issue) {
      setMessage(rosterValidationMessage(issue))
      return
    }
    setMessage('')
    shiftMutation.mutate()
  }

  if (query.isLoading) return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-600">{chinese ? '正在打开排班工作区…' : 'Opening roster workspace…'}</div>
  if (query.error || !workspace) {
    const error = normalizeApiError(query.error)
    return <div className="mx-auto max-w-6xl px-4 py-10"><section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-black text-amber-950">{error.status === 409 ? (chinese ? '这项活动还没有加入排班' : 'Rostering is not in this event yet') : (chinese ? '无法打开排班工作区' : 'Unable to open roster workspace')}</h1><p className="mt-2 text-sm leading-6 text-amber-800">{error.status === 409 ? (chinese ? '请先回到活动设置，在“按需筹备”中加入排班；加入后再设置岗位和人数。' : 'Return to event settings and add Roster under optional preparation before defining roles and staffing.') : error.message}</p><Link to={`${eventBasePath}/edit?step=setup#event-module-selector`} className="mt-5 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">{chinese ? '返回活动设置' : 'Back to event settings'}</Link></section></div>
  }

  const acceptedCount = workspace.shifts.reduce((total, item) => total + item.assignments.filter((assignment) => assignment.status === 'accepted').length, 0)
  const awaitingResponseCount = workspace.shifts.reduce((total, item) => total + item.assignments.filter((assignment) => assignment.status === 'confirmed').length, 0)
  const requiredCount = workspace.shifts.reduce((total, item) => total + item.requiredPeople, 0)
  const capabilityCatalog = workspace.capabilityCatalog ?? []
  const activePlan = planOptions?.schemes.find((scheme) => scheme.key === activePlanKey) ?? null
  const hasInvalidConfirmedQualification = managerConfirmationStatus === 'confirmed' && managerQualifications.some((qualification) => {
    const capability = capabilityCatalog.find((item) => item.key === qualification.key)
    return !capability || !capability.isActive || capability.requiresExpiry && (!qualification.validUntilUtc || new Date(qualification.validUntilUtc) <= new Date())
  })
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <nav aria-label={chinese ? '当前位置' : 'Breadcrumb'} className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687a73]"><Link to={`${eventBasePath}?section=workflow`} className="hover:text-[#123d34]">{chinese ? '活动流程' : 'Event plan'}</Link><ChevronRight className="h-4 w-4 text-[#a2ada8]" /><span className="text-[#123d34]">{chinese ? '同工排班' : 'Roster'}</span></nav>
    <section className="mt-5 rounded-[2rem] bg-[#173f36] p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{chinese ? '活动筹备 · 智能排班' : 'Event preparation · Smart roster'}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">{localizeText(workspace.eventTitle, auth.language)}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/85">{chinese ? '建议会综合成员时间、岗位偏好、管理者标签、最近 180 天的服务负担和往期同岗位经验。负责人提出安排后，还要由成员本人接受。' : 'Suggestions combine availability, role preferences, manager labels, the past 180 days of service load, and experience in similar roles. A member still accepts after the leader proposes an assignment.'}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-xl bg-white/10 px-4 py-2 text-sm font-black">{acceptedCount}/{requiredCount} {chinese ? '人已接受' : 'accepted'}</span>{awaitingResponseCount ? <span className="rounded-xl bg-amber-300/20 px-4 py-2 text-sm font-black text-amber-100">{awaitingResponseCount} {chinese ? '人待回复' : 'awaiting response'}</span> : null}</div></div>
    </section>
    {message ? <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">{message}</p> : null}

    {workspace.shifts.length > 0 ? <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-violet-200 bg-white shadow-[0_18px_45px_rgba(76,29,149,0.07)]"><div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{chinese ? '整场排班比较' : 'Whole-roster comparison'}</p><h2 className="mt-1 text-xl font-black text-slate-950">{chinese ? '先比较整套方案，再逐项采用' : 'Compare complete drafts before proposing people'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{chinese ? '两套草案都遵守时间冲突、岗位标签和每日上限。草案不会自动保存；每采用一项，系统都会重新检查，之后仍由成员本人接受。' : 'Both drafts enforce conflicts, role labels, and daily limits. Drafts are never auto-saved; every proposal is checked again and still requires the member to accept.'}</p></div><button type="button" disabled={loadingPlanOptions} onClick={() => void loadPlanOptions()} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Bot className="h-4 w-4" />{loadingPlanOptions ? (chinese ? '正在生成…' : 'Generating…') : planOptions ? (chinese ? '重新生成' : 'Regenerate') : (chinese ? '比较两套方案' : 'Compare two drafts')}</button></div>
      {planOptions && activePlan ? <div className="border-t border-violet-100"><div className="flex flex-wrap items-center justify-between gap-3 bg-violet-50/60 px-5 py-4 sm:px-7"><div className="inline-flex rounded-xl bg-white p-1 shadow-sm">{planOptions.schemes.map((scheme) => <button key={scheme.key} type="button" onClick={() => setActivePlanKey(scheme.key)} className={['rounded-lg px-4 py-2 text-sm font-black transition', activePlanKey === scheme.key ? 'bg-violet-700 text-white' : 'text-slate-600 hover:text-violet-800'].join(' ')}>{localizeText(scheme.name, auth.language)}</button>)}</div><div className="flex gap-4 text-xs font-black"><span className="text-emerald-700">{chinese ? `建议 ${activePlan.filledCount} 人次` : `${activePlan.filledCount} proposed`}</span><span className={activePlan.unfilledCount ? 'text-amber-700' : 'text-emerald-700'}>{chinese ? `缺口 ${activePlan.unfilledCount}` : `${activePlan.unfilledCount} gaps`}</span></div></div><div className="px-5 py-4 sm:px-7"><p className="text-sm leading-6 text-slate-600">{localizeText(activePlan.description, auth.language)}</p><div className="mt-3 divide-y divide-slate-200">{activePlan.shifts.map((planShift) => <div key={planShift.shiftId} className="grid gap-3 py-4 md:grid-cols-[minmax(12rem,0.75fr)_minmax(0,1.25fr)]"><div><p className="font-black text-slate-950">{localizeText(planShift.name, auth.language)}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(planShift.startUtc))}</p><p className="mt-2 text-xs font-bold text-slate-600">{chinese ? `已安排 ${planShift.alreadyProposedOrAccepted} · 本草案建议 ${planShift.suggestedAssignments.length} · 需要 ${planShift.requiredPeople}` : `${planShift.alreadyProposedOrAccepted} existing · ${planShift.suggestedAssignments.length} suggested · ${planShift.requiredPeople} needed`}</p></div><div>{planShift.suggestedAssignments.map((person) => <div key={person.memberId} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-2 first:pt-0 last:border-0"><div><p className="text-sm font-black text-slate-950">{person.displayName}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{chinese ? `近 180 天 ${person.recentAssignmentCount} 次 · 连续 ${person.consecutiveServiceWeeks} 周 · 同岗位 ${person.pastSameRoleCount} 次` : `${person.recentAssignmentCount} in 180 days · ${person.consecutiveServiceWeeks}-week streak · ${person.pastSameRoleCount} same-role`}</p><details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer font-bold text-violet-700">{chinese ? '为什么建议这位成员' : 'Why this person'}</summary><ul className="mt-1 list-disc space-y-1 pl-4">{person.reasons.map((reason) => <li key={reason.code}>{localizeText(reason.text, auth.language)}</li>)}</ul></details></div><button type="button" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate({ shiftId: planShift.shiftId, memberId: person.memberId })} className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-50 disabled:opacity-50">{chinese ? '采用并提出安排' : 'Use and propose'}</button></div>)}{planShift.unfilledCount > 0 && planShift.gapExplanation ? <p className="mt-2 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-amber-800"><strong>{chinese ? `仍缺 ${planShift.unfilledCount} 人：` : `${planShift.unfilledCount} unfilled: `}</strong>{localizeText(planShift.gapExplanation, auth.language)}</p> : null}{planShift.suggestedAssignments.length === 0 && planShift.unfilledCount === 0 ? <p className="text-xs font-bold text-emerald-700">{chinese ? '这个班次已经补齐。' : 'This shift is already covered.'}</p> : null}</div></div>)}</div></div></div> : null}
    </section> : null}

    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:items-start">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#ded6cb] bg-white shadow-[0_18px_45px_rgba(31,56,48,0.06)]">
        <div className="bg-[#fbfaf7] p-5 sm:p-7">
          <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-800"><Plus className="h-5 w-5" /></span><div><h2 className="font-black text-slate-950">{chinese ? '增加一个班次或岗位' : 'Add a shift or role'}</h2><p className="mt-1 text-sm text-slate-600">{chinese ? '例如：接待、司机、儿童照顾或场地布置。' : 'For example: welcome, driver, childcare or venue setup.'}</p></div></div>
          <div className="mt-5"><EventModuleSuggestionsPanel eventId={eventId} module="roster" language={auth.language} onApply={applyAiSuggestion} formatValue={formatAiValue} guidancePlaceholder={{ zh: '例如：为活动开始前 30 分钟安排接待岗位；不要推荐具体人员。', en: 'For example: create a welcome shift 30 minutes before the event; do not recommend people.' }} /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">{chinese ? '岗位代号' : 'Role key'}<input value={shift.roleKey} onChange={(event) => updateShift({ roleKey: event.target.value })} placeholder="welcome-team" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">{chinese ? '需要人数' : 'People needed'}<input type="number" min={1} max={100} value={shift.requiredPeople} onChange={(event) => updateShift({ requiredPeople: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">English<input value={shift.nameEn} onChange={(event) => updateShift({ nameEn: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">中文<input value={shift.nameZh} onChange={(event) => updateShift({ nameZh: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">{chinese ? '开始时间' : 'Start'}<input type="datetime-local" value={shift.startLocal} onChange={(event) => updateShift({ startLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold text-slate-700">{chinese ? '结束时间' : 'End'}<input type="datetime-local" value={shift.endLocal} onChange={(event) => updateShift({ endLocal: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
            <div className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '岗位要求' : 'Role requirements'}{capabilityCatalog.length ? <div className="mt-2 flex flex-wrap gap-2">{capabilityCatalog.map((capability) => { const selected = splitTags(shift.requiredLabels).includes(capability.key); return <button key={capability.id} type="button" aria-pressed={selected} onClick={() => toggleShiftRequiredLabel(capability.key)} className={['rounded-full border px-3 py-1.5 text-xs font-black', selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-emerald-200 bg-white text-emerald-800'].join(' ')}>{localizeText(capability.name, auth.language)}{capability.requiresExpiry ? (chinese ? ' · 有效期' : ' · current') : ''}</button> })}</div> : null}<input aria-label={chinese ? '其他自定义岗位标签' : 'Other custom role labels'} value={shift.requiredLabels} onChange={(event) => updateShift({ requiredLabels: event.target.value })} placeholder={chinese ? '也可填写其他自定义标签' : 'You can also add custom labels'} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2" /><span className="mt-1 block text-xs font-normal text-slate-500">{chinese ? '需要有效期的资格请从上方选择；系统会在推荐时检查是否过期。' : 'Choose expiring qualifications above; suggestions verify that they are still current.'}</span></div>
            <label className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '班次说明' : 'Shift notes'}<textarea rows={2} maxLength={1000} value={shift.notes} onChange={(event) => updateShift({ notes: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
          </div>
          <button type="button" disabled={shiftMutation.isPending} onClick={saveShift} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{chinese ? '保存班次' : 'Save shift'}</button>
        </div>

        {workspace.shifts.length === 0 ? <p className="border-t border-[#2f4b42]/10 p-8 text-center text-sm text-[#687a73]">{chinese ? '还没有班次。先增加实际需要的岗位，再查看智能建议。' : 'No shifts yet. Add the roles you actually need, then request suggestions.'}</p> : workspace.shifts.map((item) => {
          const assignments = item.assignments.filter((assignment) => assignment.status !== 'cancelled')
          const acceptedAssignments = assignments.filter((assignment) => assignment.status === 'accepted')
          const committedAssignments = assignments.filter((assignment) => assignment.status === 'confirmed' || assignment.status === 'accepted')
          const suggestions = suggestionsByShift[item.id]
          return <article key={item.id} className="border-t border-[#2f4b42]/10 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{localizeText(item.name, auth.language)}</h2><p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600"><CalendarClock className="h-4 w-4" />{new Intl.DateTimeFormat(chinese ? 'zh-CN' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.startUtc))}</p></div><span className={['rounded-full px-3 py-1 text-xs font-black', acceptedAssignments.length >= item.requiredPeople ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'].join(' ')}>{acceptedAssignments.length}/{item.requiredPeople} {chinese ? '已接受' : 'accepted'}</span></div>
            <div className="mt-4 space-y-2">{assignments.map((assignment) => {
              const responseLabel = assignment.status === 'accepted' ? (chinese ? '成员已接受' : 'accepted') : assignment.status === 'confirmed' ? (chinese ? '等待成员回复' : 'awaiting response') : assignment.status === 'declined' ? (chinese ? '成员无法参加' : 'declined') : (chinese ? '成员请求调整' : 'change requested')
              return <div key={assignment.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-950"><UserCheck className="h-4 w-4" />{assignment.displayName}<small className="font-semibold text-slate-600">{responseLabel}</small>{assignment.basedOnSmartSuggestion ? <small className="font-semibold text-violet-700">{chinese ? '采用智能建议' : 'smart suggestion'}</small> : null}</span><button type="button" onClick={() => cancelMutation.mutate(assignment.id)} className="text-xs font-bold text-rose-700">{chinese ? '取消安排' : 'Cancel'}</button></div>{assignment.memberResponseNotes ? <p className="mt-2 text-xs leading-5 text-amber-900">{chinese ? '成员说明：' : 'Member note: '}{assignment.memberResponseNotes}</p> : null}</div>
            })}</div>
            {committedAssignments.length < item.requiredPeople ? <button type="button" disabled={loadingSuggestions === item.id} onClick={() => void loadSuggestions(item.id)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-black text-violet-800"><Bot className="h-4 w-4" />{loadingSuggestions === item.id ? (chinese ? '正在比较…' : 'Comparing…') : (chinese ? '查看智能建议' : 'View smart suggestions')}</button> : null}
            {suggestions ? <div className="mt-4 space-y-2 border-l-2 border-violet-300 pl-4"><p className="text-xs font-black uppercase tracking-wide text-violet-700">{chinese ? '建议名单 · 尚未保存' : 'Suggestions · not saved'}</p>{suggestions.map((candidate) => <div key={candidate.memberId} className="border-b border-slate-200 py-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-slate-950">{candidate.displayName}</span>{candidate.eligible ? <button type="button" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate({ shiftId: item.id, memberId: candidate.memberId })} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-black text-white">{chinese ? '负责人提出安排' : 'Leader proposes'}</button> : <span className="text-xs font-bold text-rose-700">{chinese ? '有冲突，不能安排' : 'Conflict'}</span>}</div><div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600"><span>{chinese ? `近 180 天 ${candidate.recentAssignmentCount} 次` : `${candidate.recentAssignmentCount} in 180 days`}</span><span>·</span><span>{chinese ? `连续 ${candidate.consecutiveServiceWeeks} 周` : `${candidate.consecutiveServiceWeeks}-week streak`}</span><span>·</span><span>{chinese ? `同岗位 ${candidate.pastSameRoleCount} 次` : `${candidate.pastSameRoleCount} same-role`}</span></div><ul className="mt-2 list-disc pl-4 text-xs leading-5 text-slate-600">{candidate.reasons.map((reason) => <li key={reason.code}>{localizeText(reason.text, auth.language)}</li>)}</ul></div>)}</div> : null}
          </article>
        })}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="p-5"><h2 className="flex items-center gap-2 font-black text-slate-950"><UsersRound className="h-5 w-5 text-emerald-700" />{chinese ? '成员排班资料' : 'Member scheduling profiles'}</h2><p className="mt-2 text-xs leading-5 text-slate-600">{chinese ? '成员可自行填写；不会使用系统时，管理者也能代录。只有经过本人确认且仍在有效期内的资料，才会用于智能建议。' : 'Members can maintain their own profile. Managers may assist people who do not use the system; only confirmed, current information influences suggestions.'}</p></div><div className="max-h-[34rem] overflow-y-auto border-t border-slate-200">{workspace.members.map((member) => {
          const confirmed = member.managerConfirmationStatus === 'confirmed' && (!member.managerReviewDueUtc || new Date(member.managerReviewDueUtc) > new Date())
          return <div key={member.memberId} className="border-b border-slate-100 px-5 py-4 last:border-0"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-950">{member.displayName}</p><p className={['mt-1 text-[11px] font-bold', confirmed ? 'text-emerald-700' : 'text-amber-700'].join(' ')}>{confirmed ? (chinese ? '代录资料已确认' : 'Assisted profile confirmed') : (chinese ? '待确认或复核' : 'Needs confirmation or review')}</p></div><button type="button" onClick={() => openManagerProfile(member)} className="text-xs font-black text-emerald-800">{chinese ? '查看与维护' : 'Review'}</button></div><p className="mt-2 text-xs text-slate-600">{chinese ? '已确认资格：' : 'Qualifications: '}{(member.managerQualifications ?? []).map((item) => item.key).join(', ') || (chinese ? '未填写' : 'Not set')}</p><p className="mt-1 text-xs text-slate-600">{chinese ? '其他标签：' : 'Other labels: '}{member.managerLabels.join(', ') || (chinese ? '未填写' : 'Not set')}</p>{member.managerUnavailableWindows.length ? <p className="mt-1 text-xs text-slate-500">{chinese ? `代录 ${member.managerUnavailableWindows.length} 个不可用时段` : `${member.managerUnavailableWindows.length} assisted unavailable window(s)`}</p> : null}</div>
        })}</div></section>
      </aside>
    </div>

    {editingMember ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"><section className="my-6 w-full max-w-2xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl"><header className="flex items-start justify-between gap-3 bg-[#173f36] px-6 py-5 text-white"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">{chinese ? '代录排班资料' : 'Assisted scheduling profile'}</p><h2 className="mt-1 text-xl font-black">{editingMember.displayName}</h2><p className="mt-2 max-w-xl text-sm text-emerald-50/80">{chinese ? '可代录岗位能力和时间限制。保存前标明是否已与成员本人确认。' : 'Assist with role capabilities and time constraints, then record whether the member confirmed them.'}</p></div><button type="button" aria-label={chinese ? '关闭' : 'Close'} onClick={() => setEditingMember(null)}><X className="h-5 w-5" /></button></header><div className="max-h-[72vh] overflow-y-auto px-6 py-5">
      <div><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">{chinese ? '已确认资格' : 'Confirmed qualifications'}</h3><p className="mt-1 text-xs text-slate-500">{chinese ? '需要有效期的资格到期后会自动停止用于推荐。' : 'Qualifications that require expiry automatically stop influencing suggestions when they expire.'}</p></div><Link target="_blank" rel="noreferrer" to={`/groups/${workspace.groupId}/roster-capabilities`} className="text-xs font-black text-emerald-800">{chinese ? '维护常用能力' : 'Manage catalog'}</Link></div>{capabilityCatalog.length ? <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{capabilityCatalog.map((capability) => {
        const qualification = managerQualifications.find((item) => item.key === capability.key)
        return <div key={capability.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_11rem]"><label className="flex items-start gap-3"><input type="checkbox" checked={Boolean(qualification)} onChange={(event) => toggleManagerQualification(capability.key, event.target.checked, capability.defaultValidityDays)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700" /><span><span className="block text-sm font-bold text-slate-900">{localizeText(capability.name, auth.language)}</span><span className="mt-0.5 block text-xs text-slate-500">{capability.key}{capability.requiresExpiry ? (chinese ? ' · 必须有有效期' : ' · expiry required') : ''}</span></span></label>{capability.requiresExpiry && qualification ? <label className="text-xs font-bold text-slate-600">{chinese ? '有效至' : 'Valid until'}<input type="date" value={qualification.validUntilUtc?.slice(0, 10) ?? ''} onChange={(event) => setManagerQualifications((current) => current.map((item) => item.key === capability.key ? { ...item, validUntilUtc: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : null } : item))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" /></label> : null}</div>
      })}</div> : <p className="mt-3 text-xs text-amber-700">{chinese ? '还没有常用能力。请先建立目录，再为成员确认资格。' : 'No common capabilities yet. Create the catalog before confirming qualifications.'}</p>}</div>
      <label className="mt-5 block text-sm font-bold text-slate-700">{chinese ? '其他岗位标签（逗号分隔）' : 'Other role labels'}<input value={memberLabels} onChange={(event) => setMemberLabels(event.target.value)} placeholder={chinese ? '例如：setup-team, bilingual' : 'e.g. setup-team, bilingual'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /><span className="mt-1 block text-xs font-normal text-slate-500">{chinese ? '驾照、急救等会过期的资格不要放在这里，请从上方目录选择。' : 'Do not put expiring qualifications such as licences or first aid here; choose them from the catalog above.'}</span></label>
      <div className="mt-6 border-t border-slate-200 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">{chinese ? '代录不可用时段' : 'Assisted unavailable times'}</h3><p className="mt-1 text-xs text-slate-500">{chinese ? '系统只使用星期和时间，不会把家庭、健康等原因交给智能建议。' : 'Suggestions use only days and times, never family or health reasons.'}</p></div><button type="button" onClick={() => setManagerWindows((current) => [...current, newManagerWindow()])} className="inline-flex items-center gap-1 text-xs font-black text-emerald-800"><Plus className="h-4 w-4" />{chinese ? '添加时段' : 'Add time'}</button></div>
        <div className="mt-3 divide-y divide-slate-200">{managerWindows.map((window, index) => <div key={index} className="py-4"><div className="flex flex-wrap gap-1">{weekDays.map((day) => <button key={day.value} type="button" aria-pressed={window.daysOfWeek.includes(day.value)} onClick={() => updateManagerWindow(index, { daysOfWeek: window.daysOfWeek.includes(day.value) ? window.daysOfWeek.filter((value) => value !== day.value) : [...window.daysOfWeek, day.value].sort() })} className={['h-8 min-w-8 rounded-lg px-2 text-xs font-black', window.daysOfWeek.includes(day.value) ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'].join(' ')}>{chinese ? day.zh : day.en}</button>)}</div><div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2"><label className="text-xs font-bold text-slate-600">{chinese ? '开始' : 'Start'}<input type="time" value={window.startLocalTime} onChange={(event) => updateManagerWindow(index, { startLocalTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" /></label><label className="text-xs font-bold text-slate-600">{chinese ? '结束' : 'End'}<input type="time" value={window.endLocalTime} onChange={(event) => updateManagerWindow(index, { endLocalTime: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2" /></label><button type="button" onClick={() => setManagerWindows((current) => current.filter((_, windowIndex) => windowIndex !== index))} className="pb-2 text-xs font-black text-rose-700">{chinese ? '删除' : 'Remove'}</button></div></div>)}</div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">{chinese ? '确认状态' : 'Confirmation status'}<select value={managerConfirmationStatus} onChange={(event) => setManagerConfirmationStatus(event.target.value as 'pending' | 'confirmed')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"><option value="pending">{chinese ? '尚未与成员确认' : 'Pending member confirmation'}</option><option value="confirmed">{chinese ? '成员已经确认' : 'Confirmed by member'}</option></select></label><label className="text-sm font-bold text-slate-700">{chinese ? '确认方式' : 'How confirmed'}<select disabled={managerConfirmationStatus !== 'confirmed'} value={managerConfirmationMethod} onChange={(event) => setManagerConfirmationMethod(event.target.value as typeof managerConfirmationMethod)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100"><option value="">{chinese ? '请选择' : 'Select'}</option><option value="inPerson">{chinese ? '当面确认' : 'In person'}</option><option value="phone">{chinese ? '电话确认' : 'Phone'}</option><option value="memberPortal">{chinese ? '成员在线确认' : 'Member portal'}</option><option value="authorizedCarer">{chinese ? '经授权协助者确认' : 'Authorized helper'}</option></select></label><label className="text-sm font-bold text-slate-700 sm:col-span-2">{chinese ? '下次复核日期（可选）' : 'Review again on (optional)'}<input type="date" value={managerReviewDate} onChange={(event) => setManagerReviewDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label></div>
      <label className="mt-5 block text-sm font-bold text-slate-700">{chinese ? '管理者内部备注（不会用于智能建议）' : 'Private manager note (not used by suggestions)'}<textarea value={managerNotes} onChange={(event) => setManagerNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label><p className="mt-3 text-xs leading-5 text-amber-800">{chinese ? '不要记录诊断、家庭身份或不必要的隐私；请把原因转换为可执行的星期和时间限制。' : 'Do not record diagnoses, family identity, or unrelated private details. Convert the need into an actionable day/time constraint.'}</p>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditingMember(null)} className="rounded-xl px-4 py-2 text-sm font-black text-slate-600">{chinese ? '取消' : 'Cancel'}</button><button type="button" disabled={labelMutation.isPending || (managerConfirmationStatus === 'confirmed' && !managerConfirmationMethod) || hasInvalidConfirmedQualification} onClick={() => labelMutation.mutate()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{chinese ? '保存排班资料' : 'Save profile'}</button></div>
    </div></section></div> : null}
  </div>
}

export default EventRosterView
