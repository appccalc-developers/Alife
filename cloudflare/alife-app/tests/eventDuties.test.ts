import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCurrentTasks, localizeNotificationText } from '../src/utils/currentTasks.ts'
import { selectTaskPage } from '../src/utils/taskList.ts'
import { dutyReturnPath, withDutyReturn } from '../src/utils/eventDutyNavigation.ts'

test('business duties preserve version, account-bound identity and bilingual action metadata', () => {
  const [task] = normalizeCurrentTasks([{ id: 'source', taskKey: 'version:actor', sourceVersion: 'v2', sourceType: 'eventTask', sourceId: 'source', eventId: 'event', groupId: 'group', occurrenceId: 'occurrence', dueUtc: '2026-10-01T00:00:00Z', category: 'urgent', completionMode: 'workflow', actionLabel: { en: 'Review', zh: '审核' }, actionDataJson: JSON.stringify({ title: { en: 'Review: Event', zh: '审核：活动' }, eventTitle: { en: 'Event', zh: '活动' } }) }])
  assert.equal(task.taskKey, 'version:actor'); assert.equal(task.sourceVersion, 'v2'); assert.equal(task.completionMode, 'workflow')
  assert.equal(task.occurrenceId, 'occurrence'); assert.equal(localizeNotificationText(task.eventTitle, 'zh'), '活动')
  assert.equal(localizeNotificationText(task.actionLabel, 'en'), 'Review')
})

test('filters and stable pagination show at most twenty tasks with earliest deadlines first', () => {
  const tasks = Array.from({ length: 46 }, (_, i) => ({ id: String(i), title: `Task ${i}`, category: 'urgent' as const, eventId: i < 45 ? 'a' : 'b', sourceType: 'eventTask', dueUtc: new Date(Date.UTC(2026, 9, i + 1)).toISOString(), createdUtc: '2026-09-01T00:00:00Z' }))
  const first = selectTaskPage(tasks, { category: 'urgent', eventId: 'a' })
  assert.equal(first.total, 45); assert.equal(first.pages, 3); assert.equal(first.items.length, 20); assert.equal(first.items[0].id, '0')
  const last = selectTaskPage(tasks, { category: 'urgent', eventId: 'a', page: 99 })
  assert.equal(last.page, 3); assert.equal(last.items.length, 5)
  assert.equal(selectTaskPage(tasks, { category: 'urgent', sourceType: 'ramRevision' }).items.length, 0)
  assert.equal(selectTaskPage(tasks, { category: 'general', page: NaN }).page, 1)
})

test('return links preserve filters and page without allowing external destinations', () => {
  const returnTo = '/tasks?type=urgent&event=one&source=eventTask&sort=due&page=2'
  const url = new URL(withDutyReturn('/events/one/duties/eventTask/two?taskKey=current', returnTo), 'https://alife.test')
  assert.equal(url.searchParams.get('taskKey'), 'current'); assert.equal(url.searchParams.get('returnTo'), returnTo)
  assert.equal(dutyReturnPath('/profile'), '/profile')
  for (const input of ['https://evil.test', '//evil.test', '/tasks/elsewhere', '/tasks#script', '/profile?next=https://evil.test']) assert.equal(dutyReturnPath(input), '/tasks?type=urgent')
})
