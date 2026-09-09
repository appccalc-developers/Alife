import type { GroupMembershipDto } from '../../types/models'

const roleOrder = { leader: 0, coLeader: 1, member: 2 }

/** Approved memberships are the existing active-member category. Keep API order within each role. */
export const getGroupLifeMemberships = (memberships: GroupMembershipDto[], churchGroupId: string) =>
  memberships
    .filter((membership) => membership.status === 'approved' && membership.groupId !== churchGroupId)
    .sort((left, right) => roleOrder[left.role] - roleOrder[right.role])
