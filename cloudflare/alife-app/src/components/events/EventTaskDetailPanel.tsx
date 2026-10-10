import { eventTaskDetailPanelText } from '../../i18n/eventTaskDetailPanel.ts'
import { eventActivityPlanService } from '../../services/eventActivityPlanService'
import type { ActivityPlanView } from '../../types/eventActivityPlan'
import { BilingualField } from './creation/CreationFields'
import { roleStatusLabel } from './EventArrangementRoles'
import { workStageText } from '../../services/eventWorkService'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventTaskDetail } from '../../types/eventOperations'
import { eventOperationsService as service } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import useConfirmation from '../../hooks/useConfirmation'
import { Link } from 'react-router-dom'

export default function EventTaskDetailPanel({ eventId, taskId, onChanged, beforeAction }: { eventId: string; taskId: string; onChanged?: () => Promise<void>; beforeAction?: () => Promise<void> }) {
  const { language, me } = useAuthStore(), zh = language === 'zh'
  const [data, setData] = useState<EventTaskDetail | null>(null)
  const [reason, setReason] = useState(''), [reviewer, setReviewer] = useState(''), [assignee, setAssignee] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [activityPlan,setActivityPlan]=useState<ActivityPlanView|null>(null),[activityId,setActivityId]=useState('')
  useEffect(()=>{let live=true;setActivityPlan(null);void eventActivityPlanService.get(eventId).then(v=>{if(live)setActivityPlan(v)}).catch(()=>{});return()=>{live=false}},[eventId,me?.id])
  const [preparation, setPreparation] = useState({ en: '', zh: '' })
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const load = useCallback(async () => {
    const next = await service.getTask(eventId, taskId)
    setData(next); setActivityId(next.task.activityId || ''); setPreparation(next.task.preparation ?? { en: '', zh: '' }); setReviewer(next.task.reviewerMemberId ?? ''); setAssignee(next.task.assignedMemberId ?? '')
  }, [eventId, taskId, me?.id])
  useEffect(() => { setData(null); void load().catch(e => setError(normalizeApiError(e).message)) }, [load])
  const run = async (action: string) => {
    if (!data || busy) return
    if (!await requestConfirmation({ title: zh ? eventTaskDetailPanelText.confirmTaskAction.zh : eventTaskDetailPanelText.confirmTaskAction.en, description: zh ? eventTaskDetailPanelText.thisUpdatesTheCurrentTaskAndHandsOffThe.zh : eventTaskDetailPanelText.thisUpdatesTheCurrentTaskAndHandsOffThe.en, confirmLabel: zh ? eventTaskDetailPanelText.confirm.zh : eventTaskDetailPanelText.confirm.en })) return
    setBusy(true); setError('')
    try {
      await beforeAction?.()
      const signature = JSON.stringify([action, data.task.eTag, reason, preparation])
      if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
      if (['accept-assignment', 'decline-assignment', 'save-preparation', 'select-publication'].includes(action))
        await service.taskPreparationAction(eventId, data.task, action, action === 'save-preparation' ? { preparation } : action === 'select-publication' ? { publicationCandidate: !data.task.preparationPublicationCandidate } : {}, retry.current.key)
      else await service.actOnTask(eventId, data.task, action, reason, retry.current.key)
      retry.current = null; setReason(''); await load(); await onChanged?.()
    } catch (e) { setError(normalizeApiError(e).message) } finally { setBusy(false) }
  }
  if (!data) return <AppEmptyState title={error || (zh ? eventTaskDetailPanelText.loadingTask.zh : eventTaskDetailPanelText.loadingTask.en)} description={zh ? eventTaskDetailPanelText.taskContentIsLimitedToCurrentParticipants.zh : eventTaskDetailPanelText.taskContentIsLimitedToCurrentParticipants.en} actionLabel={zh ? eventTaskDetailPanelText.retry.zh : eventTaskDetailPanelText.retry.en} onAction={() => { void load().catch(e => setError(normalizeApiError(e).message)) }} />
  const task = data.task
  const participants = data.participants ?? []
  const labels: Record<string, string> = zh
    ? { ...eventTaskDetailPanelText.localizedCopy.zh }
    : { ...eventTaskDetailPanelText.localizedCopy.en }
  return <AppSectionCard title={task.title[language] || task.title.en}>
    {confirmationModal}
    {activityPlan?<div className="my-3 space-y-2"><label className="block text-sm">{zh?eventTaskDetailPanelText.linkedActivity.zh:eventTaskDetailPanelText.linkedActivity.en}<select className="min-h-11 w-full rounded-xl border p-2" disabled={!data.canManage||busy} value={activityId} onChange={e=>setActivityId(e.target.value)}><option value="">—</option>{activityPlan.data.activities.map(a=><option key={a.id} value={a.id}>{a.name[zh?'zh':'en']||a.name.en||a.name.zh}</option>)}{activityId&&!activityPlan.data.activities.some(a=>a.id===activityId)?<option value={activityId}>{zh?eventTaskDetailPanelText.sourceActivityRemovedChooseAgain.zh:eventTaskDetailPanelText.sourceActivityRemovedChooseAgain.en}</option>:null}</select></label>{data.canManage?<AppActionButton disabled={busy||activityId===(task.activityId||'')} onClick={()=>{setBusy(true);void Promise.resolve().then(beforeAction).then(()=>service.updateTask(eventId,task,task.status,activityId)).then(load).then(onChanged).catch(e=>setError(normalizeApiError(e).message)).finally(()=>setBusy(false))}}>{zh?eventTaskDetailPanelText.saveActivityLink.zh:eventTaskDetailPanelText.saveActivityLink.en}</AppActionButton>:null}</div>:null}
    <p className="whitespace-pre-wrap text-sm">{task.description[language] || task.description.en || task.description.zh}</p>
    <details key={language} className="mt-3 rounded-xl border p-3 text-sm"><summary className="min-h-8 cursor-pointer font-semibold">{zh ? eventTaskDetailPanelText.expand.zh : eventTaskDetailPanelText.expand.en}</summary><h3 className="mt-2 font-semibold">{task.title[zh ? 'en' : 'zh']}</h3><p className="mt-2 whitespace-pre-wrap">{task.description[zh ? 'en' : 'zh']}</p></details>
    <p className="mt-3 text-sm">{workStageText(task.stage || 'preparation', zh)} · {task.dueUtc ? new Date(task.dueUtc).toLocaleString(language) : (zh ? eventTaskDetailPanelText.noDeadline.zh : eventTaskDetailPanelText.noDeadline.en)}</p>
    <p className="mt-2 font-semibold text-violet-900">{roleStatusLabel(task.assignmentStatus ?? 'accepted', zh)}</p>
    {data.canRespond ? <div className="my-4 flex flex-wrap gap-3"><AppActionButton variant="primary" disabled={busy} onClick={() => void run('accept-assignment')}>{zh ? eventTaskDetailPanelText.acceptDelegation.zh : eventTaskDetailPanelText.acceptDelegation.en}</AppActionButton><AppActionButton disabled={busy} onClick={() => void run('decline-assignment')}>{zh ? eventTaskDetailPanelText.declineDelegation.zh : eventTaskDetailPanelText.declineDelegation.en}</AppActionButton></div> : null}
    {data.canPrepare ? <fieldset disabled={busy} className="my-4 space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><BilingualField primaryLanguage={language} label={zh ? eventTaskDetailPanelText.preparationUpdate.zh : eventTaskDetailPanelText.preparationUpdate.en} multiline maxLength={4000} value={preparation} onChange={setPreparation} /><AppActionButton variant="primary" disabled={!preparation.en.trim() && !preparation.zh.trim() || JSON.stringify(preparation) === JSON.stringify(task.preparation ?? { en: '', zh: '' })} onClick={() => void run('save-preparation')}>{zh ? eventTaskDetailPanelText.savePreparationUpdate.zh : eventTaskDetailPanelText.savePreparationUpdate.en}</AppActionButton></fieldset> : task.preparationUpdatedUtc ? <section className="my-4 rounded-2xl bg-violet-50 p-4"><h3 className="font-semibold">{zh ? eventTaskDetailPanelText.preparationUpdate.zh : eventTaskDetailPanelText.preparationUpdate.en}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{task.preparation?.[language] || task.preparation?.en || task.preparation?.zh}</p><details key={language} className="mt-3"><summary className="min-h-8 cursor-pointer text-sm font-semibold">{zh ? eventTaskDetailPanelText.expand2.zh : eventTaskDetailPanelText.expand2.en}</summary><p className="whitespace-pre-wrap text-sm">{task.preparation?.[zh ? 'en' : 'zh']}</p></details></section> : null}
    {data.canManage && !task.sourceType && task.preparationUpdatedUtc && !task.isRestricted ? <div className="my-3 space-y-2"><AppActionButton disabled={busy || !task.preparation?.en.trim() || !task.preparation?.zh.trim()} onClick={() => void run('select-publication')}>{task.preparationPublicationCandidate ? (zh ? eventTaskDetailPanelText.removeFromPublicationMaterial.zh : eventTaskDetailPanelText.removeFromPublicationMaterial.en) : (zh ? eventTaskDetailPanelText.selectAsPublicationMaterial.zh : eventTaskDetailPanelText.selectAsPublicationMaterial.en)}</AppActionButton><p className="text-sm text-[#66766f]">{zh ? eventTaskDetailPanelText.reviewAndCopySelectedMaterialInThePublicationStep.zh : eventTaskDetailPanelText.reviewAndCopySelectedMaterialInThePublicationStep.en}</p></div> : null}
    <p className="my-3 text-sm font-semibold">{task.requiresApproval && task.status !== 'done' ? labels[task.approvalStatus ?? 'notSubmitted'] : labels[task.status] || task.status}</p>
    {task.approvalStatus === 'returned' ? <p className="my-3 whitespace-pre-wrap rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.history.filter(h => h.action === 'return').at(-1)?.reason}</p> : null}
    {task.dependencies.length ? <div className="my-4 text-sm"><p className="font-semibold">{zh ? eventTaskDetailPanelText.completePrerequisiteTasksFirst.zh : eventTaskDetailPanelText.completePrerequisiteTasksFirst.en}</p>{task.dependencies.map(dependency => <Link className="mt-2 block break-all text-[#176b5a] underline" key={dependency.id} to={`/events/${eventId}/tasks/${dependency.dependsOnEventTaskId}`}>{zh ? eventTaskDetailPanelText.viewPrerequisite.zh : eventTaskDetailPanelText.viewPrerequisite.en} · {dependency.dependsOnEventTaskId.slice(0, 8)}</Link>)}</div> : null}
    {task.blockers.filter(blocker => !blocker.resolvedUtc).map(blocker => <div className="my-3 rounded-xl bg-amber-50 p-3 text-sm" key={blocker.id}><p>{blocker.reason}</p>{!task.sourceType && (data.canManage || task.assignedMemberId === me?.id) ? <div className="mt-3 grid gap-2"><label>{zh ? eventTaskDetailPanelText.resolution.zh : eventTaskDetailPanelText.resolution.en}<input className="mt-1 min-h-11 w-full rounded-xl border px-3" value={resolutions[blocker.id] ?? ''} onChange={e => setResolutions(previous => ({ ...previous, [blocker.id]: e.target.value }))} /></label><AppActionButton disabled={busy || !resolutions[blocker.id]?.trim()} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.resolveTaskBlocker(eventId, task.id, blocker.id, resolutions[blocker.id].trim())).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? eventTaskDetailPanelText.resolveBlocker.zh : eventTaskDetailPanelText.resolveBlocker.en}</AppActionButton></div> : null}</div>)}
    {task.sourceType ? <p className="my-3 text-sm">{zh ? eventTaskDetailPanelText.thisTaskIsControlledByItsSpecialistWorkflowOpen.zh : eventTaskDetailPanelText.thisTaskIsControlledByItsSpecialistWorkflowOpen.en}</p> : null}
    {error ? <p role="alert" className="my-3 text-sm text-red-700">{error}</p> : null}
    {data.canManage && !task.sourceType && task.status !== 'done' ? <div className="my-4 grid gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1 text-sm">{zh ? eventTaskDetailPanelText.taskAssignee.zh : eventTaskDetailPanelText.taskAssignee.en}<select className="min-h-11 min-w-0 rounded-xl border p-2" value={assignee} onChange={e => { setAssignee(e.target.value); if (reviewer === e.target.value) setReviewer('') }}><option value="">{zh ? eventTaskDetailPanelText.unassigned.zh : eventTaskDetailPanelText.unassigned.en}</option>{participants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {task.requiresApproval ? <label className="grid min-w-0 gap-1 text-sm">{zh ? eventTaskDetailPanelText.assignedReviewer.zh : eventTaskDetailPanelText.assignedReviewer.en}<select className="min-h-11 min-w-0 rounded-xl border p-2" value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">{zh ? eventTaskDetailPanelText.independentReviewerNotYetAssigned.zh : eventTaskDetailPanelText.independentReviewerNotYetAssigned.en}</option>{participants.filter(m => m.id !== assignee).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label> : null}
      <AppActionButton disabled={busy || assignee === (task.assignedMemberId ?? '') && reviewer === (task.reviewerMemberId ?? '')} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.setTaskResponsibility(eventId, task, assignee || null, reviewer || null)).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? eventTaskDetailPanelText.saveResponsibilityAssignments.zh : eventTaskDetailPanelText.saveResponsibilityAssignments.en}</AppActionButton>
    </div> : null}
    <div className="flex flex-wrap gap-3">
      {data.canSubmit ? <AppActionButton disabled={busy} onClick={() => void run('submit-completion')}>{zh ? eventTaskDetailPanelText.submitCompletionForReview.zh : eventTaskDetailPanelText.submitCompletionForReview.en}</AppActionButton> : null}
      {data.canWithdraw ? <AppActionButton disabled={busy} onClick={() => void run('withdraw-completion')}>{zh ? eventTaskDetailPanelText.withdrawCompletion.zh : eventTaskDetailPanelText.withdrawCompletion.en}</AppActionButton> : null}
      {!task.requiresApproval && !task.sourceType && (task.assignmentStatus ?? 'accepted') === 'accepted' && task.assignedMemberId === me?.id && !['done', 'cancelled'].includes(task.status) ? <AppActionButton disabled={busy} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.updateTask(eventId, task, 'done')).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? eventTaskDetailPanelText.completeTask.zh : eventTaskDetailPanelText.completeTask.en}</AppActionButton> : null}
    </div>
    {data.canReview ? <fieldset disabled={busy} className="mt-4 space-y-3"><label className="grid gap-1 text-sm">{zh ? eventTaskDetailPanelText.reviewNoteRequiredForReturn.zh : eventTaskDetailPanelText.reviewNoteRequiredForReturn.en}<textarea className="min-h-24 w-full rounded-xl border p-3" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex gap-3"><AppActionButton onClick={() => void run('approve')}>{zh ? eventTaskDetailPanelText.approveCompletion.zh : eventTaskDetailPanelText.approveCompletion.en}</AppActionButton><AppActionButton variant="danger" disabled={!reason.trim()} onClick={() => void run('return')}>{zh ? eventTaskDetailPanelText.returnForChanges.zh : eventTaskDetailPanelText.returnForChanges.en}</AppActionButton></div></fieldset> : null}
    {data.history.length ? <details className="mt-5 rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{zh ? eventTaskDetailPanelText.submissionAndReviewHistory.zh : eventTaskDetailPanelText.submissionAndReviewHistory.en}</summary>{data.history.map(h => <div key={h.id} className="mt-3 border-t pt-3 text-sm"><p>{zh ? eventTaskDetailPanelText.round.zh(h.round) : eventTaskDetailPanelText.round.en(h.round)} · {labels[h.action] || h.action} · {new Date(h.createdUtc).toLocaleString(language)}</p>{h.reason ? <p className="mt-1 whitespace-pre-wrap">{h.reason}</p> : null}</div>)}</details> : null}
  </AppSectionCard>
}
