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

type Step = 1 | 2 | 3 | 4
function CreationFlow({ groupId, memberId }: { groupId: string; memberId: string }) {
  const { language, me } = useAuthStore()
  const zh = language === 'zh'
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const stepRegion = useRef<HTMLFieldSetElement>(null)
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const [catalogue, setCatalogue] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogueError, setCatalogueError] = useState('')
  const [catalogueAttempt, setCatalogueAttempt] = useState(0)
  const storageKey = creationDraftKey(memberId, groupId)
  const { draft, setDraft, hydrated, storageWarning } = useCreationDraft(storageKey, archetypes, catalogue === 'ready')
  useEffect(() => { stepRegion.current?.focus() }, [step, hydrated])
  const type = useMemo(() => resolveActivityType(archetypes, draft.archetypeCode, draft.activityTypeCode), [archetypes, draft.archetypeCode, draft.activityTypeCode])
  const archetype = archetypes.find(item => item.code === draft.archetypeCode) ?? null
  const composition = type ? composeCreationDraft(draft, type) : null
  const compositionSignature = JSON.stringify(composition)
  const creationSignature = JSON.stringify({ draft, composition })
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
    const idempotencyKey = submission.current.begin(JSON.stringify([creationSignature, preview.proposal.proposalHash]))
    if (!idempotencyKey) return
    actionLock.current = true
    setBusy(true)
    setError('')
    try {
      const created = await eventService.createGroupEvent(groupId, creationEvent(draft, type, me?.displayName || ''), undefined, undefined, null, {
        composition, proposalHash: preview.proposal.proposalHash, idempotencyKey, seriesSetup: creationSeries(draft, archetype),
      })
      submission.current.finish(true)
      // Storage failure must not turn a successful creation into a retry.
      try { localStorage.removeItem(storageKey) } catch { /* Best effort. */ }
      navigate(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(created.id)}/workspace`, { replace: true, state: { created: true } })
    } catch (reason) {
      submission.current.finish(false)
      const failure = normalizeApiError(reason)
      if (failure.status === 412 || failure.status === 409) {
        setReviewSignature(''); setPreviewState('idle'); setStep(3)
        setError(zh ? '服务器检测到方案冲突，请重新检查活动安排和方案。' : 'The server detected a plan conflict. Review arrangements and the plan again.')
      } else setError(failure.message)
    } finally { actionLock.current = false; setBusy(false) }
  }

  const labels = zh ? ['选择模板', '活动资料', '活动安排', '确认创建'] : ['Template', 'Details', 'Arrange', 'Review']
  const previewStatus = <div aria-live="polite" className="rounded-xl border border-[#2f4b42]/15 bg-white p-3 text-sm">{currentPreview ? (zh ? '已根据当前安排更新管理功能。' : 'Tools updated for the current arrangements.') : previewState === 'error' ? <><p role="alert">{previewError}</p><AppActionButton className="mt-2" onClick={() => setPreviewAttempt(value => value + 1)}>{zh ? '重新计算' : 'Retry'}</AppActionButton></> : (zh ? '正在根据活动安排更新功能，请稍候……' : 'Updating tools from event arrangements…')}</div>


  return <AppPageShell title={zh ? '建立活动' : 'Create event'} context={zh ? '小组生活 / 活动' : 'Group Life / Events'}>
    <Link className="text-sm font-semibold text-[#176b5a]" to={`/groups/${encodeURIComponent(groupId)}?section=events`}>{zh ? '← 返回活动' : '← Back to events'}</Link>
    <nav aria-label={zh ? '创建活动进度' : 'Event creation progress'}><ol className="grid grid-cols-4 gap-1">{labels.map((label, index) => <li key={index}><button type="button" aria-current={step === index + 1 ? 'step' : undefined} disabled={index + 1 > step || busy || aiBusy} onClick={() => { setError(''); setStep((index + 1) as Step) }} className={`min-h-11 w-full rounded-xl px-1 py-2 text-xs font-semibold md:text-sm ${step === index + 1 ? 'bg-[#176b5a] text-white' : 'bg-[#e3f0eb] text-[#40554e]'} disabled:opacity-60`}><span className="block">{index + 1}</span><span className="block break-words">{label}</span></button></li>)}</ol></nav>
    {catalogue === 'loading' ? <p role="status">{zh ? '正在载入活动模板……' : 'Loading event templates…'}</p> : null}
    {catalogue === 'error' ? <AppEmptyState title={zh ? '活动模板无法载入' : 'Event templates unavailable'} description={catalogueError} actionLabel={zh ? '重试' : 'Retry'} onAction={() => setCatalogueAttempt(value => value + 1)} /> : null}
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {storageWarning ? <p role="status" className="text-sm text-amber-800">{zh ? '本地草稿无法恢复或保存；仍可继续填写，请勿关闭页面。' : 'Local draft recovery or saving is unavailable. You can continue; keep this page open.'}</p> : null}
    {catalogue === 'ready' && hydrated ? <>
      <fieldset ref={stepRegion} tabIndex={-1} aria-label={labels[step - 1]} disabled={busy} className="min-w-0 space-y-4 outline-none" aria-busy={busy}>
        {step === 1 ? <TemplateStep draft={draft} setDraft={setDraft} zh={zh} archetypes={archetypes} type={type} /> : null}
        {step === 2 && type && archetype ? <DetailsStep draft={draft} setDraft={setDraft} zh={zh} type={type} archetype={archetype} ai={null} /> : null}
        {type && archetype ? <div hidden={step !== 2}><EventDetailsAssistant draft={draft} setDraft={setDraft} type={type} isSeries={archetype.isSeries} zh={zh} onBusy={setAiBusy} /></div> : null}
        {step === 3 && type ? <ArrangementsStep draft={draft} setDraft={setDraft} zh={zh} type={type} proposal={preview?.proposal ?? null} current={Boolean(currentPreview)} status={previewStatus} /> : null}
        {step === 4 && type && archetype && preview ? <ReviewStep draft={draft} zh={zh} type={type} archetype={archetype} proposal={preview.proposal} /> : null}
      </fieldset>
      <footer className="flex flex-wrap items-center justify-between gap-3"><AppActionButton variant="ghost" disabled={step === 1 || busy || aiBusy} onClick={() => { setError(''); setStep((step - 1) as Step) }}>{zh ? '上一步' : 'Back'}</AppActionButton>{step < 4 ? <AppActionButton variant="primary" disabled={busy || aiBusy || (step === 3 && !currentPreview)} onClick={() => void next()}>{busy ? (zh ? '检查中……' : 'Checking…') : (zh ? '继续' : 'Continue')}</AppActionButton> : <AppActionButton variant="primary" disabled={busy || !currentPreview || reviewSignature !== creationSignature} onClick={() => void accept()}>{busy ? (zh ? '正在创建……' : 'Creating…') : (zh ? '确认创建活动' : 'Confirm and create event')}</AppActionButton>}</footer>
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
