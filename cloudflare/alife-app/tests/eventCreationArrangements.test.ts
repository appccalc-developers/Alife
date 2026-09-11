import assert from 'node:assert/strict'
import test from 'node:test'
import type { EventActivityType, EventArchetype, EventPlanProposal } from '../src/types/eventComposition.ts'
import { initialCreationDraft, composeCreationDraft, selectCreationTemplate, changeOptionalModule, restoreCreationDraft } from '../src/utils/eventCreationDraft.ts'
import { arrangementTiming, creationArrangements, creationSlots, validateCreationArrangements, validStoredArrangements } from '../src/utils/eventCreationArrangements.ts'

const text = { en: 'Welcome', zh: '欢迎' }
const type: EventActivityType = { code: 'shared-meal', version: 2, archetypeCode: 'simple-social', name: text, description: text, iconKey: 'meal',
  defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: ['SERVICE.ROSTER'],
  presetServiceSlots: [{ roleCode: 'welcome', label: text, requiredCount: 2, eligibilityCode: 'approvedGroupMember' }] }
const proposal = (enabled = true) => ({ moduleDecisions: ['SERVICE.ROSTER', 'PROGRAM.PRODUCTION', 'PLACE.RESOURCE'].map(moduleCode => ({ moduleCode, status: enabled ? 'selected' : 'inactive' })) }) as EventPlanProposal
const draft = () => {
  const value = { ...selectCreationTemplate(initialCreationDraft(), type), title: text, startLocal: '2026-09-27T01:00', endLocal: '2026-09-27T04:00', timeZone: 'Pacific/Auckland' }
  const timing = { id: 'row', startLocal: value.startLocal, endLocal: value.endLocal }
  return { ...value, arrangements: {
    slots: creationSlots(value, type),
    sessions: [{ ...timing, title: text, items: [{ id: 'item', title: text, description: { en: '', zh: '' }, startOffsetMinutes: '10', durationMinutes: '20' }] }],
    venues: [{ ...timing, venueId: '', venueETag: '', name: text, address: text, capacity: '50', requiredCapacity: '30' }],
  } }
}

test('arrangements use elapsed time in the event zone, including a DST jump', () => {
  const value = draft()
  assert.deepEqual(arrangementTiming(value, value.arrangements.slots[0]), { startOffsetMinutes: 0, endOffsetMinutes: 120 })
  assert.equal(validateCreationArrangements(value, type, proposal(), false), '')
  const result = creationArrangements(value, type, proposal())
  assert.equal(result.serviceSlots![0].requiredCount, 2)
  assert.equal(result.sessions![0].items[0].durationMinutes, 20)
  assert.equal(result.venueBookings![0].newVenue!.capacity, 50)
})

test('disabled modules omit all operational rows without destroying the draft or confirming facts', () => {
  const value = draft(), before = composeCreationDraft(value, type)
  const off = changeOptionalModule(value, proposal().moduleDecisions[0], false)
  assert.deepEqual(off.arrangements, value.arrangements)
  assert.deepEqual(creationArrangements(value, type, proposal(false)), { serviceSlots: [], sessions: [], venueBookings: [] })
  assert.deepEqual(composeCreationDraft(off, type).facts, before.facts)
  assert.deepEqual(selectCreationTemplate(value, { ...type, code: 'another' }).arrangements, value.arrangements)
  assert.equal(creationArrangements(value, type, proposal()).sessions!.length, 1)
})

test('only unedited slots follow template defaults; edits invalidate review without recomposing', () => {
  const value = draft(), before = composeCreationDraft(value, type)
  value.arrangements.slots[0].requiredCount = '4'
  assert.equal(creationSlots(value, { ...type, presetServiceSlots: [] })[0].requiredCount, '4')
  assert.deepEqual(composeCreationDraft(value, type), before)
  assert.notEqual(JSON.stringify(value), JSON.stringify(draft()))
})

test('invalid or incomplete demand, programme and capacity cannot leave Arrangements', () => {
  for (const mutate of [
    (v: ReturnType<typeof draft>) => { v.arrangements.slots[0].requiredCount = '0' },
    (v: ReturnType<typeof draft>) => { v.arrangements.slots[0].endLocal = v.startLocal },
    (v: ReturnType<typeof draft>) => { v.arrangements.sessions[0].items = [] },
    (v: ReturnType<typeof draft>) => { v.arrangements.sessions[0].items[0].title = { en: 'English only', zh: '' } },
    (v: ReturnType<typeof draft>) => { v.arrangements.sessions[0].items[0].durationMinutes = '111' },
    (v: ReturnType<typeof draft>) => { v.arrangements.sessions[0].items[0].description.en = 'x'.repeat(2001) },
    (v: ReturnType<typeof draft>) => { v.arrangements.venues[0].requiredCapacity = '51' },
    (v: ReturnType<typeof draft>) => { v.arrangements.venues[0].venueId = 'existing' },
  ]) {
    const value = draft(); mutate(value)
    assert.notEqual(validateCreationArrangements(value, type, proposal(), true), '')
    assert.equal(validateCreationArrangements(value, type, proposal(false), true), '')
  }
})

test('existing venues use their ETag and reject local overlaps but allow touching times', () => {
  const value = draft(), venue = value.arrangements.venues[0]
  venue.venueId = 'venue'; venue.venueETag = '"venue-version"'; venue.endLocal = '2026-09-27T03:30'
  value.arrangements.venues.push({ ...venue, id: 'second' })
  assert.match(validateCreationArrangements(value, type, proposal(), false), /cannot overlap/)
  value.arrangements.venues[1].startLocal = venue.endLocal
  value.arrangements.venues[1].endLocal = '2026-09-27T04:00'
  assert.equal(validateCreationArrangements(value, type, proposal(), false), '')
  const sent = creationArrangements(value, type, proposal()).venueBookings![0]
  assert.equal(sent.newVenue, null); assert.equal(sent.venueETag, '"venue-version"')
})

test('draft recovery accepts incomplete edits but rejects malformed nested arrangements', () => {
  const value = draft(); value.arrangements.venues[0].capacity = ''
  assert.equal(validStoredArrangements(value.arrangements), true)
  assert.equal(validStoredArrangements({ sessions: [null] }), false)
  assert.equal(validStoredArrangements({ slots: [{ id: 5 }] }), false)
  assert.equal(validStoredArrangements({ venues: 'invalid' }), false)
  assert.equal(validStoredArrangements({}), true)
  const saved = JSON.stringify({ version: 3, savedUtc: new Date().toISOString(), draft: value })
  const catalogue = [{ code: 'simple-social', activityTypes: [type] }] as EventArchetype[]
  assert.deepEqual(restoreCreationDraft(saved, catalogue)?.arrangements, value.arrangements)
})
