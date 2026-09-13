import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { http, normalizeApiError } from '../services/http'
import { eventOperationsService } from '../services/eventOperationsService'
import { eventPreparationService, type EventPreparationState } from '../services/eventPreparationService'
import { normalizeCurrentTask, localizeNotificationText } from '../utils/currentTasks'
import { dutyReturnPath, withDutyReturn } from '../utils/eventDutyNavigation'
import { invalidateCurrentTasks } from '../hooks/useCurrentTasks'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppActionButton from '../components/layout/AppActionButton'
import EventTaskDetailPanel from '../components/events/EventTaskDetailPanel'
import EventRamWorkspace from '../components/events/EventRamWorkspace'
import { EventPackageFoundationPanel } from '../components/events/EventPackageFoundationPanel'
import EventPreparationReopenPanel from '../components/events/EventPreparationReopenPanel'
import useConfirmation from '../hooks/useConfirmation'
import type { AppNotification } from '../types/notification'

type Duty = { task: AppNotification; surface: string; targetUrl?: string; detailText?: string; context?: { en: string; zh: string }; eTag?: string }
export default function EventDutyView() {
  const { eventId = '', sourceType = '', sourceId = '' } = useParams()
  const [params] = useSearchParams(), navigate = useNavigate()
  const taskKey = params.get('taskKey') ?? '', returnTo = dutyReturnPath(params.get('returnTo'))
  const { language, me } = useAuthStore(), zh = language === 'zh'
  const [duty, setDuty] = useState<Duty | null>(null), [preparation, setPreparation] = useState<EventPreparationState | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ended, setEnded] = useState(false), [reason, setReason] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const attempt = useRef<{ signature: string; key: string } | null>(null)
  const validate = useCallback(async () => {
    try {
      const { data } = await http.get<{ task: unknown; surface: string; targetUrl?: string; detailText?: string; context?: { en: string; zh: string }; eTag?: string }>(`/api/events/${eventId}/duties/${sourceType}/${sourceId}`, { params: { taskKey } })
      const task = normalizeCurrentTask(data.task)
      if (!task) throw new Error('Invalid duty response')
      return { ...data, task }
    } catch (e) {
      const status = normalizeApiError(e).status
      if ([403, 404, 409, 412].includes(status ?? 0)) { setEnded(true); void invalidateCurrentTasks(me?.id) }
      throw e
    }
  }, [eventId, sourceType, sourceId, taskKey, me?.id])
  const load = useCallback(async () => {
    const data = await validate(); setDuty(data)
    if (data.surface === 'reopen') setPreparation(await eventPreparationService.get(eventId))
  }, [validate, eventId])
  useEffect(() => { setDuty(null); setError(''); setEnded(false); void load().catch(e => setError(normalizeApiError(e).message)) }, [load])
  const changed = useCallback(async () => { await invalidateCurrentTasks(me?.id); setEnded(true) }, [me?.id])
  const beforeAction = useCallback(async () => { await validate() }, [validate])
  const act = async (accept: boolean) => {
    if (!duty || busy || !await requestConfirmation({ title: zh ? '确认处理此项事务' : 'Confirm this action', description: zh ? '这会更新你的职责回应或当前审批决定。' : 'This updates your response or the current approval decision.', confirmLabel: zh ? '确认' : 'Confirm' })) return
    setBusy(true); setError('')
    try {
      await validate()
      if (sourceType === 'teamInvitation') await eventOperationsService.respondToTeamInvite(eventId, sourceId, accept)
      else if (sourceType === 'roleInvitation') await eventOperationsService.respondToRoleInvitation(eventId, sourceId, accept)
      else if (sourceType === 'rosterAssignment' && duty.task.occurrenceId) await eventOperationsService.respondToRosterAssignment(eventId, duty.task.occurrenceId, sourceId, accept)
      else if (sourceType === 'sponsorship') {
        const signature = JSON.stringify([accept, reason, duty.eTag])
        if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }
        await http.post(`/api/events/${eventId}/sponsorship/${accept ? 'approve' : 'reject'}`, { reason }, { headers: { 'If-Match': duty.eTag, 'Idempotency-Key': attempt.current.key } })
      }
      await changed()
    } catch (e) { setError(normalizeApiError(e).message) } finally { setBusy(false) }
  }
  const title = duty ? localizeNotificationText(duty.task.title, language) : zh ? '活动职务事务' : 'Event duty'
  return <AppPageShell title={title} context={zh ? '个人中心 / 活动事务' : 'Personal Center / Event duty'} backLink={{ to: returnTo, label: zh ? '返回当前事务' : 'Back to current tasks' }}>
    {confirmationModal}
    {ended ? <AppEmptyState title={zh ? '此项事务已更新或不再需要你处理' : 'This responsibility has changed or no longer needs your action'} description={zh ? '返回当前事务查看最新交接和可处理版本。' : 'Return to current tasks for the latest handoff and actionable version.'} /> : !duty ? <AppEmptyState description={zh ? "正在校验当前版本与处理权限。" : "Checking the current version and your permission."} title={error || (zh ? '正在载入…' : 'Loading…')} actionLabel={zh ? '重试' : 'Retry'} onAction={() => { void load().catch(e => setError(normalizeApiError(e).message)) }} /> : <>
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {duty.surface === 'task' ? <EventTaskDetailPanel eventId={eventId} taskId={sourceId} beforeAction={beforeAction} onChanged={changed} /> : null}
      {duty.surface === 'ram' ? <EventRamWorkspace eventId={eventId} language={language} showEventPlan beforeAction={beforeAction} onSaved={changed} /> : null}
      {['package', 'condition'].includes(duty.surface) ? <EventPackageFoundationPanel eventId={eventId} groupId={duty.task.groupId!} language={language} canManage={false} conditionId={duty.surface === 'condition' ? sourceId : undefined} packageId={duty.surface === 'condition' || sourceType === 'execution' ? duty.targetUrl : sourceId} occurrenceId={duty.task.occurrenceId} beforeAction={beforeAction} onChanged={changed} /> : null}
      {duty.surface === 'reopen' && preparation ? <EventPreparationReopenPanel state={preparation} groupId={duty.task.groupId!} zh={zh} beforeAction={beforeAction} onBusy={setBusy} onChanged={() => { void changed() }} /> : null}
      {['invitation', 'rosterInvitation', 'sponsorship'].includes(duty.surface) ? <AppSectionCard title={localizeNotificationText(duty.task.actionLabel, language)}>
        <p className="mb-4 whitespace-pre-wrap text-sm">{localizeNotificationText(duty.context, language) || duty.detailText || localizeNotificationText(duty.task.body, language)}</p>
        {duty.task.dueUtc ? <p className="mb-4 text-sm">{new Date(duty.task.dueUtc).toLocaleString(language)}</p> : null}
        {duty.surface === 'sponsorship' ? <label className="mb-4 grid gap-2 text-sm">{zh ? '处理理由' : 'Decision reason'}<textarea className="min-h-24 rounded-xl border p-3" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /></label> : null}
        <div className="flex flex-wrap gap-3"><AppActionButton disabled={busy || duty.surface === 'sponsorship' && !reason.trim()} onClick={() => void act(true)}>{zh ? (duty.surface === 'sponsorship' ? '批准' : '接受并确认') : duty.surface === 'sponsorship' ? 'Approve' : 'Accept and confirm'}</AppActionButton><AppActionButton variant="secondary" disabled={busy || duty.surface === 'sponsorship' && !reason.trim()} onClick={() => void act(false)}>{zh ? '拒绝' : 'Decline'}</AppActionButton></div>
      </AppSectionCard> : null}
      {['owner', 'roster'].includes(duty.surface) ? <AppSectionCard title={localizeNotificationText(duty.task.actionLabel, language)}><Link className="inline-flex min-h-11 items-center rounded-xl bg-[#176b5a] px-4 font-semibold text-white" to={withDutyReturn(duty.targetUrl || `/events/${eventId}/workspace/roster?occurrenceId=${duty.task.occurrenceId ?? ''}`, returnTo)} onClick={e => { e.preventDefault(); void validate().then(() => navigate(withDutyReturn(duty.targetUrl || `/events/${eventId}/workspace/roster?occurrenceId=${duty.task.occurrenceId ?? ''}`, returnTo))).catch(e => setError(normalizeApiError(e).message)) }}>{zh ? '进入活动处理' : 'Open Event workspace'}</Link></AppSectionCard> : null}
    </>}
  </AppPageShell>
}
