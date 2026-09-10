import test from 'node:test'
import assert from 'node:assert/strict'
import { detailCompletion, detailFields, localTimeToUtc, type EventDetailsForm, type DetailsResult } from '../../shared/eventDetails.ts'
import { initialCreationDraft, restoreCreationDraft, creationEvent, creationSeries } from '../src/utils/eventCreationDraft.ts'
import { applyDetailsResult, detailsSnapshot } from '../src/utils/eventDetailsAssistant.ts'
import type { EventActivityType, EventArchetype } from '../src/types/eventComposition.ts'

const form: EventDetailsForm = {
  title: { zh: 'ALIFE 进度讨论会', en: 'ALIFE progress meeting' }, description: { zh: '讨论进度', en: 'Discuss progress' }, locationName: { zh: '线上 MS Teams', en: 'Online MS Teams' },
  startLocal: '2026-09-19T13:30', endLocal: '2026-09-19T14:30', timeZone: 'Pacific/Auckland', visibility: 'groupVisible', registrationMode: 'none', maxCapacity: null, intervalWeeks: 2,
}
const type = { code: 'prayer-meeting', archetypeCode: 'recurring-gathering', defaults: { visibility: 'groupVisible', registrationMode: 'none' } } as EventActivityType
const category = { code: type.archetypeCode, isSeries: true, activityTypes: [type] } as EventArchetype
test('completion excludes inapplicable fields and unconfirmed defaults; scores cannot approve', () => {
  assert.equal(detailCompletion(form, {}, true).percent, 0)
  const sources = Object.fromEntries(detailFields.map(k => [k, 'human' as const]))
  assert.deepEqual(detailCompletion(form, sources, true), { completed: 9, total: 9, percent: 100, pending: [] })
  assert.equal(detailCompletion(form, sources, false).total, 8)
  assert.equal(detailCompletion({ ...form, registrationMode: 'required' }, sources, true).percent, 90)
  assert.ok(detailCompletion(form, { ...sources, startLocal: 'unresolved' }, true).pending.includes('startLocal'))
  assert.ok(detailCompletion({ ...form, title: { zh: '会议', en: '' } }, sources, true).pending.includes('title'))
})
test('Auckland wall-clock resolution is independent of browser zone and rejects DST gaps/folds', () => {
  assert.equal(localTimeToUtc(form.startLocal!, form.timeZone!), '2026-09-19T01:30:00.000Z')
  assert.equal(localTimeToUtc('2026-10-03T13:30', 'Pacific/Auckland'), '2026-10-03T00:30:00.000Z')
  assert.throws(() => localTimeToUtc('2026-09-27T02:30', 'Pacific/Auckland'), /Nonexistent/)
  assert.throws(() => localTimeToUtc('2026-04-05T02:30', 'Pacific/Auckland'), /Ambiguous/)
  assert.throws(() => localTimeToUtc('2026-02-30T12:00', 'Pacific/Auckland'), /Invalid/)
  assert.throws(() => localTimeToUtc('2026-09-19T13:30', 'made-up'), /Invalid/)
})
test('newest snapshot and complete field adoption preserve composition choices', () => {
  const draft = { ...initialCreationDraft(), archetypeCode: type.archetypeCode, activityTypeCode: type.code, factValues: { 'safety.requiresRam': 'no' as const } }
  const result = { form, sources: { title: 'explicit', startLocal: 'explicit' }, adoptedFields: [...detailFields] } as DetailsResult
  const filled = applyDetailsResult(draft, result)
  assert.equal(filled.startLocal, '2026-09-19T13:30')
  assert.equal(filled.intervalWeeks, '2')
  assert.deepEqual(filled.factValues, draft.factValues)
  assert.equal(filled.activityTypeCode, draft.activityTypeCode)
  const edited = { ...filled, title: { zh: '手动更正', en: 'Manual edit' } }
  assert.equal(detailsSnapshot(edited, type, true, 4).form.title.en, 'Manual edit')
  const event = creationEvent(filled, type, 'Leader')
  assert.equal(event.startDate, '2026-09-19T01:30:00.000Z')
  assert.equal(event.endDate, '2026-09-19T02:30:00.000Z')
  assert.equal(creationSeries(filled, category)?.recurrenceRule, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA')
  assert.equal(creationSeries(filled, category)?.rollingOccurrenceWeeks, 12)
  assert.equal(creationSeries(filled, category)?.durationMinutes, 60)
})
test('v2 drafts preserve data with unconfirmed sources; v3 preserves explicit clears', () => {
  const draft = { ...initialCreationDraft(), title: form.title, startLocal: form.startLocal!, intervalWeeks: '2', detailSources: { title: 'human' as const } }
  const restored = restoreCreationDraft(JSON.stringify({ version: 2, draft }), [])!
  assert.deepEqual(restored.title, draft.title)
  assert.equal(restored.startLocal, draft.startLocal)
  assert.equal(restored.intervalWeeks, '1')
  assert.deepEqual(restored.detailSources, {})
  assert.deepEqual(restoreCreationDraft(JSON.stringify({ version: 3, draft }), []), draft)
  const cleared = applyDetailsResult(draft, { form: { ...form, title: { zh: '', en: '' }, startLocal: null }, sources: {}, adoptedFields: ['title', 'startLocal'] } as DetailsResult)
  assert.equal(cleared.startLocal, '')
  assert.deepEqual(cleared.title, { zh: '', en: '' })
})
