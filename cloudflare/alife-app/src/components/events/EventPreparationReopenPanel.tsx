import { useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { BilingualField } from './creation/CreationFields'
import { eventPreparationService, type EventPreparationState } from '../../services/eventPreparationService'
import { normalizeApiError } from '../../services/http'
import useConfirmation from '../../hooks/useConfirmation'

export default function EventPreparationReopenPanel({ state, groupId, zh, onChanged, onBusy, beforeAction }: {
  beforeAction?: () => Promise<void>; state: EventPreparationState; groupId: string; zh: boolean; onChanged: (value: EventPreparationState) => void; onBusy: (busy: boolean) => void
}) {
  const [reason, setReason] = useState({ en: '', zh: '' }), [reviewReason, setReviewReason] = useState({ en: '', zh: '' })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const retry = useRef<{ signature: string; key: string } | null>(null), lock = useRef(false)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const pending = state.reopenRequest?.status === 'pending'
  const requestStatus = pending ? (zh ? '撤销申请待处理，方案仍冻结' : 'Reopening requested; preparation remains frozen')
    : state.reopenRequest?.status === 'approved'
      ? state.isFrozen ? (zh ? '上次撤销已处理，当前方案已重新批准并冻结' : 'Previous reopening completed; the current plan is approved and frozen') : (zh ? '已同意撤销，活动可重新筹备' : 'Reopening approved; preparation is editable')
      : state.isFrozen ? (zh ? '撤销申请被拒绝，方案仍冻结' : 'Reopening rejected; preparation remains frozen') : (zh ? '上次撤销申请被拒绝；当前活动已恢复编辑' : 'The previous request was rejected; preparation is now editable')
  const run = async (approve?: boolean) => {
    if (lock.current) return
    lock.current = true
    const confirmed = await requestConfirmation({ title: approve === undefined ? (zh ? '申请撤销审批以修改活动' : 'Request reopening for changes') : approve ? (zh ? '同意撤销审批并解冻' : 'Approve reopening') : (zh ? '拒绝撤销申请' : 'Reject reopening'),
      description: approve === undefined ? (zh ? '申请待处理期间，活动资料与安排仍然冻结。' : 'Preparation stays frozen while the request is reviewed.') : approve ? (zh ? '撤销现有方案审批，恢复编辑，撤下已发布活动并关闭新报名。现有报名与审批历史会保留；修改后须重新审批。' : 'Revoke the approved plan, reopen editing, withdraw publication and close new registration. Existing registrations and approval history remain. Changes require fresh approval.') : (zh ? '活动方案保持冻结，申请人会看到处理理由。' : 'Preparation remains frozen and the requester can see your reason.'), confirmLabel: zh ? '确认' : 'Confirm' })
    if (!confirmed) { lock.current = false; return }
    setBusy(true); onBusy(true); setError('')
    try {
      await beforeAction?.()
      const signature = JSON.stringify({ approve, reason, reviewReason, request: state.reopenRequest?.id, eTag: state.reopenRequest?.eTag })
      if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() }
      const value = approve === undefined ? await eventPreparationService.requestReopen(state.eventId, reason, retry.current.key)
        : await eventPreparationService.reviewReopen(state.eventId, groupId, state.reopenRequest!, approve, reviewReason, retry.current.key)
      onChanged(value); setReason({ en: '', zh: '' }); setReviewReason({ en: '', zh: '' })
    } catch (failure) { setError(normalizeApiError(failure).message) }
    finally { lock.current = false; setBusy(false); onBusy(false) }
  }
  if (!state.isFrozen && !state.reopenRequest) return null
  return <AppSectionCard title={zh ? '审批与修改' : 'Approval and changes'} subtitle={state.isFrozen ? (zh ? '方案已经冻结。海报可在审批之后制作；修改活动资料、安排或团队功能须先撤销审批。' : 'Preparation is frozen. Poster production follows approval. Reopening is required to change details, arrangements or team configuration.') : (zh ? '活动已恢复编辑，修改完成后请重新提交正式审批。' : 'Editing is open. Submit a new formal approval after your changes.')}>
    {error ? <p role="alert" className="mb-3 text-sm text-rose-800">{error}</p> : null}
    {state.reopenRequest ? <div className="mb-4 rounded-xl bg-[#e3f0eb] p-3 text-sm"><p className="font-semibold">{requestStatus}</p><p className="mt-2">{state.reopenRequest.reason[zh ? 'zh' : 'en']}</p>{state.reopenRequest.reviewReason ? <p className="mt-2">{state.reopenRequest.reviewReason[zh ? 'zh' : 'en']}</p> : null}</div> : null}
    {state.isFrozen && state.canManage && !pending ? <fieldset disabled={busy} className="min-w-0 space-y-3"><BilingualField label={zh ? '需要修改的内容及原因' : 'Changes needed and reason'} value={reason} multiline onChange={setReason} /><AppActionButton disabled={!reason.en.trim() || !reason.zh.trim()} onClick={() => void run()}>{zh ? '申请撤销审批并修改' : 'Request reopening for changes'}</AppActionButton></fieldset> : null}
    {pending && state.reopenRequest?.canReview ? <fieldset disabled={busy} className="min-w-0 space-y-3"><BilingualField label={zh ? '处理理由' : 'Review reason'} value={reviewReason} multiline onChange={setReviewReason} /><div className="flex flex-wrap gap-3"><AppActionButton variant="primary" disabled={!reviewReason.en.trim() || !reviewReason.zh.trim()} onClick={() => void run(true)}>{zh ? '同意撤销并解冻' : 'Approve reopening'}</AppActionButton><AppActionButton variant="danger" disabled={!reviewReason.en.trim() || !reviewReason.zh.trim()} onClick={() => void run(false)}>{zh ? '拒绝申请' : 'Reject request'}</AppActionButton></div></fieldset> : null}
    {confirmationModal}
  </AppSectionCard>
}
