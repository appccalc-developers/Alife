import { eventCreationCopyText } from '../i18n/eventCreationCopy.ts'
import type { LocalizedText, ModuleDecision } from '../types/eventComposition'

const readinessCopy: Record<string, [string, string]> = {
  'accountable-owner-assigned': [eventCreationCopyText.assignTheAccountableOwner.en, eventCreationCopyText.assignTheAccountableOwner.zh],
  'registration-window-valid': [eventCreationCopyText.confirmTheRegistrationWindow.en, eventCreationCopyText.confirmTheRegistrationWindow.zh],
  'capacity-defined': [eventCreationCopyText.setParticipantCapacity.en, eventCreationCopyText.setParticipantCapacity.zh],
  'privacy-notice-confirmed': [eventCreationCopyText.confirmThePrivacyNotice.en, eventCreationCopyText.confirmThePrivacyNotice.zh],
  'required-slots-filled': [eventCreationCopyText.fillRequiredServiceRoles.en, eventCreationCopyText.fillRequiredServiceRoles.zh],
  'assignees-eligible': [eventCreationCopyText.verifyVolunteerEligibility.en, eventCreationCopyText.verifyVolunteerEligibility.zh],
  'assignees-confirmed': [eventCreationCopyText.confirmVolunteerAssignments.en, eventCreationCopyText.confirmVolunteerAssignments.zh],
  'currency-defined': [eventCreationCopyText.confirmTheCurrency.en, eventCreationCopyText.confirmTheCurrency.zh],
  'budget-approved': [eventCreationCopyText.obtainBudgetApproval.en, eventCreationCopyText.obtainBudgetApproval.zh],
  'payment-and-refund-terms-published': [eventCreationCopyText.publishPaymentAndRefundTerms.en, eventCreationCopyText.publishPaymentAndRefundTerms.zh],
  'ram-complete': [eventCreationCopyText.completeTheRiskAssessment.en, eventCreationCopyText.completeTheRiskAssessment.zh],
  'ram-submitted': [eventCreationCopyText.submitTheRiskAssessment.en, eventCreationCopyText.submitTheRiskAssessment.zh],
  'ram-approved': [eventCreationCopyText.obtainRiskAssessmentApproval.en, eventCreationCopyText.obtainRiskAssessmentApproval.zh],
  'current-policy-loaded': [eventCreationCopyText.confirmTheApplicableSafeguardingPolicy.en, eventCreationCopyText.confirmTheApplicableSafeguardingPolicy.zh],
  'guardianship-complete': [eventCreationCopyText.completeGuardianshipInformation.en, eventCreationCopyText.completeGuardianshipInformation.zh],
  'eligible-workers-and-policy-ratios-satisfied': [eventCreationCopyText.verifySafeguardingWorkersAndRequiredRatios.en, eventCreationCopyText.verifySafeguardingWorkersAndRequiredRatios.zh],
  'programme-owner-assigned': [eventCreationCopyText.assignTheProgrammeCoordinator.en, eventCreationCopyText.assignTheProgrammeCoordinator.zh],
  'required-items-confirmed': [eventCreationCopyText.confirmRequiredProgrammeItems.en, eventCreationCopyText.confirmRequiredProgrammeItems.zh],
  'production-check-complete': [eventCreationCopyText.completeProductionChecks.en, eventCreationCopyText.completeProductionChecks.zh],
  'capacity-sufficient': [eventCreationCopyText.verifyVenueCapacity.en, eventCreationCopyText.verifyVenueCapacity.zh],
  'bookings-confirmed': [eventCreationCopyText.confirmReservations.en, eventCreationCopyText.confirmReservations.zh],
  'conflicts-resolved': [eventCreationCopyText.resolveBookingConflicts.en, eventCreationCopyText.resolveBookingConflicts.zh],
  'transport-and-stay-facts-confirmed': [eventCreationCopyText.confirmTransportAndAccommodationArrangements.en, eventCreationCopyText.confirmTransportAndAccommodationArrangements.zh],
  'drivers-and-vehicles-qualified': [eventCreationCopyText.verifyDriversAndVehicles.en, eventCreationCopyText.verifyDriversAndVehicles.zh],
  'manifests-and-night-roles-complete': [eventCreationCopyText.completePassengerListsAndOvernightDutyArrangements.en, eventCreationCopyText.completePassengerListsAndOvernightDutyArrangements.zh],
  'food-policy-loaded': [eventCreationCopyText.confirmTheApplicableFoodSafetyPolicy.en, eventCreationCopyText.confirmTheApplicableFoodSafetyPolicy.zh],
  'allergy-process-confirmed': [eventCreationCopyText.confirmAllergyHandlingArrangements.en, eventCreationCopyText.confirmAllergyHandlingArrangements.zh],
  'service-and-cleaning-roles-filled': [eventCreationCopyText.assignFoodServiceAndCleanupRoles.en, eventCreationCopyText.assignFoodServiceAndCleanupRoles.zh],
  'zone-leads-assigned': [eventCreationCopyText.assignAreaCoordinators.en, eventCreationCopyText.assignAreaCoordinators.zh],
  'command-and-escalation-confirmed': [eventCreationCopyText.confirmCommandAndEscalationArrangements.en, eventCreationCopyText.confirmCommandAndEscalationArrangements.zh],
  'evacuation-and-first-aid-confirmed': [eventCreationCopyText.confirmEvacuationAndFirstAidArrangements.en, eventCreationCopyText.confirmEvacuationAndFirstAidArrangements.zh],
  'audience-and-channels-confirmed': [eventCreationCopyText.confirmTheAudienceAndCommunicationChannels.en, eventCreationCopyText.confirmTheAudienceAndCommunicationChannels.zh],
  'public-copy-approved-when-applicable': [eventCreationCopyText.approvePublicCopyWhereRequired.en, eventCreationCopyText.approvePublicCopyWhereRequired.zh],
  'retention-purpose-defined': [eventCreationCopyText.defineWhyInformationIsRetained.en, eventCreationCopyText.defineWhyInformationIsRetained.zh],
}

export const creationMessage = (message: LocalizedText, zh: boolean, modules: ModuleDecision[]): string => {
  let text = (zh ? message.zh : message.en) || message.en || message.zh
  // The current API wraps readiness codes in a bilingual sentence. Present the
  // authoritative task without exposing its implementation key or changing its gate.
  const rule = Object.keys(readinessCopy).find(code => text.includes(code))
  if (rule) {
    const owner = modules.find(item => text.includes(item.label.en) || text.includes(item.label.zh))
    return `${owner ? `${zh ? owner.label.zh || owner.label.en : owner.label.en || owner.label.zh}: ` : ''}${readinessCopy[rule][zh ? 1 : 0]}`
  }
  for (const item of modules) text = text.replaceAll(item.moduleCode, zh ? item.label.zh || item.label.en : item.label.en || item.label.zh)
  return text
}
