import { eventPackageFoundationPanelText } from '../../i18n/eventPackageFoundationPanel.ts'
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
      title: zh ? eventPackageFoundationPanelText.leaveTheUnfinishedDecision.zh : eventPackageFoundationPanelText.leaveTheUnfinishedDecision.en,
      description: zh ? eventPackageFoundationPanelText.unrecordedReasonsAndConditionsWillNotBeSavedSubmitted.zh : eventPackageFoundationPanelText.unrecordedReasonsAndConditionsWillNotBeSavedSubmitted.en,
      confirmLabel: zh ? eventPackageFoundationPanelText.leaveAndEditPreparation.zh : eventPackageFoundationPanelText.leaveAndEditPreparation.en, tone: 'danger',
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
      setNotice(zh ? eventPackageFoundationPanelText.selectTheOccurrenceToReviewInApprovalScopeFirst.zh : eventPackageFoundationPanelText.selectTheOccurrenceToReviewInApprovalScopeFirst.en)
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
    try { await eventPackageService.generate(eventId, planETag, scopeType, scopeType === 'occurrence' ? scopeId : undefined); await load(); await onChanged?.(); setNotice(zh ? eventPackageFoundationPanelText.aNewPackageVersionWasGeneratedFromCurrentAuthoritative.zh : eventPackageFoundationPanelText.aNewPackageVersionWasGeneratedFromCurrentAuthoritative.en) }
    catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.message)
      setState(apiError.status === 409 || apiError.status === 412 ? 'conflict' : 'error')
    }
  }

  const mutate = async (action: () => Promise<unknown>) => {
    setState('mutating'); setError(''); setNotice('')
    try { await beforeAction?.(); await action(); await load(); await onChanged?.(); setNotice(zh ? eventPackageFoundationPanelText.savedStatusAndAvailableActionsWereUpdated.zh : eventPackageFoundationPanelText.savedStatusAndAvailableActionsWereUpdated.en) }
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
      title: zh ? eventPackageFoundationPanelText.confirmFormalDecision.zh : eventPackageFoundationPanelText.confirmFormalDecision.en,
      description: zh
        ? eventPackageFoundationPanelText.thisDecisionIsPermanentlyBoundToTheScopePlan.zh(current.scopeType, current.eventPlanVersion, current.version)
        : eventPackageFoundationPanelText.thisDecisionIsPermanentlyBoundToTheScopePlan.en(current.scopeType, current.eventPlanVersion, current.version),
      confirmLabel: zh ? eventPackageFoundationPanelText.recordDecision.zh : eventPackageFoundationPanelText.recordDecision.en,
      tone: decisionType === 'reject' ? 'danger' : 'primary',
    })
    if (confirmed) await mutate(() => eventPackageService.decide(eventId, current.id, current.eTag, request))
  }

  const completeSubmission = async () => {
    if (!current) return
    const confirmed = await requestConfirmation({
      title: zh ? eventPackageFoundationPanelText.submitForFormalApproval.zh : eventPackageFoundationPanelText.submitForFormalApproval.en,
      description: zh
        ? eventPackageFoundationPanelText.submitTheApprovalSnapshotForPlanVPreparationRemains.zh(current.scopeType, current.eventPlanVersion)
        : eventPackageFoundationPanelText.submitTheApprovalSnapshotForPlanVPreparationRemains.en(current.scopeType, current.eventPlanVersion),
      confirmLabel: zh ? eventPackageFoundationPanelText.submitForApproval.zh : eventPackageFoundationPanelText.submitForApproval.en,
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
    publish: zh ? eventPackageFoundationPanelText.publish.zh : eventPackageFoundationPanelText.publish.en,
    registration: zh ? eventPackageFoundationPanelText.registration.zh : eventPackageFoundationPanelText.registration.en,
    payment: zh ? eventPackageFoundationPanelText.payment.zh : eventPackageFoundationPanelText.payment.en,
    execute: zh ? eventPackageFoundationPanelText.execute.zh : eventPackageFoundationPanelText.execute.en,
  }[gate])
  const packageSections = current?.manifest.sections ?? []
  return (
    <div ref={panel}><AppSectionCard
      title={zh ? eventPackageFoundationPanelText.eventPackageApproval.zh : eventPackageFoundationPanelText.eventPackageApproval.en}
      subtitle={zh
        ? eventPackageFoundationPanelText.savePreparationGenerateAReviewSnapshotThenSubmitApproval.zh
        : eventPackageFoundationPanelText.savePreparationGenerateAReviewSnapshotThenSubmitApproval.en}
      action={current ? <AppBadge variant="info">{approvalTierLabel(current.governanceTier, zh)} · v{current.version}</AppBadge> : undefined}
    >
      {assessmentError ? <p role="alert" className="my-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{zh ? eventPackageFoundationPanelText.approvalTierAndReplyTimeAreUnavailable.zh : eventPackageFoundationPanelText.approvalTierAndReplyTimeAreUnavailable.en}{assessmentError}</p> : null}
      {!packageId && eventBaseline && eventBaseline.coveredOccurrenceIds.length > 1 ? <label className={`${labelClass} mb-4`}>{zh ? eventPackageFoundationPanelText.approvalScope.zh : eventPackageFoundationPanelText.approvalScope.en}<select data-approval-scope className={fieldClass} value={scopeType === 'event' ? 'event' : scopeId} onChange={(event) => { const value = event.target.value; setHistoryPage(1); setScopeType(value === 'event' ? 'event' : 'occurrence'); setScopeId(value === 'event' ? '' : value) }}><option value="event">{zh ? eventPackageFoundationPanelText.wholeEventSeries.zh : eventPackageFoundationPanelText.wholeEventSeries.en}</option>{eventBaseline.coveredOccurrenceIds.map((occurrenceId, index) => <option key={occurrenceId} value={occurrenceId}>{zh ? eventPackageFoundationPanelText.occurrence.zh(index + 1) : eventPackageFoundationPanelText.occurrence.en(index + 1)} · {occurrenceId.slice(0, 8)}</option>)}</select><span className="mt-1 block font-normal text-[#66766f]">{scopeType === 'occurrence' ? (zh ? eventPackageFoundationPanelText.useThisScopeToGenerateReviewConditionAndConfirm.zh : eventPackageFoundationPanelText.useThisScopeToGenerateReviewConditionAndConfirm.en) : (zh ? eventPackageFoundationPanelText.theSeriesBaselineCoversTheListedOccurrencesSelectAn.zh : eventPackageFoundationPanelText.theSeriesBaselineCoversTheListedOccurrencesSelectAn.en)}</span></label> : null}
      {state === 'loading' ? <p className="text-sm text-[#66766f]" role="status">{zh ? eventPackageFoundationPanelText.loadingEventPackages.zh : eventPackageFoundationPanelText.loadingEventPackages.en}</p> : null}
      {error ? <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${state === 'conflict' ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`} role="alert">{error}</p> : null}
      {error ? <AppActionButton className="mt-2" disabled={busy} onClick={() => void load()}>{zh ? eventPackageFoundationPanelText.refreshAndRetry.zh : eventPackageFoundationPanelText.refreshAndRetry.en}</AppActionButton> : null}
      {notice ? <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{notice}</p> : null}
      <div data-approval-actions tabIndex={-1} className="my-4 scroll-mt-24 space-y-3 rounded-xl border border-[#dce5e0] bg-[#f4f8f6] p-4 outline-none focus:ring-2 focus:ring-[#176b5a]"><h3 className="font-semibold">{zh ? eventPackageFoundationPanelText.approvalActions.zh : eventPackageFoundationPanelText.approvalActions.en}</h3><p className="text-sm">{current?.status === 'submitted' ? (zh ? eventPackageFoundationPanelText.submittedForADecisionDelegationIsOptional.zh : eventPackageFoundationPanelText.submittedForADecisionDelegationIsOptional.en) : current?.status === 'approved' || current?.status === 'approvedWithConditions' ? (zh ? eventPackageFoundationPanelText.checkApprovalValidityThenPublishOrOpenRegistrationSeparately.zh : eventPackageFoundationPanelText.checkApprovalValidityThenPublishOrOpenRegistrationSeparately.en) : (zh ? eventPackageFoundationPanelText.completeTheItemsBelowThenGenerateAndSubmitA.zh : eventPackageFoundationPanelText.completeTheItemsBelowThenGenerateAndSubmitA.en)}</p><div className="flex flex-wrap gap-2">
        {mayGenerate ? <AppActionButton variant="primary" disabled={!planETag || busy || (scopeType === 'occurrence' && !scopeId)} onClick={() => void generate()}>{state === 'generating' ? (zh ? eventPackageFoundationPanelText.generating.zh : eventPackageFoundationPanelText.generating.en) : (current ? (zh ? eventPackageFoundationPanelText.generateANewVersion.zh : eventPackageFoundationPanelText.generateANewVersion.en) : scopeType === 'occurrence' ? (zh ? eventPackageFoundationPanelText.generateOccurrencePackage.zh : eventPackageFoundationPanelText.generateOccurrencePackage.en) : (zh ? eventPackageFoundationPanelText.generatePackage.zh : eventPackageFoundationPanelText.generatePackage.en))}</AppActionButton> : null}
        {current && capabilities?.canSubmit ? <AppActionButton disabled={busy || current.manifest.blockers.length > 0} onClick={() => void submit()}>{zh ? eventPackageFoundationPanelText.submitForApproval.zh : eventPackageFoundationPanelText.submitForApproval.en}</AppActionButton> : null}
        {current && capabilities?.canWithdraw ? <AppActionButton variant="danger" disabled={busy} onClick={() => void mutate(() => eventPackageService.withdraw(eventId, current.id, current.eTag))}>{zh ? eventPackageFoundationPanelText.withdrawVersion.zh : eventPackageFoundationPanelText.withdrawVersion.en}</AppActionButton> : null}
        {showPublicationActions && current && lifecycle && capabilities?.canPublish ? <AppActionButton variant="primary" disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'publish' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.publish(eventId, lifecycle.eTag, current))}>{zh ? eventPackageFoundationPanelText.confirmPublication.zh : eventPackageFoundationPanelText.confirmPublication.en}</AppActionButton> : null}
        {current && lifecycle && capabilities?.canOpenRegistration ? <AppActionButton disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'registration' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.openRegistration(eventId, lifecycle, current))}>{zh ? eventPackageFoundationPanelText.confirmRegistrationOpening.zh : eventPackageFoundationPanelText.confirmRegistrationOpening.en}</AppActionButton> : null}
        {current && lifecycle && capabilities?.canConfirmExecution ? <AppActionButton disabled={busy || (current.status === 'approvedWithConditions' && current.conditions.some((condition) => condition.appliesToGate === 'execute' && condition.status !== 'verified' && condition.status !== 'waived'))} onClick={() => void mutate(() => eventPackageService.confirmExecution(eventId, lifecycle, current))}>{zh ? eventPackageFoundationPanelText.confirmExecution.zh : eventPackageFoundationPanelText.confirmExecution.en}</AppActionButton> : null}
      </div>{!hasPrimaryActions ? <p className="text-sm">{zh ? eventPackageFoundationPanelText.youCannotSubmitOrPublishWithYourCurrentPermissions.zh : eventPackageFoundationPanelText.youCannotSubmitOrPublishWithYourCurrentPermissions.en}</p> : null}
      {current && capabilities?.canSubmit && current.manifest.blockers.length > 0 ? <p className="text-sm text-amber-900">{zh ? eventPackageFoundationPanelText.submissionUnavailableCompleteTheEvidenceGapsBelowFirst.zh : eventPackageFoundationPanelText.submissionUnavailableCompleteTheEvidenceGapsBelowFirst.en}</p> : null}
      {current && capabilities?.canDecide ? <AppActionButton disabled={busy} onClick={() => focusSection('decision')}>{zh ? eventPackageFoundationPanelText.goToDecisionForm.zh : eventPackageFoundationPanelText.goToDecisionForm.en}</AppActionButton> : null}</div>
      {capabilities?.canUnpublish && lifecycle ? <form className="mt-4 grid gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.unpublish(eventId, lifecycle.eTag, { en: unpublishReasonEn.trim(), zh: unpublishReasonZh.trim() })) }}><label className={labelClass}>{zh ? eventPackageFoundationPanelText.unpublishReasonEnglish.zh : eventPackageFoundationPanelText.unpublishReasonEnglish.en}<input className={fieldClass} value={unpublishReasonEn} onChange={(event) => setUnpublishReasonEn(event.target.value)} required /></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.unpublishReasonChinese.zh : eventPackageFoundationPanelText.unpublishReasonChinese.en}<input className={fieldClass} value={unpublishReasonZh} onChange={(event) => setUnpublishReasonZh(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !unpublishReasonEn.trim() || !unpublishReasonZh.trim()}>{zh ? eventPackageFoundationPanelText.unpublishEvent.zh : eventPackageFoundationPanelText.unpublishEvent.en}</AppActionButton></form> : null}
      {!current && assessment ? <EventApprovalAssessmentPanel assessment={assessment} zh={zh} approved={false} /> : null}
      {state !== 'loading' && !current ? (
        <AppEmptyState
          title={zh ? eventPackageFoundationPanelText.noEventPackageYet.zh : eventPackageFoundationPanelText.noEventPackageYet.en}
          description={scopeType === 'occurrence'
            ? (zh ? eventPackageFoundationPanelText.thisOccurrenceHasNoScopedPackageYetGenerateOne.zh : eventPackageFoundationPanelText.thisOccurrenceHasNoScopedPackageYetGenerateOne.en)
            : (zh ? eventPackageFoundationPanelText.acceptAnEventPlanAndPublishAnApplicableGovernance.zh : eventPackageFoundationPanelText.acceptAnEventPlanAndPublishAnApplicableGovernance.en)}
        />
      ) : null}
      {current ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#40554e]">{packageStatusLabel(current.status, zh)} · {packageStatusLabel(current.approvalValidityStatus, zh)} · {current.scopeType === 'event' ? (zh ? eventPackageFoundationPanelText.wholeEvent.zh : eventPackageFoundationPanelText.wholeEvent.en) : (zh ? eventPackageFoundationPanelText.oneOccurrence.zh : eventPackageFoundationPanelText.oneOccurrence.en)}</p>
          {lifecycle ? <EventGateChecklist lifecycle={lifecycle} current={current} capabilities={capabilities} zh={zh} canManage={canManage} busy={busy} onEdit={module => void editPreparation(module)} onFocus={focusSection} /> : null}
          {assessment ? <EventApprovalAssessmentPanel assessment={assessment} zh={zh} approved={Boolean(current && ['approved', 'approvedWithConditions'].includes(current.status) && current.approvalValidityStatus === 'active')} /> : null}
          <details data-approval-evidence className="scroll-mt-24 space-y-3 rounded-xl border border-[#dce5e0] p-3"><summary tabIndex={0} className="min-h-11 cursor-pointer font-semibold">{zh ? eventPackageFoundationPanelText.viewFullApprovalEvidenceAndGaps.zh : eventPackageFoundationPanelText.viewFullApprovalEvidenceAndGaps.en}</summary><p className="text-xs text-[#596a63]">Plan v{current.eventPlanVersion} · Policy {current.governancePolicyVersion}</p>
          {(current.manifest.triggerReasons?.length ?? 0) > 0 ? <section className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><strong>{zh ? eventPackageFoundationPanelText.whyThisPackageIsRequired.zh : eventPackageFoundationPanelText.whyThisPackageIsRequired.en}</strong><ul className="mt-2 space-y-1">{current.manifest.triggerReasons!.map((reason) => <li key={reason.code}>• {localize(reason.message, language)} <span className="text-xs opacity-70">({reason.code})</span></li>)}</ul></section> : null}
          {packageSections.length ? <div className="space-y-3">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={zh ? eventPackageFoundationPanelText.packageSections.zh : eventPackageFoundationPanelText.packageSections.en}>{packageSections.map((section, index) => <a key={section.code} href={`#event-package-${section.code}`} className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[#176b5a]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#176b5a] hover:bg-[#edf7f3]">{index + 1}. {localize(section.title, language)}</a>)}</nav>
            <div className="overflow-hidden rounded-xl border border-[#2f4b42]/10 bg-white">{packageSections.map((section, index) => <details id={`event-package-${section.code}`} key={section.code} open={index === 0} className="scroll-mt-4 border-b border-[#2f4b42]/10 last:border-b-0"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-[#f4f8f6]"><span className="min-w-0"><span className="mr-2 text-xs font-black text-[#66766f]">{index + 1}</span><strong className="text-sm text-[#18332d]">{localize(section.title, language)}</strong></span><AppBadge variant={section.status === 'ready' ? 'success' : section.status === 'notApplicable' ? 'info' : 'warning'}>{section.status === 'ready' ? (zh ? eventPackageFoundationPanelText.ready.zh : eventPackageFoundationPanelText.ready.en) : section.status === 'notApplicable' ? (zh ? eventPackageFoundationPanelText.notApplicable.zh : eventPackageFoundationPanelText.notApplicable.en) : (zh ? eventPackageFoundationPanelText.attention.zh : eventPackageFoundationPanelText.attention.en)}</AppBadge></summary><div className="border-t border-[#2f4b42]/10 bg-[#fbfcfa] px-4 py-3">{section.items.length ? <ul className="space-y-1.5 text-sm text-[#40554e]">{section.items.map((item, itemIndex) => <li key={`${section.code}-item-${itemIndex}`}>• {localize(item, language)}</li>)}</ul> : null}{section.moduleCodes.length ? <div className="mt-3 flex flex-wrap gap-1">{section.moduleCodes.map((moduleCode) => canManage && knownPreparationArea(moduleCode) ? <AppActionButton key={moduleCode} size="sm" disabled={busy} onClick={() => void editPreparation(moduleCode)}>{zh ? eventPackageFoundationPanelText.edit.zh : eventPackageFoundationPanelText.edit.en}{preparationAreaLabel(moduleCode, zh)}</AppActionButton> : <AppBadge key={moduleCode} variant="info">{preparationAreaLabel(moduleCode, zh)}</AppBadge>)}</div> : null}{section.blockers.length ? <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">{section.blockers.map((blocker, blockerIndex) => <li key={`${section.code}-blocker-${blockerIndex}`}>• {localize(blocker, language)}</li>)}</ul> : null}</div></details>)}</div>
          </div> : null}
          {(current.manifest.requiredSpecialistDecisions?.length ?? 0) > 0 ? <section className="rounded-xl border border-[#2f4b42]/10 bg-[#f4f8f6] p-3"><strong className="text-sm text-[#18332d]">{zh ? eventPackageFoundationPanelText.specialistDecisionsStillRemainIndependent.zh : eventPackageFoundationPanelText.specialistDecisionsStillRemainIndependent.en}</strong><div className="mt-2 flex flex-wrap gap-1">{current.manifest.requiredSpecialistDecisions!.map((decision) => <AppBadge key={decision} variant="warning">{decision}</AppBadge>)}</div></section> : null}
          <details className="rounded-xl border border-[#2f4b42]/10 bg-white p-3"><summary className="cursor-pointer text-sm font-black text-[#40554e]">{zh ? eventPackageFoundationPanelText.authoritativeModuleSourcesAndDetailedReadiness.zh : eventPackageFoundationPanelText.authoritativeModuleSourcesAndDetailedReadiness.en}</summary><div className="mt-3 grid gap-2 tablet:grid-cols-2" aria-label={zh ? eventPackageFoundationPanelText.moduleSourceAndReadinessStates.zh : eventPackageFoundationPanelText.moduleSourceAndReadinessStates.en}>{current.manifest.modules.map((module) => <section key={module.moduleCode} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-[#18332d]">{module.moduleCode}</strong><AppBadge variant={module.availability === 'available' && module.blockers.length === 0 ? 'success' : 'warning'}>{module.availability} · {module.blockers.length === 0 ? (zh ? eventPackageFoundationPanelText.readyLabel.zh : eventPackageFoundationPanelText.readyLabel.en) : (zh ? eventPackageFoundationPanelText.gaps.zh(module.blockers.length) : eventPackageFoundationPanelText.gaps.en(module.blockers.length))}</AppBadge></div>{module.blockers.length ? <ul className="mt-2 space-y-1 text-xs text-amber-900">{module.blockers.map((blocker, index) => <li key={`${module.moduleCode}-${index}`}>• {localize(blocker, language)}</li>)}</ul> : null}</section>)}</div></details>
          {current.manifest.blockers.length ? <ul className="space-y-2">{current.manifest.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{localize(blocker, language)}</li>)}</ul> : <p className="text-sm text-[#66766f]">{zh ? eventPackageFoundationPanelText.theCurrentSnapshotHasNoSubmissionBlockersItStill.zh : eventPackageFoundationPanelText.theCurrentSnapshotHasNoSubmissionBlockersItStill.en}</p>}
          </details>
          {current.decisions.length ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-emerald-900">{zh ? eventPackageFoundationPanelText.formalDecision.zh : eventPackageFoundationPanelText.formalDecision.en}</p>{current.decisions.map((decision) => <div key={decision.id} className="mt-2 text-sm text-emerald-950"><strong>{decision.decisionType}</strong> · {new Date(decision.decidedUtc).toLocaleString()}<p>{localize(decision.reason, language)}</p></div>)}{capabilities?.canRevokeDecision && current.decisions.some((decision) => decision.decisionType === 'approve' || decision.decisionType === 'approveWithConditions') ? <form className="mt-3 grid gap-2 border-t border-emerald-200 pt-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); const approval = current.decisions.find((decision) => decision.decisionType === 'approve' || decision.decisionType === 'approveWithConditions'); if (approval) void mutate(() => eventPackageService.revokeDecision(eventId, current, approval.id, { en: revokeReasonEn.trim(), zh: revokeReasonZh.trim() })) }}><input className={fieldClass} value={revokeReasonEn} onChange={(event) => setRevokeReasonEn(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.revocationReasonEnglish.zh : eventPackageFoundationPanelText.revocationReasonEnglish.en} required /><input className={fieldClass} value={revokeReasonZh} onChange={(event) => setRevokeReasonZh(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.revocationReasonChinese.zh : eventPackageFoundationPanelText.revocationReasonChinese.en} required /><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !revokeReasonEn.trim() || !revokeReasonZh.trim()}>{zh ? eventPackageFoundationPanelText.revokeApproval.zh : eventPackageFoundationPanelText.revokeApproval.en}</AppActionButton></form> : null}</div> : null}
          {current.conditions.length ? <div data-approval-conditions tabIndex={-1} className="scroll-mt-24 space-y-2 outline-none">{current.conditions.filter(condition => !conditionId || condition.id === conditionId).map((condition) => <div key={condition.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>{condition.appliesToGate} · {condition.status}</strong><p>{localize(condition.text, language)}</p><p className="mt-1 text-xs">{condition.ownerRoleRequirementKey} · {new Date(condition.dueUtc).toLocaleString()}</p>{condition.evidenceReferenceHash ? <p className="mt-1 text-xs">{condition.evidenceAvailable ? (zh ? eventPackageFoundationPanelText.evidenceReferenceAvailableToAuthorisedReviewers.zh : eventPackageFoundationPanelText.evidenceReferenceAvailableToAuthorisedReviewers.en) : (zh ? eventPackageFoundationPanelText.evidenceReferenceIsUnavailableUnderRetentionRulesItsAudit.zh : eventPackageFoundationPanelText.evidenceReferenceIsUnavailableUnderRetentionRulesItsAudit.en)} · {condition.evidenceExpiresUtc ? new Date(condition.evidenceExpiresUtc).toLocaleDateString() : '—'}</p> : null}{conditionCapability(condition.id)?.canSatisfy ? <form className="mt-3 flex flex-col gap-2 tablet:flex-row" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.satisfyCondition(eventId, current.id, condition.id, condition.eTag, conditionEvidence.trim())) }}><input className={fieldClass} value={conditionEvidence} onChange={(event) => setConditionEvidence(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.evidenceReferenceDoNotPasteSensitiveEvidence.zh : eventPackageFoundationPanelText.evidenceReferenceDoNotPasteSensitiveEvidence.en} required /><AppActionButton className="self-end" type="submit" disabled={busy || !conditionEvidence.trim()}>{zh ? eventPackageFoundationPanelText.submitEvidenceReference.zh : eventPackageFoundationPanelText.submitEvidenceReference.en}</AppActionButton></form> : null}{conditionCapability(condition.id)?.canVerify ? <form className="mt-3 grid gap-2 tablet:grid-cols-[1fr_1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.verifyCondition(eventId, current.id, condition.id, condition.eTag, true, { en: conditionVerifyEn.trim(), zh: conditionVerifyZh.trim() })) }}><input className={fieldClass} value={conditionVerifyEn} onChange={(event) => setConditionVerifyEn(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.verificationReasonEnglish.zh : eventPackageFoundationPanelText.verificationReasonEnglish.en} required /><input className={fieldClass} value={conditionVerifyZh} onChange={(event) => setConditionVerifyZh(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.verificationReasonChinese.zh : eventPackageFoundationPanelText.verificationReasonChinese.en} required /><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy || !conditionVerifyEn.trim() || !conditionVerifyZh.trim()}>{zh ? eventPackageFoundationPanelText.verify.zh : eventPackageFoundationPanelText.verify.en}</AppActionButton><AppActionButton className="self-end" variant="danger" disabled={busy || !conditionVerifyEn.trim() || !conditionVerifyZh.trim()} onClick={() => void mutate(() => eventPackageService.verifyCondition(eventId, current.id, condition.id, condition.eTag, false, { en: conditionVerifyEn.trim(), zh: conditionVerifyZh.trim() }))}>{zh ? eventPackageFoundationPanelText.rejectEvidence.zh : eventPackageFoundationPanelText.rejectEvidence.en}</AppActionButton></form> : null}{conditionCapability(condition.id)?.canWaive ? <div className="mt-3 grid gap-2 border-t border-amber-200 pt-3 tablet:grid-cols-[1fr_1fr_auto]"><input className={fieldClass} value={conditionWaiverEn} onChange={(event) => setConditionWaiverEn(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.waiverReasonEnglish.zh : eventPackageFoundationPanelText.waiverReasonEnglish.en} /><input className={fieldClass} value={conditionWaiverZh} onChange={(event) => setConditionWaiverZh(event.target.value)} placeholder={zh ? eventPackageFoundationPanelText.waiverReasonChinese.zh : eventPackageFoundationPanelText.waiverReasonChinese.en} /><AppActionButton disabled={busy || !conditionWaiverEn.trim() || !conditionWaiverZh.trim()} onClick={() => void mutate(() => eventPackageService.waiveCondition(eventId, current.id, condition.id, condition.eTag, { en: conditionWaiverEn.trim(), zh: conditionWaiverZh.trim() }))}>{zh ? eventPackageFoundationPanelText.policyWaiver.zh : eventPackageFoundationPanelText.policyWaiver.en}</AppActionButton></div> : null}</div>)}</div> : null}
          <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]"><summary className="cursor-pointer font-bold text-[#40554e]">{zh ? eventPackageFoundationPanelText.versionHistory.zh(historyTotal) : eventPackageFoundationPanelText.versionHistory.en(historyTotal)}</summary><div className="mt-3 grid gap-2 tablet:grid-cols-2"><label className={labelClass}>{zh ? eventPackageFoundationPanelText.filterByStatus.zh : eventPackageFoundationPanelText.filterByStatus.en}<select className={fieldClass} value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value as EventPackageStatus | 'all'); setHistoryPage(1) }}><option value="all">{zh ? eventPackageFoundationPanelText.allStatuses.zh : eventPackageFoundationPanelText.allStatuses.en}</option>{(['draft', 'submitted', 'returnedForAmendment', 'rejected', 'approvedWithConditions', 'approved', 'withdrawn', 'superseded'] as EventPackageStatus[]).map((status) => <option key={status} value={status}>{packageStatusLabel(status, zh)}</option>)}</select></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.sort.zh : eventPackageFoundationPanelText.sort.en}<select className={fieldClass} value={historySort} onChange={(event) => { setHistorySort(event.target.value as typeof historySort); setHistoryPage(1) }}><option value="versionDesc">{zh ? eventPackageFoundationPanelText.versionNewestFirst.zh : eventPackageFoundationPanelText.versionNewestFirst.en}</option><option value="versionAsc">{zh ? eventPackageFoundationPanelText.versionOldestFirst.zh : eventPackageFoundationPanelText.versionOldestFirst.en}</option><option value="generatedDesc">{zh ? eventPackageFoundationPanelText.generatedNewestFirst.zh : eventPackageFoundationPanelText.generatedNewestFirst.en}</option><option value="generatedAsc">{zh ? eventPackageFoundationPanelText.generatedOldestFirst.zh : eventPackageFoundationPanelText.generatedOldestFirst.en}</option></select></label></div>{eventHistory.length ? <ol className="mt-3 space-y-1">{eventHistory.map((item) => <li key={item.id}>v{item.version} · {packageStatusLabel(item.status, zh)} · {new Date(item.generatedUtc).toLocaleString()} · {item.contentHash.slice(0, 12)}</li>)}</ol> : <p className="mt-3">{zh ? eventPackageFoundationPanelText.noVersionsMatchThisFilter.zh : eventPackageFoundationPanelText.noVersionsMatchThisFilter.en}</p>}<div className="mt-3 flex items-center justify-between gap-2"><AppActionButton disabled={busy || historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>{zh ? eventPackageFoundationPanelText.previous.zh : eventPackageFoundationPanelText.previous.en}</AppActionButton><span>{zh ? eventPackageFoundationPanelText.pageOf.zh(historyPage, historyPageCount) : eventPackageFoundationPanelText.pageOf.en(historyPage, historyPageCount)}</span><AppActionButton disabled={busy || historyPage >= historyPageCount} onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}>{zh ? eventPackageFoundationPanelText.next.zh : eventPackageFoundationPanelText.next.en}</AppActionButton></div></details>
          {packageDiff ? <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]"><summary className="cursor-pointer font-bold text-[#40554e]">{zh ? eventPackageFoundationPanelText.changesFromV.zh(packageDiff.fromVersion, packageDiff.changes.length) : eventPackageFoundationPanelText.changesFromV.en(packageDiff.fromVersion, packageDiff.changes.length)}</summary>{packageDiff.changes.length ? <ul className="mt-2 space-y-2">{packageDiff.changes.map((change) => <li key={change.field} className="rounded-lg bg-[#f4f8f6] px-2 py-1"><strong>{change.field}</strong> · {change.classification}<span className="block break-all">{change.before || '—'} → {change.after || '—'}</span></li>)}</ul> : <p className="mt-2">{zh ? eventPackageFoundationPanelText.noContentChanges.zh : eventPackageFoundationPanelText.noContentChanges.en}</p>}</details> : null}
        </div>
      ) : null}
      {capabilities?.canCloseRegistration && lifecycle ? <form className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventPackageService.closeRegistration(eventId, lifecycle, { en: registrationCloseEn.trim(), zh: registrationCloseZh.trim() })) }}><label className={labelClass}>{zh ? eventPackageFoundationPanelText.closeRegistrationReasonEnglish.zh : eventPackageFoundationPanelText.closeRegistrationReasonEnglish.en}<input className={fieldClass} value={registrationCloseEn} onChange={(event) => setRegistrationCloseEn(event.target.value)} required /></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.closeRegistrationReasonChinese.zh : eventPackageFoundationPanelText.closeRegistrationReasonChinese.en}<input className={fieldClass} value={registrationCloseZh} onChange={(event) => setRegistrationCloseZh(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="danger" disabled={busy || !registrationCloseEn.trim() || !registrationCloseZh.trim()}>{zh ? eventPackageFoundationPanelText.closeRegistration.zh : eventPackageFoundationPanelText.closeRegistration.en}</AppActionButton></form> : null}
      {current && capabilities?.canDecide ? <form data-approval-decision tabIndex={-1} className="mt-5 scroll-mt-24 rounded-2xl border border-[#176b5a]/20 bg-[#f4f8f6] p-4 outline-none focus:ring-2 focus:ring-[#176b5a]" onSubmit={(event) => { event.preventDefault(); void decide() }}>
        <h3 className="font-black text-[#18332d]">{zh ? eventPackageFoundationPanelText.recordFormalDecision.zh : eventPackageFoundationPanelText.recordFormalDecision.en}</h3>
        <p className="mt-1 text-xs text-[#66766f]">{zh ? eventPackageFoundationPanelText.theServerRechecksGovernanceTierOrganisationalAuthorityAndSubmitter.zh : eventPackageFoundationPanelText.theServerRechecksGovernanceTierOrganisationalAuthorityAndSubmitter.en}</p>
        <div className="mt-3 grid gap-3 tablet:grid-cols-3">
          <label className={labelClass}>{zh ? eventPackageFoundationPanelText.decision.zh : eventPackageFoundationPanelText.decision.en}<select className={fieldClass} value={decisionType} onChange={(event) => setDecisionType(event.target.value as Exclude<EventPackageDecisionType, 'revoke' | 'conditionWaiver'>)}><option value="approve">{zh ? eventPackageFoundationPanelText.approve.zh : eventPackageFoundationPanelText.approve.en}</option><option value="approveWithConditions">{zh ? eventPackageFoundationPanelText.approveWithConditions.zh : eventPackageFoundationPanelText.approveWithConditions.en}</option><option value="returnForAmendment">{zh ? eventPackageFoundationPanelText.returnForAmendment.zh : eventPackageFoundationPanelText.returnForAmendment.en}</option><option value="reject">{zh ? eventPackageFoundationPanelText.reject.zh : eventPackageFoundationPanelText.reject.en}</option></select></label>
          <label className={labelClass}>{zh ? eventPackageFoundationPanelText.reasonInEnglish.zh : eventPackageFoundationPanelText.reasonInEnglish.en}<textarea aria-label={zh ? eventPackageFoundationPanelText.reasonInEnglish.zh : eventPackageFoundationPanelText.reasonInEnglish.en} className={fieldClass} value={reasonEn} onChange={(event) => setReasonEn(event.target.value)} required /></label>
          <label className={labelClass}>{zh ? eventPackageFoundationPanelText.reasonInChinese.zh : eventPackageFoundationPanelText.reasonInChinese.en}<textarea aria-label={zh ? eventPackageFoundationPanelText.reasonInChinese.zh : eventPackageFoundationPanelText.reasonInChinese.en} className={fieldClass} value={reasonZh} onChange={(event) => setReasonZh(event.target.value)} required /></label>
        </div>
        {decisionType === 'approveWithConditions' ? <fieldset className="mt-3 grid gap-3 border-t border-[#2f4b42]/10 pt-3 tablet:grid-cols-2"><legend className="px-1 text-xs font-black text-[#40554e]">{zh ? eventPackageFoundationPanelText.structuredCondition.zh : eventPackageFoundationPanelText.structuredCondition.en}</legend><label className={labelClass}>English<input className={fieldClass} value={conditionEn} onChange={(event) => setConditionEn(event.target.value)} required /></label><label className={labelClass}>{eventPackageFoundationPanelText.label}<input className={fieldClass} value={conditionZh} onChange={(event) => setConditionZh(event.target.value)} required /></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.ownerRoleKey.zh : eventPackageFoundationPanelText.ownerRoleKey.en}<input className={fieldClass} value={conditionOwner} onChange={(event) => setConditionOwner(event.target.value)} required /></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.appliesToGate.zh : eventPackageFoundationPanelText.appliesToGate.en}<select className={fieldClass} value={conditionGate} onChange={(event) => setConditionGate(event.target.value as EventLifecycleGate)}>{(['publish', 'registration', 'payment', 'execute'] as const).map(gate => <option key={gate} value={gate}>{gateLabel(gate)}</option>)}</select></label><label className={labelClass}>{zh ? eventPackageFoundationPanelText.due.zh : eventPackageFoundationPanelText.due.en}<input type="datetime-local" className={fieldClass} value={conditionDue} onChange={(event) => setConditionDue(event.target.value)} required /></label></fieldset> : null}
        <div className="mt-3"><AppActionButton type="submit" variant={decisionType === 'reject' ? 'danger' : 'primary'} disabled={busy || !reasonEn.trim() || !reasonZh.trim() || !conditionalComplete}>{state === 'mutating' ? (zh ? eventPackageFoundationPanelText.saving.zh : eventPackageFoundationPanelText.saving.en) : (zh ? eventPackageFoundationPanelText.confirmAndRecordDecision.zh : eventPackageFoundationPanelText.confirmAndRecordDecision.en)}</AppActionButton></div>
      </form> : null}
      {capabilities?.canManageDelegations ? <EventApprovalDelegation key={groupId + eventId} groupId={groupId} eventId={eventId} zh={zh} disabled={state !== 'ready'} onBusy={setDelegationBusy} onChanged={async () => { await load(); await onChanged?.() }} /> : null}
      {confirmationModal}
      {ramReviewOpen ? <RamReviewModal eventId={eventId} zh={zh} onClose={() => setRamReviewOpen(false)} onReviewed={async () => { setRamReviewOpen(false); await completeSubmission() }} /> : null}
    </AppSectionCard></div>
  )
}
