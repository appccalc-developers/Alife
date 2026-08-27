import assert from 'node:assert/strict'
import test from 'node:test'
import { eventSurfaceRegistry, resolveEventSurface, resolveEventSurfacePath } from '../src/components/events/eventSurfaceRegistry.ts'
import {
  filterSafeguardingChildren,
  resolveSafeguardingLoadFailure,
  resolveSafeguardingMutationFailure,
  safeguardingChildState,
  safeguardingReadinessItems,
} from '../src/utils/eventSafeguardingState.ts'
import type { EventSafeguardingChild } from '../src/types/eventSafeguarding.ts'

const child = (name: string, state?: 'present' | 'checkedOut'): EventSafeguardingChild => ({
  id: crypto.randomUUID(), enrollmentId: '', childMemberId: '', displayName: name,
  consentCurrent: true, authorisedCollectionComplete: true, guardians: [], authorisedCollectors: [],
  attendance: state ? { id: crypto.randomUUID(), eventOccurrenceId: crypto.randomUUID(), state,
    checkedInUtc: '2026-10-18T09:00:00Z', eTag: '"attendance"' } : null,
  eTag: '"child"',
})

test('safeguarding.child resolves only through the compile-time workspace contract', () => {
  assert.equal(resolveEventSurface('safeguarding.child')?.componentContract, 'EventSafeguardingWorkspace')
  assert.equal(eventSurfaceRegistry['safeguarding.child'].presentation, 'page')
  assert.equal(resolveEventSurfacePath('safeguarding')?.surfaceKey, 'safeguarding.child')
  assert.equal(resolveEventSurface('safeguarding.child/../../remote'), null)
})

test('safeguarding readiness maps exact policy-backed rules', () => {
  assert.deepEqual(safeguardingReadinessItems({
    currentPolicyLoaded: true, guardianshipComplete: false, eligibleWorkersSatisfied: true,
    blockers: [], checkedUtc: '2026-10-18T09:00:00Z',
  }), [
    { code: 'current-policy-loaded', ready: true },
    { code: 'guardianship-complete', ready: false },
    { code: 'eligible-workers-and-policy-ratios-satisfied', ready: true },
  ])
})

test('fast lookup and occurrence state are deterministic in both languages', () => {
  const children = [child('Alice Wong'), child('王小明', 'present'), child('Bob', 'checkedOut')]
  assert.deepEqual(filterSafeguardingChildren(children, 'alice').map((x) => x.displayName), ['Alice Wong'])
  assert.deepEqual(filterSafeguardingChildren(children, '小明').map((x) => x.displayName), ['王小明'])
  assert.equal(safeguardingChildState(children[0]), 'not-checked-in')
  assert.equal(safeguardingChildState(children[1]), 'present')
  assert.equal(safeguardingChildState(children[2]), 'checked-out')
})

test('safeguarding workspace maps permission, stale, conflict and generic failures', () => {
  assert.equal(resolveSafeguardingLoadFailure(403), 'permission-denied')
  assert.equal(resolveSafeguardingLoadFailure(500), 'error')
  assert.equal(resolveSafeguardingMutationFailure(412), 'stale')
  assert.equal(resolveSafeguardingMutationFailure(409), 'conflict')
  assert.equal(resolveSafeguardingMutationFailure(422), 'error')
})
