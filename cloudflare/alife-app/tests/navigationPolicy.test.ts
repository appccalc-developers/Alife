import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAccessChurchManagement,
  churchManagementAdminPermissions,
  normalizeChurchManagementSection,
} from '../src/app/routing/churchManagementAccess.ts'
import {
  buildCurrentGroupEventPath,
  buildEventDetailPath,
  buildScopedEventDetailPath,
  resolveEventBoundActionUrl,
} from '../src/utils/eventRoutes.ts'
import { getRouteTransitionKey, isForumFeedPath } from '../src/app/routing/routeTransitionPolicy.ts'
import { isHomeLocation } from '../src/app/routing/publicRoutePolicy.ts'
import { normalizeRouteGroupId } from '../src/utils/groupRouteIds.ts'
import { resolveWorkspaceEntryLocation, toWorkspaceLocation } from '../src/services/workspaceResumeService.ts'

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
  assert.equal(buildCurrentGroupEventPath('event?two'), '/events/event%3Ftwo')
  assert.equal(buildScopedEventDetailPath('group-id', 'event-id'), '/events/event-id')
  assert.equal(
    buildScopedEventDetailPath('group-id', 'event-id', true),
    '/groups/group-id/events/event-id',
  )
})

test('workspace entry resumes the last route before falling back to the current group or church life', () => {
  assert.equal(resolveWorkspaceEntryLocation('/groups/forum?categoryId=updates', 'group-id'), '/groups/forum?categoryId=updates')
  assert.equal(resolveWorkspaceEntryLocation('', 'group-id'), '/groups?view=overview')
  assert.equal(resolveWorkspaceEntryLocation('', ''), '/church')
  assert.equal(toWorkspaceLocation({ pathname: '/events/event-id', search: '?section=memories' }), '/events/event-id?section=memories')
  assert.equal(toWorkspaceLocation({ pathname: '/' }), '')
})

test('only the actual homepage uses the public home shell', () => {
  assert.equal(isHomeLocation({ pathname: '/', search: '' }), true)
  assert.equal(isHomeLocation({ pathname: '/home', search: '' }), true)
  assert.equal(isHomeLocation({ pathname: '/home', search: '?page=about' }), false)
  assert.equal(isHomeLocation({ pathname: '/articles', search: '' }), false)
})

test('current-group route segments are not parsed as explicit group identifiers', () => {
  assert.equal(normalizeRouteGroupId('forum'), '')
  assert.equal(normalizeRouteGroupId('manage'), '')
  assert.equal(normalizeRouteGroupId('group-id'), 'group-id')
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

test('forum feed category changes preserve the mounted route view', () => {
  for (const pathname of ['/forum', '/church/forum', '/groups/forum', '/groups/group-id/forum']) {
    assert.equal(isForumFeedPath(pathname), true)
    assert.equal(getRouteTransitionKey({ pathname, search: '?categoryId=updates', isManagedPublicPage: false }), pathname)
  }
})

test('forum post detail routes keep their full transition identity', () => {
  for (const pathname of ['/forum/posts/post-id', '/church/forum/posts/post-id', '/groups/forum/posts/post-id', '/groups/group-id/forum/posts/post-id']) {
    assert.equal(isForumFeedPath(pathname), false)
    assert.equal(
      getRouteTransitionKey({ pathname, search: '?reply=comment-id', isManagedPublicPage: false }),
      `${pathname}?reply=comment-id`,
    )
  }
})
