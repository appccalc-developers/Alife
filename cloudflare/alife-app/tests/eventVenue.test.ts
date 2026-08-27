import assert from 'node:assert/strict'
import test from 'node:test'
import { eventSurfaceRegistry, resolveEventSurface } from '../src/components/events/eventSurfaceRegistry.ts'
import { intervalsOverlap, venueCapacityLabel, venueReadinessItems } from '../src/utils/eventVenueState.ts'

test('place.resource resolves only through the compile-time venue workspace contract', () => {
  assert.equal(resolveEventSurface('place.resource')?.componentContract, 'EventVenueWorkspaceSurface')
  assert.equal(eventSurfaceRegistry['place.resource'].presentation, 'tab')
  assert.equal(resolveEventSurface('place.resource/../../remote'), null)
})

test('venue overlap uses half-open intervals so touching boundaries remain available', () => {
  assert.equal(intervalsOverlap('2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', '2026-09-01T10:30:00Z', '2026-09-01T11:30:00Z'), true)
  assert.equal(intervalsOverlap('2026-09-01T10:00:00Z', '2026-09-01T11:00:00Z', '2026-09-01T11:00:00Z', '2026-09-01T12:00:00Z'), false)
})

test('venue capacity and readiness presentation stay deterministic and language-neutral', () => {
  assert.equal(venueCapacityLabel(18, 20), '18/20')
  assert.deepEqual(venueReadinessItems({ capacitySufficient: true, bookingsConfirmed: false, conflictsResolved: true }), [
    { code: 'capacity-sufficient', ready: true },
    { code: 'bookings-confirmed', ready: false },
    { code: 'conflicts-resolved', ready: true },
  ])
})
