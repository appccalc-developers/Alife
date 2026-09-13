import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import AppActionButton from '../layout/AppActionButton'
import EventFlowRail from './EventFlowRail'
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

export default function EventSetupPipeline({ workspace: initialWorkspace, plan: initialPlan, archetypes, eventBasePath, language }: {
  workspace: EventWorkspace; plan: EventPlanSnapshot | null; archetypes: EventArchetype[]; eventBasePath: string; language: 'en' | 'zh'
}) {
  const zh = language === 'zh', navigate = useNavigate(), [params] = useSearchParams()
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
    const path = setupPath(eventBasePath, value, value === 'arrangements' ? moduleParam || undefined : undefined)
    navigate(returnTo ? withDutyReturn(path, returnTo) : path)
  }
  const changedReopening = (value: EventPreparationState) => { setPreparation(value); setApprovalRevision(current => current + 1); void refresh() }
  return <AppPageShell backLink={returnTo ? { to: returnTo, label: zh ? '返回当前事务' : 'Back to current tasks' } : undefined} title={`${zh ? '活动筹备' : 'Event preparation'} · ${workspace.title[language] || workspace.title.en || workspace.title.zh}`} context={zh ? '小组生活 / 活动' : 'Group Life / Events'}>
    <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#176b5a]"><Link to={eventBasePath}>{zh ? '← 返回活动' : '← Back to event'}</Link><Link to={`${eventBasePath}/workspace?view=workspace`}>{zh ? '打开活动工作区总览' : 'Open workspace overview'}</Link></div>
    <div ref={flowTop} className="scroll-mt-24"><EventFlowRail current={step} zh={zh} eventBasePath={eventBasePath} returnTo={returnTo} disabled={busy || refreshing || unavailable} frozen={frozen} approved={approved} pendingChanges={dirty} /></div>
    <p className="rounded-xl bg-[#e3f0eb] p-3 text-sm">{frozen && preparation
      ? (zh ? '正式审批已通过，活动资料和安排已冻结。接下来可制作海报并发布活动；需要修改时，请在正式审批中申请撤销。' : 'Approval freezes details and arrangements. Continue to poster and publication, or request reopening in the approval step.')
      : (zh ? '活动已保存。正式审批批准前，可在活动资料和活动安排之间反复调整；满意后再提交审批。海报在审批之后制作。' : 'The event is saved. Revisit details and arrangements until satisfied, then submit for approval. Poster production follows approval.')}</p>
    {dirty ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{zh ? '还有未保存的活动资料或功能选择。请先保存或放弃这些修改，再进入正式审批。' : 'Details or tool selections have unsaved changes. Save or discard them before formal approval.'}</p> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-rose-800"><p>{error}</p><AppActionButton disabled={refreshing} onClick={() => void refresh()}>{zh ? '重新读取筹备状态' : 'Reload preparation status'}</AppActionButton></div> : null}
    <div ref={region} tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      {!preparation && !error ? <p role="status">{zh ? '正在读取筹备状态……' : 'Loading preparation status…'}</p> : null}
      {preparation && !allowed && !error ? <AppSectionCard title={zh ? '此步骤暂不可进入' : 'This step is currently unavailable'} subtitle={dirty ? (zh ? '请返回并保存未完成的修改。' : 'Return and save your pending changes.') : frozen && step < 5 ? (zh ? '审批通过后筹备资料已冻结，请先申请撤销审批。' : 'Approved preparation is frozen. Request reopening before editing.') : (zh ? '正式审批批准后，才可以制作海报和发布活动。' : 'Formal approval is required before poster production and publication.')}><AppActionButton onClick={() => go(dirty ? (detailsDirty ? 'details' : 'arrangements') : 'approval')}>{dirty ? (zh ? '返回修改' : 'Return to changes') : (zh ? '前往正式审批' : 'Go to formal approval')}</AppActionButton></AppSectionCard> : null}
      {!frozen && !unavailable && (['details', 'arrangements', 'review'].some(value => visited.has(value)) || ['details', 'arrangements', 'review'].includes(stage)) ? <EventSavedPreparationSteps eventId={workspace.eventId} groupId={workspace.owningGroupId} eventBasePath={eventBasePath} workspaceItems={workspace.items} focusModule={moduleParam} plan={plan} archetypes={archetypes} stage={stage} zh={zh} readOnly={!canEdit} onBusy={setBusy} onDirty={setDetailsDirty} onSaved={refresh} go={go} /> : null}
      {allowed && stage === 'approval' ? <><EventPackageFoundationPanel key={approvalRevision} eventId={workspace.eventId} groupId={workspace.owningGroupId} planETag={plan?.eTag} canManage={workspace.canManage} language={language} showPublicationActions={false} onBusyChange={setBusy} onChanged={refresh} /><EventPreparationReopenPanel state={preparation!} groupId={workspace.owningGroupId} zh={zh} onChanged={changedReopening} onBusy={setBusy} /><div className="flex flex-wrap items-center justify-between gap-3">{!frozen ? <AppActionButton variant="ghost" disabled={busy} onClick={() => go('arrangements')}>{zh ? '继续修改筹备资料' : 'Continue editing preparation'}</AppActionButton> : <span /> }<AppActionButton disabled={busy || refreshing || !approved} onClick={() => go('poster')}>{zh ? '继续海报制作' : 'Continue to poster'}</AppActionButton></div></> : null}
      {approved && !unavailable && (visited.has('poster') || stage === 'poster') ? <div hidden={stage !== 'poster'}><EventPosterStep eventId={workspace.eventId} zh={zh} onBusy={setBusy} onContinue={() => go('publish')} /></div> : null}
      {allowed && stage === 'publish' ? <EventPublishStep eventId={workspace.eventId} eventBasePath={eventBasePath} zh={zh} onBusy={setBusy} /> : null}
    </div><div className="pb-24" />
  </AppPageShell>
}
