import EventFlowRail from '../components/events/EventFlowRail'
import { setupPath } from '../utils/eventSetupFlow'
import RamAssessmentFields from '../components/events/RamAssessmentFields'
import { upgradeRam, type RamDraft } from '../types/ramGovernance'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import EventDetailsAssistant from '../components/events/creation/EventDetailsAssistant'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { ArrangementsStep, DetailsStep, ReviewStep, TemplateStep } from '../components/events/creation/CreationSteps'
import { useCreationDraft } from '../components/events/creation/useCreationDraft'
import { eventCompositionService } from '../services/eventCompositionService'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { EventArchetype, EventPlanProposal } from '../types/eventComposition'
import { resolveActivityType } from '../utils/eventCreationWizard'
import { composeCreationDraft, createRequestSequence, createSubmissionGuard, creationDraftKey, creationEvent, creationSeries, validateCreationDraft } from '../utils/eventCreationDraft'
import { creationArrangements, validateCreationArrangements } from '../utils/eventCreationArrangements'

type Step = 1 | 2 | 3 | 4
function CreationFlow({ groupId, memberId }: { groupId: string; memberId: string }) {
  const { language, me } = useAuthStore()
  const zh = language === 'zh'
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const stepRegion = useRef<HTMLFieldSetElement>(null)
  const returnToDetailsForm = () => {
    stepRegion.current?.focus({ preventScroll: true })
    stepRegion.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const [catalogue, setCatalogue] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState('')
  const [catalogueAttempt, setCatalogueAttempt] = useState(0)
  const storageKey = creationDraftKey(memberId, groupId)
  const { draft, setDraft, hydrated, storageWarning } = useCreationDraft(storageKey, archetypes, catalogue === 'ready')
  useEffect(() => { stepRegion.current?.focus() }, [step, hydrated])
  const type = useMemo(() => resolveActivityType(archetypes, draft.archetypeCode, draft.activityTypeCode), [archetypes, draft.archetypeCode, draft.activityTypeCode])
  const archetype = archetypes.find(item => item.code === draft.archetypeCode) ?? null
  const [ramDraft, setRamDraft] = useState<RamDraft>(() => upgradeRam(undefined)), [ramTouched, setRamTouched] = useState(false)
  useEffect(() => { setUnsavedChangesGuard(ramTouched, zh ? 'RAM 草稿尚未随活动创建保存。离开将丢失此 RAM 草稿。' : 'The RAM draft has not been saved with the Event. Leaving will discard it.', 'confirm'); return () => setUnsavedChangesGuard(false) }, [ramTouched, zh])
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
        setPreviewError(normalizeApiError(reason).message)
      })
    }, 400)
    return () => { clearTimeout(timer); sequence.current.invalidate() }
  }, [compositionSignature, groupId, hydrated, step, previewAttempt])

  const next = async () => {
    if (actionLock.current || aiBusy) return
    setError('')
    if (!type || !archetype || !composition) { setError(zh ? '请选择活动分类和模板。' : 'Choose a category and template.'); return }
    if (step === 1) { setStep(2); return }
    const issue = validateCreationDraft(draft, type, archetype, zh)
    if (issue) { setError(issue); if (step === 3) setStep(2); return }
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
      const arrangementIssue = validateCreationArrangements(draft, type, proposal, zh)
      if (arrangementIssue) { setError(arrangementIssue); return }
      setReviewSignature(signature)
      setStep(4)
    } catch (reason) {
      if (sequence.current.isCurrent(id)) { setPreviewState('error'); setPreviewError(normalizeApiError(reason).message) }
    } finally { actionLock.current = false; setBusy(false) }
  }

  const accept = async () => {
    if (actionLock.current || !type || !archetype || !composition) return
    if (!currentPreview || !preview || reviewSignature !== creationSignature) {
      setError(zh ? '方案已变化，请返回活动安排重新审阅。' : 'The plan changed. Return to arrangements and review again.'); return
    }
    const issue = validateCreationDraft(draft, type, archetype, zh)
    if (issue) { setError(issue); setStep(2); return }
    const arrangementIssue = validateCreationArrangements(draft, type, preview.proposal, zh)
    if (arrangementIssue) { setError(arrangementIssue); setStep(3); return }
    const idempotencyKey = submission.current.begin(JSON.stringify([creationSignature, preview.proposal.proposalHash]))
    if (!idempotencyKey) return
    actionLock.current = true
    setBusy(true)
    setError('')
    try {
      const created = await eventService.createGroupEvent(groupId, creationEvent(draft, type, me?.displayName || ''), undefined, undefined, null, {
        composition, proposalHash: preview.proposal.proposalHash, idempotencyKey, seriesSetup: creationSeries(draft, archetype),
        arrangements: creationArrangements(draft, type, preview.proposal),
        initialRamDraft: ramTouched ? ramDraft : undefined,
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
        setError(zh ? '方案或场地预订发生冲突，请检查活动安排；场地有更新时请刷新场地列表后重试。' : 'The plan or a venue booking has a conflict. Review arrangements and refresh venues if their details changed.')
      } else setError(failure.message)
    } finally { actionLock.current = false; setBusy(false) }
  }

  const labels = zh ? ['选择模板', '活动资料', '活动安排', '确认创建'] : ['Template', 'Details', 'Arrange', 'Review']
  const previewStatus = <div aria-live="polite" className="rounded-xl border border-[#2f4b42]/15 bg-white p-3 text-sm">{currentPreview ? (zh ? '已根据当前安排更新管理功能。' : 'Tools updated for the current arrangements.') : previewState === 'error' ? <><p role="alert">{previewError}</p><AppActionButton className="mt-2" onClick={() => setPreviewAttempt(value => value + 1)}>{zh ? '重新计算' : 'Retry'}</AppActionButton></> : (zh ? '正在根据活动安排更新功能，请稍候……' : 'Updating tools from event arrangements…')}</div>


  return <AppPageShell title={zh ? '建立活动' : 'Create event'} context={zh ? '小组生活 / 活动' : 'Group Life / Events'}>
    <Link className="text-sm font-semibold text-[#176b5a]" to={`/groups/${encodeURIComponent(groupId)}?section=events`}>{zh ? '← 返回活动' : '← Back to events'}</Link>
    <EventFlowRail current={step} zh={zh} disabled={busy || aiBusy} onSelect={value => { setError(''); setStep(value as Step) }} />
    {catalogue === 'loading' ? <p role="status">{zh ? '正在载入活动模板……' : 'Loading event templates…'}</p> : null}
    {catalogue === 'error' ? <AppEmptyState title={zh ? '活动模板无法载入' : 'Event templates unavailable'} description={catalogueError} actionLabel={zh ? '重试' : 'Retry'} onAction={() => setCatalogueAttempt(value => value + 1)} /> : null}
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {storageWarning ? <p role="status" className="text-sm text-amber-800">{zh ? '本地草稿无法恢复或保存；仍可继续填写，请勿关闭页面。' : 'Local draft recovery or saving is unavailable. You can continue; keep this page open.'}</p> : null}
    {catalogue === 'ready' && hydrated ? <>
      <fieldset ref={stepRegion} tabIndex={-1} aria-label={labels[step - 1]} disabled={busy} className="min-w-0 scroll-mt-24 space-y-4 outline-none" aria-busy={busy}>
        {step === 1 ? <TemplateStep draft={draft} setDraft={setDraft} zh={zh} archetypes={archetypes} type={type} /> : null}
        {step === 2 && type && archetype ? <DetailsStep draft={draft} setDraft={setDraft} zh={zh} type={type} archetype={archetype} ai={null} /> : null}
        {type && archetype ? <div hidden={step !== 2}><EventDetailsAssistant draft={draft} setDraft={setDraft} type={type} isSeries={archetype.isSeries} zh={zh} active={step === 2} onBusy={setAiBusy} onReturnToForm={returnToDetailsForm} /></div> : null}
        {step === 3 && type ? <ArrangementsStep draft={draft} setDraft={setDraft} zh={zh} type={type} groupId={groupId} proposal={preview?.proposal ?? null} current={Boolean(currentPreview)} status={previewStatus} ramPanel={<div className="space-y-4"><p className="rounded-xl bg-[#e3f0eb] p-3 text-sm">{zh ? '可直接填写风险，确认创建时随活动保存。创建前 RAM 仅保留在当前页面，不写入本机草稿。创建后继续核对教会题库、本人确认及审核。' : 'Fill in risks here; they are saved with the Event when you confirm creation. Until then RAM stays only in this page, outside local draft storage. Continue with church questions, personal confirmation and review after creation.'}</p><RamAssessmentFields draft={ramDraft} update={change => { setRamDraft(value => ({ ...value, ...change })); setRamTouched(true); setDraft(previous => ({ ...previous, arrangementConfirmations: { ...previous.arrangementConfirmations, safety: false } })) }} editable={!busy} dirty zh={zh} /></div>} /> : null}
        {step === 4 && type && archetype && preview ? <ReviewStep draft={draft} zh={zh} type={type} archetype={archetype} proposal={preview.proposal} /> : null}
      </fieldset>
      <footer className="flex flex-wrap items-center justify-between gap-3 pb-24"><AppActionButton variant="ghost" disabled={step === 1 || busy || aiBusy} onClick={() => { setError(''); setStep((step - 1) as Step) }}>{zh ? '上一步' : 'Back'}</AppActionButton>{step < 4 ? <AppActionButton variant="primary" disabled={busy || aiBusy || (step === 3 && !currentPreview)} onClick={() => void next()}>{busy ? (zh ? '检查中……' : 'Checking…') : (zh ? '继续' : 'Continue')}</AppActionButton> : <AppActionButton variant="primary" disabled={busy || !currentPreview || reviewSignature !== creationSignature} onClick={() => void accept()}>{busy ? (zh ? '正在创建……' : 'Creating…') : (zh ? '确认创建活动' : 'Confirm and create event')}</AppActionButton>}</footer>
    </> : null}
  </AppPageShell>
}

export default function EventCreationWizard() {
  const { language, me, canManageGroup } = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>()
  const [searchParams] = useSearchParams()
  const groupId = routeGroupId || searchParams.get('groupId') || CurrentGroup?.id || ''
  if (!groupId || !me?.id || !canManageGroup(groupId)) return <AppPageShell title={language === 'zh' ? '建立活动' : 'Create event'}><AppEmptyState title={language === 'zh' ? '需要所属小组的管理权限' : 'Owning-group management permission required'} description={language === 'zh' ? '请登录并选择你可以管理的小组。' : 'Sign in and select a group you can manage.'} /></AppPageShell>
  return <CreationFlow key={`${me.id}:${groupId}`} groupId={groupId} memberId={me.id} />
}
