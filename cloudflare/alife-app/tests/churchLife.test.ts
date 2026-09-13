import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChurchLifeGroup } from '../src/services/churchLifeService.ts'
import { churchLifeQueryKeys, forumQueryKeys } from '../src/services/contentQueryKeys.ts'
import { invalidateForumPostQueries } from '../src/services/forumCache.ts'
import { queryClient } from '../src/db/queryClient.ts'
import { churchGroupPath, updateChurchLifeOwnerFilter } from '../src/utils/churchLifeGroups.ts'
import { getChurchSiteMenu, getChurchSiteSection, withChurchSiteOwnerFilter } from '../src/app/navigation/churchSiteNavigation.ts'

test('church site tabs retain the selected owner without carrying another tab category or pagination', () => {
  const source = '?ownerGroupId=team%2Fone&categoryId=category&page=3'
  const destinations = ['/church', ...getChurchSiteMenu('en', { isMember: true }).map(item => item.to)]
  for (const to of destinations) {
    const target = new URL(withChurchSiteOwnerFilter(to, source), 'https://example.test')
    assert.equal(target.searchParams.get('ownerGroupId'), 'team/one')
    assert.equal(target.searchParams.has('categoryId'), false)
    assert.equal(target.searchParams.has('page'), false)
    if (to.includes('announcements')) assert.equal(target.searchParams.get('section'), 'announcements')
    if (to.includes('events')) assert.equal(target.searchParams.get('section'), 'events')
  }
  assert.equal(withChurchSiteOwnerFilter('/church/forum', '?ownerGroupId=%20'), '/church/forum')
  assert.equal(withChurchSiteOwnerFilter('/church/forum', ''), '/church/forum')
})

test('forum owner changes preserve the selected category, clear pagination, and isolate cached results', () => {
  const next = updateChurchLifeOwnerFilter(new URLSearchParams('categoryId=prayer&ownerGroupId=church&page=4'), 'team')
  assert.equal(next.get('ownerGroupId'), 'team')
  assert.equal(next.get('categoryId'), 'prayer')
  assert.equal(next.has('page'), false)
  assert.equal(updateChurchLifeOwnerFilter(next, '').has('ownerGroupId'), false)
  assert.notDeepEqual(churchLifeQueryKeys.forum('viewer', 'church', 'prayer', 1, 30), churchLifeQueryKeys.forum('viewer', 'team', 'prayer', 1, 30))
})

test('church site navigation follows sections, filters, and content details', () => {
  assert.equal(getChurchSiteSection('/church'), 'home')
  assert.equal(getChurchSiteSection('/church', '?ownerGroupId=team&section=announcements'), 'announcements')
  assert.equal(getChurchSiteSection('/church', '?section=events'), 'events')
  assert.equal(getChurchSiteSection('/church', '?section=ram-reviews'), 'ram-reviews')
  assert.equal(getChurchSiteSection('/sermons/sermon-id'), 'sermons')
  assert.equal(getChurchSiteSection('/church/bulletins'), 'bulletins')
  assert.equal(getChurchSiteSection('/church/albums'), 'albums')
  assert.equal(getChurchSiteSection('/church/groups/team/albums/album-id'), 'albums')
  assert.equal(getChurchSiteSection('/church/forum/posts/post-id'), 'forum')
  for (const path of ['/church/manage', '/church/manage/edit', '/groups/team/albums/album-id', '/admin', '/sermons-other', '/']) {
    assert.equal(getChurchSiteSection(path), null, path)
  }
})

test('church site menus start with sermons and put events after forum', () => {
  const keys = (isMember: boolean) => getChurchSiteMenu('en', { isMember }).map(item => item.key)
  assert.deepEqual(keys(false), ['sermons'])
  assert.deepEqual(keys(true), ['sermons', 'announcements', 'albums', 'forum', 'events'])
  assert.deepEqual(getChurchSiteMenu('en', { isMember: true, canReviewRam: true }).map(item => item.key), ['sermons', 'announcements', 'albums', 'forum', 'events', 'ram-reviews'])
  const access = { isMember: true, canReviewRam: true }
  assert.deepEqual(getChurchSiteMenu('zh', access).map(item => item.to), getChurchSiteMenu('en', access).map(item => item.to))
  assert.equal(getChurchSiteMenu('en', access).at(-1)?.label, 'Independent RAM review')
  assert.equal(getChurchSiteMenu('zh', access).at(-1)?.label, 'RAM 独立审核')
})

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
