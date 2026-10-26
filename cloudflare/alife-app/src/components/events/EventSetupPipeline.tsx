import { eventSetupPipelineText } from '../../i18n/eventSetupPipeline.ts'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppPageShell from '../layout/AppPageShell'
import AppPageBackLink from '../layout/AppPageBackLink'
import AppSectionCard from '../layout/AppSectionCard'
import AppActionButton from '../layout/AppActionButton'
import EventPreparationNavigation from './EventPreparationNavigation'
import EventPreparationLoading from './EventPreparationLoading'
import '../../styles/eventPreparationEditorial.css'
import EventPosterStep from './EventPosterStep'
import EventPublishStep from './EventPublishStep'
import EventSavedPreparationSteps from './EventSavedPreparationSteps'
import EventPreparationReopenPanel from './EventPreparationReopenPanel'
import { EventPackageFoundationPanel } from './EventPackageFoundationPanel'
import { canVisitSetupStep, resolveSetupStage, setupPath, setupStages } from '../../utils/eventSetupFlow'
import { eventPreparationService, type EventPreparationState } from '../../services/eventPreparationService'
import { eventCompositionService } from '../../services/eventCompositionService'
import { normalizeApiError } from '../../services/http'
import type { EventArchetype, EventPlanSnapshot, EventWorkspace } from '../../types/eventComposition'
import { dutyReturnPath, withDutyReturn } from '../../utils/eventDutyNavigation'
import useConfirmation from '../../hooks/useConfirmation'

export default function EventSetupPipeline({ workspace: initialWorkspace, plan: initialPlan, archetypes, eventBasePath, language }: {
  workspace: EventWorkspace; plan: EventPlanSnapshot | null; archetypes: EventArchetype[]; eventBasePath: string; language: 'en' | 'zh'
}) {
  const zh = language === 'zh', navigate = useNavigate(), [params] = useSearchParams()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const stage = resolveSetupStage(params.get('stage')), step = setupStages.indexOf(stage) + 2
  const [workspace, setWorkspace] = useState(initialWorkspace), [plan, setPlan] = useState(initialPlan)
  const [preparation, setPreparation] = useState<EventPreparationState | null>(null), [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(true), [busy, setBusy] = useState(false)
  const [detailsDirty, setDetailsDirty] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(() => new Set([stage]))
  const [approvalRevision, setApprovalRevision] = useState(0)
  const moduleParam = params.get('module')
  const region = useRef<HTMLDivElement>(null), flowTop = useRef<HTMLDivElement>(null), live = useRef(true), refreshVersion = useRef(0)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current
    setRefreshing(true)
    try {
      const [next, nextPlan, nextWorkspace] = await Promise.all([eventPreparationService.get(initialWorkspace.eventId), eventCompositionService.getPlan(initialWorkspace.eventId), eventCompositionService.getWorkspace(initialWorkspace.eventId)])
      if (live.current && version === refreshVersion.current) { setPreparation(next); setPlan(nextPlan); setWorkspace(nextWorkspace); setError('') }
    } catch (failure) { if (live.current && version === refreshVersion.current) setError(normalizeApiError(failure).message) }
    finally { if (live.current && version === refreshVersion.current) setRefreshing(false) }
  }, [initialWorkspace.eventId])
  useEffect(() => { void refresh() }, [refresh, stage])
  useEffect(() => { const focus = () => void refresh(); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus) }, [refresh])
  const frozen = preparation?.isFrozen ?? true, approved = preparation?.isApproved ?? false
  const dirty = detailsDirty, unavailable = !preparation || Boolean(error)
  const allowed = !unavailable && canVisitSetupStep(step, frozen, approved) && !(dirty && step >= 5)
  const canEdit = Boolean(preparation?.canEdit && !unavailable)
  useEffect(() => {
    setVisited(current => new Set([...current, stage]))
    region.current?.focus({ preventScroll: true })
    flowTop.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [stage])
  const returnTo = params.has('returnTo') ? dutyReturnPath(params.get('returnTo')) : undefined
  const go = (value: typeof stage) => {
    const path = setupPath(eventBasePath, value) + (params.get('reviewReturn') === 'approval' && value !== 'approval' ? '&reviewReturn=approval' : '')
    navigate(returnTo ? withDutyReturn(path, returnTo) : path)
  }
  const selectModule = (code: string | null) => {
    const path = setupPath(eventBasePath, 'arrangements', code || undefined) + (params.get('reviewReturn') === 'approval' ? '&reviewReturn=approval' : '')
    navigate(returnTo ? withDutyReturn(path, returnTo) : path)
  }
  const changedReopening = (value: EventPreparationState) => { setPreparation(value); setApprovalRevision(current => current + 1); void refresh() }
  const leave = async (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (busy) { event.preventDefault(); return }
    if (!dirty) return
    event.preventDefault()
    if (await requestConfirmation({ title: zh ? eventSetupPipelineText.leaveAndDiscardUnsavedChanges.zh : eventSetupPipelineText.leaveAndDiscardUnsavedChanges.en, description: zh ? eventSetupPipelineText.unsavedEventDetailsAndAreaFormsWillBeLost.zh : eventSetupPipelineText.unsavedEventDetailsAndAreaFormsWillBeLost.en, confirmLabel: zh ? eventSetupPipelineText.discardAndLeave.zh : eventSetupPipelineText.discardAndLeave.en, cancelLabel: zh ? eventSetupPipelineText.keepEditing.zh : eventSetupPipelineText.keepEditing.en, tone: 'danger' })) navigate(path)
  }
  return <AppPageShell><div className="event-editorial space-y-4">
    {confirmationModal}
    <div className="flex flex-wrap items-center gap-3"><AppPageBackLink to={returnTo ?? eventBasePath} label={returnTo ? (zh ? eventSetupPipelineText.backToCurrentTasks.zh : eventSetupPipelineText.backToCurrentTasks.en) : (zh ? eventSetupPipelineText.backToEvent.zh : eventSetupPipelineText.backToEvent.en)} onClick={event => void leave(event, returnTo ?? eventBasePath)} /><Link className="text-sm font-semibold text-[#176b5a] hover:underline" to={`/events/${workspace.eventId}/work`} aria-disabled={busy || undefined} onClick={event => void leave(event, `/events/${workspace.eventId}/work`)}>{zh ? eventSetupPipelineText.viewEventWorkspaceFourStages.zh : eventSetupPipelineText.viewEventWorkspaceFourStages.en}</Link></div>
    <div ref={flowTop} className="scroll-mt-24"><EventPreparationNavigation eventId={workspace.eventId} title={workspace.title[language] || workspace.title.en || workspace.title.zh} stage={stage} zh={zh} returnTo={returnTo} disabled={busy || refreshing || unavailable} frozen={frozen} approved={approved} dirty={dirty} go={go} /></div>
    {params.get('reviewReturn') === 'approval' && stage !== 'approval' ? <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#e3f0eb] p-3 text-sm"><AppActionButton disabled={busy || dirty || refreshing} onClick={() => go('approval')}>{zh ? eventSetupPipelineText.backToFormalApproval.zh : eventSetupPipelineText.backToFormalApproval.en}</AppActionButton><span>{zh ? eventSetupPipelineText.saveYourChangesThenReturnToReviewTheApproval.zh : eventSetupPipelineText.saveYourChangesThenReturnToReviewTheApproval.en}</span></div> : null}
    {preparation && frozen ? <p className="event-editorial-notice">{zh ? eventSetupPipelineText.preparationIsFrozenRequestReopeningBeforeChangingItsConfiguration.zh : eventSetupPipelineText.preparationIsFrozenRequestReopeningBeforeChangingItsConfiguration.en}</p> : null}
    {dirty ? <p role="status" className="text-sm text-amber-900">{zh ? eventSetupPipelineText.unsavedChangesSaveBeforeApprovalOrSwitchingStages.zh : eventSetupPipelineText.unsavedChangesSaveBeforeApprovalOrSwitchingStages.en}</p> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-rose-800"><p>{error}</p><AppActionButton disabled={refreshing} onClick={() => void refresh()}>{zh ? eventSetupPipelineText.reloadPreparationStatus.zh : eventSetupPipelineText.reloadPreparationStatus.en}</AppActionButton></div> : null}
    <div ref={region} tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      {!preparation && !error ? <EventPreparationLoading zh={zh} /> : null}
      {preparation && !allowed && !error ? <AppSectionCard title={zh ? eventSetupPipelineText.thisStepIsCurrentlyUnavailable.zh : eventSetupPipelineText.thisStepIsCurrentlyUnavailable.en} subtitle={dirty ? (zh ? eventSetupPipelineText.returnAndSaveYourPendingChanges.zh : eventSetupPipelineText.returnAndSaveYourPendingChanges.en) : frozen && step < 5 ? (zh ? eventSetupPipelineText.approvedPreparationIsFrozenRequestReopeningBeforeEditing.zh : eventSetupPipelineText.approvedPreparationIsFrozenRequestReopeningBeforeEditing.en) : (zh ? eventSetupPipelineText.formalApprovalIsRequiredBeforePosterProductionAndPublication.zh : eventSetupPipelineText.formalApprovalIsRequiredBeforePosterProductionAndPublication.en)}><AppActionButton onClick={() => go(dirty ? (detailsDirty ? 'details' : 'arrangements') : 'approval')}>{dirty ? (zh ? eventSetupPipelineText.returnToChanges.zh : eventSetupPipelineText.returnToChanges.en) : (zh ? eventSetupPipelineText.goToFormalApproval.zh : eventSetupPipelineText.goToFormalApproval.en)}</AppActionButton></AppSectionCard> : null}
      {!frozen && preparation && (['details', 'arrangements', 'review'].some(value => visited.has(value)) || ['details', 'arrangements', 'review'].includes(stage)) ? <div hidden={unavailable}><EventSavedPreparationSteps eventId={workspace.eventId} groupId={workspace.owningGroupId} eventBasePath={eventBasePath} workspaceItems={workspace.items} readiness={workspace.readiness} onSelectModule={selectModule} focusModule={moduleParam} plan={plan} archetypes={archetypes} stage={stage} zh={zh} readOnly={!canEdit} onBusy={setBusy} onDirty={setDetailsDirty} onSaved={refresh} go={go} /></div> : null}
      {allowed && stage === 'approval' ? <><EventPackageFoundationPanel key={approvalRevision} eventId={workspace.eventId} groupId={workspace.owningGroupId} planETag={plan?.eTag} canManage={workspace.canManage} language={language} showPublicationActions={false} onBusyChange={setBusy} onChanged={refresh} /><EventPreparationReopenPanel state={preparation!} groupId={workspace.owningGroupId} zh={zh} onChanged={changedReopening} onBusy={setBusy} /><div className="flex flex-wrap items-center justify-between gap-3">{!frozen ? <AppActionButton variant="ghost" disabled={busy} onClick={() => go('arrangements')}>{zh ? eventSetupPipelineText.continueEditingPreparation.zh : eventSetupPipelineText.continueEditingPreparation.en}</AppActionButton> : <span /> }<AppActionButton disabled={busy || refreshing || !approved} onClick={() => go('poster')}>{zh ? eventSetupPipelineText.continueToPoster.zh : eventSetupPipelineText.continueToPoster.en}</AppActionButton></div></> : null}
      {approved && !unavailable && (visited.has('poster') || stage === 'poster') ? <div hidden={stage !== 'poster'}><EventPosterStep eventId={workspace.eventId} zh={zh} onBusy={setBusy} onContinue={() => go('publish')} /></div> : null}
      {allowed && stage === 'publish' ? <EventPublishStep eventId={workspace.eventId} eventBasePath={eventBasePath} zh={zh} onBusy={setBusy} /> : null}
    </div><div className="pb-24" /></div>
  </AppPageShell>
}
