export type EventPackagePolicyAdmin = {
  id: string
  organisationId?: string | null
  version: string
  schemaVersion: string
  rules: Record<string, unknown>
  enforcementMode: 'off' | 'dryRun' | 'enforced'
  effectiveFromUtc: string
  retiredUtc?: string | null
  isPublished: boolean
  publishedByMemberId: string
  publishedByDisplayName?: string | null
  publishedUtc: string
}

export type PublishEventPackagePolicyRequest = {
  organisationId?: string | null
  version: string
  schemaVersion: string
  rules: Record<string, unknown>
  enforcementMode: EventPackagePolicyAdmin['enforcementMode']
  effectiveFromUtc: string
  expectedCurrentPolicyId?: string
  sourcePolicyId?: string
  impactToken?: string
}

export type EventPackageRolloutReport = {
  windowDays: number
  fromUtc: string
  generatedUtc: string
  evaluatedOperationCount: number
  wouldBlockOperationCount: number
  affectedEventCount: number
  reasons: Array<{ reasonCode: string; count: number }>
}

export type PolicyTier = 'light' | 'standard' | 'enhanced'
export type PolicyTrigger = 'whenAnyConfirmedFactCodes' | 'whenAnyActivityTypeCodes' | 'whenAnyModuleCodes'
export type PolicyRules = Record<string, unknown> & {
  schemaVersion: '1'
  preEventConfirmationWindowHours: number
  tierRules: Array<{ tier: PolicyTier } & Record<PolicyTrigger, string[]>>
  authorityByTier: Record<PolicyTier, { minimumApproverCount: number }>
  approvalValidityByTier: Record<PolicyTier, string>
  materialChangeRules: unknown[]
  conditionWaiverAllowed: boolean
  delegationRules: { enabled: boolean; allowedTiers?: PolicyTier[] }
  legacyRollout: { effectiveFromUtc: string; transitionDeadlineUtc: string; cohortRule: string; safetyCriticalModuleCodes: string[]; transitionByMode: Record<string, string> }
}
export type PolicyOption = { code: string; label: { en: string; zh: string } }
export type PolicyEditorDefaults = { rules: PolicyRules; facts: PolicyOption[]; activityTypes: PolicyOption[]; modules: PolicyOption[] }
export type PolicyImpact = { currentPolicyId: string | null; affectedEventCount: number; affectedApprovalCount: number; impactToken: string }
