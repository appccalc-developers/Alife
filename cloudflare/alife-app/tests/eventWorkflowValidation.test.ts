import assert from 'node:assert/strict'
import test from 'node:test'

import { validateRosterShift, validateVenueDraft } from '../src/utils/eventWorkflowValidation.ts'

const validVenue = {
  occurrenceRequired: true,
  occurrenceId: 'occurrence-1',
  occurrenceStartUtc: '2026-11-01T00:00:00.000Z',
  occurrenceEndUtc: '2026-11-01T04:00:00.000Z',
  venueSpaceId: 'space-1',
  purposeEn: 'Community lunch',
  purposeZh: '',
  startLocal: '2026-11-01T00:00:00.000Z',
  endLocal: '2026-11-01T04:00:00.000Z',
  attendeeCount: 80,
  spaceCapacity: 100,
}

test('venue draft accepts a complete request inside its occurrence', () => {
  assert.equal(validateVenueDraft(validVenue), null)
})

test('venue draft catches missing session, invalid ranges and capacity before the API call', () => {
  assert.equal(validateVenueDraft({ ...validVenue, occurrenceId: '' }), 'occurrenceRequired')
  assert.equal(validateVenueDraft({ ...validVenue, endLocal: validVenue.startLocal }), 'endBeforeStart')
  assert.equal(validateVenueDraft({ ...validVenue, startLocal: '2026-10-31T23:00:00.000Z' }), 'outsideOccurrence')
  assert.equal(validateVenueDraft({ ...validVenue, attendeeCount: 101 }), 'capacityExceeded')
})

const validShift = {
  roleKey: 'welcome-team',
  nameEn: 'Welcome team',
  nameZh: '接待组',
  startLocal: '2026-12-05T01:00:00.000Z',
  endLocal: '2026-12-05T02:00:00.000Z',
  requiredPeople: 2,
  eventStartUtc: '2026-12-05T01:00:00.000Z',
  eventEndUtc: '2026-12-05T05:00:00.000Z',
}

test('roster shift accepts a complete shift inside the event', () => {
  assert.equal(validateRosterShift(validShift), null)
})

test('roster shift catches missing identity, invalid ranges and out-of-event times', () => {
  assert.equal(validateRosterShift({ ...validShift, roleKey: '' }), 'roleRequired')
  assert.equal(validateRosterShift({ ...validShift, nameEn: '', nameZh: '' }), 'nameRequired')
  assert.equal(validateRosterShift({ ...validShift, endLocal: validShift.startLocal }), 'endBeforeStart')
  assert.equal(validateRosterShift({ ...validShift, endLocal: '2026-12-05T06:00:00.000Z' }), 'outsideEvent')
})
