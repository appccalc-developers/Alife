import RamReviewModal from './RamReviewModal'
import { ramService } from '../../services/ramGovernanceService'
import { useCallback, useEffect, useRef, useState } from 'react'
import EventApprovalAssessmentPanel, { approvalTierLabel } from './EventApprovalAssessment'
import type { EventApprovalAssessment } from '../../types/eventPackage'
import type { Language } from '../../i18n/locale'
import { eventPackageService } from '../../services/eventPackageService'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EventGateChecklist from './EventGateChecklist'
import EventApprovalDelegation from './EventApprovalDelegation'
import { knownPreparationArea, packageStatusLabel, preparationAreaLabel } from '../../utils/eventActionGuidance'
import { setupPath } from '../../utils/eventSetupFlow'
import { normalizeApiError } from '../../services/http'
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities, EventPackageDecisionRequest, EventPackageDecisionType, EventLifecycleGate, EventPackageDiff, EventPackageScopeType, EventPackageStatus } from '../../types/eventPackage'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import useConfirmation from '../../hooks/useConfirmation'

type Props = {
  conditionId?: string
  packageId?: string
  occurrenceId?: string
  beforeAction?: () => Promise<void>
  eventId: string
  groupId: string
  planETag?: string
  canManage: boolean
  language: Language
  showPublicationActions?: boolean
  onBusyChange?: (busy: boolean) => void
  onChanged?: () => Promise<void>
}

type State = 'loading' | 'ready' | 'generating' | 'mutating' | 'error' | 'conflict'

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 py-2 text-sm text-[#18332d] outline-none focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'
const labelClass = 'block text-xs font-bold text-[#40554e]'

const localize = (value: { en: string; zh: string }, language: Language) => value[language] || value.en || value.zh

export const EventPackageFoundationPanel = ({ eventId, groupId, planETag, canManage, language, showPublicationActions = true, onBusyChange, onChanged, packageId, conditionId, occurrenceId, beforeAction }: Props) => {
  const zh = language === 'zh'
  const navigate = useNavigate(), [searchParams] = useSearchParams()
  const panel = useRef<HTMLDivElement>(null)
  const [delegationBusy, setDelegationBusy] = useState(false)
  const editPreparation = async (module?: string) => {
    if (busy) return
    if ((reasonEn || reasonZh || conditionEn || conditionZh) && !await requestConfirmation({
      title: zh ? '离开未提交的审批表单？' : 'Leave the unfinished decision?',
      description: zh ? '未记录的审批理由和条件不会保存。已提交内容不受影响。' : 'Unrecorded reasons and conditions will not be saved. Submitted content is unaffected.',
      confirmLabel: zh ? '离开并修改筹备' : 'Leave and edit preparation', tone: 'danger',
    })) return
    const target = new URL(setupPath(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`, 'arrangements', module), window.location.origin)
    target.searchParams.set('reviewReturn', 'approval')
    if (searchParams.has('returnTo')) target.searchParams.set('returnTo', searchParams.get('returnTo')!)
    navigate(target.pathname + target.search)
  }
  const focusSection = (target: 'actions' | 'decision' | 'conditions' | 'evidence', occurrence?: string | null) => {
    if (occurrence && (scopeType !== 'occurrence' || scopeId !== occurrence)) {
      // Keep scope changes explicit: do not silently replace an unfinished decision.
      panel.current?.querySelector<HTMLElement>('[data-approval-scope]')?.focus()
      setNotice(zh ? '请先在审批范围中选择需要复审的场次。' : 'Select the occurrence to review in Approval scope first.')
      return
    }
    const element = panel.current?.querySelector<HTMLElement>(`[data-approval-${target}]`) ?? panel.current?.querySelector<HTMLElement>('[data-approval-actions]')
    if (element instanceof HTMLDetailsElement) element.open = true
    const focusable = element instanceof HTMLDetailsElement ? element.querySelector('summary') : element
    focusable?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  const [ramReviewOpen, setRamReviewOpen] = useState(false)
  const [state, setState] = useState<State>('loading')
  const [history, setHistory] = useState<EventPackage[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyStatus, setHistoryStatus] = useState<EventPackageStatus | 'all'>('all')
  const [historySort, setHistorySort] = useState<'versionDesc' | 'versionAsc' | 'generatedDesc' | 'generatedAsc'>('versionDesc')
  const [current, setCurrent] = useState<EventPackage | undefined>()
  const [assessment, setAssessment] = useState<EventApprovalAssessment | null>(null), [assessmentError, setAssessmentError] = useState('')
  const [eventBaseline, setEventBaseline] = useState<EventPackage | undefined>()
  const [scopeType, setScopeType] = useState<EventPackageScopeType>(occurrenceId ? 'occurrence' : 'event')
  const [scopeId, setScopeId] = useState(occurrenceId ?? '')
  const [lifecycle, setLifecycle] = useState<EventLifecycle | null>(null)
  const [packageDiff, setPackageDiff] = useState<EventPackageDiff | null>(null)
  const [capabilities, setCapabilities] = useState<EventPackageActorCapabilities | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [decisionType, setDecisionType] = useState<Exclude<EventPackageDecisionType, 'revoke' | 'conditionWaiver'>>('approve')
  const [reasonEn, setReasonEn] = useState('')
  const [reasonZh, setReasonZh] = useState('')
  const [conditionEn, setConditionEn] = useState('')
  const [conditionZh, setConditionZh] = useState('')
  const [conditionOwner, setConditionOwner] = useState('')
  const [conditionGate, setConditionGate] = useState<EventLifecycleGate>('publish')
  const [conditionDue, setConditionDue] = useState('')
  const [unpublishReasonEn, setUnpublishReasonEn] = useState('')
  const [unpublishReasonZh, setUnpublishReasonZh] = useState('')
  const [conditionEvidence, setConditionEvidence] = useState('')
  const [conditionVerifyEn, setConditionVerifyEn] = useState('')
  const [conditionVerifyZh, setConditionVerifyZh] = useState('')
  const [conditionWaiverEn, setConditionWaiverEn] = useState('')
  const [conditionWaiverZh, setConditionWaiverZh] = useState('')
  const [revokeReasonEn, setRevokeReasonEn] = useState('')
  const [revokeReasonZh, setRevokeReasonZh] = useState('')
  const [registrationCloseEn, setRegistrationCloseEn] = useState('')
  const [registrationCloseZh, setRegistrationCloseZh] = useState('')

  const load = useCallback(async () => {
    setState('loading'); setError('')
    try {
      const selectedScope = { scopeType, ...(scopeType === 'occurrence' && scopeId ? { scopeId } : {}) }
      const [baselinePage, latestPage, historyResult, nextLifecycle, assessmentResult] = await Promise.all([
        eventPackageService.listPage(eventId, { page: 1, pageSize: 1, scopeType: 'event', sort: 'versionDesc' }),
        eventPackageService.listPage(eventId, { page: 1, pageSize: 2, sort: 'versionDesc', ...selectedScope }),
        eventPackageService.listPage(eventId, { page: historyPage, pageSize: 10, sort: historySort, ...selectedScope, ...(historyStatus === 'all' ? {} : { status: historyStatus }) }),
        eventPackageService.getLifecycle(eventId, scopeType === 'occurrence' ? scopeId : undefined),
        eventPackageService.getAssessment(eventId, scopeType, scopeType === 'occurrence' ? scopeId : undefined)
          .then(value => ({ value, error: '' })).catch(reason => ({ value: null, error: normalizeApiError(reason).message })),
      ])
      setAssessment(assessmentResult.value); setAssessmentError(assessmentResult.error)
      const baseline = baselinePage.items[0]
      const selectedPackages = packageId ? [await eventPackageService.get(eventId, packageId)] : latestPage.items.filter((item) => item.scopeType === scopeType &&
        (scopeType === 'event' ? !item.scopeId : item.scopeId === scopeId))
      setEventBaseline(baseline); setCurrent(selectedPackages[0]); setHistory(historyResult.items); setHistoryTotal(historyResult.totalCount); setLifecycle(nextLifecycle)
      const capabilityPackage = selectedPackages[0] ?? baseline
      const nextCapabilities = capabilityPackage
        ? await eventPackageService.getCapabilities(eventId, capabilityPackage.id)
        : null
      setCapabilities(nextCapabilities)
      setPackageDiff(selectedPackages.length > 1
        ? await eventPackageService.diff(eventId, selectedPackages[1].id, selectedPackages[0].id)
        : null)
      setState('ready')
    }
    catch (reason) { setError(normalizeApiError(reason).message); setState('error') }
  }, [eventId, groupId, historyPage, historySort, historyStatus, scopeId, scopeType, packageId])

  useEffect(() => { void load() }, [load])

  const generate = async () => {
    if (!planETag) return
    setState('generating'); setError(''); setNotice('')
    try { await eventPackageService.generate(eventId, planETag, scopeType, scopeType === 'occurrence' ? scopeId : undefined); await load(); await onChanged?.(); setNotice(zh ? '已从当前权威资料生成新的审批包版本。' : 'A new Package version was generated from current authoritative sources.') }
    catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.message)
      setState(apiError.status === 409 || apiError.status === 412 ? 'conflict' : 'error')
    }
  }

  const mutate = async (action: () => Promise<unknown>) => {
    setState('mutating'); setError(''); setNotice('')
    try { await beforeAction?.(); await action(); await load(); await onChanged?.(); setNotice(zh ? '操作已保存，状态和可用操作已更新。' : 'Saved. Status and available actions were updated.') }
    catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.message)
      setState(apiError.status === 409 || apiError.status === 412 ? 'conflict' : 'error')
    }
  }

  const decide = async () => {
    if (!current) return
    const request: EventPackageDecisionRequest = { decisionType, reason: { en: reasonEn.trim(), zh: reasonZh.trim() } }
    if (decisionType === 'approveWithConditions') {
      request.conditions = [{
        text: { en: conditionEn.trim(), zh: conditionZh.trim() },
        appliesToGate: conditionGate,
        ownerRoleRequirementKey: conditionOwner.trim(),
        dueUtc: new Date(conditionDue).toISOString(),
      }]
    }
    const confirmed = await requestConfirmation({
      title: zh ? '确认记录正式决定' : 'Confirm formal decision',
      description: zh
        ? `此决定将永久绑定 ${current.scopeType} 范围、Plan v${current.eventPlanVersion} 和 Package v${current.version}，不会自动发布或开放报名。`
        : `This decision is permanently bound to the ${current.scopeType} scope, Plan v${current.eventPlanVersion}, and Package v${current.version}. It will not publish or open registration automatically.`,
      confirmLabel: zh ? '记录决定' : 'Record decision',
      tone: decisionType === 'reject' ? 'danger' : 'primary',
    })
    if (confirmed) await mutate(() => eventPackageService.decide(eventId, current.id, current.eTag, request))
  }

  const completeSubmission = async () => {
    if (!current) return
    const confirmed = await requestConfirmation({
      title: zh ? '确认提交正式审批' : 'Submit for formal approval?',
      description: zh
        ? `提交 ${current.scopeType} 范围、Plan v${current.eventPlanVersion} 的审批快照。批准之前仍可修改筹备资料；修改后须生成并提交新版本。批准后筹备资料才会冻结，海报不在本次审批内。`
        : `Submit the approval snapshot for ${current.scopeType}, Plan v${current.eventPlanVersion}. Preparation remains editable until approved; changes require a new submission. Approval freezes preparation. The poster is excluded.`,
      confirmLabel: zh ? '提交正式审批' : 'Submit for approval',
    })
    if (confirmed) await mutate(() => eventPackageService.submit(eventId, current.id, current.eTag))
  }

  const submit = async () => {
    setError('')
    try {
      await beforeAction?.()
      const ram = await ramService.sync(eventId)
      if (ram.isRequired) setRamReviewOpen(true)
      else await completeSubmission()
    } catch (e) { setError(normalizeApiError(e).message) }
  }

  const eventHistory = history.filter((item) => item.scopeType === scopeType &&
    (scopeType === 'event' ? !item.scopeId : item.scopeId === scopeId))
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / 10))
  const mayGenerate = current ? capabilities?.canGenerate === true : canManage
  const conditionCapability = (conditionId: string) => capabilities?.conditions.find((item) => item.conditionId === conditionId)
  const hasPrimaryActions = mayGenerate || capabilities?.canSubmit || capabilities?.canWithdraw ||
    capabilities?.canPublish || capabilities?.canOpenRegistration || capabilities?.canConfirmExecution
  const busy = state === 'loading' || state === 'generating' || state === 'mutating' || delegationBusy
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  const conditionalComplete = decisionType !== 'approveWithConditions' ||
    Boolean(conditionEn.trim() && conditionZh.trim() && conditionOwner.trim() && conditionDue)
  const gateLabel = (gate: EventLifecycleGate) => ({
    publish: zh ? '发布' : 'Publish',
    registration: zh ? '报名' : 'Registration',
    payment: zh ? '付款' : 'Payment',
    execute: zh ? '执行' : 'Execute',
  }[gate])
  const packageSections = current?.manifest.sections ?? []
  return (
    <div ref={panel}><AppSectionCard
      title={zh ? '活动方案正式审批' : 'Event Package approval'}
      subtitle={zh
        ? '先保存筹备资料，再生成审批快照并提交。批准后仍需单独发布、开放报名。'
        : 'Save preparation, generate a review snapshot, then submit. Approval does not publish the event or open registration.'}
      action={current ? <AppBadge variant="info">{approvalTierLabel(current.governanceTier, zh)} · v{current.version}</AppBadge> : undefined}
    >
      {assessmentError ? <p role="alert" className="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{zh ? '暂时无法核对审批等级与时间：' : 'Approval tier and reply time are unavailable: '}{assessmentError}</p> : null}
      {!packageId && eventBaseline && eventBaseline.coveredOccurrenceIds.length > 1 ? <label className={`${labelClass} mb-4`}>{zh ? '审批范围' : 'Approval scope'}<select data-approval-scope className={fieldClass} value={scopeType === 'event' ? 'event' : scopeId} onChange={(event) => { const value = event.target.value; setHistoryPage(1); setScopeType(value === 'event' ? 'event' : 'occurrence'); setScopeId(value === 'event' ? '' : value) }}><option value="event">{zh ? '整个活动系列' : 'Whole Event series'}</option>{eventBaseline.coveredOccurrenceIds.map((occurrenceId, index) => <option key={occurrenceId} value={occurrenceId}>{zh ? `场次 ${index + 1}` : `Occurrence ${index + 1}`} · {occurrenceId.slice(0, 8)}</option>)}</select><span className="mt-1 block font-normal text-[#66766f]">{scopeType === 'occurrence' ? (zh ? '此范围用于单场次例外的生成、复审、条件和执行确认。' : 'Use this scope to generate, review, condition, and confirm one occurrence exception.') : (zh ? '系列基线审批覆盖所列场次；单场次例外必须切换到对应场次复审。' : 'The series baseline covers the listed occurrences; select an occurrence for a local exception review.')}</span></label> : null}
      {state === 'loading' ? <p className="text-sm text-[#66766f]" role="status">{zh ? '正在读取审批包…' : 'Loading Event Packages…'}</p> : null}
      {error ? <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${state === 'conflict' ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`} role="alert">{error}</p> : null}
      {error ? <AppActionButton className="mt-2" disabled={busy} onClick={() => void load()}>{zh ? '刷新并重试' : 'Refresh and retry'}</AppActionButton> : null}
      {notice ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{notice}</p> : null}
      <div data-approval-actions tabIndex={-1} className="my-4 scroll-mt-24 space-y-3 rounded-xl border border-[#dce5e0] bg-[#f4f8f6] p-4 outline-none focus:ring-2 focus:ring-[#176b5a]"><h3 className="font-semibold">{zh ? '审批操作' : 'Approval actions'}</h3><p className="text-sm">{current?.status === 'submitted' ? (zh ? '资料已提交，等待审批决定。委派不是必填步骤。' : 'Submitted for a decision. Delegation is optional.') : current?.status === 'approved' || current?.status === 'approvedWithConditions' ? (zh ? '检查批准是否仍然有效，并分别完成发布或开放报名。' : 'Check approval validity, then publish or open registration separately.') : (zh ? '先补齐下方缺项，再生成当前资料的审批快照并提交。' : 'Complete the items below, then generate and submit a snapshot of the current preparation.')}</p><div className="flex flex-wrap gap-2">
        {mayGenerate ? <AppActionButton variant="primary" disabled={!planETag || busy || (scopeType === 'occurrence' && !scopeId)} onClick={() => void generate()}>{state === 'generating' ? (zh ? '正在生成…' : 'Generating…') : (current ? (zh ? '从当前资料生成新版本' : 'Generate a new version') : scopeType === 'occurrence' ? (zh ? '生成此场次审批包' : 'Generate occurrence Package') : (zh ? '生成审批包' : 'Generate Package'))}</AppActionButton> : null}
        {current && capabilities?.canSubmit ? <AppActionButton disabled={busy || current.manifest.blockers.length > 0} onClick={() => void submit()}>{zh ? '提交正式审批' : 'Submit for approval'}</AppActionButton> : null}
        {current && capabilities?.canWithdraw ? <AppActionButton variant="danger" disabled={busy} onClick={() => void mutate(() => eventPackageService.withdraw(eventId, current.id, current.eTag))}>{zh ? '撤回此版本' : 'Withdraw version'}</AppActionButton> : null}
        {showPublicationActions && current && lifecycle && capabilities?.canPublish ? <AppActionButton variant="primary" disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'publish' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.publish(eventId, lifecycle.eTag, current))}>{zh ? '确认发布活动' : 'Confirm publication'}</AppActionButton> : null}
        {current && lifecycle && capabilities?.canOpenRegistration ? <AppActionButton disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'registration' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.openRegistration(eventId, lifecycle, current))}>{zh ? '确认开放报名' : 'Confirm registration opening'}</AppActionButton> : null}
        {current && lifecycle && capabilities?.canConfirmExecution ? <AppActionButton disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'execute' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.confirmExecution(eventId, lifecycle, current))}>{zh ? '确认进入执行' : 'Confirm execution'}</AppActionButton> : null}
      </div>{!hasPrimaryActions ? <p className="text-sm">{zh ? '你目前没有提交或发布权限，可查看资料或由有权限的人继续处理。' : 'You cannot submit or publish with your current permissions. Review the evidence or ask an authorised person to continue.'}</p> : null}
      {current && capabilities?.canSubmit && current.manifest.blockers.length > 0 ? <p className="text-sm text-amber-900">{zh ? '暂不能提交：请先处理下方资料缺项。' : 'Submission unavailable: complete the evidence gaps below first.'}</p> : null}
      {current && capabilities?.canDecide ? <AppActionButton disabled={busy} onClick={() => focusSection('decision')}>{zh ? '前往审批表单' : 'Go to decision form'}</AppActionButton> : null}</div>
      {capabilities?.canUnpublish && lifecycle ? <form className="mt-4 grid gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.unpublish(eventId, lifecycle.eTag, { en: unpublishReasonEn.trim(), zh: unpublishReasonZh.trim() })) }}><label className={labelClass}>{zh ? '撤下原因（英文）' : 'Unpublish reason (English)'}<input className={fieldClass} value={unpublishReasonEn} onChange={(event) => setUnpublishReasonEn(event.target.value)} required /></label><label className={labelClass}>{zh ? '撤下原因（中文）' : 'Unpublish reason (Chinese)'}<input className={fieldClass} value={unpublishReasonZh} onChange={(event) => setUnpublishReasonZh(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !unpublishReasonEn.trim() || !unpublishReasonZh.trim()}>{zh ? '撤下公开活动' : 'Unpublish event'}</AppActionButton></form> : null}
      {!current && assessment ? <EventApprovalAssessmentPanel assessment={assessment} zh={zh} approved={false} /> : null}
      {state !== 'loading' && !current ? (
        <AppEmptyState
          title={zh ? '尚未生成审批包' : 'No Event Package yet'}
          description={scopeType === 'occurrence'
            ? (zh ? '此场次尚无局部审批包；可从当前权威资料生成并单独复审。' : 'This occurrence has no scoped Package yet; generate one from current authoritative sources for local review.')
            : (zh ? '先接受 Event Plan，并发布适用的治理政策版本。' : 'Accept an Event Plan and publish an applicable governance policy version first.')}
        />
      ) : null}
      {current ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#40554e]">{packageStatusLabel(current.status, zh)} · {packageStatusLabel(current.approvalValidityStatus, zh)} · {current.scopeType === 'event' ? (zh ? '整个活动' : 'Whole event') : (zh ? '单个场次' : 'One occurrence')}</p>
          {lifecycle ? <EventGateChecklist lifecycle={lifecycle} current={current} capabilities={capabilities} zh={zh} canManage={canManage} busy={busy} onEdit={module => void editPreparation(module)} onFocus={focusSection} /> : null}
          {assessment ? <EventApprovalAssessmentPanel assessment={assessment} zh={zh} approved={Boolean(current && ['approved', 'approvedWithConditions'].includes(current.status) && current.approvalValidityStatus === 'active')} /> : null}
          <details data-approval-evidence className="scroll-mt-24 space-y-3 rounded-xl border border-[#dce5e0] p-3"><summary tabIndex={0} className="min-h-11 cursor-pointer font-semibold">{zh ? '查看完整审批资料与缺项' : 'View full approval evidence and gaps'}</summary><p className="text-xs text-[#596a63]">Plan v{current.eventPlanVersion} · Policy {current.governancePolicyVersion}</p>
          {current.manifest.legacyTransition !== 'formalPackageRequired' ? <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{zh ? `旧活动过渡分类：${current.manifest.legacyTransition}` : `Legacy transition: ${current.manifest.legacyTransition}`}</p> : null}
          {(current.manifest.triggerReasons?.length ?? 0) > 0 ? <section className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><strong>{zh ? '为何需要此审批包' : 'Why this Package is required'}</strong><ul className="mt-2 space-y-1">{current.manifest.triggerReasons!.map((reason) => <li key={reason.code}>• {localize(reason.message, language)} <span className="text-xs opacity-70">({reason.code})</span></li>)}</ul></section> : null}
          {packageSections.length ? <div className="space-y-3">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={zh ? '审批包章节' : 'Package sections'}>{packageSections.map((section, index) => <a key={section.code} href={`#event-package-${section.code}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[#176b5a]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#176b5a] hover:bg-[#edf7f3]">{index + 1}. {localize(section.title, language)}</a>)}</nav>
            <div className="overflow-hidden rounded-xl border border-[#2f4b42]/10 bg-white">{packageSections.map((section, index) => <details id={`event-package-${section.code}`} key={section.code} open={index === 0} className="scroll-mt-4 border-b border-[#2f4b42]/10 last:border-b-0"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-[#f4f8f6]"><span className="min-w-0"><span className="mr-2 text-xs font-black text-[#66766f]">{index + 1}</span><strong className="text-sm text-[#18332d]">{localize(section.title, language)}</strong></span><AppBadge variant={section.status === 'ready' ? 'success' : section.status === 'notApplicable' ? 'info' : 'warning'}>{section.status === 'ready' ? (zh ? '就绪' : 'Ready') : section.status === 'notApplicable' ? (zh ? '不适用' : 'Not applicable') : (zh ? '需关注' : 'Attention')}</AppBadge></summary><div className="border-t border-[#2f4b42]/10 bg-[#fbfcfa] px-4 py-3">{section.items.length ? <ul className="space-y-1.5 text-sm text-[#40554e]">{section.items.map((item, itemIndex) => <li key={`${section.code}-item-${itemIndex}`}>• {localize(item, language)}</li>)}</ul> : null}{section.moduleCodes.length ? <div className="mt-3 flex flex-wrap gap-1">{section.moduleCodes.map((moduleCode) => canManage && knownPreparationArea(moduleCode) ? <AppActionButton key={moduleCode} size="sm" disabled={busy} onClick={() => void editPreparation(moduleCode)}>{zh ? '前往修改：' : 'Edit: '}{preparationAreaLabel(moduleCode, zh)}</AppActionButton> : <AppBadge key={moduleCode} variant="info">{preparationAreaLabel(moduleCode, zh)}</AppBadge>)}</div> : null}{section.blockers.length ? <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">{section.blockers.map((blocker, blockerIndex) => <li key={`${section.code}-blocker-${blockerIndex}`}>• {localize(blocker, language)}</li>)}</ul> : null}</div></details>)}</div>
          </div> : null}
          {(current.manifest.requiredSpecialistDecisions?.length ?? 0) > 0 ? <section className="rounded-xl border border-[#2f4b42]/10 bg-[#f4f8f6] p-3"><strong className="text-sm text-[#18332d]">{zh ? '仍须独立完成的专项决定' : 'Specialist decisions still remain independent'}</strong><div className="mt-2 flex flex-wrap gap-1">{current.manifest.requiredSpecialistDecisions!.map((decision) => <AppBadge key={decision} variant="warning">{decision}</AppBadge>)}</div></section> : null}
          <details className="rounded-xl border border-[#2f4b42]/10 bg-white p-3"><summary className="cursor-pointer text-sm font-black text-[#40554e]">{zh ? '权威模块来源与详细就绪状态' : 'Authoritative module sources and detailed readiness'}</summary><div className="mt-3 grid gap-2 tablet:grid-cols-2" aria-label={zh ? '模块来源与就绪状态' : 'Module source and readiness states'}>{current.manifest.modules.map((module) => <section key={module.moduleCode} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-[#18332d]">{module.moduleCode}</strong><AppBadge variant={module.availability === 'available' && module.blockers.length === 0 ? 'success' : 'warning'}>{module.availability} · {module.blockers.length === 0 ? (zh ? '就绪' : 'ready') : (zh ? `${module.blockers.length} 项缺口` : `${module.blockers.length} gaps`)}</AppBadge></div>{module.blockers.length ? <ul className="mt-2 space-y-1 text-xs text-amber-900">{module.blockers.map((blocker, index) => <li key={`${module.moduleCode}-${index}`}>• {localize(blocker, language)}</li>)}</ul> : null}</section>)}</div></details>
          {current.manifest.blockers.length ? <ul className="space-y-2">{current.manifest.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{localize(blocker, language)}</li>)}</ul> : <p className="text-sm text-[#66766f]">{zh ? '当前快照没有提交前缺项；仍需正式提交并由有权限的人审批。' : 'The current snapshot has no submission blockers; it still requires formal submission and server-authorised approval.'}</p>}
          </details>
          {current.decisions.length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-emerald-900">{zh ? '正式决定' : 'Formal decision'}</p>{current.decisions.map((decision) => <div key={decision.id} className="mt-2 text-sm text-emerald-950"><strong>{decision.decisionType}</strong> · {new Date(decision.decidedUtc).toLocaleString()}<p>{localize(decision.reason, language)}</p></div>)}{capabilities?.canRevokeDecision && current.decisions.some((decision) => decision.decisionType === 'approve' || decision.decisionType === 'approveWithConditions') ? <form className="mt-3 grid gap-2 border-t border-emerald-200 pt-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); const approval = current.decisions.find((decision) => decision.decisionType === 'approve' || decision.decisionType === 'approveWithConditions'); if (approval) void mutate(() => eventPackageService.revokeDecision(eventId, current, approval.id, { en: revokeReasonEn.trim(), zh: revokeReasonZh.trim() })) }}><input className={fieldClass} value={revokeReasonEn} onChange={(event) => setRevokeReasonEn(event.target.value)} placeholder={zh ? '撤销理由（英文）' : 'Revocation reason (English)'} required /><input className={fieldClass} value={revokeReasonZh} onChange={(event) => setRevokeReasonZh(event.target.value)} placeholder={zh ? '撤销理由（中文）' : 'Revocation reason (Chinese)'} required /><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !revokeReasonEn.trim() || !revokeReasonZh.trim()}>{zh ? '撤销批准' : 'Revoke approval'}</AppActionButton></form> : null}</div> : null}
          {current.conditions.length ? <div data-approval-conditions tabIndex={-1} className="scroll-mt-24 space-y-2 outline-none">{current.conditions.filter(condition => !conditionId || condition.id === conditionId).map((condition) => <div key={condition.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{condition.appliesToGate} · {condition.status}</strong><p>{localize(condition.text, language)}</p><p className="mt-1 text-xs">{condition.ownerRoleRequirementKey} · {new Date(condition.dueUtc).toLocaleString()}</p>{condition.evidenceReferenceHash ? <p className="mt-1 text-xs">{condition.evidenceAvailable ? (zh ? '证据引用可供授权人员核验' : 'Evidence reference available to authorised reviewers') : (zh ? '证据引用已按保留规则变为不可访问；审计哈希仍保留' : 'Evidence reference is unavailable under retention rules; its audit hash remains')} · {condition.evidenceExpiresUtc ? new Date(condition.evidenceExpiresUtc).toLocaleDateString() : '—'}</p> : null}{conditionCapability(condition.id)?.canSatisfy ? <form className="mt-3 flex flex-col gap-2 tablet:flex-row" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.satisfyCondition(eventId, current.id, condition.id, condition.eTag, conditionEvidence.trim())) }}><input className={fieldClass} value={conditionEvidence} onChange={(event) => setConditionEvidence(event.target.value)} placeholder={zh ? '证据引用（不粘贴敏感原文）' : 'Evidence reference (do not paste sensitive evidence)'} required /><AppActionButton className="self-end" type="submit" disabled={busy || !conditionEvidence.trim()}>{zh ? '提交证据引用' : 'Submit evidence reference'}</AppActionButton></form> : null}{conditionCapability(condition.id)?.canVerify ? <form className="mt-3 grid gap-2 tablet:grid-cols-[1fr_1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.verifyCondition(eventId, current.id, condition.id, condition.eTag, true, { en: conditionVerifyEn.trim(), zh: conditionVerifyZh.trim() })) }}><input className={fieldClass} value={conditionVerifyEn} onChange={(event) => setConditionVerifyEn(event.target.value)} placeholder={zh ? '核验理由（英文）' : 'Verification reason (English)'} required /><input className={fieldClass} value={conditionVerifyZh} onChange={(event) => setConditionVerifyZh(event.target.value)} placeholder={zh ? '核验理由（中文）' : 'Verification reason (Chinese)'} required /><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy || !conditionVerifyEn.trim() || !conditionVerifyZh.trim()}>{zh ? '核验通过' : 'Verify'}</AppActionButton><AppActionButton className="self-end" variant="danger" disabled={busy || !conditionVerifyEn.trim() || !conditionVerifyZh.trim()} onClick={() => void mutate(() => eventPackageService.verifyCondition(eventId, current.id, condition.id, condition.eTag, false, { en: conditionVerifyEn.trim(), zh: conditionVerifyZh.trim() }))}>{zh ? '拒绝证据' : 'Reject evidence'}</AppActionButton></form> : null}{conditionCapability(condition.id)?.canWaive ? <div className="mt-3 grid gap-2 border-t border-amber-200 pt-3 tablet:grid-cols-[1fr_1fr_auto]"><input className={fieldClass} value={conditionWaiverEn} onChange={(event) => setConditionWaiverEn(event.target.value)} placeholder={zh ? '豁免理由（英文）' : 'Waiver reason (English)'} /><input className={fieldClass} value={conditionWaiverZh} onChange={(event) => setConditionWaiverZh(event.target.value)} placeholder={zh ? '豁免理由（中文）' : 'Waiver reason (Chinese)'} /><AppActionButton disabled={busy || !conditionWaiverEn.trim() || !conditionWaiverZh.trim()} onClick={() => void mutate(() => eventPackageService.waiveCondition(eventId, current.id, condition.id, condition.eTag, { en: conditionWaiverEn.trim(), zh: conditionWaiverZh.trim() }))}>{zh ? '按政策豁免' : 'Policy waiver'}</AppActionButton></div> : null}</div>)}</div> : null}
          <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]"><summary className="cursor-pointer font-bold text-[#40554e]">{zh ? `版本历史（${historyTotal}）` : `Version history (${historyTotal})`}</summary><div className="mt-3 grid gap-2 tablet:grid-cols-2"><label className={labelClass}>{zh ? '状态筛选' : 'Filter by status'}<select className={fieldClass} value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value as EventPackageStatus | 'all'); setHistoryPage(1) }}><option value="all">{zh ? '全部状态' : 'All statuses'}</option>{(['draft', 'submitted', 'returnedForAmendment', 'rejected', 'approvedWithConditions', 'approved', 'withdrawn', 'superseded'] as EventPackageStatus[]).map((status) => <option key={status} value={status}>{packageStatusLabel(status, zh)}</option>)}</select></label><label className={labelClass}>{zh ? '排序' : 'Sort'}<select className={fieldClass} value={historySort} onChange={(event) => { setHistorySort(event.target.value as typeof historySort); setHistoryPage(1) }}><option value="versionDesc">{zh ? '版本：新到旧' : 'Version: newest first'}</option><option value="versionAsc">{zh ? '版本：旧到新' : 'Version: oldest first'}</option><option value="generatedDesc">{zh ? '生成时间：新到旧' : 'Generated: newest first'}</option><option value="generatedAsc">{zh ? '生成时间：旧到新' : 'Generated: oldest first'}</option></select></label></div>{eventHistory.length ? <ol className="mt-3 space-y-1">{eventHistory.map((item) => <li key={item.id}>v{item.version} · {packageStatusLabel(item.status, zh)} · {new Date(item.generatedUtc).toLocaleString()} · {item.contentHash.slice(0, 12)}</li>)}</ol> : <p className="mt-3">{zh ? '当前筛选没有历史版本。' : 'No versions match this filter.'}</p>}<div className="mt-3 flex items-center justify-between gap-2"><AppActionButton disabled={busy || historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>{zh ? '上一页' : 'Previous'}</AppActionButton><span>{zh ? `第 ${historyPage} / ${historyPageCount} 页` : `Page ${historyPage} of ${historyPageCount}`}</span><AppActionButton disabled={busy || historyPage >= historyPageCount} onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}>{zh ? '下一页' : 'Next'}</AppActionButton></div></details>
          {packageDiff ? <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]"><summary className="cursor-pointer font-bold text-[#40554e]">{zh ? `与 v${packageDiff.fromVersion} 的变化（${packageDiff.changes.length}）` : `Changes from v${packageDiff.fromVersion} (${packageDiff.changes.length})`}</summary>{packageDiff.changes.length ? <ul className="mt-2 space-y-2">{packageDiff.changes.map((change) => <li key={change.field} className="rounded-lg bg-[#f4f8f6] px-2 py-1"><strong>{change.field}</strong> · {change.classification}<span className="block break-all">{change.before || '—'} → {change.after || '—'}</span></li>)}</ul> : <p className="mt-2">{zh ? '没有内容变化。' : 'No content changes.'}</p>}</details> : null}
        </div>
      ) : null}
      {capabilities?.canCloseRegistration && lifecycle ? <form className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.closeRegistration(eventId, lifecycle, { en: registrationCloseEn.trim(), zh: registrationCloseZh.trim() })) }}><label className={labelClass}>{zh ? '关闭报名原因（英文）' : 'Close-registration reason (English)'}<input className={fieldClass} value={registrationCloseEn} onChange={(event) => setRegistrationCloseEn(event.target.value)} required /></label><label className={labelClass}>{zh ? '关闭报名原因（中文）' : 'Close-registration reason (Chinese)'}<input className={fieldClass} value={registrationCloseZh} onChange={(event) => setRegistrationCloseZh(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !registrationCloseEn.trim() || !registrationCloseZh.trim()}>{zh ? '关闭报名' : 'Close registration'}</AppActionButton></form> : null}
      {current && capabilities?.canDecide ? <form data-approval-decision tabIndex={-1} className="mt-5 scroll-mt-24 rounded-2xl border border-[#176b5a]/20 bg-[#f4f8f6] p-4 outline-none focus:ring-2 focus:ring-[#176b5a]" onSubmit={(event) => { event.preventDefault(); void decide() }}>
        <h3 className="font-black text-[#18332d]">{zh ? '记录正式决定' : 'Record formal decision'}</h3>
        <p className="mt-1 text-xs text-[#66766f]">{zh ? '服务端会按治理等级、组织角色及提交人回避规则再次验证；界面显示按钮不代表拥有权限。' : 'The server rechecks governance tier, organisational authority, and submitter separation. Seeing this form does not grant approval authority.'}</p>
        <div className="mt-3 grid gap-3 tablet:grid-cols-3">
          <label className={labelClass}>{zh ? '决定' : 'Decision'}<select className={fieldClass} value={decisionType} onChange={(event) => setDecisionType(event.target.value as Exclude<EventPackageDecisionType, 'revoke' | 'conditionWaiver'>)}><option value="approve">{zh ? '批准' : 'Approve'}</option><option value="approveWithConditions">{zh ? '附条件批准' : 'Approve with conditions'}</option><option value="returnForAmendment">{zh ? '退回修改' : 'Return for amendment'}</option><option value="reject">{zh ? '拒绝' : 'Reject'}</option></select></label>
          <label className={labelClass}>{zh ? '英文理由' : 'Reason in English'}<textarea aria-label={zh ? '英文理由' : 'Reason in English'} className={fieldClass} value={reasonEn} onChange={(event) => setReasonEn(event.target.value)} required /></label>
          <label className={labelClass}>{zh ? '中文理由' : 'Reason in Chinese'}<textarea aria-label={zh ? '中文理由' : 'Reason in Chinese'} className={fieldClass} value={reasonZh} onChange={(event) => setReasonZh(event.target.value)} required /></label>
        </div>
        {decisionType === 'approveWithConditions' ? <fieldset className="mt-3 grid gap-3 border-t border-[#2f4b42]/10 pt-3 tablet:grid-cols-2"><legend className="px-1 text-xs font-black text-[#40554e]">{zh ? '结构化条件' : 'Structured condition'}</legend><label className={labelClass}>English<input className={fieldClass} value={conditionEn} onChange={(event) => setConditionEn(event.target.value)} required /></label><label className={labelClass}>中文<input className={fieldClass} value={conditionZh} onChange={(event) => setConditionZh(event.target.value)} required /></label><label className={labelClass}>{zh ? '责任角色键' : 'Owner role key'}<input className={fieldClass} value={conditionOwner} onChange={(event) => setConditionOwner(event.target.value)} required /></label><label className={labelClass}>{zh ? '适用门禁' : 'Applies to gate'}<select className={fieldClass} value={conditionGate} onChange={(event) => setConditionGate(event.target.value as EventLifecycleGate)}>{(['publish', 'registration', 'payment', 'execute'] as const).map(gate => <option key={gate} value={gate}>{gateLabel(gate)}</option>)}</select></label><label className={labelClass}>{zh ? '期限' : 'Due'}<input type="datetime-local" className={fieldClass} value={conditionDue} onChange={(event) => setConditionDue(event.target.value)} required /></label></fieldset> : null}
        <div className="mt-3"><AppActionButton type="submit" variant={decisionType === 'reject' ? 'danger' : 'primary'} disabled={busy || !reasonEn.trim() || !reasonZh.trim() || !conditionalComplete}>{state === 'mutating' ? (zh ? '正在保存…' : 'Saving…') : (zh ? '确认并记录决定' : 'Confirm and record decision')}</AppActionButton></div>
      </form> : null}
      {capabilities?.canManageDelegations ? <EventApprovalDelegation key={groupId + eventId} groupId={groupId} eventId={eventId} zh={zh} disabled={state !== 'ready'} onBusy={setDelegationBusy} onChanged={async () => { await load(); await onChanged?.() }} /> : null}
      {confirmationModal}
      {ramReviewOpen ? <RamReviewModal eventId={eventId} zh={zh} onClose={() => setRamReviewOpen(false)} onReviewed={async () => { setRamReviewOpen(false); await completeSubmission() }} /> : null}
    </AppSectionCard></div>
  )
}
