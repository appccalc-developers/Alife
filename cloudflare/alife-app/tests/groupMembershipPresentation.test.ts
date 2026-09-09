import assert from 'node:assert/strict'
import test from 'node:test'
import { groupMembershipLabel } from '../src/utils/groupMembershipPresentation.ts'

test('approved group membership displays the actual role in both languages', () => {
  for (const [role, zh, en] of [['leader', '组长', 'Group leader'], ['coLeader', '副组长', 'Co-leader'], ['member', '组员', 'Group member']]) {
    assert.equal(groupMembershipLabel({ status: 'approved', role }, 'zh'), zh)
    assert.equal(groupMembershipLabel({ status: 'approved', role }, 'en'), en)
  }
})

test('pending, invited, guest, and nonmember statuses do not claim an approved role', () => {
  assert.equal(groupMembershipLabel({ status: 'requested', role: 'leader' }, 'zh'), '申请审核中')
  assert.equal(groupMembershipLabel({ status: 'invited', role: 'coLeader' }, 'en'), 'Invited')
  assert.equal(groupMembershipLabel({ status: 'approved', role: 'leader' }, 'zh', true), '登录后可申请')
  assert.equal(groupMembershipLabel(undefined, 'zh'), '可以申请加入')
  assert.equal(groupMembershipLabel({ status: 'rejected', role: 'member' }, 'en'), 'Available to join')
})
