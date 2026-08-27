import assert from 'node:assert/strict'
import test from 'node:test'
import { eventSurfaceRegistry, resolveEventSurface, resolveEventSurfacePath } from '../src/components/events/eventSurfaceRegistry.ts'
import { passengerCapacity, resolveTravelLoadFailure, resolveTravelMutationFailure, travelReadinessItems } from '../src/utils/eventTravelState.ts'

test('move.stay resolves only through the compile-time travel workspace contract', () => {
  assert.equal(resolveEventSurface('move.stay')?.componentContract, 'EventTravelWorkspace')
  assert.equal(eventSurfaceRegistry['move.stay'].presentation, 'page')
  assert.equal(resolveEventSurfacePath('travel')?.surfaceKey, 'move.stay')
  assert.equal(resolveEventSurface('move.stay/../../remote'), null)
})

test('travel readiness maps operational and RAM evidence deterministically', () => {
  assert.deepEqual(travelReadinessItems({
    transportFactsConfirmed: true,
    driversAndVehiclesQualified: false,
    passengerManifestsComplete: true,
    ramTransportChecksComplete: false,
    blockers: [],
  }), [
    { code: 'transport-and-stay-facts-confirmed', ready: false },
    { code: 'drivers-and-vehicles-qualified', ready: false },
    { code: 'manifests-and-night-roles-complete', ready: true },
  ])
})

test('passenger capacity flags full and exceeded manifests without passenger identities', () => {
  assert.deepEqual(passengerCapacity(4, 4), { count: 4, seats: 4, full: true, exceeded: false })
  assert.deepEqual(passengerCapacity(5, 4), { count: 5, seats: 4, full: true, exceeded: true })
  assert.deepEqual(passengerCapacity(2), { count: 2, seats: null, full: false, exceeded: false })
})

test('travel workspace maps permission, stale, conflict and generic failures explicitly', () => {
  assert.equal(resolveTravelLoadFailure(403), 'permission-denied')
  assert.equal(resolveTravelLoadFailure(500), 'error')
  assert.equal(resolveTravelMutationFailure(412), 'stale')
  assert.equal(resolveTravelMutationFailure(409), 'conflict')
  assert.equal(resolveTravelMutationFailure(422), 'error')
})
