import type { GroupMembershipDto, GroupSummaryDto } from '../../types/models'

const roleOrder = { leader: 0, coLeader: 1, member: 2 }

/** Approved memberships are the existing active-member category. Keep API order within each role. */
export const getGroupLifeMemberships = (memberships: GroupMembershipDto[], churchGroupId: string, groups: Pick<GroupSummaryDto, 'id' | 'isClosed' | 'isChurch'>[]) =>
  memberships
    .filter((membership) => membership.status === 'approved' && membership.groupId !== churchGroupId &&
      groups.some(group => group.id === membership.groupId && !group.isClosed && !group.isChurch))
    .sort((left, right) => roleOrder[left.role] - roleOrder[right.role])
