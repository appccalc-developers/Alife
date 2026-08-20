import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChurchLifeGroup } from '../src/services/churchLifeService.ts'
import { churchLifeQueryKeys, forumQueryKeys } from '../src/services/contentQueryKeys.ts'
import { invalidateForumPostQueries } from '../src/services/forumCache.ts'
import { queryClient } from '../src/db/queryClient.ts'
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

test('forum detail query keys isolate viewers and Church Life route semantics', () => {
  assert.notDeepEqual(
    forumQueryKeys.post('post-id', 'viewer-a'),
    forumQueryKeys.post('post-id', 'viewer-b'),
  )
  assert.notDeepEqual(
    churchLifeQueryKeys.forumPost('viewer-a', 'post-id'),
    forumQueryKeys.post('post-id', 'viewer-a'),
  )
  assert.notDeepEqual(
    forumQueryKeys.sermonPost('sermon-id', 'viewer-a'),
    forumQueryKeys.sermonPost('sermon-id', 'viewer-b'),
  )
})

test('comment invalidation covers every viewer variant and all Church Life details', async () => {
  queryClient.clear()
  const viewerAKey = forumQueryKeys.post('post-id', 'viewer-a')
  const viewerBKey = forumQueryKeys.post('post-id', 'viewer-b')
  const otherPostKey = forumQueryKeys.post('other-post', 'viewer-a')
  const churchPostKey = churchLifeQueryKeys.forumPost('viewer-a', 'post-id')
  queryClient.setQueryData(viewerAKey, { id: 'post-id' })
  queryClient.setQueryData(viewerBKey, { id: 'post-id' })
  queryClient.setQueryData(otherPostKey, { id: 'other-post' })
  queryClient.setQueryData(churchPostKey, { id: 'post-id' })

  await invalidateForumPostQueries('post-id')

  assert.equal(queryClient.getQueryState(viewerAKey)?.isInvalidated, true)
  assert.equal(queryClient.getQueryState(viewerBKey)?.isInvalidated, true)
  assert.equal(queryClient.getQueryState(otherPostKey)?.isInvalidated, false)
  assert.equal(queryClient.getQueryState(churchPostKey)?.isInvalidated, true)
  queryClient.clear()
})
