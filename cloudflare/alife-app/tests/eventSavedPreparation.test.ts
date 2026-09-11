import assert from 'node:assert/strict'
import test from 'node:test'
import { arrangementSignature, detailSignature, savedArrangementDraft, savedCreationDraft, type SavedArrangements } from '../src/utils/eventSavedPreparation.ts'
import type { GroupEventRecord } from '../src/types/event.ts'
import type { EventPlanSnapshot } from '../src/types/eventComposition.ts'

test('saved creation form preserves bilingual copy, timezone and explicit No selections', () => {
  const record = { titleEn: 'Meal', titleZh: '聚餐', startDate: '2026-09-27T01:00:00Z', endDate: '2026-09-27T03:00:00Z', visibility: 'churchVisible',
    eventDataJson: JSON.stringify({ timeZone: 'Pacific/Auckland', maxCapacity: 15, description: { en: 'Together', zh: '相聚' } }) } as GroupEventRecord
  const plan = { plan: { archetypeCode: 'simple-social', activityTypeCode: 'shared-meal', moduleDecisions: [{ moduleCode: 'TEAM.WORK', status: 'inactive' }, { moduleCode: 'SERVICE.ROSTER', status: 'required' }], facts: { items: [{ code: 'people.childrenPresent', value: true, certainty: 'candidate' }] } } } as EventPlanSnapshot
  const draft = savedCreationDraft(record, plan)
  assert.deepEqual(draft.title, { en: 'Meal', zh: '聚餐' })
  assert.equal(draft.startLocal, '2026-09-27T14:00')
  assert.equal(draft.moduleOverrides['TEAM.WORK'], false)
  assert.equal(draft.moduleOverrides['SERVICE.ROSTER'], true)
  assert.equal(draft.factValues['people.childrenPresent'], 'unknown')
  assert.equal(draft.aiCandidateFacts['people.childrenPresent'], true)
  assert.notEqual(detailSignature(draft), detailSignature({ ...draft, intervalWeeks: '2' }))
})

test('saved arrangements restore persisted row identities and ignore catalogue-only refreshes for dirty detection', () => {
  const data: SavedArrangements = { occurrenceId: 'o', startUtc: '2026-09-27T01:00:00Z', endUtc: '2026-09-27T03:00:00Z', eTag: 'tag',
    serviceSlots: [{ id: 'slot', details: { roleCode: 'welcome', requiredCount: 2, eligibilityCode: 'approvedGroupMember', startOffsetMinutes: -15, endOffsetMinutes: 120 } }], sessions: [],
    venueBookings: [{ id: 'booking', details: { venueId: 'venue', venueETag: 'v1', requiredCapacity: 20, startOffsetMinutes: 0, endOffsetMinutes: 120 }, venue: { name: { en: 'Hall', zh: '礼堂' }, capacity: 50 } }] }
  const arrangements = savedArrangementDraft(data, 'Pacific/Auckland')
  assert.equal(arrangements.slots![0].id, 'slot'); assert.equal(arrangements.slots![0].startLocal, '2026-09-27T13:45')
  assert.equal(arrangements.venues![0].id, 'booking')
  assert.equal(arrangements.venues![0].capacity, '50')
  const draft = savedCreationDraft({ titleEn: '', titleZh: '', startDate: data.startUtc, endDate: data.endUtc, eventDataJson: '{}' } as GroupEventRecord, null)
  draft.arrangements = arrangements
  const signature = arrangementSignature(draft)
  arrangements.venues![0].venueETag = 'v2'; arrangements.venues![0].capacity = '50'; arrangements.venues![0].name = { en: 'Hall', zh: '礼堂' }
  assert.equal(arrangementSignature(draft), signature)
  arrangements.slots![0].requiredCount = '3'
  assert.notEqual(arrangementSignature(draft), signature)
})
