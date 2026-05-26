import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { normalizeGroup, normalizeGroupMembership, normalizePageSummary } from '../../utils/apiEnums'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

// ---------- Church (单个对象，只做缓存不做 collection) ----------

export const churchQueryKey = ['church'] as const

export const getCachedChurch = async () => {
  const data = (await getCachedRecord<GroupDto>(churchQueryKey))?.data
  return data ? normalizeGroup(data) : null
}

// ---------- Group by id (单个对象，只做缓存不做 collection) ----------

export const groupQueryKey = (groupId: string) => ['group', groupId] as const

export const getCachedGroup = async (groupId: string) =>
  normalizeNullableGroup((await getCachedRecord<GroupDto>(groupQueryKey(groupId)))?.data)

// ---------- Subgroups ----------

export const subgroupsQueryKey = (groupId: string) => ['subgroups', groupId] as const

export const subgroupsCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: subgroupsQueryKey(groupId),
      getKey: (item: GroupSummaryDto) => item.id,
      queryFn: async (): Promise<GroupSummaryDto[]> => {
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

export const groupMembershipsCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupMembershipsQueryKey(groupId),
      getKey: (item: MembershipRecord) => item.memberId,
      queryFn: async (): Promise<MembershipRecord[]> => {
        const items = await conditionalGet<MembershipRecord[]>({
          queryKey: groupMembershipsQueryKey(groupId),
          path: `/api/groups/${groupId}/memberships`,
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

