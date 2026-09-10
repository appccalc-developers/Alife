import type { PolicyEditorDefaults, EventPackagePolicyAdmin } from '../../src/types/eventPackagePolicyAdmin'

export const defaults: PolicyEditorDefaults = {
  facts: [{ code: 'people.childrenPresent', label: { en: 'Children participating', zh: '儿童参与' } }], activityTypes: [], modules: [],
  rules: {
    schemaVersion: '1', preEventConfirmationWindowHours: 72,
    tierRules: ['light', 'standard', 'enhanced'].map(tier => ({ tier, whenAnyConfirmedFactCodes: [], whenAnyActivityTypeCodes: [], whenAnyModuleCodes: [] })) as PolicyEditorDefaults['rules']['tierRules'],
    authorityByTier: { light: { minimumApproverCount: 1 }, standard: { minimumApproverCount: 1 }, enhanced: { minimumApproverCount: 1 } },
    approvalValidityByTier: { light: 'P30D', standard: 'P14D', enhanced: 'P7D' },
    materialChangeRules: [], conditionWaiverAllowed: false, delegationRules: { enabled: false, allowedTiers: [] },
    legacyRollout: { effectiveFromUtc: '2026-01-01T00:00:00Z', transitionDeadlineUtc: '2026-04-01T00:00:00Z', cohortRule: 'new-events-first', safetyCriticalModuleCodes: [], transitionByMode: { off: 'legacyReadOnlyPackage', dryRun: 'timeLimitedCompatibility', enforced: 'formalPackageRequired' } },
  },
}
export const policy = (overrides: Partial<EventPackagePolicyAdmin> = {}): EventPackagePolicyAdmin => ({ id: 'old', version: 'First', schemaVersion: '1', rules: structuredClone(defaults.rules), enforcementMode: 'enforced', effectiveFromUtc: '2026-01-01T00:00:00Z', isPublished: true, publishedByMemberId: 'admin', publishedUtc: '2026-01-01T00:00:00Z', ...overrides })
