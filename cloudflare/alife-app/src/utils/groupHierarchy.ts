import type { GroupSummaryDto } from '../types'

export type GroupHierarchyNode = {
  group: GroupSummaryDto
  children: GroupHierarchyNode[]
}

export const buildGroupHierarchy = (groups: GroupSummaryDto[]): GroupHierarchyNode[] => {
  const visibleGroups = groups.filter((group) => !group.isChurch)
  const groupsById = new Map(visibleGroups.map((group) => [group.id, group]))
  const childrenByParentId = new Map<string, string[]>()
  const rootIds: string[] = []

  visibleGroups.forEach((group) => {
    const parentId = group.parentGroupId
    if (!parentId || parentId === group.id || !groupsById.has(parentId)) {
      rootIds.push(group.id)
      return
    }

    const siblings = childrenByParentId.get(parentId) ?? []
    siblings.push(group.id)
    childrenByParentId.set(parentId, siblings)
  })

  const visited = new Set<string>()
  const buildNode = (groupId: string, ancestors: Set<string>): GroupHierarchyNode | null => {
    const group = groupsById.get(groupId)
    if (!group || visited.has(groupId) || ancestors.has(groupId)) return null

    visited.add(groupId)
    const nextAncestors = new Set(ancestors).add(groupId)
    const children = (childrenByParentId.get(groupId) ?? [])
      .map((childId) => buildNode(childId, nextAncestors))
      .filter((node): node is GroupHierarchyNode => Boolean(node))

    return { group, children }
  }

  const roots = rootIds
    .map((groupId) => buildNode(groupId, new Set()))
    .filter((node): node is GroupHierarchyNode => Boolean(node))

  visibleGroups.forEach((group) => {
    if (visited.has(group.id)) return
    const recoveredRoot = buildNode(group.id, new Set())
    if (recoveredRoot) roots.push(recoveredRoot)
  })

  return roots
}

export const findGroupHierarchyNode = (
  roots: GroupHierarchyNode[],
  groupId: string,
): GroupHierarchyNode | null => {
  for (const node of roots) {
    if (node.group.id === groupId) return node
    const child = findGroupHierarchyNode(node.children, groupId)
    if (child) return child
  }
  return null
}

export const getGroupHierarchyPath = (
  roots: GroupHierarchyNode[],
  groupId: string,
): GroupSummaryDto[] => {
  const visit = (nodes: GroupHierarchyNode[], path: GroupSummaryDto[]): GroupSummaryDto[] => {
    for (const node of nodes) {
      const nextPath = [...path, node.group]
      if (node.group.id === groupId) return nextPath
      const childPath = visit(node.children, nextPath)
      if (childPath.length > 0) return childPath
    }
    return []
  }

  return visit(roots, [])
}

export const getGroupHierarchyAncestorIds = (
  roots: GroupHierarchyNode[],
  groupId: string,
) => getGroupHierarchyPath(roots, groupId).slice(0, -1).map((group) => group.id)
