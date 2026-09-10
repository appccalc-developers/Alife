import test from 'node:test'
import assert from 'node:assert/strict'
import { createPolicyDraft, readPolicyRules, isCurrentPolicy, validityDays, changedPolicySections, noCurrentPolicy } from '../src/utils/eventPackagePolicyEditor.ts'
import { defaults, policy } from './fixtures/eventPackagePolicy.ts'
import type { PolicyEditorDefaults } from '../src/types/eventPackagePolicyAdmin.ts'

test('initialization copies server defaults, uses dry run and explicitly expects no current policy', () => {
  const draft = createPolicyDraft(defaults, undefined, undefined, new Date('2026-09-10T00:00:00Z'))
  assert.equal(draft.enforcementMode, 'dryRun')
  assert.equal(draft.expectedCurrentPolicyId, noCurrentPolicy)
  assert.equal(draft.sourcePolicyId, undefined)
  assert.equal((draft.rules as PolicyEditorDefaults['rules']).legacyRollout.transitionDeadlineUtc, '2026-12-09T00:00:00.000Z')
  assert.notEqual(draft.rules, defaults.rules)
})

test('restore retains rules, links source and current versions, and renews dates without mutating history', () => {
  const historical = policy({ retiredUtc: '2026-08-01T00:00:00Z' })
  const before = structuredClone(historical)
  const draft = createPolicyDraft(defaults, historical, policy({ id: 'current' }), new Date('2026-09-10T00:00:00Z'))
  assert.equal(draft.sourcePolicyId, 'old')
  assert.equal(draft.expectedCurrentPolicyId, 'current')
  assert.equal(draft.enforcementMode, 'enforced')
  assert.deepEqual(draft.rules.authorityByTier, historical.rules.authorityByTier)
  assert.deepEqual(historical, before)
  assert.notEqual(draft.version, historical.version)
})

test('current status considers published flag and both effective dates', () => {
  const now = Date.parse('2026-09-10T00:00:00Z')
  assert.equal(isCurrentPolicy(policy(), now), true)
  assert.equal(isCurrentPolicy(policy({ isPublished: false }), now), false)
  assert.equal(isCurrentPolicy(policy({ effectiveFromUtc: '2027-01-01T00:00:00Z' }), now), false)
  assert.equal(isCurrentPolicy(policy({ retiredUtc: '2026-09-10T00:00:00Z' }), now), false)
})

test('form round-trip retains known rules and independent nested values', () => {
  const copy = readPolicyRules(defaults.rules, defaults)
  assert.deepEqual(copy, defaults.rules)
  copy.tierRules[2].whenAnyConfirmedFactCodes.push('people.childrenPresent')
  assert.equal(defaults.rules.tierRules[2].whenAnyConfirmedFactCodes.length, 0)
  assert.deepEqual(changedPolicySections(defaults.rules, copy), ['tierRules'])
})

test('unsupported versions, nested fields, missing or retired triggers never silently convert', () => {
  for (const transform of [
    (r: PolicyEditorDefaults['rules']) => { r.schemaVersion = '2' as '1' },
    (r: PolicyEditorDefaults['rules']) => { r.unrecognized = true },
    (r: PolicyEditorDefaults['rules']) => { r.authorityByTier.light = { minimumApproverCount: 1, unknown: true } as { minimumApproverCount: number } },
    (r: PolicyEditorDefaults['rules']) => { r.tierRules[2].whenAnyConfirmedFactCodes = ['unknown'] },
    (r: PolicyEditorDefaults['rules']) => { r.tierRules.pop() },
  ]) {
    const rules = structuredClone(defaults.rules); transform(rules)
    assert.throws(() => readPolicyRules(rules, defaults))
  }
})

test('duration conversion preserves sub-day values and rejects invalid or zero duration', () => {
  assert.equal(validityDays('P1DT12H'), 1.5)
  assert.equal(validityDays('PT12H'), 0.5)
  assert.throws(() => validityDays('P0D'))
  assert.throws(() => validityDays('tomorrow'))
})
