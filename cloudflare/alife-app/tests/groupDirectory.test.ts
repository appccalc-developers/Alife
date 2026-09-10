import assert from 'node:assert/strict'
import test from 'node:test'
import { isDirectoryGroupType, isGroupLifeVisible, readGroupDisplayImage } from '../src/utils/groupDirectory.ts'

test('Group Life excludes closed and departed groups while preserving discovery and current memberships', () => {
  const group = { id: 'group', isChurch: false, isClosed: false }
  assert.equal(isGroupLifeVisible(group, []), true)
  assert.equal(isGroupLifeVisible({ ...group, isClosed: true }, []), false)
  assert.equal(isGroupLifeVisible({ ...group, isChurch: true }, []), false)
  for (const status of ['approved', 'requested', 'invited', 'rejected', 'removed'] as const) {
    assert.equal(isGroupLifeVisible(group, [{ groupId: 'group', role: 'member', status }]), status !== 'removed')
    assert.equal(isGroupLifeVisible({ ...group, isClosed: true }, [{ groupId: 'group', role: 'leader', status }]), false)
  }
  assert.equal(isGroupLifeVisible(group, [{ groupId: 'other', role: 'member', status: 'removed' }]), true)
})

test('directory tabs use stored types, preserve legacy fellowships, and exclude the church', () => {
  assert.equal(isDirectoryGroupType({ isChurch: false }, 'fellowship'), true)
  assert.equal(isDirectoryGroupType({ isChurch: false }, 'ministry'), false)
  assert.equal(isDirectoryGroupType({ isChurch: false, groupType: 'ministry' }, 'ministry'), true)
  assert.equal(isDirectoryGroupType({ isChurch: false, groupType: 'ministry' }, 'fellowship'), false)
  assert.equal(isDirectoryGroupType({ isChurch: true, groupType: 'fellowship' }, 'fellowship'), false)
})

test('display pictures retain the legacy section image shapes and section order', () => {
  for (const contentJson of [
    { backgroundImageUrl: '/photo.jpg' }, { backgroundImage: '/photo.jpg' },
    { imageUrl: '/photo.jpg' }, { media: { url: '/photo.jpg' } },
  ]) {
    assert.equal(readGroupDisplayImage({ sections: [{ contentJson } as never] }), '/photo.jpg')
  }
  assert.equal(readGroupDisplayImage({ sections: [] }), '')
  assert.equal(readGroupDisplayImage({ sections: [{ contentJson: { imageUrl: ' ' } } as never] }), '')
})
