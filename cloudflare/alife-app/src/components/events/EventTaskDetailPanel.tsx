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
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const load = useCallback(async () => {
    const next = await service.getTask(eventId, taskId)
    setData(next); setReviewer(next.task.reviewerMemberId ?? ''); setAssignee(next.task.assignedMemberId ?? '')
  }, [eventId, taskId, me?.id])
  useEffect(() => { setData(null); void load().catch(e => setError(normalizeApiError(e).message)) }, [load])
  const run = async (action: string) => {
    if (!data || busy) return
    if (!await requestConfirmation({ title: zh ? '确认任务操作' : 'Confirm task action', description: zh ? '操作会更新当前任务并交接相关待办。' : 'This updates the current task and hands off the related responsibility.', confirmLabel: zh ? '确认' : 'Confirm' })) return
    setBusy(true); setError('')
    try {
      await beforeAction?.()
      const signature = JSON.stringify([action, data.task.eTag, reason])
      if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
      await service.actOnTask(eventId, data.task, action, reason, retry.current.key)
      retry.current = null; setReason(''); await load(); await onChanged?.()
    } catch (e) { setError(normalizeApiError(e).message) } finally { setBusy(false) }
  }
  if (!data) return <AppEmptyState title={error || (zh ? '正在载入任务…' : 'Loading task…')} description={zh ? '任务内容仅向当前处理人开放。' : 'Task content is limited to current participants.'} actionLabel={zh ? '重试' : 'Retry'} onAction={() => { void load().catch(e => setError(normalizeApiError(e).message)) }} />
  const task = data.task
  const participants = data.participants ?? []
  const labels: Record<string, string> = zh
    ? { todo: '待处理', inProgress: '进行中', blocked: '受阻', done: '已完成', cancelled: '已取消', notRequired: '不需审批', notSubmitted: '未提交审核', pendingReview: '待审核', approved: '审核通过', returned: '退回修改', 'submit-completion': '已提交完成', 'withdraw-completion': '已撤回提交', approve: '已通过', return: '已退回', invalidated: '原提交已失效' }
    : { todo: 'To do', inProgress: 'In progress', blocked: 'Blocked', done: 'Done', cancelled: 'Cancelled', notRequired: 'No review required', notSubmitted: 'Not submitted', pendingReview: 'Awaiting review', approved: 'Approved', returned: 'Returned', 'submit-completion': 'Completion submitted', 'withdraw-completion': 'Submission withdrawn', approve: 'Approved', return: 'Returned', invalidated: 'Submission invalidated' }
  return <AppSectionCard title={task.title[language] || task.title.en}>
    {confirmationModal}
    <p className="whitespace-pre-wrap text-sm">{task.description[language] || task.description.en}</p>
    <p className="my-3 text-sm font-semibold">{task.requiresApproval && task.status !== 'done' ? labels[task.approvalStatus ?? 'notSubmitted'] : labels[task.status] || task.status}</p>
    {task.approvalStatus === 'returned' ? <p className="my-3 whitespace-pre-wrap rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.history.filter(h => h.action === 'return').at(-1)?.reason}</p> : null}
    {task.dependencies.length ? <div className="my-4 text-sm"><p className="font-semibold">{zh ? '先完成关联任务' : 'Complete prerequisite tasks first'}</p>{task.dependencies.map(dependency => <Link className="mt-2 block break-all text-[#176b5a] underline" key={dependency.id} to={`/events/${eventId}/tasks/${dependency.dependsOnEventTaskId}`}>{zh ? '查看前置任务' : 'View prerequisite'} · {dependency.dependsOnEventTaskId.slice(0, 8)}</Link>)}</div> : null}
    {task.blockers.filter(blocker => !blocker.resolvedUtc).map(blocker => <div className="my-3 rounded-xl bg-amber-50 p-3 text-sm" key={blocker.id}><p>{blocker.reason}</p>{!task.sourceType && (data.canManage || task.assignedMemberId === me?.id) ? <div className="mt-3 grid gap-2"><label>{zh ? '解除阻塞说明' : 'Resolution'}<input className="mt-1 min-h-11 w-full rounded-xl border px-3" value={resolutions[blocker.id] ?? ''} onChange={e => setResolutions(previous => ({ ...previous, [blocker.id]: e.target.value }))} /></label><AppActionButton disabled={busy || !resolutions[blocker.id]?.trim()} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.resolveTaskBlocker(eventId, task.id, blocker.id, resolutions[blocker.id].trim())).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? '解除阻塞' : 'Resolve blocker'}</AppActionButton></div> : null}</div>)}
    {task.sourceType ? <p className="my-3 text-sm">{zh ? '此任务由对应的专业流程管理，请在活动中查看其审批或修改记录。' : 'This task is controlled by its specialist workflow. Open its approval or revision record in the Event.'}</p> : null}
    {error ? <p role="alert" className="my-3 text-sm text-red-700">{error}</p> : null}
    {data.canManage && !task.sourceType && task.status !== 'done' ? <div className="my-4 grid gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1 text-sm">{zh ? '任务执行人' : 'Task assignee'}<select className="min-h-11 min-w-0 rounded-xl border p-2" value={assignee} onChange={e => { setAssignee(e.target.value); if (reviewer === e.target.value) setReviewer('') }}><option value="">{zh ? '未指派' : 'Unassigned'}</option>{participants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {task.requiresApproval ? <label className="grid min-w-0 gap-1 text-sm">{zh ? '指定审核人' : 'Assigned reviewer'}<select className="min-h-11 min-w-0 rounded-xl border p-2" value={reviewer} onChange={e => setReviewer(e.target.value)}><option value="">{zh ? '尚未指定独立审核人' : 'Independent reviewer not yet assigned'}</option>{participants.filter(m => m.id !== assignee).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label> : null}
      <AppActionButton disabled={busy || assignee === (task.assignedMemberId ?? '') && reviewer === (task.reviewerMemberId ?? '')} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.setTaskResponsibility(eventId, task, assignee || null, reviewer || null)).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? '保存人员安排' : 'Save responsibility assignments'}</AppActionButton>
    </div> : null}
    <div className="flex flex-wrap gap-3">
      {data.canSubmit ? <AppActionButton disabled={busy} onClick={() => void run('submit-completion')}>{zh ? '提交完成并送审' : 'Submit completion for review'}</AppActionButton> : null}
      {data.canWithdraw ? <AppActionButton disabled={busy} onClick={() => void run('withdraw-completion')}>{zh ? '撤回提交' : 'Withdraw completion'}</AppActionButton> : null}
      {!task.requiresApproval && !task.sourceType && task.assignedMemberId === me?.id && !['done', 'cancelled'].includes(task.status) ? <AppActionButton disabled={busy} onClick={() => { setBusy(true); void Promise.resolve().then(beforeAction).then(() => service.updateTask(eventId, task, 'done')).then(load).then(onChanged).catch(e => setError(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? '标记完成' : 'Complete task'}</AppActionButton> : null}
    </div>
    {data.canReview ? <fieldset disabled={busy} className="mt-4 space-y-3"><label className="grid gap-1 text-sm">{zh ? '审核意见（退回时必填）' : 'Review note (required for return)'}<textarea className="min-h-24 w-full rounded-xl border p-3" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex gap-3"><AppActionButton onClick={() => void run('approve')}>{zh ? '审核通过' : 'Approve completion'}</AppActionButton><AppActionButton variant="danger" disabled={!reason.trim()} onClick={() => void run('return')}>{zh ? '退回修改' : 'Return for changes'}</AppActionButton></div></fieldset> : null}
    {data.history.length ? <details className="mt-5 rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{zh ? '提交与审核记录' : 'Submission and review history'}</summary>{data.history.map(h => <div key={h.id} className="mt-3 border-t pt-3 text-sm"><p>{zh ? `第 ${h.round} 轮` : `Round ${h.round}`} · {labels[h.action] || h.action} · {new Date(h.createdUtc).toLocaleString(language)}</p>{h.reason ? <p className="mt-1 whitespace-pre-wrap">{h.reason}</p> : null}</div>)}</details> : null}
  </AppSectionCard>
}
