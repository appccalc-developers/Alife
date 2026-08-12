import assert from 'node:assert/strict'
import test from 'node:test'
import type { GroupSummaryDto } from '../src/types/index.ts'
import {
  buildGroupHierarchy,
  findGroupHierarchyNode,
  getGroupHierarchyAncestorIds,
  getGroupHierarchyPath,
} from '../src/utils/groupHierarchy.ts'

const group = (id: string, parentGroupId: string | null, isChurch = false): GroupSummaryDto => ({
  id,
  parentGroupId,
  isChurch,
  isClosed: false,
  accessType: 'protected',
  name: { en: id, zh: id },
})

test('builds nested visible groups while excluding the church root', () => {
  const hierarchy = buildGroupHierarchy([
    group('church', null, true),
    group('line', 'church'),
    group('group', 'line'),
    group('study', 'group'),
  ])

  assert.equal(hierarchy.length, 1)
  assert.equal(hierarchy[0]?.group.id, 'line')
  assert.equal(hierarchy[0]?.children[0]?.group.id, 'group')
  assert.equal(hierarchy[0]?.children[0]?.children[0]?.group.id, 'study')
  assert.deepEqual(getGroupHierarchyPath(hierarchy, 'study').map((item) => item.id), ['line', 'group', 'study'])
  assert.deepEqual(getGroupHierarchyAncestorIds(hierarchy, 'study'), ['line', 'group'])
})

test('promotes groups whose parent is unavailable and retains disconnected cycles safely', () => {
  const hierarchy = buildGroupHierarchy([
    group('visible-child', 'hidden-parent'),
    group('cycle-a', 'cycle-b'),
    group('cycle-b', 'cycle-a'),
  ])

  assert.ok(findGroupHierarchyNode(hierarchy, 'visible-child'))
  assert.ok(findGroupHierarchyNode(hierarchy, 'cycle-a'))
  assert.ok(findGroupHierarchyNode(hierarchy, 'cycle-b'))
})
