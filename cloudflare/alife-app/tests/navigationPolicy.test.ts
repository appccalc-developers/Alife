import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAccessChurchManagement,
  churchManagementAdminPermissions,
  normalizeChurchManagementSection,
} from '../src/app/routing/churchManagementAccess.ts'
import { buildEventDetailPath, resolveEventBoundActionUrl } from '../src/utils/eventRoutes.ts'

test('church management access accepts church managers and each scoped platform permission', () => {
  assert.equal(canAccessChurchManagement({
    churchGroupId: 'church-id',
    canManageGroup: (groupId) => groupId === 'church-id',
    hasAdminPermission: () => false,
  }), true)

  for (const grantedPermission of churchManagementAdminPermissions) {
    assert.equal(canAccessChurchManagement({
      churchGroupId: 'church-id',
      canManageGroup: () => false,
      hasAdminPermission: (permission) => permission === grantedPermission,
    }), true)
  }
})

test('church management access rejects users without church leadership or scoped permission', () => {
  assert.equal(canAccessChurchManagement({
    churchGroupId: 'church-id',
    canManageGroup: () => false,
    hasAdminPermission: () => false,
  }), false)
})

test('church management routes exclude group-owned page and album sections', () => {
  assert.equal(normalizeChurchManagementSection('group'), 'group')
  assert.equal(normalizeChurchManagementSection('subgroups'), 'subgroups')
  assert.equal(normalizeChurchManagementSection('albums'), 'dashboard')
  assert.equal(normalizeChurchManagementSection('pages'), 'dashboard')
  assert.equal(normalizeChurchManagementSection(null), 'dashboard')
})

test('event detail routes encode group and event identifiers', () => {
  assert.equal(
    buildEventDetailPath('group / one', 'event?two'),
    '/groups/group%20%2F%20one/events/event%3Ftwo',
  )
})

test('event-bound actions replace only missing and legacy detail links', () => {
  const canonicalPath = '/groups/group-id/events/event-id'
  assert.equal(resolveEventBoundActionUrl('', 'group-id', 'event-id'), canonicalPath)
  assert.equal(resolveEventBoundActionUrl(' /events ', 'group-id', 'event-id'), canonicalPath)
  assert.equal(
    resolveEventBoundActionUrl('/custom/event-page', 'group-id', 'event-id'),
    '/custom/event-page',
  )
  assert.equal(
    resolveEventBoundActionUrl(' https://example.com/event ', 'group-id', 'event-id'),
    ' https://example.com/event ',
  )
})
