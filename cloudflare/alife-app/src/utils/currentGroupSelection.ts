import type { GroupMembershipDto, GroupSummaryDto, MembershipRole } from '../types'
import { buildGroupHierarchy, type GroupHierarchyNode } from './groupHierarchy.ts'

const rolePriority: MembershipRole[] = ['leader', 'coLeader', 'member']

const flattenHierarchy = (nodes: GroupHierarchyNode[]): GroupSummaryDto[] =>
  nodes.flatMap((node) => [node.group, ...flattenHierarchy(node.children)])

export const hasApprovedMembership = (
  memberships: GroupMembershipDto[],
  groupId: string,
) => memberships.some((membership) =>
  membership.groupId === groupId && membership.status === 'approved')

export const selectPreferredCurrentGroup = (
  visibleGroups: GroupSummaryDto[],
  memberships: GroupMembershipDto[],
) => {
  const groupsInDisplayOrder = flattenHierarchy(buildGroupHierarchy(visibleGroups))
  const approvedMemberships = new Map(
    memberships
      .filter((membership) => membership.status === 'approved')
      .map((membership) => [membership.groupId, membership]),
  )

  for (const role of rolePriority) {
    const group = groupsInDisplayOrder.find((candidate) =>
      approvedMemberships.get(candidate.id)?.role === role)
    if (group) {
      return group
    }
  }

  return null
}
