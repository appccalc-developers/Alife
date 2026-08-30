import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countCurrentTasks,
  formatTaskCount,
  localizeNotificationText,
  normalizeCurrentTasks,
  normalizeNotificationActionUrl,
} from '../src/utils/currentTasks.ts'

test('current task payloads preserve backend category and safe detail fields', () => {
  const tasks = normalizeCurrentTasks([
    {
      id: 'urgent-id',
      actionType: 'visitor.contact.requested',
      actionDataJson: JSON.stringify({
        title: { en: 'Visitor request', zh: '访客请求' },
        body: { en: 'Please follow up', zh: '请跟进' },
        displayName: 'Alex',
        email: 'alex@example.com',
        message: 'I would like to visit.',
        ipAddress: 'must-not-be-exposed',
      }),
      occurredUtc: '2026-08-18T10:00:00Z',
      category: 'urgent',
      completionMode: 'workflow',
      actionUrl: '/admin/visit-requests',
    },
    {
      id: 'general-id',
      actionType: 'announcement.published',
      actionDataJson: JSON.stringify({ title: { en: 'News', zh: '消息' } }),
      occurredUtc: '2026-08-17T10:00:00Z',
      category: 'general',
      completionMode: 'read',
    },
    {
      id: 'application-id',
      actionType: 'membership.application',
      actionDataJson: JSON.stringify({
        title: { en: 'Application needs information', zh: '申请需要补充资料' },
        sourceType: 'membershipApplication',
        sourceId: 'application-id',
      }),
      occurredUtc: '2026-08-19T10:00:00Z',
      category: 'urgent',
      completionMode: 'workflow',
      sourceType: 'membershipApplication',
      sourceId: 'application-id',
    },
  ])

  assert.equal(tasks.length, 3)
  assert.equal(tasks[0].id, 'application-id')
  assert.equal(tasks[0].sourceType, 'membershipApplication')
  assert.equal(tasks[0].sourceId, 'application-id')
  const visitorTask = tasks.find((task) => task.id === 'urgent-id')
  assert.equal(visitorTask?.category, 'urgent')
  assert.deepEqual(visitorTask?.details, {
    displayName: 'Alex',
    email: 'alex@example.com',
    message: 'I would like to visit.',
  })
  assert.equal('ipAddress' in (visitorTask?.details ?? {}), false)
  assert.deepEqual(countCurrentTasks(tasks), { urgent: 2, general: 1 })
})

test('current task normalization never infers a missing category in the browser', () => {
  assert.deepEqual(normalizeCurrentTasks([{
    id: 'missing-category',
    actionType: 'group.join-request.received',
    actionDataJson: '{}',
    completionMode: 'workflow',
  }]), [])
})

test('task presentation uses bilingual fallback and normalized routes', () => {
  assert.equal(localizeNotificationText({ en: 'English', zh: '中文' }, 'zh'), '中文')
  assert.equal(localizeNotificationText({ en: 'English', zh: '' }, 'zh'), 'English')
  assert.equal(normalizeNotificationActionUrl('groups/id/manage?section=members'), '/groups/id/manage?section=members')
  assert.equal(normalizeNotificationActionUrl(' https://example.com/task '), 'https://example.com/task')
  assert.equal(formatTaskCount(0), '0')
  assert.equal(formatTaskCount(120), '99+')
})
