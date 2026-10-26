import type { LocalizedText } from './eventComposition'

export type ActivityProjectRules = {
  eligibility: LocalizedText
  minimumAge: number | null
  maximumAge: number | null
  capacity: number
  allowWaitlist: boolean
  requiresGuardianConsent: boolean
  feeMinor: number
  currency: string
  opensUtc: string
  deadlineUtc: string
  needsSpace: boolean
  terms: LocalizedText
  feeChargeScope: 'perOccurrence' | 'oncePerSeries'
}
export type ActivityProjectPolicy = { id: string; version: number; rules: ActivityProjectRules; eTag: string; feeApprovalStatus: string }
export type ActivitySpace = { id: string; kind: 'internal' | 'external'; reservationId: string | null; name: LocalizedText; status: string; eTag: string }
export type ActivityOffer = { id: string; activityId: string; occurrenceId: string; startUtc: string; endUtc: string; capacity: number; status: string; eTag: string; confirmed: number; reserved: number; waitlisted: number; space: ActivitySpace | null }
export type ActivityParticipation = { id: string; offerId: string; participantId: string; displayName: string; seatStatus: string; procedureStatus: string; eligibility: string; feeMinor: number; currency: string; paidMinor: number; refundedMinor: number; reservedUntilUtc: string | null; eTag: string; chargeParticipationId: string | null }
export type ActivityProjectOperations = { activityId: string; name: LocalizedText; policy: ActivityProjectPolicy | null; offers: ActivityOffer[]; participations: ActivityParticipation[] }
export type ActivityParticipantOption = { participantId: string; displayName: string; isChild: boolean; seatStatus: string; canProvidePrivateData?: boolean; canConsent?: boolean; canSelect?: boolean }
export type ActivityOperationsWorkspace = { eventId: string; canConfigure: boolean; canManage: boolean; canFinance: boolean; canApproveFees: boolean; canManageSpace: boolean; projects: ActivityProjectOperations[]; participants: ActivityParticipantOption[] }
export type ActivitySelectionChange = { participantId: string; addOfferIds: string[]; removeParticipationIds: string[] }
export type ActivitySelectionPreview = { previewToken: string; change: ActivitySelectionChange; addedOffers: ActivityOffer[]; addedFeeMinor: number; currency: string; refundReviewCount: number }
export type ActivityActionRequest = { evidence?: string; occurredUtc?: string; amountMinor?: number }
export type ActivitySpaceRequest = { kind: 'internal' | 'external'; reservationId: string | null; name: LocalizedText; status: 'draft' | 'awaitingConfirmation' | 'confirmed' | 'refused' | 'cancelled'; evidence?: string }
export type ActivityPrivateData = { birthDate: string | null; eTag: string }
