import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChurchLifeGroup } from '../src/services/churchLifeService.ts'
import { churchGroupPath, updateChurchLifeOwnerFilter } from '../src/utils/churchLifeGroups.ts'

const groups: ChurchLifeGroup[] = [
  { id: 'church', parentGroupId: null, name: { en: 'Church', zh: '教会' }, pathIds: ['church'], canManage: false, isSelectable: true },
  { id: 'ministry', parentGroupId: 'church', name: { en: 'Ministry', zh: '事工' }, pathIds: ['church', 'ministry'], canManage: true, isSelectable: true },
  { id: 'team', parentGroupId: 'ministry', name: { en: 'Team', zh: '团队' }, pathIds: ['church', 'ministry', 'team'], canManage: false, isSelectable: true },
]

test('church group path localizes the complete indirect hierarchy without changing data', () => {
  assert.equal(churchGroupPath('team', groups, 'zh'), '教会 / 事工 / 团队')
  assert.equal(churchGroupPath('team', groups, 'en'), 'Church / Ministry / Team')
  assert.deepEqual(groups[2].pathIds, ['church', 'ministry', 'team'])
})

test('church group path safely handles missing owners', () => {
  assert.equal(churchGroupPath('missing', groups, 'zh'), '')
  assert.equal(churchGroupPath(null, groups, 'en'), '')
})

test('changing the owning-group filter preserves the section and clears selected content pagination', () => {
  const next = updateChurchLifeOwnerFilter(
    new URLSearchParams('section=events&ownerGroupId=ministry&page=3'),
    'team',
  )
  assert.equal(next.get('section'), 'events')
  assert.equal(next.get('ownerGroupId'), 'team')
  assert.equal(next.has('page'), false)
})
