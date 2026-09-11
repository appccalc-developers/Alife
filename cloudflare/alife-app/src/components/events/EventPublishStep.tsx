import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { eventPackageService } from '../../services/eventPackageService'
import { eventPosterWorkspaceService, type EventPosterWorkspace } from '../../services/eventPosterWorkspaceService'
import { invalidateGroupEventsCache } from '../../services/eventService'
import { normalizeApiError } from '../../services/http'
import { canPublishFromFlow, publicationAudience, setupPath } from '../../utils/eventSetupFlow'
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../../types/eventPackage'
import useConfirmation from '../../hooks/useConfirmation'

export default function EventPublishStep({ eventId, eventBasePath, zh, onBusy }: {
  eventId: string; eventBasePath: string; zh: boolean; onBusy: (busy: boolean) => void
}) {
  const [state, setState] = useState<{ item: EventPackage | null; lifecycle: EventLifecycle; info: EventPosterWorkspace; capabilities: EventPackageActorCapabilities | null } | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), active = useRef(true)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  useEffect(() => { active.current = true; return () => { active.current = false; onBusy(false) } }, [onBusy])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [item, lifecycle, info] = await Promise.all([eventPackageService.getCurrent(eventId), eventPackageService.getLifecycle(eventId), eventPosterWorkspaceService.get(eventId)])
      const capabilities = item ? await eventPackageService.getCapabilities(eventId, item.id) : null
      if (active.current) setState({ item, lifecycle, info, capabilities })
    } catch (reason) { if (active.current) setError(normalizeApiError(reason).message) }
    finally { if (active.current) setLoading(false) }
  }, [eventId])
  useEffect(() => { void load() }, [load])
  const publish = async () => {
    if (lock.current || !state?.item || !canPublishFromFlow(state.item, state.lifecycle, state.capabilities)) return
    lock.current = true
    const accepted = await requestConfirmation({ title: zh ? '确认发布活动' : 'Publish this event?',
      description: publicationAudience(state.info.visibility, zh), confirmLabel: zh ? '确认发布' : 'Publish' })
    if (!accepted) { lock.current = false; return }
    setBusy(true); onBusy(true); setError('')
    try {
      const lifecycle = await eventPackageService.publish(eventId, state.lifecycle.eTag, state.item)
      if (active.current) setState({ ...state, lifecycle })
      await invalidateGroupEventsCache(state.info.groupId)
    } catch (reason) {
      if (active.current) {
        const failure = normalizeApiError(reason)
        setError(failure.message.includes('ramNotApproved') ? (zh ? '风险评估尚未批准，请先完成 RAM 审批。' : 'The risk assessment is not approved. Complete RAM approval first.')
          : failure.message.includes('sponsorshipNotApproved') ? (zh ? '教会身份尚未批准，请先完成身份审批。' : 'Church sponsorship is not approved yet.')
          : failure.status === 409 || failure.status === 412 ? (zh ? '审批或活动资料已变化，请刷新并检查审批状态后再发布。' : 'Approval or event details changed. Refresh and review approval before publishing.') : failure.message)
      }
    } finally { lock.current = false; if (active.current) { setBusy(false); onBusy(false) } }
  }
  const published = state?.lifecycle.publicationStatus === 'published' && state.lifecycle.publishGateSatisfied
  const gate = state?.lifecycle.gates.find(item => item.gate === 'publish')
  return <AppSectionCard title={zh ? '发布活动' : 'Publish event'} subtitle={zh ? '正式审批通过并满足发布条件后，按已设置的可见范围发布。' : 'After formal approval and publication checks, publish to the configured audience.'}>
    {loading ? <p role="status">{zh ? '正在检查审批与发布状态……' : 'Checking approval and publication…'}</p> : null}
    {error ? <p role="alert" className="my-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {state ? <div className="space-y-4 text-sm">
      <div className="rounded-xl bg-[#e3f0eb] p-4"><h3 className="font-semibold">{zh ? '发布范围' : 'Audience'}</h3><p className="mt-2">{publicationAudience(state.info.visibility, zh)}</p></div>
      {published ? <p role="status" className="font-semibold text-[#176b5a]">{zh ? '活动已发布，符合可见性规则的访客或成员可以查看。' : 'Event published. Eligible visitors or members can now view it.'}</p>
        : <><p>{canPublishFromFlow(state.item, state.lifecycle, state.capabilities) ? (zh ? '审批和发布条件已满足，请确认发布。' : 'Approval and publication checks are satisfied. Confirm publication when ready.') : (zh ? '尚未满足发布条件，请先完成正式审批、所需条件与相关安全审批。' : 'Publication is not ready. Complete formal approval, required conditions and applicable safety approvals.')}</p>
          {gate?.blockers.length ? <ul className="list-disc space-y-2 pl-5">{gate.blockers.map(item => <li key={item.code}>{item.message[zh ? 'zh' : 'en']}</li>)}</ul> : null}
          <AppActionButton variant="primary" disabled={loading || busy || !canPublishFromFlow(state.item, state.lifecycle, state.capabilities)} onClick={() => void publish()}>{busy ? (zh ? '正在发布……' : 'Publishing…') : (zh ? '确认并发布活动' : 'Confirm and publish event')}</AppActionButton></>}
      <div className="flex flex-wrap gap-4"><Link className="font-semibold text-[#176b5a]" to={setupPath(eventBasePath, 'approval')}>{zh ? '返回正式审批' : 'Back to approval'}</Link><Link className="font-semibold text-[#176b5a]" to={`${eventBasePath}/edit?step=ram&flow=setup`}>{zh ? '查看风险评估与管理' : 'Risk assessment and management'}</Link>{published ? <Link className="font-semibold text-[#176b5a]" to={eventBasePath}>{zh ? '查看活动' : 'View event'}</Link> : null}</div>
      {published && state.info.registrationMode === 'required' && state.lifecycle.registrationStatus !== 'open' ? <p>{zh ? '发布后仍需在审批治理中确认开放报名。' : 'Registration still needs an explicit opening action in governance.'}<Link className="ml-2 font-semibold text-[#176b5a]" to={`${eventBasePath}/workspace?tab=governance`}>{zh ? '开放报名设置' : 'Registration controls'}</Link></p> : null}
    </div> : null}
    <AppActionButton className="mt-4" disabled={loading || busy} onClick={() => void load()}>{zh ? '刷新审批与发布状态' : 'Refresh approval and publication'}</AppActionButton>
    {confirmationModal}
  </AppSectionCard>
}
