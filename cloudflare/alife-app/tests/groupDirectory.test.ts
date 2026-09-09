import assert from 'node:assert/strict'
import test from 'node:test'
import { isDirectoryGroupType, readGroupDisplayImage } from '../src/utils/groupDirectory.ts'

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
