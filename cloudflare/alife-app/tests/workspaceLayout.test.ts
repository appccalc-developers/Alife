import assert from 'node:assert/strict'
import test from 'node:test'
import { PERSONAL_CENTER_PATH, PROFILE_SETTINGS_PATH } from '../src/app/routing/personalCenterRoutes.ts'
import { getWorkspaceArea } from '../src/app/routing/workspaceArea.ts'
import {
  PERSONAL_CENTER_TASK_LIMIT,
  getPersonalCenterPrimaryAction,
  selectPersonalCenterTasks,
} from '../src/utils/personalCenter.ts'
import type { AppNotification } from '../src/types/notification.ts'

test('workspace theme routes isolate system management from member pages', () => {
  assert.equal(getWorkspaceArea('/admin'), 'system')
  assert.equal(getWorkspaceArea('/admin/groups/group-id'), 'system')
  assert.equal(getWorkspaceArea('/church/manage'), 'member')
  assert.equal(getWorkspaceArea('/groups/manage'), 'member')
  assert.equal(getWorkspaceArea('/profile/settings'), 'member')
})

test('personal center keeps the overview route and gives profile settings a dedicated route', () => {
  assert.equal(PERSONAL_CENTER_PATH, '/profile')
  assert.equal(PROFILE_SETTINGS_PATH, '/profile/settings')
})

test('personal center primary action follows task and reading priority', () => {
  assert.equal(getPersonalCenterPrimaryAction({ urgentCount: 1, generalCount: 3, hasReadingProgress: true }), 'urgent')
  assert.equal(getPersonalCenterPrimaryAction({ urgentCount: 0, generalCount: 3, hasReadingProgress: true }), 'general')
  assert.equal(getPersonalCenterPrimaryAction({ urgentCount: 0, generalCount: 0, hasReadingProgress: true }), 'continue-study')
  assert.equal(getPersonalCenterPrimaryAction({ urgentCount: 0, generalCount: 0, hasReadingProgress: false }), 'start-study')
})

test('personal center shows at most three tasks with urgent work first', () => {
  const task = (id: string, category: 'urgent' | 'general', createdUtc: string): AppNotification => ({
    id,
    title: id,
    category,
    completionMode: 'read',
    createdUtc,
  })
  const selected = selectPersonalCenterTasks([
    task('general-new', 'general', '2026-09-04T10:00:00Z'),
    task('urgent-old', 'urgent', '2026-09-01T10:00:00Z'),
    task('urgent-new', 'urgent', '2026-09-03T10:00:00Z'),
    task('general-old', 'general', '2026-08-01T10:00:00Z'),
  ])

  assert.equal(selected.length, PERSONAL_CENTER_TASK_LIMIT)
  assert.deepEqual(selected.map((item) => item.id), ['urgent-new', 'urgent-old', 'general-new'])
})
