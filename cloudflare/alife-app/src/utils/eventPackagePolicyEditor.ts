import type { EventPackagePolicyAdmin, PolicyEditorDefaults, PolicyRules, PolicyTier, PublishEventPackagePolicyRequest } from '../types/eventPackagePolicyAdmin'

// Presentation order follows if / else if / else; stored rule order is preserved.
export const policyTiers: PolicyTier[] = ['enhanced', 'standard', 'light']
export const noCurrentPolicy = '00000000-0000-0000-0000-000000000000'
export const isCurrentPolicy = (p: EventPackagePolicyAdmin, now = Date.now()) => p.isPublished && Date.parse(p.effectiveFromUtc) <= now && (!p.retiredUtc || Date.parse(p.retiredUtc) > now)
export const validityDays = (value: string): number => {
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value)
  if (!match) throw new Error('Unsupported approval duration')
  const days = Number(match[1] || 0) + Number(match[2] || 0) / 24 + Number(match[3] || 0) / 1440 + Number(match[4] || 0) / 86400
  if (!(days > 0)) throw new Error('Invalid approval duration')
  return days
}

// Unknown structures are read-only: never round-trip a partially understood policy.
export const readPolicyRules = (input: Record<string, unknown>, catalog: PolicyEditorDefaults): PolicyRules => {
  const r = structuredClone(input) as PolicyRules
  const shape = (value: object, keys: string[], optional: string[] = []) => {
    if (!value || Array.isArray(value) || typeof value !== 'object' || keys.some(k => !(k in value)) || Object.keys(value).some(k => !keys.includes(k) && !optional.includes(k))) throw new Error('Unsupported policy')
  }
  shape(r, Object.keys(catalog.rules))
  if (r.schemaVersion !== '1' || !Number.isInteger(r.preEventConfirmationWindowHours) || r.preEventConfirmationWindowHours <= 0 || typeof r.conditionWaiverAllowed !== 'boolean' || !Array.isArray(r.materialChangeRules)) throw new Error('Unsupported policy')
  if (!Array.isArray(r.tierRules) || r.tierRules.length !== 3 || policyTiers.some(t => r.tierRules.filter(x => x.tier === t).length !== 1)) throw new Error('Unsupported tiers')
  shape(r.authorityByTier, policyTiers); shape(r.approvalValidityByTier, policyTiers)
  for (const tier of r.tierRules) {
    shape(tier, ['tier', 'whenAnyConfirmedFactCodes', 'whenAnyActivityTypeCodes', 'whenAnyModuleCodes'])
    for (const [key, options] of [['whenAnyConfirmedFactCodes', catalog.facts], ['whenAnyActivityTypeCodes', catalog.activityTypes], ['whenAnyModuleCodes', catalog.modules]] as const) {
      if (!Array.isArray(tier[key]) || tier[key].some(code => !options.some(o => o.code === code)) || new Set(tier[key]).size !== tier[key].length) throw new Error('Unavailable trigger')
    }
    shape(r.authorityByTier[tier.tier], ['minimumApproverCount'])
    const count = r.authorityByTier[tier.tier].minimumApproverCount
    if (!Number.isInteger(count) || count < 1 || count > 5) throw new Error('Invalid approver count')
    validityDays(r.approvalValidityByTier[tier.tier])
  }
  shape(r.delegationRules, ['enabled'], ['allowedTiers'])
  if (typeof r.delegationRules.enabled !== 'boolean' || (r.delegationRules.allowedTiers ?? []).some(t => !policyTiers.includes(t))) throw new Error('Unsupported delegation')
  shape(r.legacyRollout, ['effectiveFromUtc', 'transitionDeadlineUtc', 'cohortRule', 'safetyCriticalModuleCodes', 'transitionByMode'])
  if (r.legacyRollout.cohortRule !== 'new-events-first' || !Array.isArray(r.legacyRollout.safetyCriticalModuleCodes) || r.legacyRollout.safetyCriticalModuleCodes.some(c => !catalog.modules.some(m => m.code === c)) || !(Date.parse(r.legacyRollout.transitionDeadlineUtc) > Date.parse(r.legacyRollout.effectiveFromUtc))) throw new Error('Unsupported rollout')
  shape(r.legacyRollout.transitionByMode, [], ['off', 'dryRun', 'enforced'])
  for (const [mode, value] of Object.entries(r.legacyRollout.transitionByMode)) if (catalog.rules.legacyRollout.transitionByMode[mode] !== value) throw new Error('Unsupported transition')
  return r
}

export const createPolicyDraft = (catalog: PolicyEditorDefaults, source: EventPackagePolicyAdmin | undefined, current: EventPackagePolicyAdmin | undefined, now = new Date()): PublishEventPackagePolicyRequest => {
  const rules = readPolicyRules(source?.rules ?? catalog.rules, catalog)
  rules.legacyRollout.effectiveFromUtc = now.toISOString()
  rules.legacyRollout.transitionDeadlineUtc = new Date(now.getTime() + 90 * 86400000).toISOString()
  return { version: `v${now.toISOString().replace(/\D/g, '')}`, schemaVersion: '1', rules,
    enforcementMode: source?.enforcementMode ?? 'dryRun', effectiveFromUtc: now.toISOString(),
    expectedCurrentPolicyId: current?.id ?? noCurrentPolicy, sourcePolicyId: source?.id }
}

export const changedPolicySections = (before: Record<string, unknown> | undefined, after: PolicyRules): string[] => Object.keys(after).filter(k => k !== 'schemaVersion' && JSON.stringify(before?.[k]) !== JSON.stringify(after[k]))
