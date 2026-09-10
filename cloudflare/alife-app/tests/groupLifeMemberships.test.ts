import assert from 'node:assert/strict'
import test from 'node:test'
import { getGroupLifeMemberships } from '../src/app/navigation/groupLifeMemberships.ts'
import type { GroupMembershipDto } from '../src/types/models.ts'

test('all joined groups are ordered by leader, co-leader, then active member without changing auth data', () => {
  const memberships: GroupMembershipDto[] = [
    { groupId: 'member-a', role: 'member', status: 'approved' },
    { groupId: 'co-leader', role: 'coLeader', status: 'approved' },
    { groupId: 'leader', role: 'leader', status: 'approved' },
    { groupId: 'member-b', role: 'member', status: 'approved' },
    { groupId: 'church', role: 'leader', status: 'approved' },
    ...(['requested', 'invited', 'rejected', 'removed'] as const).map(status => ({ groupId: status, role: 'leader' as const, status })),
  ]
  const original = structuredClone(memberships)
  const groups = memberships.map(m => ({ id: m.groupId, isClosed: false, isChurch: m.groupId === 'church' }))
  assert.deepEqual(getGroupLifeMemberships(memberships, 'church', groups).map(m => m.groupId),
    ['leader', 'co-leader', 'member-a', 'member-b'])
  assert.deepEqual(memberships, original)
})

test('empty and church-only accounts have no Group Life memberships', () => {
  assert.deepEqual(getGroupLifeMemberships([], '', []), [])
  assert.deepEqual(getGroupLifeMemberships([{ groupId: 'church', role: 'member', status: 'approved' }], 'church', []), [])
})

test('closed and unavailable groups are absent from navigation even for leaders', () => {
  const memberships: GroupMembershipDto[] = ['open', 'closed', 'missing'].map(groupId => ({ groupId, role: 'leader', status: 'approved' }))
  assert.deepEqual(getGroupLifeMemberships(memberships, '', [
    { id: 'open', isChurch: false, isClosed: false },
    { id: 'closed', isChurch: false, isClosed: true },
  ]).map(m => m.groupId), ['open'])
})
