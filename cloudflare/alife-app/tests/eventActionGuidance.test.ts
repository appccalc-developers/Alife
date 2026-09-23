import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventDelegations, futureDelegationExpiry, gateStateLabel, groupGateIssues, knownPreparationArea, packageStatusLabel } from '../src/utils/eventActionGuidance.ts'
import type { EventLifecycle, EventPackageApprovalDelegation } from '../src/types/eventPackage.ts'

const gate = (name = 'publish', reason = 'packageNotApproved') => ({ gate: name, enforcementMode: 'dryRun', scopeType: 'event', allowed: true, requirementsSatisfied: false, evaluatedUtc: '', eventPackageVersion: 1, governancePolicyVersion: '1', blockers: [{ code: `event.${name}.${reason}`, nextAction: 'event.package.decide', responsibleRole: 'package.approver', message: { en: 'Needs approval', zh: '待审批' } }], warnings: [] }) as EventLifecycle['gates'][number]
test('same approval evidence across gates appears once; aliases do not create duplicate tasks', () => {
  const issues = groupGateIssues([gate(), gate('publish', 'approvalDecisionMissing'), gate('registration')])
  assert.equal(issues.length, 1)
  assert.deepEqual(issues[0].gates, ['publish', 'registration'])
})
test('different occurrence, policy, evidence and messages are never merged', () => {
  assert.equal(groupGateIssues([gate(), { ...gate(), scopeType: 'occurrence', scopeId: 'one' }, { ...gate(), eventPackageVersion: 2 }, { ...gate(), governancePolicyVersion: '2' }]).length, 4)
  const other = gate(); other.blockers[0].message.en = 'A different requirement'
  assert.equal(groupGateIssues([gate(), other]).length, 2)
})
test('trial diagnostics never claim approval and never mask a server denial', () => {
  assert.match(gateStateLabel(gate(), true), /试运行/)
  assert.equal(gateStateLabel({ ...gate(), allowed: false }, true), '暂不可操作')
  assert.equal(gateStateLabel({ ...gate(), requirementsSatisfied: true, allowed: false }, false), 'Not available')
})
test('warnings remain available and do not erase blockers', () => {
  const first = gate(); first.warnings = first.blockers; first.blockers = []
  assert.equal(groupGateIssues([first])[0].warningsOnly, true)
  assert.equal(groupGateIssues([first, gate()])[0].warningsOnly, false)
})
test('only allowlisted modules can become editing links', () => {
  assert.equal(knownPreparationArea('safety.ram'), true)
  assert.equal(knownPreparationArea('https://evil.invalid'), false)
  assert.equal(knownPreparationArea('__proto__'), false)
  assert.equal(packageStatusLabel('newUnknownState', true), '状态待核对')
})
test('delegation list cannot revoke another event or an organisation-wide grant', () => {
  const now = Date.parse('2026-09-22T00:00:00Z')
  const base = { scopeType: 'event', scopeId: 'ours', expiresUtc: '2026-10-01T00:00:00Z' } as EventPackageApprovalDelegation
  assert.deepEqual(eventDelegations([base, { ...base, scopeId: 'other' }, { ...base, scopeType: 'organisation' }, { ...base, revokedUtc: '2026-09-21T00:00:00Z' }, { ...base, expiresUtc: '2026-09-20T00:00:00Z' }], 'ours', now), [base])
})
test('delegation expiry rejects empty, invalid and past values', () => {
  const now = Date.parse('2026-09-22T00:00:00Z')
  for (const value of ['', 'bad', '2026-09-21T00:00:00Z']) assert.equal(futureDelegationExpiry(value, now), false)
  assert.equal(futureDelegationExpiry('2026-09-23T00:00:00Z', now), true)
})
