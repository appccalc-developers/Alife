import { explicitLocalRange } from '../../shared/eventDetailsTime.ts'
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
  const draft = { ...initialCreationDraft(), timeZone: form.timeZone!, archetypeCode: type.archetypeCode, activityTypeCode: type.code, factValues: { 'safety.requiresRam': 'no' as const } }
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
  const draft = { ...initialCreationDraft(), timeZone: form.timeZone!, title: form.title, startLocal: form.startLocal!, intervalWeeks: '2', detailSources: { title: 'human' as const } }
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

test('explicit Auckland September afternoon range replaces defaults without device-zone conversion', () => {
  for (const message of ['9月19日下午的1点到下午4点', '九月十九日下午一点到四点', '2026-09-19 13:00 to 16:00']) {
    const range = explicitLocalRange(message, 'Pacific/Auckland', new Date('2026-09-11T23:30:00Z'))!
    assert.equal(range.startLocal, '2026-09-19T13:00')
    assert.equal(range.endLocal, '2026-09-19T16:00')
    assert.equal(localTimeToUtc(range.startLocal, 'Pacific/Auckland'), '2026-09-19T01:00:00.000Z')
    assert.equal(localTimeToUtc(range.endLocal, 'Pacific/Auckland'), '2026-09-19T04:00:00.000Z')
  }
  for (const message of ['9月19日1点到4点', '如果9月19日下午1点到4点', '不是9月19日下午1点到4点', '2026-09-27 02:30 to 04:00', '2026-04-05 02:30 to 04:00', '下个周六下午1点到4点']) {
    assert.equal(explicitLocalRange(message, 'Pacific/Auckland'), null, message)
  }
})

test('time-only corrections retain the event date and explicit local clock, without guessing a date', () => {
  for (const message of ['改为早上八点到下午四点', 'Change to 8am to 4pm', 'Change to 08:00 to 16:00']) {
    assert.deepEqual(explicitLocalRange(message, 'Australia/Perth', undefined, '2026-12-06T10:00'), {
      startLocal: '2026-12-06T08:00', endLocal: '2026-12-06T16:00', evidence: message,
    })
    assert.equal(explicitLocalRange(message, 'Australia/Perth'), null)
  }
  for (const message of ['明天早上八点到下午四点', 'next Sunday 8am to 4pm', '八点到四点'])
    assert.equal(explicitLocalRange(message, 'Australia/Perth', undefined, '2026-12-06T10:00'), null)
})

test('AI time adoption validates the entire tuple before mutating any draft fields', () => {
  const draft = { ...initialCreationDraft(), timeZone: 'Australia/Perth', startLocal: '2026-12-06T10:00', endLocal: '2026-12-06T20:00' }
  const result = { form: { ...form, timeZone: draft.timeZone, startLocal: '2026-12-06T08:00', endLocal: '2026-12-06T16:00' }, sources: {}, adoptedFields: ['startLocal', 'endLocal'] } as DetailsResult
  const original = structuredClone(draft)
  const applied = applyDetailsResult(draft, result)
  assert.equal(creationEvent(applied, type, 'Leader').startDate, '2026-12-06T00:00:00.000Z')
  assert.equal(creationEvent(applied, type, 'Leader').endDate, '2026-12-06T08:00:00.000Z')
  for (const changes of [{ timeZone: null }, { timeZone: 'UTC' }, { timeZone: 'bad-zone' }, { startLocal: '2026-12-06T08:00+08:00' }, { endLocal: '2026-12-06T07:00' }]) {
    assert.throws(() => applyDetailsResult(draft, { ...result, form: { ...result.form, ...changes } }), /Invalid AI time/)
    assert.deepEqual(draft, original)
  }
  const zoned = { ...result, form: { ...result.form, timeZone: 'Pacific/Auckland' }, adoptedFields: [...result.adoptedFields, 'timeZone'], fieldAssessments: [{ field: 'timeZone', status: 'explicit', evidence: 'Pacific/Auckland' }] } as DetailsResult
  assert.throws(() => applyDetailsResult(draft, zoned), /Invalid AI time/)
  assert.equal(applyDetailsResult(draft, zoned, 'Use Pacific/Auckland').timeZone, 'Pacific/Auckland')
  for (const startLocal of ['2026-09-27T02:30', '2026-04-05T02:30']) {
    assert.throws(() => applyDetailsResult(draft, { ...zoned, form: { ...zoned.form, startLocal, endLocal: `${startLocal.slice(0, 10)}T04:00` } }, 'Use Pacific/Auckland'), /Invalid AI time/)
  }
})
