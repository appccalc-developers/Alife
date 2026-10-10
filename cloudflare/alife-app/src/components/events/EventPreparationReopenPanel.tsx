import { eventPreparationReopenPanelText } from '../../i18n/eventPreparationReopenPanel.ts'
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
  const requestStatus = pending ? (zh ? eventPreparationReopenPanelText.reopeningRequestedPreparationRemainsFrozen.zh : eventPreparationReopenPanelText.reopeningRequestedPreparationRemainsFrozen.en)
    : state.reopenRequest?.status === 'approved'
      ? state.isFrozen ? (zh ? eventPreparationReopenPanelText.previousReopeningCompletedTheCurrentPlanIsApprovedAnd.zh : eventPreparationReopenPanelText.previousReopeningCompletedTheCurrentPlanIsApprovedAnd.en) : (zh ? eventPreparationReopenPanelText.reopeningApprovedPreparationIsEditable.zh : eventPreparationReopenPanelText.reopeningApprovedPreparationIsEditable.en)
      : state.isFrozen ? (zh ? eventPreparationReopenPanelText.reopeningRejectedPreparationRemainsFrozen.zh : eventPreparationReopenPanelText.reopeningRejectedPreparationRemainsFrozen.en) : (zh ? eventPreparationReopenPanelText.thePreviousRequestWasRejectedPreparationIsNowEditable.zh : eventPreparationReopenPanelText.thePreviousRequestWasRejectedPreparationIsNowEditable.en)
  const run = async (approve?: boolean) => {
    if (lock.current) return
    lock.current = true
    const confirmed = await requestConfirmation({ title: approve === undefined ? (zh ? eventPreparationReopenPanelText.requestReopeningForChanges.zh : eventPreparationReopenPanelText.requestReopeningForChanges.en) : approve ? (zh ? eventPreparationReopenPanelText.approveReopening.zh : eventPreparationReopenPanelText.approveReopening.en) : (zh ? eventPreparationReopenPanelText.rejectReopening.zh : eventPreparationReopenPanelText.rejectReopening.en),
      description: approve === undefined ? (zh ? eventPreparationReopenPanelText.preparationStaysFrozenWhileTheRequestIsReviewed.zh : eventPreparationReopenPanelText.preparationStaysFrozenWhileTheRequestIsReviewed.en) : approve ? (zh ? eventPreparationReopenPanelText.revokeTheApprovedPlanReopenEditingWithdrawPublicationAnd.zh : eventPreparationReopenPanelText.revokeTheApprovedPlanReopenEditingWithdrawPublicationAnd.en) : (zh ? eventPreparationReopenPanelText.preparationRemainsFrozenAndTheRequesterCanSeeYour.zh : eventPreparationReopenPanelText.preparationRemainsFrozenAndTheRequesterCanSeeYour.en), confirmLabel: zh ? eventPreparationReopenPanelText.confirm.zh : eventPreparationReopenPanelText.confirm.en })
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
  return <AppSectionCard title={zh ? eventPreparationReopenPanelText.approvalAndChanges.zh : eventPreparationReopenPanelText.approvalAndChanges.en} subtitle={state.isFrozen ? (zh ? eventPreparationReopenPanelText.preparationIsFrozenPosterProductionFollowsApprovalReopeningIs.zh : eventPreparationReopenPanelText.preparationIsFrozenPosterProductionFollowsApprovalReopeningIs.en) : (zh ? eventPreparationReopenPanelText.editingIsOpenSubmitANewFormalApprovalAfter.zh : eventPreparationReopenPanelText.editingIsOpenSubmitANewFormalApprovalAfter.en)}>
    {error ? <p role="alert" className="mb-3 text-sm text-rose-800">{error}</p> : null}
    {state.reopenRequest ? <div className="mb-4 rounded-xl bg-[#e3f0eb] p-3 text-sm"><p className="font-semibold">{requestStatus}</p><p className="mt-2">{state.reopenRequest.reason[zh ? 'zh' : 'en']}</p>{state.reopenRequest.reviewReason ? <p className="mt-2">{state.reopenRequest.reviewReason[zh ? 'zh' : 'en']}</p> : null}</div> : null}
    {state.isFrozen && state.canManage && !pending ? <fieldset disabled={busy} className="min-w-0 space-y-3"><BilingualField label={zh ? eventPreparationReopenPanelText.changesNeededAndReason.zh : eventPreparationReopenPanelText.changesNeededAndReason.en} value={reason} multiline onChange={setReason} /><AppActionButton disabled={!reason.en.trim() || !reason.zh.trim()} onClick={() => void run()}>{zh ? eventPreparationReopenPanelText.requestReopeningForChangesLabel.zh : eventPreparationReopenPanelText.requestReopeningForChangesLabel.en}</AppActionButton></fieldset> : null}
    {pending && state.reopenRequest?.canReview ? <fieldset disabled={busy} className="min-w-0 space-y-3"><BilingualField label={zh ? eventPreparationReopenPanelText.reviewReason.zh : eventPreparationReopenPanelText.reviewReason.en} value={reviewReason} multiline onChange={setReviewReason} /><div className="flex flex-wrap gap-3"><AppActionButton variant="primary" disabled={!reviewReason.en.trim() || !reviewReason.zh.trim()} onClick={() => void run(true)}>{zh ? eventPreparationReopenPanelText.approveReopeningLabel.zh : eventPreparationReopenPanelText.approveReopeningLabel.en}</AppActionButton><AppActionButton variant="danger" disabled={!reviewReason.en.trim() || !reviewReason.zh.trim()} onClick={() => void run(false)}>{zh ? eventPreparationReopenPanelText.rejectRequest.zh : eventPreparationReopenPanelText.rejectRequest.en}</AppActionButton></div></fieldset> : null}
    {confirmationModal}
  </AppSectionCard>
}
