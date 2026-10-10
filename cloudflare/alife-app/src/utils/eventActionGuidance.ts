import { eventActionGuidanceText } from '../i18n/eventActionGuidance.ts'
import type { EventLifecycle, EventPackageApprovalDelegation } from '../types/eventPackage'

export const preparationAreas: Record<string, [string, string]> = {
  'TEAM.WORK': [eventActionGuidanceText.teamAndTasks.en, eventActionGuidanceText.teamAndTasks.zh],
  'PEOPLE.REGISTRATION': [eventActionGuidanceText.registrationRules.en, eventActionGuidanceText.registrationRules.zh],
  'SERVICE.ROSTER': [eventActionGuidanceText.rolesAndShifts.en, eventActionGuidanceText.rolesAndShifts.zh],
  'SAFETY.RAM': [eventActionGuidanceText.riskAssessment.en, eventActionGuidanceText.riskAssessment.zh],
  'SAFEGUARDING.CHILD': [eventActionGuidanceText.childSafeguarding.en, eventActionGuidanceText.childSafeguarding.zh],
  'PROGRAM.PRODUCTION': [eventActionGuidanceText.programme.en, eventActionGuidanceText.programme.zh],
  'PLACE.RESOURCE': [eventActionGuidanceText.venueAndResources.en, eventActionGuidanceText.venueAndResources.zh],
  'MOVE.STAY': [eventActionGuidanceText.transportAndAccommodation.en, eventActionGuidanceText.transportAndAccommodation.zh],
  'MONEY.FINANCE': [eventActionGuidanceText.registrationFees.en, eventActionGuidanceText.registrationFees.zh],
  'FOOD.HOSPITALITY': [eventActionGuidanceText.foodAndHospitality.en, eventActionGuidanceText.foodAndHospitality.zh],
  'COMMS.FOLLOWUP': [eventActionGuidanceText.communicationAndFollowUp.en, eventActionGuidanceText.communicationAndFollowUp.zh],
}

export const preparationAreaLabel = (code: string, zh: boolean) => preparationAreas[code.toUpperCase()]?.[zh ? 1 : 0] ?? (zh ? eventActionGuidanceText.relatedPreparation.zh : eventActionGuidanceText.relatedPreparation.en)
export const knownPreparationArea = (code: string) => Object.hasOwn(preparationAreas, code.toUpperCase())
export const gateLabel = (gate: string, zh: boolean) => ({ publish: zh ? eventActionGuidanceText.publish.zh : eventActionGuidanceText.publish.en, registration: zh ? eventActionGuidanceText.registration.zh : eventActionGuidanceText.registration.en, payment: zh ? eventActionGuidanceText.payment.zh : eventActionGuidanceText.payment.en, execute: zh ? eventActionGuidanceText.delivery.zh : eventActionGuidanceText.delivery.en }[gate] ?? (zh ? eventActionGuidanceText.eventAction.zh : eventActionGuidanceText.eventAction.en))

type Gate = EventLifecycle['gates'][number]
export type GateIssue = { key: string; blocker: Gate['blockers'][number]; gates: string[]; scopeType: Gate['scopeType']; scopeId?: string | null; packageVersion?: number | null; warningsOnly: boolean }

// Combine only the same requirement and evidence scope. Never merge different
// occurrence evidence or treat navigation as resolving the server requirement.
export function groupGateIssues(gates: Gate[]): GateIssue[] {
  const issues = new Map<string, GateIssue>()
  for (const gate of gates) for (const [warning, items] of [[false, gate.blockers], [true, gate.warnings]] as const) for (const blocker of items) {
    const reason = blocker.code.split('.').at(-1) ?? blocker.code
    const normalized = ['packageNotApproved', 'approvalDecisionMissing', 'approvalQuorumMissing'].includes(reason) ? 'approvalMissing' : reason
    const key = JSON.stringify([normalized, blocker.nextAction, blocker.responsibleRole, blocker.message, gate.scopeType, gate.scopeId, gate.eventPackageVersion, gate.governancePolicyVersion])
    const existing = issues.get(key)
    if (existing) { if (!existing.gates.includes(gate.gate)) existing.gates.push(gate.gate); existing.warningsOnly &&= warning }
    else issues.set(key, { key, blocker, gates: [gate.gate], scopeType: gate.scopeType, scopeId: gate.scopeId, packageVersion: gate.eventPackageVersion, warningsOnly: warning })
  }
  return [...issues.values()]
}

export function gateStateLabel(gate: Gate, zh: boolean) {
  if (!gate.allowed) return zh ? eventActionGuidanceText.notAvailable.zh : eventActionGuidanceText.notAvailable.en
  if (gate.enforcementMode === 'off') return zh ? eventActionGuidanceText.checkDisabled.zh : eventActionGuidanceText.checkDisabled.en
  if (gate.enforcementMode === 'dryRun') return gate.requirementsSatisfied ? (zh ? eventActionGuidanceText.trialChecksMet.zh : eventActionGuidanceText.trialChecksMet.en) : (zh ? eventActionGuidanceText.trialAttentionNeeded.zh : eventActionGuidanceText.trialAttentionNeeded.en)
  return gate.requirementsSatisfied ? (zh ? eventActionGuidanceText.requirementsMet.zh : eventActionGuidanceText.requirementsMet.en) : (zh ? eventActionGuidanceText.attentionNeeded.zh : eventActionGuidanceText.attentionNeeded.en)
}

export const packageStatusLabel = (value: string, zh: boolean) => ({
  draft: [eventActionGuidanceText.notSubmitted.en, eventActionGuidanceText.notSubmitted.zh], submitted: [eventActionGuidanceText.awaitingDecision.en, eventActionGuidanceText.awaitingDecision.zh], returnedForAmendment: [eventActionGuidanceText.changesRequested.en, eventActionGuidanceText.changesRequested.zh], rejected: [eventActionGuidanceText.notApproved.en, eventActionGuidanceText.notApproved.zh], approvedWithConditions: [eventActionGuidanceText.approvedWithConditions.en, eventActionGuidanceText.approvedWithConditions.zh], approved: [eventActionGuidanceText.approved.en, eventActionGuidanceText.approved.zh], withdrawn: [eventActionGuidanceText.withdrawn.en, eventActionGuidanceText.withdrawn.zh], superseded: [eventActionGuidanceText.replacedByANewerVersion.en, eventActionGuidanceText.replacedByANewerVersion.zh],
  notDecided: [eventActionGuidanceText.noDecisionYet.en, eventActionGuidanceText.noDecisionYet.zh], active: [eventActionGuidanceText.approvalValid.en, eventActionGuidanceText.approvalValid.zh], invalidated: [eventActionGuidanceText.approvalNeedsRenewal.en, eventActionGuidanceText.approvalNeedsRenewal.zh], expired: [eventActionGuidanceText.approvalExpired.en, eventActionGuidanceText.approvalExpired.zh], revoked: [eventActionGuidanceText.approvalRevoked.en, eventActionGuidanceText.approvalRevoked.zh],
}[value]?.[zh ? 1 : 0] ?? (zh ? eventActionGuidanceText.statusNeedsReview.zh : eventActionGuidanceText.statusNeedsReview.en))

export function eventDelegations(items: EventPackageApprovalDelegation[], eventId: string, now = Date.now()) {
  return items.filter(item => item.scopeType === 'event' && item.scopeId === eventId && !item.revokedUtc && new Date(item.expiresUtc).getTime() > now)
}

export const futureDelegationExpiry = (value: string, now = Date.now()) => Boolean(value && Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > now)

export const eventStageHelp = (stage: string, zh: boolean) => ({
  preparation: [eventActionGuidanceText.arrangePeopleVenueAndSafetyThenSubmitThePlan.en, eventActionGuidanceText.arrangePeopleVenueAndSafetyThenSubmitThePlan.zh],
  registration: [eventActionGuidanceText.publishTheApprovedEventAndManageRegistrationPublicationDoes.en, eventActionGuidanceText.publishTheApprovedEventAndManageRegistrationPublicationDoes.zh],
  execution: [eventActionGuidanceText.handleTheSelectedDateSDutiesCheckInAnd.en, eventActionGuidanceText.handleTheSelectedDateSDutiesCheckInAnd.zh],
  followup: [eventActionGuidanceText.completeRemainingTasksFeedbackAndEventFollowUp.en, eventActionGuidanceText.completeRemainingTasksFeedbackAndEventFollowUp.zh],
}[stage]?.[zh ? 1 : 0] ?? '')
