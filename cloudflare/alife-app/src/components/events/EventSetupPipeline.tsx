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
    if (await requestConfirmation({ title: zh ? '离开并放弃未保存修改？' : 'Leave and discard unsaved changes?', description: zh ? '当前活动资料和领域表单中尚未保存的修改将丢失。已保存内容不受影响。' : 'Unsaved event details and area forms will be lost. Saved content is not affected.', confirmLabel: zh ? '放弃修改并离开' : 'Discard and leave', cancelLabel: zh ? '继续编辑' : 'Keep editing', tone: 'danger' })) navigate(path)
  }
  return <AppPageShell><div className="event-editorial space-y-4">
    {confirmationModal}
    <div className="flex flex-wrap items-center gap-3"><AppPageBackLink to={returnTo ?? eventBasePath} label={returnTo ? (zh ? '返回当前事务' : 'Back to current tasks') : (zh ? '返回活动' : 'Back to event')} onClick={event => void leave(event, returnTo ?? eventBasePath)} /><Link className="text-sm font-semibold text-[#176b5a] hover:underline" to={`/events/${workspace.eventId}/work`} aria-disabled={busy || undefined} onClick={event => void leave(event, `/events/${workspace.eventId}/work`)}>{zh ? '查看活动工作台 · 四个阶段' : 'View event workspace · four stages'}</Link></div>
    <div ref={flowTop} className="scroll-mt-24"><EventPreparationNavigation eventId={workspace.eventId} title={workspace.title[language] || workspace.title.en || workspace.title.zh} stage={stage} zh={zh} returnTo={returnTo} disabled={busy || refreshing || unavailable} frozen={frozen} approved={approved} dirty={dirty} go={go} /></div>
    {params.get('reviewReturn') === 'approval' && stage !== 'approval' ? <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#e3f0eb] p-3 text-sm"><AppActionButton disabled={busy || dirty || refreshing} onClick={() => go('approval')}>{zh ? '← 返回正式审批' : '← Back to formal approval'}</AppActionButton><span>{zh ? '修改并保存后返回，重新核对审批资料；导航不会自动保存或提交。' : 'Save your changes, then return to review the approval evidence. Navigation does not save or submit.'}</span></div> : null}
    {preparation && frozen ? <p className="event-editorial-notice">{zh ? '方案已冻结。修改筹备配置须先申请重开。' : 'Preparation is frozen. Request reopening before changing its configuration.'}</p> : null}
    {dirty ? <p role="status" className="text-sm text-amber-900">{zh ? '有未保存修改。保存后才能进入审批或其他阶段。' : 'Unsaved changes. Save before approval or switching stages.'}</p> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-rose-800"><p>{error}</p><AppActionButton disabled={refreshing} onClick={() => void refresh()}>{zh ? '重新读取筹备状态' : 'Reload preparation status'}</AppActionButton></div> : null}
    <div ref={region} tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      {!preparation && !error ? <EventPreparationLoading zh={zh} /> : null}
      {preparation && !allowed && !error ? <AppSectionCard title={zh ? '此步骤暂不可进入' : 'This step is currently unavailable'} subtitle={dirty ? (zh ? '请返回并保存未完成的修改。' : 'Return and save your pending changes.') : frozen && step < 5 ? (zh ? '审批通过后筹备资料已冻结，请先申请撤销审批。' : 'Approved preparation is frozen. Request reopening before editing.') : (zh ? '正式审批批准后，才可以制作海报和发布活动。' : 'Formal approval is required before poster production and publication.')}><AppActionButton onClick={() => go(dirty ? (detailsDirty ? 'details' : 'arrangements') : 'approval')}>{dirty ? (zh ? '返回修改' : 'Return to changes') : (zh ? '前往正式审批' : 'Go to formal approval')}</AppActionButton></AppSectionCard> : null}
      {!frozen && preparation && (['details', 'arrangements', 'review'].some(value => visited.has(value)) || ['details', 'arrangements', 'review'].includes(stage)) ? <div hidden={unavailable}><EventSavedPreparationSteps eventId={workspace.eventId} groupId={workspace.owningGroupId} eventBasePath={eventBasePath} workspaceItems={workspace.items} readiness={workspace.readiness} onSelectModule={selectModule} focusModule={moduleParam} plan={plan} archetypes={archetypes} stage={stage} zh={zh} readOnly={!canEdit} onBusy={setBusy} onDirty={setDetailsDirty} onSaved={refresh} go={go} /></div> : null}
      {allowed && stage === 'approval' ? <><EventPackageFoundationPanel key={approvalRevision} eventId={workspace.eventId} groupId={workspace.owningGroupId} planETag={plan?.eTag} canManage={workspace.canManage} language={language} showPublicationActions={false} onBusyChange={setBusy} onChanged={refresh} /><EventPreparationReopenPanel state={preparation!} groupId={workspace.owningGroupId} zh={zh} onChanged={changedReopening} onBusy={setBusy} /><div className="flex flex-wrap items-center justify-between gap-3">{!frozen ? <AppActionButton variant="ghost" disabled={busy} onClick={() => go('arrangements')}>{zh ? '继续修改筹备资料' : 'Continue editing preparation'}</AppActionButton> : <span /> }<AppActionButton disabled={busy || refreshing || !approved} onClick={() => go('poster')}>{zh ? '继续海报制作' : 'Continue to poster'}</AppActionButton></div></> : null}
      {approved && !unavailable && (visited.has('poster') || stage === 'poster') ? <div hidden={stage !== 'poster'}><EventPosterStep eventId={workspace.eventId} zh={zh} onBusy={setBusy} onContinue={() => go('publish')} /></div> : null}
      {allowed && stage === 'publish' ? <EventPublishStep eventId={workspace.eventId} eventBasePath={eventBasePath} zh={zh} onBusy={setBusy} /> : null}
    </div><div className="pb-24" /></div>
  </AppPageShell>
}
