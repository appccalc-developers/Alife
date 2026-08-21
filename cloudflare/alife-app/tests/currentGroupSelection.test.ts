import assert from 'node:assert/strict'
import test from 'node:test'
import type { GroupMembershipDto, GroupSummaryDto } from '../src/types/index.ts'
import {
  hasApprovedMembership,
  selectPreferredCurrentGroup,
} from '../src/utils/currentGroupSelection.ts'

const group = (
  id: string,
  parentGroupId: string | null = null,
  isChurch = false,
): GroupSummaryDto => ({
  id,
  name: { en: id, zh: id },
  accessType: 'protected',
  isChurch,
  isClosed: false,
  parentGroupId,
})

const membership = (
  groupId: string,
  role: GroupMembershipDto['role'],
  status: GroupMembershipDto['status'] = 'approved',
): GroupMembershipDto => ({ groupId, role, status })

test('chooses a leader before a co-leader or approved member', () => {
  const groups = [group('member'), group('co-leader'), group('leader')]
  const memberships = [
    membership('member', 'member'),
    membership('co-leader', 'coLeader'),
    membership('leader', 'leader'),
  ]

  assert.equal(selectPreferredCurrentGroup(groups, memberships)?.id, 'leader')
})

test('uses rendered hierarchy order between groups with the same role', () => {
  const groups = [
    group('first-root'),
    group('second-root'),
    group('first-root-child', 'first-root'),
  ]
  const memberships = [
    membership('second-root', 'leader'),
    membership('first-root-child', 'leader'),
  ]

  assert.equal(selectPreferredCurrentGroup(groups, memberships)?.id, 'first-root-child')
})

test('falls back to the first approved member and ignores unapproved or church groups', () => {
  const groups = [
    group('church', null, true),
    group('requested-leader'),
    group('member-1'),
    group('member-2'),
  ]
  const memberships = [
    membership('church', 'leader'),
    membership('requested-leader', 'leader', 'requested'),
    membership('member-1', 'member'),
    membership('member-2', 'member'),
  ]

  assert.equal(selectPreferredCurrentGroup(groups, memberships)?.id, 'member-1')
  assert.equal(hasApprovedMembership(memberships, 'requested-leader'), false)
  assert.equal(hasApprovedMembership(memberships, 'member-1'), true)
})

test('returns no group when the account has no eligible approved membership', () => {
  assert.equal(
    selectPreferredCurrentGroup(
      [group('requested')],
      [membership('requested', 'member', 'requested')],
    ),
    null,
  )
})
