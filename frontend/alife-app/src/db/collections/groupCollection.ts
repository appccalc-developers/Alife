import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

// ---------- Church (单个对象，只做缓存不做 collection) ----------

export const churchQueryKey = ['church'] as const

export const getCachedChurch = async () => (await getCachedRecord<GroupDto>(churchQueryKey))?.data ?? null

// ---------- Group by id (单个对象，只做缓存不做 collection) ----------

export const groupQueryKey = (groupId: string) => ['group', groupId] as const

export const getCachedGroup = async (groupId: string) =>
  (await getCachedRecord<GroupDto>(groupQueryKey(groupId)))?.data ?? null

// ---------- Subgroups ----------

export const subgroupsQueryKey = (groupId: string) => ['subgroups', groupId] as const

export const subgroupsCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: subgroupsQueryKey(groupId),
      getKey: (item: GroupSummaryDto) => item.id,
      queryFn: async () =>
        conditionalGet<GroupSummaryDto[]>({
          queryKey: subgroupsQueryKey(groupId),
          path: `/api/groups/${groupId}/subgroups`,
        }),
    }),
  )

export const getCachedSubgroups = async (groupId: string) =>
  (await getCachedRecord<GroupSummaryDto[]>(subgroupsQueryKey(groupId)))?.data ?? []

// ---------- Group pages ----------

export const groupPagesQueryKey = (groupId: string, lang: string) => ['groupPages', groupId, lang] as const

export const groupPagesCollection = (groupId: string, lang: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupPagesQueryKey(groupId, lang),
      getKey: (item: PageSummaryDto) => item.id,
      queryFn: async () =>
        conditionalGet<PageSummaryDto[]>({
          queryKey: groupPagesQueryKey(groupId, lang),
          path: `/api/groups/${groupId}/pages`,
        }),
    }),
  )

export const getCachedGroupPages = async (groupId: string, lang: string) =>
  (await getCachedRecord<PageSummaryDto[]>(groupPagesQueryKey(groupId, lang)))?.data ?? []

// ---------- Group memberships ----------

type MembershipRecord = Omit<GroupMembershipDto, 'groupId'> & { memberId: string }

export const groupMembershipsQueryKey = (groupId: string) => ['groupMemberships', groupId] as const

export const groupMembershipsCollection = (groupId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: groupMembershipsQueryKey(groupId),
      getKey: (item: MembershipRecord) => item.memberId,
      queryFn: async () =>
        conditionalGet<MembershipRecord[]>({
          queryKey: groupMembershipsQueryKey(groupId),
          path: `/api/groups/${groupId}/memberships`,
        }),
    }),
  )

export const getCachedGroupMemberships = async (groupId: string) =>
  (await getCachedRecord<MembershipRecord[]>(groupMembershipsQueryKey(groupId)))?.data ?? []

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

// ---------- Global events ----------

export const globalEventsQueryKey = () => ['globalEvents'] as const

export const globalEventsCollection = () =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: globalEventsQueryKey(),
      getKey: (item: GroupEventRecord) => item.id,
      queryFn: async () =>
        conditionalGet<GroupEventRecord[]>({
          queryKey: globalEventsQueryKey(),
          path: '/api/events',
        }),
    }),
  )

export const getCachedGlobalEvents = async () =>
  (await getCachedRecord<GroupEventRecord[]>(globalEventsQueryKey()))?.data ?? []

