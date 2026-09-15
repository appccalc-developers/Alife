import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppModal from '../layout/AppModal'
import AppActionButton from '../layout/AppActionButton'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { upgradeRam, type RamWorkspace } from '../../types/ramGovernance'
import { useRamSync, RamSyncBadge, ramSyncErrorText } from './RamSyncPanel'

export default function RamReviewModal({ eventId, zh, onClose, onReviewed }: { eventId: string; zh: boolean; onClose: () => void; onReviewed: () => Promise<void> }) {
  const { data, error, refresh } = useRamSync(eventId)
  const [workspace, setWorkspace] = useState<RamWorkspace | null>(null), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [failure, setFailure] = useState('')
  useEffect(() => {
    let live = true; setWorkspace(null); setAccepted(false); setFailure('')
    if (data?.sync.isUpdated) void ramService.workspace(eventId).then(value => { if (live) setWorkspace(value) }).catch(e => { if (live) setFailure(normalizeApiError(e).message) })
    return () => { live = false }
  }, [eventId, data?.eTag, data?.sync.isUpdated])
  const risks = workspace ? upgradeRam(workspace.assessment?.ramDataJson).hazards : []
  const current = Boolean(data?.sync.isUpdated && workspace?.assessment?.eTag === data.eTag)
  const confirm = async () => {
    if (!data || !accepted || !current) return
    setBusy(true); setFailure('')
    try { await ramService.syncAction(eventId, 'review', data.eTag); await onReviewed() }
    catch (e) { setFailure(normalizeApiError(e).message); await refresh() }
    finally { setBusy(false) }
  }
  return <AppModal open title={zh ? '提交前 RAM 最终核对' : 'Final RAM review before submission'} closeLabel={zh ? '关闭' : 'Close'} onClose={onClose} closeDisabled={busy} footer={<AppActionButton variant="primary" disabled={busy || !current || !accepted || !data?.canReview} onClick={() => void confirm()}>{zh ? '确认核对，继续提交' : 'Confirm review and continue'}</AppActionButton>}>
    <div className="space-y-4">
      {data ? <RamSyncBadge sync={data.sync} zh={zh} /> : <p role="status">{zh ? '正在读取…' : 'Loading…'}</p>}
      {!data?.sync.isUpdated ? <p role="status">{zh ? '请等待最新资料的 AI 同步完成。同步完成后会显示风险清单。' : 'Wait for AI to synchronize the latest plans. The risk list will appear when ready.'}</p> : null}
      {error || failure ? <p role="alert">{error || failure}</p> : null}
      {data && (data.sync.error || data.sync.status === 'Draft') ? <><p role="alert">{data.sync.error ? ramSyncErrorText(data.sync.error, zh) : (zh ? '请启动首次同步。' : 'Start the first synchronization.')}</p>{data.canRetry ? <AppActionButton disabled={busy} onClick={() => { setBusy(true); void ramService.syncAction(eventId, 'retry', data.eTag).then(refresh).catch(e => setFailure(normalizeApiError(e).message)).finally(() => setBusy(false)) }}>{zh ? '重试同步' : 'Retry synchronization'}</AppActionButton> : null}</> : null}
      {risks.map(risk => <details key={risk.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{risk.hazard[zh ? 'zh' : 'en']}</summary><p className="mt-2 whitespace-pre-wrap">{risk.consequence[zh ? 'zh' : 'en']}</p><p className="mt-2 whitespace-pre-wrap">{risk.controlMeasures[zh ? 'zh' : 'en']}</p><p className="mt-2">{zh ? '初始／剩余评分：' : 'Initial / residual rating: '}{risk.riskScore ?? '—'} / {risk.residualScore ?? '—'}</p><p>{risk.additionalAction[zh ? 'zh' : 'en']}</p><details className="mt-2"><summary>{zh ? '展开 English' : 'Expand 中文'}</summary><p>{risk.hazard[zh ? 'en' : 'zh']}</p><p>{risk.consequence[zh ? 'en' : 'zh']}</p><p>{risk.controlMeasures[zh ? 'en' : 'zh']}</p><p>{risk.additionalAction[zh ? 'en' : 'zh']}</p></details></details>)}
      <Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/workspace/ram`} onClick={onClose}>{zh ? '打开 RAM，修订风险与评分' : 'Open RAM to revise risks and ratings'}</Link>
      {current ? <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>{zh ? '我已核对当前风险、控制措施及人工修订。此次核对不替代现场确认或独立安全审批。' : 'I have checked the current risks, controls and human revisions. This does not replace personal confirmation or independent safety approval.'}</span></label> : null}
    </div>
  </AppModal>
}
