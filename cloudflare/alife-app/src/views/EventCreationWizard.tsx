import { eventCreationWizardText } from '../i18n/eventCreationWizard.ts'
import { eventProjectQuestionnaireText as projectCopy } from '../i18n/eventProjectQuestionnaire'
import { projectNeedsConfirmation } from '../utils/eventProjectQuestionnaire'
import type { EventProjectQuestionDefinition } from '../types/eventProjectQuestionnaire'
import { ramService } from '../services/ramGovernanceService'
import { emptyActivityPlan } from '../types/eventActivityPlan'
import EventFlowRail from '../components/events/EventFlowRail'
import { setupPath } from '../utils/eventSetupFlow'
import RamDraftEditor from '../components/events/RamDraftEditor'
import { parseRamDraft, type RamDraft } from '../types/ramGovernance'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import type { DetailsFocusRequest } from '../components/events/creation/DetailsWorkspace'
import EventDetailsAssistant from '../components/events/creation/EventDetailsAssistant'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { ArrangementsStep, DetailsWorkspace, DetailsStep, ReviewStep, TemplateStep } from '../components/events/creation/CreationSteps'
import { useCreationDraft } from '../components/events/creation/useCreationDraft'
import { eventCompositionService } from '../services/eventCompositionService'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { EventArchetype, EventPlanProposal } from '../types/eventComposition'
import { resolveActivityType } from '../utils/eventCreationWizard'
import { invalidateArrangementConfirmation, composeCreationDraft, createRequestSequence, createSubmissionGuard, creationDraftKey, creationEvent, creationSeries, creationDraftIssue } from '../utils/eventCreationDraft'
import { creationArrangements, validateCreationArrangements } from '../utils/eventCreationArrangements'

type Step = 1 | 2 | 3 | 4
function CreationFlow({ groupId, memberId }: { groupId: string; memberId: string }) {
  const { language, me } = useAuthStore()
  const zh = language === 'zh'
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const stepRegion = useRef<HTMLFieldSetElement>(null)
  const [questionDefinitions,setQuestionDefinitions]=useState<EventProjectQuestionDefinition[]>()
  useEffect(()=>{let live=true;void ramService.authoringContext({groupId}).then(context=>{if(live)setQuestionDefinitions(context.questionDefinitions)}).catch(()=>{});return()=>{live=false}},[groupId,memberId])
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const [catalogue, setCatalogue] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState('')
  const [catalogueAttempt, setCatalogueAttempt] = useState(0)
  const storageKey = creationDraftKey(memberId, groupId)
  const { draft, setDraft, hydrated, storageWarning } = useCreationDraft(storageKey, archetypes, catalogue === 'ready')
  useEffect(() => { stepRegion.current?.focus() }, [step, hydrated])
  const type = useMemo(() => resolveActivityType(archetypes, draft.archetypeCode, draft.activityTypeCode), [archetypes, draft.archetypeCode, draft.activityTypeCode])
  const archetype = archetypes.find(item => item.code === draft.archetypeCode) ?? null
  const [ramDraft, setRamDraft] = useState<RamDraft>(() => parseRamDraft(undefined)), [ramTouched, setRamTouched] = useState(false)
  useEffect(() => { setUnsavedChangesGuard(ramTouched, zh ? eventCreationWizardText.theRamDraftHasNotBeenSavedWithThe.zh : eventCreationWizardText.theRamDraftHasNotBeenSavedWithThe.en, 'confirm'); return () => setUnsavedChangesGuard(false) }, [ramTouched, zh])
  const composition = type ? composeCreationDraft(draft, type) : null
  const compositionSignature = JSON.stringify(composition)
  const creationSignature = JSON.stringify({ draft, composition, ram: ramTouched ? ramDraft : null })
  const latest = useRef({ compositionSignature, creationSignature })
  latest.current = { compositionSignature, creationSignature }
  const [preview, setPreview] = useState<{ proposal: EventPlanProposal; signature: string } | null>(null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [previewError, setPreviewError] = useState('')
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const sequence = useRef(createRequestSequence())
  const [reviewSignature, setReviewSignature] = useState('')
  const [busy, setBusy] = useState(false)
  const actionLock = useRef(false)
  const [error, setError] = useState('')
  const submission = useRef(createSubmissionGuard())
  const currentPreview = previewState === 'ready' && preview?.signature === compositionSignature
  const [aiBusy, setAiBusy] = useState(false)
  const [detailsFocusRequest, setDetailsFocusRequest] = useState<DetailsFocusRequest>()

  useEffect(() => {
    let active = true
    setCatalogue('loading')
    eventCompositionService.listArchetypes(groupId).then(items => {
      if (active) { setArchetypes(items); setCatalogue('ready') }
    }).catch(reason => {
      if (active) { setCatalogueError(normalizeApiError(reason).message); setCatalogue('error') }
    })
    return () => { active = false }
  }, [groupId, catalogueAttempt])
  useEffect(() => () => { sequence.current.invalidate() }, [])

  // Copy and language changes do not refetch the composition.
  useEffect(() => {
    if (step !== 3 || !hydrated || compositionSignature === 'null') return
    const id = sequence.current.next()
    setPreviewState('loading')
    setPreviewError('')
    const timer = setTimeout(() => {
      void eventCompositionService.compose(groupId, JSON.parse(compositionSignature)).then(proposal => {
        if (!sequence.current.isCurrent(id) || latest.current.compositionSignature !== compositionSignature) return
        setPreview({ proposal, signature: compositionSignature })
        setPreviewState('ready')
      }).catch(reason => {
        if (!sequence.current.isCurrent(id) || latest.current.compositionSignature !== compositionSignature) return
        setPreviewState('error')
        const failure = normalizeApiError(reason)
        setPreviewError(failure.status === 412 ? (zh ? eventCreationWizardText.templateVersionChangedReload.zh : eventCreationWizardText.templateVersionChangedReload.en) : failure.message)
      })
    }, 400)
    return () => { clearTimeout(timer); sequence.current.invalidate() }
  }, [compositionSignature, groupId, hydrated, step, previewAttempt])

  const next = async () => {
    if (actionLock.current || aiBusy) return
    setError('')
    if (!type || !archetype || !composition) { setError(zh ? eventCreationWizardText.chooseACategoryAndTemplate.zh : eventCreationWizardText.chooseACategoryAndTemplate.en); return }
    if (step === 1) { setStep(3); return }
    const issue = creationDraftIssue(draft, type, archetype, zh)
    if (issue) { setError(issue.message); setDetailsFocusRequest(previous => ({ field: issue.field, version: (previous?.version ?? 0) + 1 })); setStep(3); return }
    if (step === 2) { setStep(3); return }
    if (step !== 3 || !currentPreview) return
    actionLock.current = true
    setBusy(true)
    const id = sequence.current.next()
    const signature = creationSignature
    try {
      const proposal = await eventCompositionService.compose(groupId, composition)
      if (!sequence.current.isCurrent(id) || latest.current.creationSignature !== signature) return
      setPreview({ proposal, signature: compositionSignature })
      setPreviewState('ready')
      if (draft.activityPlan?.activities.some(activity => projectNeedsConfirmation(activity,questionDefinitions ?? []))) { setError(zh ? projectCopy.confirmBeforeCreate.zh : projectCopy.confirmBeforeCreate.en); setStep(3); return }
    const arrangementIssue = validateCreationArrangements(draft, type, proposal, zh)
      if (arrangementIssue) { setError(arrangementIssue); return }
      setReviewSignature(signature)
      setStep(4)
    } catch (reason) {
      if (sequence.current.isCurrent(id)) { const failure = normalizeApiError(reason); setPreviewState('error'); setPreviewError(failure.status === 412 ? (zh ? eventCreationWizardText.templateVersionChangedReload.zh : eventCreationWizardText.templateVersionChangedReload.en) : failure.message) }
    } finally { actionLock.current = false; setBusy(false) }
  }

  const accept = async () => {
    if (actionLock.current || !type || !archetype || !composition) return
    if (!currentPreview || !preview || reviewSignature !== creationSignature) {
      setError(zh ? eventCreationWizardText.thePlanChangedReturnToArrangementsAndReviewAgain.zh : eventCreationWizardText.thePlanChangedReturnToArrangementsAndReviewAgain.en); return
    }
    const issue = creationDraftIssue(draft, type, archetype, zh)
    if (issue) { setError(issue.message); setDetailsFocusRequest(previous => ({ field: issue.field, version: (previous?.version ?? 0) + 1 })); setStep(3); return }
    if (draft.activityPlan?.activities.some(activity => projectNeedsConfirmation(activity,questionDefinitions ?? []))) { setError(zh ? projectCopy.confirmBeforeCreate.zh : projectCopy.confirmBeforeCreate.en);setStep(3);return }
    const arrangementIssue = validateCreationArrangements(draft, type, preview.proposal, zh)
    if (arrangementIssue) { setError(arrangementIssue); setStep(3); return }
    const idempotencyKey = submission.current.begin(JSON.stringify([creationSignature, preview.proposal.proposalHash]))
    if (!idempotencyKey) return
    actionLock.current = true
    setBusy(true)
    setError('')
    try {
      const created = await eventService.createGroupEvent(groupId, creationEvent(draft, type, me?.displayName || ''), {
        composition, proposalHash: preview.proposal.proposalHash, idempotencyKey, seriesSetup: creationSeries(draft, archetype),
        arrangements: creationArrangements(draft, type, preview.proposal),
        initialRamDraft: ramTouched ? { ...ramDraft, ...(draft.activityPlan || emptyActivityPlan()) } : undefined,
      })
      submission.current.finish(true)
      setUnsavedChangesGuard(false)
      // Storage failure must not turn a successful creation into a retry.
      try { localStorage.removeItem(storageKey) } catch { /* Best effort. */ }
      navigate(setupPath(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(created.id)}`, 'arrangements'), { replace: true, state: { created: true } })
    } catch (reason) {
      submission.current.finish(false)
      const failure = normalizeApiError(reason)
      if (failure.status === 412 || failure.status === 409) {
        setReviewSignature(''); setPreviewState('idle'); setStep(3)
        setError(failure.status === 412 ? (zh ? eventCreationWizardText.templateVersionChangedReload.zh : eventCreationWizardText.templateVersionChangedReload.en) : (zh ? eventCreationWizardText.thePlanOrAVenueBookingHasAConflict.zh : eventCreationWizardText.thePlanOrAVenueBookingHasAConflict.en))
      } else setError(failure.message)
    } finally { actionLock.current = false; setBusy(false) }
  }

  const labels = zh ? [...eventCreationWizardText.localizedCopy.zh] : [...eventCreationWizardText.localizedCopy.en]
  const previewStatus = <div aria-live="polite" className="rounded-xl border border-[#2f4b42]/15 bg-white p-3 text-sm">{currentPreview ? (zh ? eventCreationWizardText.toolsUpdatedForTheCurrentArrangements.zh : eventCreationWizardText.toolsUpdatedForTheCurrentArrangements.en) : previewState === 'error' ? <><p role="alert">{previewError}</p><AppActionButton className="mt-2" onClick={() => setPreviewAttempt(value => value + 1)}>{zh ? eventCreationWizardText.retry.zh : eventCreationWizardText.retry.en}</AppActionButton></> : (zh ? eventCreationWizardText.updatingToolsFromEventArrangements.zh : eventCreationWizardText.updatingToolsFromEventArrangements.en)}</div>


  return <AppPageShell title={zh ? eventCreationWizardText.eventWorkspaceCreateEvent.zh : eventCreationWizardText.eventWorkspaceCreateEvent.en} context={zh ? eventCreationWizardText.groupLifeEvents.zh : eventCreationWizardText.groupLifeEvents.en} backLink={{ to: `/groups/${encodeURIComponent(groupId)}?section=events`, label: zh ? eventCreationWizardText.backToEvents.zh : eventCreationWizardText.backToEvents.en }}>
    <EventFlowRail current={step} zh={zh} disabled={busy || aiBusy || (step === 3 && !currentPreview)} onSelect={value => { if (value === 4 && step === 3) { void next(); return }; setError(''); setStep(value as Step) }} />
    {catalogue === 'loading' ? <p role="status">{zh ? eventCreationWizardText.loadingEventTemplates.zh : eventCreationWizardText.loadingEventTemplates.en}</p> : null}
    {catalogue === 'error' ? <AppEmptyState title={zh ? eventCreationWizardText.eventTemplatesUnavailable.zh : eventCreationWizardText.eventTemplatesUnavailable.en} description={catalogueError} actionLabel={zh ? eventCreationWizardText.retryLabel.zh : eventCreationWizardText.retryLabel.en} onAction={() => setCatalogueAttempt(value => value + 1)} /> : null}
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {storageWarning ? <p role="status" className="text-sm text-amber-800">{zh ? eventCreationWizardText.localDraftRecoveryOrSavingIsUnavailableYouCan.zh : eventCreationWizardText.localDraftRecoveryOrSavingIsUnavailableYouCan.en}</p> : null}
    {catalogue === 'ready' && hydrated ? <>
      <fieldset ref={stepRegion} tabIndex={-1} aria-label={labels[step - 1]} disabled={busy} className="min-w-0 scroll-mt-24 space-y-4 outline-none" aria-busy={busy}>
        {step === 1 ? <TemplateStep draft={draft} setDraft={setDraft} zh={zh} archetypes={archetypes} type={type} /> : null}
        {type && archetype ? <div hidden={step !== 3}><ArrangementsStep questionDefinitions={questionDefinitions} detailsFocusRequest={detailsFocusRequest} detailsPanel={active => <DetailsWorkspace focusRequest={detailsFocusRequest} zh={zh} active={active && step === 3} form={<DetailsStep groupId={groupId} draft={draft} setDraft={setDraft} zh={zh} type={type} archetype={archetype} ai={null} />} assistant={visible => <EventDetailsAssistant draft={draft} setDraft={setDraft} type={type} isSeries={archetype.isSeries} zh={zh} active={visible} onBusy={setAiBusy} />} />} ownerPanel={<p className="mt-1">{me?.displayName || (zh ? eventCreationWizardText.currentUser.zh : eventCreationWizardText.currentUser.en)}</p>} ramDirty={ramTouched} draft={draft} setDraft={setDraft} zh={zh} type={type} groupId={groupId} proposal={preview?.proposal ?? null} current={Boolean(currentPreview)} status={previewStatus} ramPanel={<div className="space-y-4"><p className="rounded-xl bg-[#e3f0eb] p-3 text-sm">{zh ? eventCreationWizardText.fillInRisksHereTheyAreSavedWithThe.zh : eventCreationWizardText.fillInRisksHereTheyAreSavedWithThe.en}</p><RamDraftEditor groupId={groupId} conditionsKey={JSON.stringify(draft)} onBusy={setAiBusy} draft={{...ramDraft,...(draft.activityPlan || emptyActivityPlan())}} update={change => { setRamDraft(value => ({ ...value, ...change })); setRamTouched(true); setDraft(previous => invalidateArrangementConfirmation(previous, 'SAFETY.RAM')) }} editable={!busy} dirty zh={zh} /></div>} /></div> : null}
        {step === 4 && type && archetype && preview ? <ReviewStep draft={draft} zh={zh} type={type} archetype={archetype} proposal={preview.proposal} /> : null}
      </fieldset>
      {step === 1 ? <AppActionButton variant="primary" disabled={busy || aiBusy} onClick={() => void next()}>{zh ? eventCreationWizardText.startArranging.zh : eventCreationWizardText.startArranging.en}</AppActionButton> : null}
      {step === 4 ? <AppActionButton variant="primary" disabled={busy || !currentPreview || reviewSignature !== creationSignature} onClick={() => void accept()}>{zh ? eventCreationWizardText.confirmAndCreateEvent.zh : eventCreationWizardText.confirmAndCreateEvent.en}</AppActionButton> : null}
      <footer className="pb-24"><AppActionButton variant="ghost" onClick={() => { document.querySelector<HTMLElement>('nav[tabindex="-1"]')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>{zh ? eventCreationWizardText.backToTop.zh : eventCreationWizardText.backToTop.en}</AppActionButton></footer>
    </> : null}
  </AppPageShell>
}

export default function EventCreationWizard() {
  const { language, me, canManageGroup } = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>()
  const [searchParams] = useSearchParams()
  const groupId = routeGroupId || searchParams.get('groupId') || CurrentGroup?.id || ''
  if (!groupId || !me?.id || !canManageGroup(groupId)) return <AppPageShell title={language === 'zh' ? eventCreationWizardText.eventWorkspaceCreateEvent.zh : eventCreationWizardText.eventWorkspaceCreateEvent.en}><AppEmptyState title={language === 'zh' ? eventCreationWizardText.owningGroupManagementPermissionRequired.zh : eventCreationWizardText.owningGroupManagementPermissionRequired.en} description={language === 'zh' ? eventCreationWizardText.signInAndSelectAGroupYouCanManage.zh : eventCreationWizardText.signInAndSelectAGroupYouCanManage.en} /></AppPageShell>
  return <CreationFlow key={`${me.id}:${groupId}`} groupId={groupId} memberId={me.id} />
}
