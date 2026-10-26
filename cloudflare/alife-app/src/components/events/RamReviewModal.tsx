import { ramReviewModalText } from '../../i18n/ramReviewModal.ts'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppModal from '../layout/AppModal'
import AppActionButton from '../layout/AppActionButton'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { parseRamDraft, type RamWorkspace } from '../../types/ramGovernance'
import { useRamSync, RamSyncBadge, ramSyncErrorText } from './RamSyncPanel'

export default function RamReviewModal({ eventId, zh, onClose, onReviewed }: { eventId: string; zh: boolean; onClose: () => void; onReviewed: () => Promise<void> }) {
  const { data, error, refresh } = useRamSync(eventId)
  const [workspace, setWorkspace] = useState<RamWorkspace | null>(null), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [failure, setFailure] = useState('')
  useEffect(() => {
    let live = true; setWorkspace(null); setAccepted(false); setFailure('')
    if (data?.sync.isUpdated) void ramService.workspace(eventId).then(value => { if (live) setWorkspace(value) }).catch(e => { if (live) setFailure(normalizeApiError(e).message) })
    return () => { live = false }
  }, [eventId, data?.eTag, data?.sync.isUpdated])
  const risks = workspace ? parseRamDraft(workspace.assessment?.ramDataJson).hazards : []
  const current = Boolean(data?.sync.isUpdated && workspace?.assessment?.eTag === data.eTag)
  const confirm = async () => {
    if (!data || !accepted || !current) return
    setBusy(true); setFailure('')
    try { await ramService.syncAction(eventId, 'review', data.eTag); await onReviewed() }
    catch (e) { setFailure(normalizeApiError(e).message); await refresh() }
    finally { setBusy(false) }
  }
  return <AppModal open title={zh ? ramReviewModalText.finalRamReviewBeforeSubmission.zh : ramReviewModalText.finalRamReviewBeforeSubmission.en} closeLabel={zh ? ramReviewModalText.close.zh : ramReviewModalText.close.en} onClose={onClose} closeDisabled={busy} footer={<AppActionButton variant="primary" disabled={busy || !current || !accepted || !data?.canReview} onClick={() => void confirm()}>{zh ? ramReviewModalText.confirmReviewAndContinue.zh : ramReviewModalText.confirmReviewAndContinue.en}</AppActionButton>}>
    <div className="space-y-4">
      {data ? <RamSyncBadge sync={data.sync} zh={zh} /> : <p role="status">{zh ? ramReviewModalText.loading.zh : ramReviewModalText.loading.en}</p>}
      {!data?.sync.isUpdated ? <p role="status">{zh ? ramReviewModalText.waitForAiToSynchronizeTheLatestPlansThe.zh : ramReviewModalText.waitForAiToSynchronizeTheLatestPlansThe.en}</p> : null}
      {error || failure ? <p role="alert">{error || failure}</p> : null}
      {data && (data.sync.error || data.sync.status === 'Draft') ? <><p role="alert">{data.sync.error ? ramSyncErrorText(data.sync.error, zh) : (zh ? ramReviewModalText.startTheFirstSynchronization.zh : ramReviewModalText.startTheFirstSynchronization.en)}</p>{data.canRetry ? <AppActionButton disabled={busy} onClick={() => { setBusy(true); void ramService.syncAction(eventId, 'retry', data.eTag).then(refresh).catch(e => setFailure(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? ramReviewModalText.retrySynchronization.zh : ramReviewModalText.retrySynchronization.en}</AppActionButton> : null}</> : null}
      {risks.map(risk => <details key={risk.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{risk.hazard[zh ? 'zh' : 'en']}</summary><p className="mt-2 whitespace-pre-wrap">{risk.consequence[zh ? 'zh' : 'en']}</p><p className="mt-2 whitespace-pre-wrap">{risk.controlMeasures[zh ? 'zh' : 'en']}</p><p className="mt-2">{zh ? ramReviewModalText.initialResidualRating.zh : ramReviewModalText.initialResidualRating.en}{risk.riskScore ?? '—'} / {risk.residualScore ?? '—'}</p><p>{risk.additionalAction[zh ? 'zh' : 'en']}</p><details className="mt-2"><summary>{zh ? ramReviewModalText.expand.zh : ramReviewModalText.expand.en}</summary><p>{risk.hazard[zh ? 'en' : 'zh']}</p><p>{risk.consequence[zh ? 'en' : 'zh']}</p><p>{risk.controlMeasures[zh ? 'en' : 'zh']}</p><p>{risk.additionalAction[zh ? 'en' : 'zh']}</p></details></details>)}
      <Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/workspace/ram`} onClick={onClose}>{zh ? ramReviewModalText.openRamToReviseRisksAndRatings.zh : ramReviewModalText.openRamToReviseRisksAndRatings.en}</Link>
      {current ? <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>{zh ? ramReviewModalText.iHaveCheckedTheCurrentRisksControlsAndHuman.zh : ramReviewModalText.iHaveCheckedTheCurrentRisksControlsAndHuman.en}</span></label> : null}
    </div>
  </AppModal>
}
