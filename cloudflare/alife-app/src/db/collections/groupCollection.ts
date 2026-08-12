import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { normalizeGroup, normalizeGroupMembership, normalizePageSummary } from '../../utils/apiEnums'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

// ---------- Church (single object, cached only and not exposed as a collection) ----------

export const churchQueryKey = ['church'] as const

export const getCachedChurch = async () => {
  const data = (await getCachedRecord<GroupDto>(churchQueryKey))?.data
  return data ? normalizeGroup(data) : null
}

// ---------- Publicly visible groups ----------

export const visibleGroupsQueryKey = ['visibleGroups'] as const

export const getCachedVisibleGroups = async () =>
  ((await getCachedRecord<GroupSummaryDto[]>(visibleGroupsQueryKey))?.data ?? []).map(normalizeGroup)

// ---------- Group by id (single object, cached only and not exposed as a collection) ----------

export const groupQueryKey = (groupId: string) => ['group', groupId] as const

const groupViewerQueryKey = (groupId: string, viewerId?: string) =>
  [...groupQueryKey(groupId), 'viewer', viewerId?.trim() || 'guest'] as const

const groupViewerQueryOptions = (groupId: string, viewerId?: string) => ({
  queryKey: groupViewerQueryKey(groupId, viewerId),
  queryFn: () => conditionalGet<GroupDto>({
    queryKey: groupQueryKey(groupId),
    path: `/api/groups/${groupId}`,
  }),
  // Coalesce sequential StrictMode/shell startup reads without becoming a navigation cache.
  staleTime: 1_000,
})

export const fetchGroupForViewer = (groupId: string, viewerId?: string) =>
  queryClient.fetchQuery(groupViewerQueryOptions(groupId, viewerId))

export const ensureGroupForViewer = (groupId: string, viewerId?: string) =>
  queryClient.ensureQueryData(groupViewerQueryOptions(groupId, viewerId))

export const getCachedGroup = async (groupId: string) =>
  normalizeNullableGroup((await getCachedRecord<GroupDto>(groupQueryKey(groupId)))?.data)

// ---------- Subgroups ----------

export const subgroupsQueryKey = (groupId: string) => ['subgroups', groupId] as const

export const subgroupsCollection = (groupId: string, enabled = true) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: [...subgroupsQueryKey(groupId), enabled ? 'enabled' : 'disabled'],
      getKey: (item: GroupSummaryDto) => item.id,
      queryFn: async (): Promise<GroupSummaryDto[]> => {
        if (!enabled) {
          return []
        }

        const items = await conditionalGet<GroupSummaryDto[]>({
          queryKey: subgroupsQueryKey(groupId),
          path: `/api/groups/${groupId}/subgroups`,
        })
        return items.map(normalizeGroup)
      },
    }),
  )

export const getCachedSubgroups = async (groupId: string) =>
  ((await getCachedRecord<GroupSummaryDto[]>(subgroupsQueryKey(groupId)))?.data ?? []).map(normalizeGroup)

// ---------- Group pages ----------

export const groupPagesQueryKey = (groupId: string) => ['groupPages', groupId] as const

export const groupPagesCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupPagesQueryKey(groupId),
      getKey: (item: PageSummaryDto) => item.id,
      queryFn: async (): Promise<PageSummaryDto[]> => {
        const items = await conditionalGet<PageSummaryDto[]>({
          queryKey: groupPagesQueryKey(groupId),
          path: `/api/groups/${groupId}/pages`,
        })
        return items.map(normalizePageSummary)
      },
    }),
  )

export const getCachedGroupPages = async (groupId: string) =>
  ((await getCachedRecord<PageSummaryDto[]>(groupPagesQueryKey(groupId)))?.data ?? []).map(normalizePageSummary)

// ---------- Group memberships ----------

type MembershipRecord = Omit<GroupMembershipDto, 'groupId'> & { memberId: string }

export const groupMembershipsQueryKey = (groupId: string) => ['groupMemberships', groupId] as const

export const groupMembershipsCollectionQueryKey = (groupId: string, enabled = true, includeLineCandidates = false) => [
  ...groupMembershipsQueryKey(groupId),
  enabled ? 'enabled' : 'disabled',
  includeLineCandidates ? 'line-candidates' : 'members-only',
] as const

export const groupMembershipsCollection = (groupId: string, enabled = true, includeLineCandidates = false) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupMembershipsCollectionQueryKey(groupId, enabled, includeLineCandidates),
      getKey: (item: MembershipRecord) => item.memberId,
      queryFn: async (): Promise<MembershipRecord[]> => {
        if (!enabled) {
          return []
        }

        const items = await conditionalGet<MembershipRecord[]>({
          queryKey: [...groupMembershipsQueryKey(groupId), includeLineCandidates ? 'line-candidates' : 'members-only'],
          path: `/api/groups/${groupId}/memberships${includeLineCandidates ? '?includeLineCandidates=true' : ''}`,
        })
        return items.map(normalizeGroupMembership)
      },
    }),
  )

export const getCachedGroupMemberships = async (groupId: string) =>
  ((await getCachedRecord<MembershipRecord[]>(groupMembershipsQueryKey(groupId)))?.data ?? []).map(normalizeGroupMembership)

// ---------- Group events ----------

export const groupEventsQueryKey = (groupId: string) => ['groupEvents', groupId] as const

export const groupEventsCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupEventsQueryKey(groupId),
      getKey: (item: GroupEventRecord) => item.id,
      queryFn: async () =>
        conditionalGet<GroupEventRecord[]>({
          queryKey: groupEventsQueryKey(groupId),
          path: `/api/groups/${groupId}/events`,
        }),
    }),
  )

export const getCachedGroupEvents = async (groupId: string) =>
  (await getCachedRecord<GroupEventRecord[]>(groupEventsQueryKey(groupId)))?.data ?? []

const normalizeNullableGroup = (group: GroupDto | undefined) => group ? normalizeGroup(group) : null

