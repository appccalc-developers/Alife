import type {
  AccessType,
  GroupDto,
  GroupMembershipDto,
  GroupSummaryDto,
  MeDto,
  MembershipRole,
  MembershipStatus,
  PageSummaryDto,
  PageVisibility,
} from '../types'
import { toLocalizedText } from './localizedText'

const normalizeEnum = <T extends string>(
  value: unknown,
  byNumber: Record<number, T>,
  byName: Record<string, T>,
  fallback: T,
): T => {
  if (typeof value === 'number') {
    return byNumber[value] ?? fallback
  }

  if (typeof value === 'string') {
    return byName[value] ?? byName[value.toLowerCase()] ?? fallback
  }

  return fallback
}

export const normalizeAccessType = (value: unknown): AccessType =>
  normalizeEnum<AccessType>(
    value,
    { 0: 'public', 1: 'protected', 2: 'private' },
    { public: 'public', protected: 'protected', private: 'private' },
    'private',
  )

export const normalizeMembershipStatus = (value: unknown): MembershipStatus =>
  normalizeEnum<MembershipStatus>(
    value,
    { 0: 'invited', 1: 'requested', 2: 'approved', 3: 'rejected', 4: 'removed' },
    {
      invited: 'invited',
      requested: 'requested',
      approved: 'approved',
      rejected: 'rejected',
      removed: 'removed',
    },
    'removed',
  )

export const normalizeMembershipRole = (value: unknown): MembershipRole =>
  normalizeEnum<MembershipRole>(
    value,
    { 0: 'member', 1: 'coLeader', 2: 'leader' },
    {
      member: 'member',
      coleader: 'coLeader',
      coLeader: 'coLeader',
      leader: 'leader',
    },
    'member',
  )

export const normalizePageVisibility = (value: unknown): PageVisibility =>
  normalizeEnum<PageVisibility>(
    value,
    { 0: 'draft', 1: 'group', 2: 'public' },
    {
      draft: 'draft',
      invisibledraft: 'draft',
      group: 'group',
      visibletogroup: 'group',
      public: 'public',
      visiblepublic: 'public',
    },
    'draft',
  )

export const normalizeMembership = <T extends { status: unknown; role: unknown }>(membership: T) => ({
  ...membership,
  status: normalizeMembershipStatus(membership.status),
  role: normalizeMembershipRole(membership.role),
  platformRole: 'platformRole' in membership && typeof (membership as { platformRole?: unknown }).platformRole === 'string'
    ? (membership as { platformRole: string }).platformRole
    : 'user',
  platformRoles: 'platformRoles' in membership && Array.isArray((membership as { platformRoles?: unknown }).platformRoles)
    ? (membership as { platformRoles: string[] }).platformRoles
    : [],
  groupName: 'groupName' in membership && (membership as { groupName?: unknown }).groupName
    ? toLocalizedText((membership as { groupName: Record<string, string> }).groupName)
    : (membership as { groupName?: unknown }).groupName,
})

export const normalizeMe = (me: MeDto): MeDto => ({
  ...me,
  memberships: (me.memberships ?? []).map(normalizeMembership),
})

export const normalizeGroup = <T extends GroupDto | GroupSummaryDto>(group: T): T => ({
  ...group,
  name: toLocalizedText(group.name),
  description: group.description ? toLocalizedText(group.description) : group.description,
  accessType: normalizeAccessType(group.accessType),
})

export const normalizePageSummary = (page: PageSummaryDto): PageSummaryDto => ({
  ...page,
  visibility: normalizePageVisibility(page.visibility),
  accessName: page.accessName ? toLocalizedText(page.accessName) : page.accessName,
  cardText: page.cardText ? toLocalizedText(page.cardText) : page.cardText,
})

export const normalizeGroupMembership = (
  membership: Omit<GroupMembershipDto, 'groupId'> & { memberId: string },
): Omit<GroupMembershipDto, 'groupId'> & { memberId: string } => normalizeMembership(membership)
