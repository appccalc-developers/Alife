import type { LocalizedText } from './eventComposition'
import type { EventOccurrence } from './eventOperations'

export type GuardianRelationshipStatus = 'pending' | 'confirmed' | 'ended'
export type GuardianConsentDecision = 'granted' | 'withdrawn'
export type ChildAttendanceState = 'present' | 'checkedOut'

export type EventSafeguardingPolicy = {
  id: string
  policyCode: string
  version: number
  name: LocalizedText
  effectiveFromUtc: string
  retiredUtc?: string | null
  requirementsRecognized: boolean
}

export type EventChildGuardian = {
  id: string
  guardianMemberId: string
  guardianDisplayName: string
  relationshipLabel: string
  status: GuardianRelationshipStatus
  eTag: string
}

export type EventChildCollector = {
  id: string
  displayName: string
  relationshipLabel: string
  isActive: boolean
  eTag: string
}

export type EventChildAttendance = {
  id: string
  eventOccurrenceId: string
  state: ChildAttendanceState
  checkedInUtc: string
  checkedOutUtc?: string | null
  collectorId?: string | null
  collectorDisplayName?: string | null
  eTag: string
}

export type EventSafeguardingChild = {
  id: string
  enrollmentId: string
  childMemberId: string
  displayName: string
  photoUrl?: string | null
  consentCurrent: boolean
  authorisedCollectionComplete: boolean
  guardians: EventChildGuardian[]
  authorisedCollectors: EventChildCollector[]
  attendance?: EventChildAttendance | null
  eTag: string
}

export type EventSafeguardingReadiness = {
  currentPolicyLoaded: boolean
  guardianshipComplete: boolean
  eligibleWorkersSatisfied: boolean
  blockers: LocalizedText[]
  checkedUtc: string
}

export type EventSafeguardingEnrollmentOption = { enrollmentId: string; memberId: string; displayName: string }
export type EventSafeguardingMemberOption = { memberId: string; displayName: string }

export type EventSafeguardingWorkspace = {
  eventId: string
  selectedOccurrenceId?: string | null
  accessMode: 'lead' | 'checkInDuty'
  selectedPolicy?: EventSafeguardingPolicy | null
  availablePolicies: EventSafeguardingPolicy[]
  occurrences: EventOccurrence[]
  enrollmentOptions: EventSafeguardingEnrollmentOption[]
  memberOptions: EventSafeguardingMemberOption[]
  children: EventSafeguardingChild[]
  workerEvidence: Array<{
    id: string; memberId: string; memberDisplayName: string; roleRequirementKey: string
    eligibilityEvidenceCode: string; evidenceReference: string; isEligible: boolean
    verifiedByMemberId: string; verifiedUtc: string; eTag: string
  }>
  audit: Array<{ id: string; action: string; childRegistrationId?: string | null; actorMemberId: string; occurredUtc: string }>
  readiness: EventSafeguardingReadiness
  configurationETag: string
  dataClassification: 'roleRestricted'
}

export type EventSafeguardingMyChild = {
  childRegistrationId: string
  childMemberId: string
  displayName: string
  photoUrl?: string | null
  isGuardian: boolean
  guardianRelationshipId?: string | null
  guardianETag?: string | null
  guardianStatus?: GuardianRelationshipStatus | null
  consentCurrent: boolean
  authorisedCollectors: EventChildCollector[]
  attendance: EventChildAttendance[]
}

export type EventSafeguardingMyContext = {
  eventId: string
  children: EventSafeguardingMyChild[]
  dataClassification: 'userSpecific'
}
