import type { LocalizedText } from './eventComposition'

export type EventPackageScopeType = 'event' | 'occurrence'
export type EventPackageCoverageMode = 'explicitOccurrences' | 'planBoundSeriesWindow'
export type EventGovernanceTier = 'light' | 'standard' | 'enhanced'
export type EventPackageStatus = 'draft' | 'submitted' | 'returnedForAmendment' | 'rejected' | 'approvedWithConditions' | 'approved' | 'withdrawn' | 'superseded'
export type EventPackageApprovalValidity = 'notDecided' | 'active' | 'invalidated' | 'expired' | 'revoked'
export type LegacyEventPackageTransition = 'formalPackageRequired' | 'legacyReadOnlyPackage' | 'timeLimitedCompatibility' | 'safetyCriticalBlocked'
export type EventPackageDecisionType = 'approve' | 'approveWithConditions' | 'returnForAmendment' | 'reject' | 'revoke' | 'conditionWaiver'
export type EventPackageConditionStatus = 'open' | 'evidenceSubmitted' | 'verified' | 'rejected' | 'expired' | 'waived'
export type EventLifecycleGate = 'publish' | 'registration' | 'payment' | 'execute'

export type EventPackageModuleSummary = {
  moduleCode: string
  planStatus: string
  availability: 'available' | 'unavailable'
  sourceVersion: string
  blockers: LocalizedText[]
}

export type EventPackageManifest = {
  packageSchemaVersion: string
  eventId: string
  scopeType: EventPackageScopeType
  scopeId?: string | null
  coverageMode: EventPackageCoverageMode
  coveredOccurrenceIds: string[]
  eventPlanVersion: number
  governancePolicyVersion: string
  governanceTier: EventGovernanceTier
  legacyTransition: LegacyEventPackageTransition
  eventTitle: LocalizedText
  startUtc: string
  endUtc: string
  modules: EventPackageModuleSummary[]
  blockers: LocalizedText[]
  /** Optional while pre-1.0 stored manifests remain readable during rollout. */
  triggerReasons?: Array<{ code: string; message: LocalizedText }>
  requiredSpecialistDecisions?: string[]
  sections?: Array<{
    code: string
    title: LocalizedText
    status: 'ready' | 'attentionRequired' | 'notApplicable'
    items: LocalizedText[]
    moduleCodes: string[]
    blockers: LocalizedText[]
  }>
  warnings?: LocalizedText[]
}

export type EventPackage = {
  id: string
  eventId: string
  scopeType: EventPackageScopeType
  scopeId?: string | null
  coverageMode: EventPackageCoverageMode
  coveredOccurrenceIds: string[]
  version: number
  eventPlanVersion: number
  packageSchemaVersion: string
  governancePolicyVersion: string
  governanceTier: EventGovernanceTier
  status: EventPackageStatus
  approvalValidityStatus: EventPackageApprovalValidity
  contentHash: string
  sourceVectorHash: string
  manifest: EventPackageManifest
  sourceReferences: Array<{
    moduleCode: string
    subjectType: string
    subjectId: string
    subjectVersion: string
    sourceDecisionId?: string | null
    validUntilUtc?: string | null
    dataClass: string
    requiredForDecision: boolean
    capturedUtc: string
  }>
  decisions: Array<{
    id: string
    decisionType: EventPackageDecisionType
    actorMemberId: string
    reason: LocalizedText
    decidedUtc: string
    effectiveUtc: string
    expiresUtc?: string | null
    revokedByDecisionId?: string | null
    invalidatedReasonCode?: string | null
  }>
  conditions: Array<{
    id: string
    readinessTaskId?: string | null
    text: LocalizedText
    appliesToGate: EventLifecycleGate
    ownerRoleRequirementKey: string
    dueUtc: string
    status: EventPackageConditionStatus
    expiredUtc?: string | null
    evidenceReference?: string | null
    evidenceReferenceHash?: string | null
    evidenceExpiresUtc?: string | null
    evidenceUnavailableUtc?: string | null
    evidenceAvailable: boolean
    satisfiedByMemberId?: string | null
    satisfiedUtc?: string | null
    verifiedByMemberId?: string | null
    verifiedUtc?: string | null
    eTag: string
  }>
  supersedesPackageId?: string | null
  generatedByMemberId: string
  generatedUtc: string
  eTag: string
}

export type EventPackagePage = {
  items: EventPackage[]
  page: number
  pageSize: number
  totalCount: number
}

export type EventPackageDecisionRequest = {
  decisionType: Exclude<EventPackageDecisionType, 'revoke' | 'conditionWaiver'>
  reason: LocalizedText
  expiresUtc?: string | null
  conditions?: Array<{
    text: LocalizedText
    appliesToGate: EventLifecycleGate
    ownerRoleRequirementKey: string
    dueUtc: string
  }>
}

export type EventPublicationStatus = 'legacyImplicit' | 'draft' | 'published' | 'unpublished'
export type EventRegistrationStatus = 'legacyImplicit' | 'closed' | 'open'

export type EventLifecycle = {
  eventId: string
  publicationStatus: EventPublicationStatus
  publishedPackageId?: string | null
  publishedUtc?: string | null
  gateMode: 'off' | 'dryRun' | 'enforced'
  publishGateSatisfied: boolean
  reasonCodes: string[]
  eTag: string
  registrationStatus: EventRegistrationStatus
  registrationPackageId?: string | null
  registrationOpenedUtc?: string | null
  registrationGateMode: 'off' | 'dryRun' | 'enforced'
  registrationGateSatisfied: boolean
  registrationReasonCodes: string[]
  registrationETag: string
  executionStatus: 'notConfirmed' | 'confirmed' | 'invalidated'
  executionPackageId?: string | null
  executionConfirmedUtc?: string | null
  executionGateMode: 'off' | 'dryRun' | 'enforced'
  executionGateSatisfied: boolean
  executionReasonCodes: string[]
  executionETag: string
  paymentGateSatisfied: boolean
  paymentReasonCodes: string[]
  gates: Array<{
    gate: EventLifecycleGate
    enforcementMode: 'off' | 'dryRun' | 'enforced'
    scopeType: EventPackageScopeType
    scopeId?: string | null
    allowed: boolean
    requirementsSatisfied: boolean
    evaluatedUtc: string
    eventPlanVersion?: number | null
    eventPackageVersion?: number | null
    governancePolicyVersion?: string | null
    blockers: Array<{
      code: string
      message: LocalizedText
      responsibleRole: string
      nextAction: string
    }>
    warnings: Array<{
      code: string
      message: LocalizedText
      responsibleRole: string
      nextAction: string
    }>
  }>
}

export type EventPackageConditionResult = {
  condition: EventPackage['conditions'][number]
  lifecycle: EventLifecycle
}

export type EventPackageDiff = {
  fromPackageId: string
  fromVersion: number
  toPackageId: string
  toVersion: number
  hasMaterialChanges: boolean
  changes: Array<{
    field: string
    before?: string | null
    after?: string | null
    classification: 'cosmetic' | 'operational' | 'governanceCritical'
    affectedModuleCodes: string[]
  }>
}

export type EventPackageActorCapabilities = {
  eventId: string
  packageId: string
  canGenerate: boolean
  canSubmit: boolean
  canWithdraw: boolean
  canDecide: boolean
  canRevokeDecision: boolean
  canPublish: boolean
  canUnpublish: boolean
  canOpenRegistration: boolean
  canCloseRegistration: boolean
  canConfirmExecution: boolean
  canManageDelegations: boolean
  conditions: Array<{
    conditionId: string
    canSatisfy: boolean
    canVerify: boolean
    canWaive: boolean
  }>
}

export type EventPackageApprovalDelegation = {
  id: string
  organisationId: string
  scopeType: 'organisation' | 'event' | 'occurrence'
  scopeId?: string | null
  permissionCode: string
  delegatedToMemberId: string
  startsUtc: string
  expiresUtc: string
  grantedByMemberId: string
  grantedUtc: string
  revokedByMemberId?: string | null
  revokedUtc?: string | null
  revocationReason?: LocalizedText | null
  eTag: string
}
