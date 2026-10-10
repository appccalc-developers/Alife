import { eventPublishStepText } from '../../i18n/eventPublishStep.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { eventPackageService } from '../../services/eventPackageService'
import { eventPosterWorkspaceService, type EventPosterWorkspace } from '../../services/eventPosterWorkspaceService'
import { invalidateGroupEventsCache } from '../../services/eventService'
import { normalizeApiError } from '../../services/http'
import { canPublishFromFlow, publicationAudience, setupPath } from '../../utils/eventSetupFlow'
import type { EventLifecycle, EventPackage, EventPackageActorCapabilities } from '../../types/eventPackage'
import useConfirmation from '../../hooks/useConfirmation'
import EventTaskPublicationMaterial from './EventTaskPublicationMaterial'
import EventGateChecklist from './EventGateChecklist'

export default function EventPublishStep({ eventId, eventBasePath, zh, onBusy }: {
  eventId: string; eventBasePath: string; zh: boolean; onBusy: (busy: boolean) => void
}) {
  const navigate = useNavigate()
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
    const accepted = await requestConfirmation({ title: zh ? eventPublishStepText.publishThisEvent.zh : eventPublishStepText.publishThisEvent.en,
      description: publicationAudience(state.info.visibility, zh), confirmLabel: zh ? eventPublishStepText.publish.zh : eventPublishStepText.publish.en })
    if (!accepted) { lock.current = false; return }
    setBusy(true); onBusy(true); setError('')
    try {
      const lifecycle = await eventPackageService.publish(eventId, state.lifecycle.eTag, state.item)
      if (active.current) setState({ ...state, lifecycle })
      await invalidateGroupEventsCache(state.info.groupId)
    } catch (reason) {
      if (active.current) {
        const failure = normalizeApiError(reason)
        setError(failure.message.includes('ramNotApproved') ? (zh ? eventPublishStepText.theRiskAssessmentHasNotPassedIndependentRamReview.zh : eventPublishStepText.theRiskAssessmentHasNotPassedIndependentRamReview.en)
          : failure.message.includes('sponsorshipNotApproved') ? (zh ? eventPublishStepText.churchSponsorshipIsNotApprovedYet.zh : eventPublishStepText.churchSponsorshipIsNotApprovedYet.en)
          : failure.status === 409 || failure.status === 412 ? (zh ? eventPublishStepText.approvalOrEventDetailsChangedRefreshAndReviewApproval.zh : eventPublishStepText.approvalOrEventDetailsChangedRefreshAndReviewApproval.en) : failure.message)
      }
    } finally { lock.current = false; if (active.current) { setBusy(false); onBusy(false) } }
  }
  const published = state?.lifecycle.publicationStatus === 'published' && state.lifecycle.publishGateSatisfied
  const gate = state?.lifecycle.gates.find(item => item.gate === 'publish')
  return <AppSectionCard title={zh ? eventPublishStepText.publishEvent.zh : eventPublishStepText.publishEvent.en} subtitle={zh ? eventPublishStepText.afterFormalApprovalAndPublicationChecksPublishToThe.zh : eventPublishStepText.afterFormalApprovalAndPublicationChecksPublishToThe.en}>
    {loading ? <p role="status">{zh ? eventPublishStepText.checkingApprovalAndPublication.zh : eventPublishStepText.checkingApprovalAndPublication.en}</p> : null}
    {error ? <p role="alert" className="my-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {state ? <div className="space-y-4 text-sm">
      {state.info.canManage ? <EventTaskPublicationMaterial eventId={eventId} zh={zh} /> : null}
      <div className="rounded-xl bg-[#e3f0eb] p-4"><h3 className="font-semibold">{zh ? eventPublishStepText.audience.zh : eventPublishStepText.audience.en}</h3><p className="mt-2">{publicationAudience(state.info.visibility, zh)}</p></div>
      {published ? <p role="status" className="font-semibold text-[#176b5a]">{zh ? eventPublishStepText.eventPublishedEligibleVisitorsOrMembersCanNowView.zh : eventPublishStepText.eventPublishedEligibleVisitorsOrMembersCanNowView.en}</p>
        : <><p>{canPublishFromFlow(state.item, state.lifecycle, state.capabilities) ? (zh ? eventPublishStepText.approvalAndPublicationChecksAreSatisfiedConfirmPublicationWhen.zh : eventPublishStepText.approvalAndPublicationChecksAreSatisfiedConfirmPublicationWhen.en) : (zh ? eventPublishStepText.publicationIsNotReadyCompleteFormalApprovalRequiredConditions.zh : eventPublishStepText.publicationIsNotReadyCompleteFormalApprovalRequiredConditions.en)}</p>
          {gate && (gate.blockers.length || gate.warnings.length) ? <EventGateChecklist lifecycle={{ ...state.lifecycle, gates: [gate] }} current={state.item ?? undefined} capabilities={state.capabilities} canManage={state.info.canManage} zh={zh} busy={loading || busy} onEdit={module => navigate(setupPath(eventBasePath, 'arrangements', module) + '&reviewReturn=approval')} onFocus={() => navigate(setupPath(eventBasePath, 'approval'))} /> : null}
          <AppActionButton variant="primary" disabled={loading || busy || !canPublishFromFlow(state.item, state.lifecycle, state.capabilities)} onClick={() => void publish()}>{busy ? (zh ? eventPublishStepText.publishing.zh : eventPublishStepText.publishing.en) : (zh ? eventPublishStepText.confirmAndPublishEvent.zh : eventPublishStepText.confirmAndPublishEvent.en)}</AppActionButton></>}
      <div className="flex flex-wrap gap-4"><Link className="font-semibold text-[#176b5a]" to={setupPath(eventBasePath, 'approval')}>{zh ? eventPublishStepText.backToApproval.zh : eventPublishStepText.backToApproval.en}</Link><Link className="font-semibold text-[#176b5a]" to={`${eventBasePath}/workspace/ram?flow=setup`}>{zh ? eventPublishStepText.riskAssessmentAndManagement.zh : eventPublishStepText.riskAssessmentAndManagement.en}</Link>{published ? <Link className="font-semibold text-[#176b5a]" to={eventBasePath}>{zh ? eventPublishStepText.viewEvent.zh : eventPublishStepText.viewEvent.en}</Link> : null}</div>
      {published && state.info.registrationMode === 'required' && state.lifecycle.registrationStatus !== 'open' ? <p>{zh ? eventPublishStepText.registrationStillNeedsAnExplicitOpeningActionInGovernance.zh : eventPublishStepText.registrationStillNeedsAnExplicitOpeningActionInGovernance.en}<Link className="ml-2 font-semibold text-[#176b5a]" to={`${eventBasePath}/workspace?tab=governance`}>{zh ? eventPublishStepText.registrationControls.zh : eventPublishStepText.registrationControls.en}</Link></p> : null}
    </div> : null}
    <AppActionButton className="mt-4" disabled={loading || busy} onClick={() => void load()}>{zh ? eventPublishStepText.refreshApprovalAndPublication.zh : eventPublishStepText.refreshApprovalAndPublication.en}</AppActionButton>
    {confirmationModal}
  </AppSectionCard>
}
