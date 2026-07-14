import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { sermonsCollection } from '../db/collections/sermonsCollection'
import {
  subgroupsCollection,
  groupMembershipsCollection,
  groupPagesCollection,
  groupEventsCollection,
} from '../db/collections/groupCollection'
import type { ListViewMetadata } from '../types/page-editor'
import type { SermonDto } from '../services/sermonService'
import type { GroupEventRecord } from '../types/event'
import type { GroupSummaryDto } from '../types'
import type { AnnouncementDto } from '../types/announcement'
import { announcementService } from '../services/announcementService'
import { useActiveEntityIds } from './useActiveEntityIds'

type MembershipListRow = { memberId: string; status: string; role: string; name?: string; displayName?: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const localizedTextValues = (value: unknown) => {
  if (typeof value === 'string') return [value]
  if (!isRecord(value)) return []
  return Object.values(value).filter((entry): entry is string => typeof entry === 'string')
}

const readString = (value: unknown) => typeof value === 'string' ? value : ''

const resolveSourceType = (sourceType: ListViewMetadata['sourceType']) =>
  sourceType === 'groups' ? 'subgroups' : sourceType

const searchableText = (sourceType: ListViewMetadata['sourceType'], item: unknown) => {
  if (!isRecord(item)) return ''

  switch (resolveSourceType(sourceType)) {
    case 'sermons':
      return [
        readString(item.title),
        readString(item.speakerName),
        readString(item.preachedAt),
      ].join(' ')
    case 'announcements':
      return [
        ...localizedTextValues(item.title),
        ...localizedTextValues(item.summary),
        ...localizedTextValues(item.content),
        readString(item.publishUtc),
      ].join(' ')
    case 'subgroups':
      return [
        ...localizedTextValues(item.name),
        ...localizedTextValues(item.description),
        readString(item.accessType),
      ].join(' ')
    case 'members':
      return [
        readString(item.memberId),
        readString(item.name),
        readString(item.displayName),
        readString(item.status),
        readString(item.role),
      ].join(' ')
    case 'pages':
      return [
        ...localizedTextValues(item.title),
        ...localizedTextValues(item.description),
        readString(item.updatedUtc),
      ].join(' ')
    case 'events':
      return [
        readString(item.titleEn),
        readString(item.titleZh),
        readString(item.startDate),
        readString(item.endDate),
      ].join(' ')
    default:
      return ''
  }
}

const titleValue = (sourceType: ListViewMetadata['sourceType'], item: unknown) => {
  if (!isRecord(item)) return ''

  switch (resolveSourceType(sourceType)) {
    case 'sermons':
      return readString(item.title)
    case 'announcements':
      return localizedTextValues(item.title)[0] ?? ''
    case 'subgroups':
    case 'pages':
      return localizedTextValues(item.name ?? item.title)[0] ?? ''
    case 'members':
      return readString(item.name) || readString(item.displayName) || readString(item.memberId)
    case 'events':
      return readString(item.titleEn) || readString(item.titleZh)
    default:
      return ''
  }
}

const dateValue = (sourceType: ListViewMetadata['sourceType'], item: unknown) => {
  if (!isRecord(item)) return null

  const resolvedSourceType = resolveSourceType(sourceType)
  const raw =
    resolvedSourceType === 'announcements' ? item.publishUtc
      :
    resolvedSourceType === 'sermons' ? item.preachedAt
      : resolvedSourceType === 'events' ? item.startDate
        : resolvedSourceType === 'pages' ? item.updatedUtc
          : isRecord(item) ? item.updatedUtc ?? item.createdUtc : null

  if (typeof raw !== 'string' || !raw.trim()) return null
  const time = new Date(raw).getTime()
  return Number.isFinite(time) ? time : null
}

const applyListViewFilteringAndSorting = <T,>(items: T[], metadata: ListViewMetadata): T[] => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const filter = metadata.filterText?.trim().toLowerCase()
  const presetFiltered = metadata.sourceType === 'events' && (metadata.preset === 'upcoming' || metadata.preset === 'recent')
    ? items.filter((item) => {
      const eventTime = dateValue('events', item)
      if (eventTime === null) return false
      return metadata.preset === 'upcoming' ? eventTime >= now.getTime() : eventTime < now.getTime()
    })
    : items
  const filtered = filter
    ? presetFiltered.filter((item) => searchableText(metadata.sourceType, item).toLowerCase().includes(filter))
    : presetFiltered

  if (metadata.sortBy === 'source') {
    return filtered
  }

  const direction = metadata.sortDirection === 'desc' ? -1 : 1
  return [...filtered].sort((a, b) => {
    if (metadata.sortBy === 'date') {
      const aDate = dateValue(metadata.sourceType, a)
      const bDate = dateValue(metadata.sourceType, b)
      if (aDate === null && bDate === null) return 0
      if (aDate === null) return 1
      if (bDate === null) return -1
      return direction * (aDate - bDate)
    }

    return direction * titleValue(metadata.sourceType, a).localeCompare(titleValue(metadata.sourceType, b))
  })
}

interface ListSourceResult {
  data: any[] | undefined
  isLoading: boolean
  isReady: boolean
  error: Error | null
}

export type ListSourceResolverOptions = {
  /** Overrides the active group id when rendering content from another group. */
  groupId?: string
  /** Skip collection wiring entirely when the caller only needs the hook shape. */
  enabled?: boolean
}

/**
 * Resolves a ListViewMetadata config to the appropriate TanStack DB collection query.
 *
 * Strategy (Local-First):
 * 1. Render: renders immediately from local DB (useLiveQuery)
 * 2. Fetch: if local collection is empty, triggers an API call via conditionalGet to the .NET API
 * 3. Persist: Results stored in TanStack DB via httpCache (conditionalGet writes to idb-keyval)
 *
 * Supports metadata.id:
 * - members: id is treated as subgroupId for precise subgroup member queries
 * - subgroups: id is treated as the parent groupId
 * - events: id is treated as subgroupId for subgroup event queries
 * - when id is omitted, the current groupId is used
 */
export function useListSourceResolver(metadata: ListViewMetadata, options?: ListSourceResolverOptions): ListSourceResult {
  const { groupId: activeGroupId } = useActiveEntityIds()
  const enabled = options?.enabled ?? true

  const currentGroupId = enabled ? (options?.groupId?.trim() || activeGroupId || '').trim() : ''
  const sourceType = resolveSourceType(metadata.sourceType)
  const sourceScope = metadata.sourceScope
  const limit = Math.min(Math.max(metadata.limit || 10, 1), 50)
  // If metadata.id exists, use it instead of currentGroupId for precise subgroup queries.
  const targetGroupId = metadata.id?.trim() || currentGroupId

  // Determine the config for the query
  const queryConfig = useMemo(() => {
    let isGlobal = false

    switch (sourceType) {
      case 'sermons':
        isGlobal = true
        break
      case 'members':
      case 'subgroups':
      case 'pages':
        isGlobal = false
        break
      case 'events':
        isGlobal = false
        break
      default:
        isGlobal = true
    }

    return { isGlobal, limit }
  }, [sourceType, sourceScope, limit])

  // ----- useLiveQuery: use callback that returns a Collection or `undefined` -----
  // Do not pass `undefined` as the direct collection overload (crashes in _getQuery).
  // Do not rely on q.from().select(({ row }) => row) here — returning the collection matches SermonList.

  const isSermons = enabled && sourceType === 'sermons'
  const isAnnouncements = enabled && sourceType === 'announcements'
  const isSubgroups = enabled && sourceType === 'subgroups'
  const isMembers = enabled && sourceType === 'members'
  const isGroupPages = enabled && sourceType === 'pages'
  const isEvents = enabled && sourceType === 'events'
  const [announcementsData, setAnnouncementsData] = useState<AnnouncementDto[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(false)
  const [announcementsError, setAnnouncementsError] = useState(false)

  useEffect(() => {
    if (!isAnnouncements || !targetGroupId) {
      setAnnouncementsData([])
      setAnnouncementsLoading(false)
      setAnnouncementsError(false)
      return
    }

    let cancelled = false
    setAnnouncementsLoading(true)
    setAnnouncementsError(false)
    announcementService.listActive(targetGroupId)
      .then((items) => { if (!cancelled) setAnnouncementsData(items) })
      .catch(() => { if (!cancelled) setAnnouncementsError(true) })
      .finally(() => { if (!cancelled) setAnnouncementsLoading(false) })
    return () => { cancelled = true }
  }, [isAnnouncements, targetGroupId])

  // Sermons (always global, always available)
  const sermonsLive = useLiveQuery(
    () => {
      if (!isSermons) return undefined
      return sermonsCollection
    },
    [isSermons],
  )
  const sermonsData = isSermons ? ((sermonsLive.data ?? []) as SermonDto[]) : ([] as SermonDto[])
  const sermonsLoading = isSermons ? (sermonsLive.isLoading ?? true) : false
  const sermonsReady = isSermons ? (sermonsLive.isReady ?? false) : true
  const sermonsError = isSermons ? (sermonsLive.isError ?? false) : false

  // Subgroups (group-scoped, using targetGroupId to support metadata.id)
  const subgroupsLive = useLiveQuery(
    () => {
      if (!isSubgroups || !targetGroupId) return undefined
      return subgroupsCollection(targetGroupId)
    },
    [isSubgroups, targetGroupId],
  )
  const subgroupsData = isSubgroups
    ? ((subgroupsLive.data ?? []) as GroupSummaryDto[])
    : ([] as GroupSummaryDto[])
  const subgroupsLoading = isSubgroups ? (subgroupsLive.isLoading ?? true) : false
  const subgroupsReady = isSubgroups ? (subgroupsLive.isReady ?? false) : true
  const subgroupsError = isSubgroups ? (subgroupsLive.isError ?? false) : false

  // Members (group-scoped, using targetGroupId to support metadata.id)
  const membershipsLive = useLiveQuery(
    () => {
      if (!isMembers || !targetGroupId) return undefined
      return groupMembershipsCollection(targetGroupId)
    },
    [isMembers, targetGroupId],
  )
  const membershipsData = isMembers
    ? ((membershipsLive.data ?? []) as MembershipListRow[])
    : ([] as MembershipListRow[])
  const membershipsLoading = isMembers ? (membershipsLive.isLoading ?? true) : false
  const membershipsReady = isMembers ? (membershipsLive.isReady ?? false) : true
  const membershipsError = isMembers ? (membershipsLive.isError ?? false) : false

  // Group-scoped pages — always create collection when active, so TanStack DB can trigger conditionalGet
  const groupPagesLive = useLiveQuery(
    () => {
      if (!isGroupPages) return undefined
      if (!targetGroupId) return undefined
      return groupPagesCollection(targetGroupId)
    },
    [isGroupPages, targetGroupId],
  )
  const groupPagesData = isGroupPages ? ((groupPagesLive.data ?? []) as any[]) : ([] as any[])
  const groupPagesLoading = isGroupPages ? (groupPagesLive.isLoading ?? true) : false
  const groupPagesReady = isGroupPages ? (groupPagesLive.isReady ?? false) : true
  const groupPagesError = isGroupPages ? (groupPagesLive.isError ?? false) : false

  // Events (always group-scoped, no global option)
  const groupEventsLive = useLiveQuery(
    () => {
      if (!isEvents || !targetGroupId) return undefined
      return groupEventsCollection(targetGroupId)
    },
    [isEvents, targetGroupId],
  )
  const eventsData = isEvents
    ? ((groupEventsLive.data ?? []) as GroupEventRecord[])
    : ([] as GroupEventRecord[])
  const eventsLoading = isEvents
    ? (groupEventsLive.isLoading ?? true)
    : false
  const eventsReady = isEvents
    ? (groupEventsLive.isReady ?? false)
    : true
  const eventsError = isEvents
    ? (groupEventsLive.isError ?? false)
    : false

  // Build the result data based on source type
  const result = useMemo(() => {
    switch (sourceType) {
      case 'announcements':
        return applyListViewFilteringAndSorting(announcementsData, metadata).slice(0, queryConfig.limit)
      case 'sermons': {
        return applyListViewFilteringAndSorting(sermonsData as SermonDto[], metadata).slice(0, queryConfig.limit)
      }
      case 'subgroups': {
        const items = (subgroupsData as GroupSummaryDto[])
          .filter((s) => s.parentGroupId === targetGroupId)
        return applyListViewFilteringAndSorting(items, metadata).slice(0, queryConfig.limit)
      }
      case 'members': {
        const items = (membershipsData as MembershipListRow[])
          .filter((m) => m.status === 'approved')
        return applyListViewFilteringAndSorting(items, metadata).slice(0, queryConfig.limit)
      }
      case 'pages':
        return applyListViewFilteringAndSorting(groupPagesData as any[], metadata).slice(0, queryConfig.limit)
      case 'events':
        return applyListViewFilteringAndSorting(eventsData as GroupEventRecord[], metadata).slice(0, queryConfig.limit)
      case 'media':
      case 'posts':
        return []
      default:
        return []
    }
  }, [sourceType, announcementsData, sermonsData, subgroupsData, membershipsData, groupPagesData, eventsData, metadata, queryConfig.limit, targetGroupId])

  // Determine loading/ready/error state from the active source
  const { isLoading: isCollectionLoading, isReady, isError: hasError } = useMemo(() => {
    if (isAnnouncements) return { isLoading: announcementsLoading, isReady: !announcementsLoading, isError: announcementsError }
    if (isSermons) return { isLoading: sermonsLoading, isReady: sermonsReady, isError: sermonsError }
    if (isSubgroups) return { isLoading: subgroupsLoading, isReady: subgroupsReady, isError: subgroupsError }
    if (isMembers) return { isLoading: membershipsLoading, isReady: membershipsReady, isError: membershipsError }
    if (isGroupPages) return { isLoading: groupPagesLoading, isReady: groupPagesReady, isError: groupPagesError }
    if (isEvents) return { isLoading: eventsLoading, isReady: eventsReady, isError: eventsError }
    return { isLoading: false, isReady: true, isError: false }
  }, [
    isAnnouncements, announcementsLoading, announcementsError,
    isSermons, isSubgroups, isMembers, isGroupPages, isEvents,
    sermonsLoading, sermonsReady, sermonsError,
    subgroupsLoading, subgroupsReady, subgroupsError,
    membershipsLoading, membershipsReady, membershipsError,
    groupPagesLoading, groupPagesReady, groupPagesError,
    eventsLoading, eventsReady, eventsError,
  ])

  // When using a collection that hasn't started loading yet but also hasn't errored,
  // treat it as loading to avoid flashing empty state
  const effectiveLoading = !isReady && !isCollectionLoading && !hasError
    ? true
    : isCollectionLoading

  // Build the error (only if collection has failed)
  const error = useMemo(() => {
    if (!hasError) return null
    if (isAnnouncements) return new Error('Failed to load announcements')
    if (isSermons) return new Error('Failed to load sermons')
    if (isSubgroups) return new Error('Failed to load subgroups')
    if (isMembers) return new Error('Failed to load members')
    if (isGroupPages) return new Error('Failed to load pages')
    if (isEvents) return new Error('Failed to load events')
    return null
  }, [hasError, isAnnouncements, isSermons, isSubgroups, isMembers, isGroupPages, isEvents])

  return {
    data: result,
    isLoading: !isReady && effectiveLoading,
    isReady,
    error,
  }
}
