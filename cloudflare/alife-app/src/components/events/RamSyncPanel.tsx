import { ramSyncPanelText } from '../../i18n/ramSyncPanel.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { RamSyncOverview, RamSyncState } from '../../types/ramGovernance'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'

export function ramSyncErrorText(error: string, zh: boolean) {
  if (error === 'ram.sync.activityPlanRequired') return zh ? ramSyncPanelText.defineAndSaveActivitiesInTasksAndHandoffsFirst.zh : ramSyncPanelText.defineAndSaveActivitiesInTasksAndHandoffsFirst.en
  if (error === 'ram.sync.upgradeRequired') return zh ? ramSyncPanelText.upgradeAndSaveTheLegacyAssessmentInTheRam.zh : ramSyncPanelText.upgradeAndSaveTheLegacyAssessmentInTheRam.en
  return zh ? ramSyncPanelText.synchronizationFailedExistingContentIsPreservedRetryWhenReady.zh : ramSyncPanelText.synchronizationFailedExistingContentIsPreservedRetryWhenReady.en
}

export function useRamSync(eventId: string) {
  const viewer = useAuthStore().me?.id
  const [data, setData] = useState<RamSyncOverview | null>(null), [error, setError] = useState('')
  const sequence = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++sequence.current
    try { const next = await ramService.sync(eventId); if (version === sequence.current) { setData(next); setError('') } }
    catch (e) { if (version === sequence.current) setError(normalizeApiError(e).message) }
  }, [eventId, viewer])
  useEffect(() => {
    setData(null); setError(''); void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 6000)
    return () => { sequence.current++; window.clearInterval(timer) }
  }, [refresh])
  return { data, error, refresh }
}

export function RamSyncBadge({ sync, zh }: { sync: RamSyncState; zh: boolean }) {
  const waiting = !sync.isUpdated && !sync.error && sync.status === 'Syncing'
  const reviewed = sync.isUpdated && sync.status === 'Reviewed'
  const Icon = waiting ? LoaderCircle : reviewed ? CheckCircle2 : CircleAlert
  return <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${waiting ? 'bg-amber-100 text-amber-950' : reviewed ? 'bg-emerald-100 text-emerald-950' : 'bg-rose-100 text-rose-950'}`}>
    <Icon size={16} aria-hidden="true" />{waiting ? (zh ? ramSyncPanelText.aiSyncing.zh : ramSyncPanelText.aiSyncing.en) : reviewed ? (zh ? ramSyncPanelText.upToDate.zh : ramSyncPanelText.upToDate.en) : (zh ? ramSyncPanelText.needsReview.zh : ramSyncPanelText.needsReview.en)}
    {sync.isUpdated && !reviewed ? <span className="font-normal">{zh ? ramSyncPanelText.aiUpdated.zh : ramSyncPanelText.aiUpdated.en}</span> : null}
  </span>
}

export default function RamSyncPanel({ eventId, zh, onVersionChange, disabled = false }: { eventId: string; zh: boolean; disabled?: boolean; onVersionChange?: (etag: string) => void }) {
  const { data, error, refresh } = useRamSync(eventId)
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const callback = useRef(onVersionChange); callback.current = onVersionChange
  useEffect(() => { if (data) callback.current?.(data.eTag) }, [data?.eTag])
  return <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4" aria-label={zh ? ramSyncPanelText.ramBackgroundSynchronization.zh : ramSyncPanelText.ramBackgroundSynchronization.en}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{zh ? ramSyncPanelText.ramFinalRiskReview.zh : ramSyncPanelText.ramFinalRiskReview.en}</h3>{data?.isRequired ? <RamSyncBadge sync={data.sync} zh={zh} /> : data ? <span>{zh ? ramSyncPanelText.ramNotRequired.zh : ramSyncPanelText.ramNotRequired.en}</span> : null}</div>
    <p className="text-sm">{zh ? ramSyncPanelText.aggregatesSavedModulePlansReviewAiSuggestionsBeforeCompleting.zh : ramSyncPanelText.aggregatesSavedModulePlansReviewAiSuggestionsBeforeCompleting.en}</p>
    {data?.sync.lastEvaluatedAt ? <p className="text-xs">{zh ? ramSyncPanelText.lastEvaluated.zh : ramSyncPanelText.lastEvaluated.en}{new Date(data.sync.lastEvaluatedAt).toLocaleString(zh ? 'zh' : 'en')}</p> : null}
    {error || actionError || data?.sync.error ? <p role="alert" className="text-sm">{error || actionError || ramSyncErrorText(data?.sync.error || '', zh)}</p> : null}
    {!data && !error ? <p role="status">{zh ? ramSyncPanelText.loadingSyncStatus.zh : ramSyncPanelText.loadingSyncStatus.en}</p> : null}
    {error ? <AppActionButton onClick={() => void refresh()}>{zh ? ramSyncPanelText.refreshStatus.zh : ramSyncPanelText.refreshStatus.en}</AppActionButton> : null}
    <AppActionButton variant="primary" disabled={disabled || busy || !data?.isRequired || !data.canRetry || data.sync.status === 'Syncing'} onClick={() => {
      if (!data) return
      void requestConfirmation({title:zh?ramSyncPanelText.reassessRisksWithAi.zh:ramSyncPanelText.reassessRisksWithAi.en,description:zh?ramSyncPanelText.reassessTheLatestActivityPlansAndKeepHumanEdits.zh:ramSyncPanelText.reassessTheLatestActivityPlansAndKeepHumanEdits.en}).then(ok=>{
        if (!ok) return
        setBusy(true); setActionError(''); void ramService.syncAction(eventId, 'recalculate', data.eTag).then(refresh).catch(e => setActionError(normalizeApiError(e).message)).finally(() => setBusy(false))
      })
    }}>{zh ? ramSyncPanelText.reassessRisksWithAi.zh : ramSyncPanelText.reassessRisksWithAi.en}</AppActionButton>
    {disabled ? <p className="text-xs">{zh?ramSyncPanelText.saveCurrentChangesBeforeReassessing.zh:ramSyncPanelText.saveCurrentChangesBeforeReassessing.en}</p>:null}
    {confirmationModal}
  </section>
}
