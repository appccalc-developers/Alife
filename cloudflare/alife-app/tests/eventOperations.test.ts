import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatLocalOccurrenceTime,
  fromTwelveHourTimeParts,
  groupEventTasks,
  localTimeValue,
  localizeOperationsText,
  occurrenceLocalTimeToUtc,
  parseUtcInstant,
  rosterCoverage,
  selectOccurrenceId,
  toTwelveHourTimeParts,
} from '../src/utils/eventOperationsState.ts'
import type { EventTask } from '../src/types/eventOperations.ts'

const task = (id: string, status: EventTask['status']): EventTask => ({
  id, eventId: 'event', title: { en: id, zh: id }, description: { en: '', zh: '' }, status,
  isRequired: true, requiresApproval: false, isRestricted: false, eTag: `"${id}"`, dependencies: [], blockers: [],
})

test('task board groups each reachable status without losing tasks', () => {
  const tasks = [task('a', 'todo'), task('b', 'blocked'), task('c', 'done'), task('d', 'cancelled')]
  const grouped = groupEventTasks(tasks)
  assert.deepEqual(grouped.todo.map((value) => value.id), ['a'])
  assert.deepEqual(grouped.blocked.map((value) => value.id), ['b'])
  assert.equal(Object.values(grouped).flat().length, tasks.length)
})

test('occurrence selection preserves a valid choice and otherwise selects the first materialized occurrence', () => {
  const occurrences = [
    { id: 'one', eventId: 'event', startUtc: '', endUtc: '', localDate: '2026-08-26', status: 'scheduled', isLegacyBackfill: false },
    { id: 'two', eventId: 'event', startUtc: '', endUtc: '', localDate: '2026-09-02', status: 'scheduled', isLegacyBackfill: false },
  ]
  assert.equal(selectOccurrenceId(occurrences, 'two'), 'two')
  assert.equal(selectOccurrenceId(occurrences, 'missing'), 'one')
})

test('roster coverage and bilingual fallback remain deterministic', () => {
  assert.deepEqual(rosterCoverage({ confirmedCount: 1, requiredCount: 3 }), { complete: false, missing: 2, label: '1/3' })
  assert.equal(localizeOperationsText({ en: 'Team', zh: '團隊' }, 'zh'), '團隊')
  assert.equal(localizeOperationsText({ en: 'Team', zh: '' }, 'zh'), 'Team')
})

test('roster UTC values are normalized before local 12-hour presentation', () => {
  assert.equal(parseUtcInstant('2026-08-27T19:05:00').toISOString(), '2026-08-27T19:05:00.000Z')
  assert.match(formatLocalOccurrenceTime('2026-08-27T19:05:00Z', 'en', 'UTC'), /7:05\s*pm/i)
  assert.match(formatLocalOccurrenceTime('2026-08-27T19:05:00Z', 'zh', 'UTC'), /下午7:05/)
})

test('service-slot time controls round-trip midnight, noon and local occurrence time', () => {
  assert.deepEqual(toTwelveHourTimeParts('00:07'), { hour: '12', minute: '07', period: 'AM' })
  assert.deepEqual(toTwelveHourTimeParts('12:45'), { hour: '12', minute: '45', period: 'PM' })
  assert.equal(fromTwelveHourTimeParts({ hour: '12', minute: '07', period: 'AM' }), '00:07')
  assert.equal(fromTwelveHourTimeParts({ hour: '12', minute: '45', period: 'PM' }), '12:45')

  const occurrenceStart = '2026-08-27T19:05:00Z'
  assert.equal(
    occurrenceLocalTimeToUtc(occurrenceStart, localTimeValue(occurrenceStart)),
    '2026-08-27T19:05:00.000Z',
  )
  const overnightEnd = '2026-08-28T01:20:00Z'
  assert.equal(
    occurrenceLocalTimeToUtc(overnightEnd, localTimeValue(overnightEnd)),
    '2026-08-28T01:20:00.000Z',
  )
})
