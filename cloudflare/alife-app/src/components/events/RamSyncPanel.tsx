import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { RamSyncOverview, RamSyncState } from '../../types/ramGovernance'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'

export function ramSyncErrorText(error: string, zh: boolean) {
  if (error === 'ram.sync.activityPlanRequired') return zh ? '请先在任务与交接中定义并保存活动项目。' : 'Define and save activities in Tasks and handoffs first.'
  if (error === 'ram.sync.upgradeRequired') return zh ? '请先在 RAM 编辑器中升级并保存旧版资料，再重新同步。' : 'Upgrade and save the legacy assessment in the RAM editor before synchronizing.'
  return zh ? '同步失败，原有内容已保留。可重试。' : 'Synchronization failed. Existing content is preserved. Retry when ready.'
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
    <Icon size={16} aria-hidden="true" />{waiting ? (zh ? 'AI 同步中' : 'AI syncing') : reviewed ? (zh ? '已更新并核对' : 'Up to date') : (zh ? '需要核对' : 'Needs review')}
    {sync.isUpdated && !reviewed ? <span className="font-normal">{zh ? '· AI 已更新' : '· AI updated'}</span> : null}
  </span>
}

export default function RamSyncPanel({ eventId, zh, onVersionChange, disabled = false }: { eventId: string; zh: boolean; disabled?: boolean; onVersionChange?: (etag: string) => void }) {
  const { data, error, refresh } = useRamSync(eventId)
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const callback = useRef(onVersionChange); callback.current = onVersionChange
  useEffect(() => { if (data) callback.current?.(data.eTag) }, [data?.eTag])
  return <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-4" aria-label={zh ? 'RAM 后台同步' : 'RAM background synchronization'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{zh ? 'RAM · 汇总风险核对' : 'RAM · Final risk review'}</h3>{data?.isRequired ? <RamSyncBadge sync={data.sync} zh={zh} /> : data ? <span>{zh ? '当前无需 RAM' : 'RAM not required'}</span> : null}</div>
    <p className="text-sm">{zh ? '汇总已保存的各模块安排。AI 建议须由人核对，正式安全审批另行完成。' : 'Aggregates saved module plans. Review AI suggestions before completing independent safety approval.'}</p>
    {data?.sync.lastEvaluatedAt ? <p className="text-xs">{zh ? '最近评估：' : 'Last evaluated: '}{new Date(data.sync.lastEvaluatedAt).toLocaleString(zh ? 'zh' : 'en')}</p> : null}
    {error || actionError || data?.sync.error ? <p role="alert" className="text-sm">{error || actionError || ramSyncErrorText(data?.sync.error || '', zh)}</p> : null}
    {!data && !error ? <p role="status">{zh ? '正在读取同步状态…' : 'Loading sync status…'}</p> : null}
    {error ? <AppActionButton onClick={() => void refresh()}>{zh ? '刷新状态' : 'Refresh status'}</AppActionButton> : null}
    <AppActionButton variant="primary" disabled={disabled || busy || !data?.isRequired || !data.canRetry || data.sync.status === 'Syncing'} onClick={() => {
      if (!data) return
      void requestConfirmation({title:zh?'AI 重新评估风险':'Reassess risks with AI',description:zh?'将按最新活动资料重新列出风险，保留人工修改。已有确认及审批将失效，需要重新核对和签署。AI 不填写评分。':'Reassess the latest activity plans and keep human edits. Existing confirmation and approval will be invalidated and require review and signing again. AI does not supply ratings.'}).then(ok=>{
        if (!ok) return
        setBusy(true); setActionError(''); void ramService.syncAction(eventId, 'recalculate', data.eTag).then(refresh).catch(e => setActionError(normalizeApiError(e).message)).finally(() => setBusy(false))
      })
    }}>{zh ? 'AI 重新评估风险' : 'Reassess risks with AI'}</AppActionButton>
    {disabled ? <p className="text-xs">{zh?'请先保存当前修改，再重新评估。':'Save current changes before reassessing.'}</p>:null}
    {confirmationModal}
  </section>
}
