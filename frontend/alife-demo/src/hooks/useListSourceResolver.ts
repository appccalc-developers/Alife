import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { sermonsCollection } from '../db/collections/sermonsCollection'
import {
  subgroupsCollection,
  groupMembershipsCollection,
  groupPagesCollection,
} from '../db/collections/groupCollection'
import { globalPagesCollection } from '../db/collections/pageCollection'
import { useAuthStore } from '../stores/auth'
import type { ListViewMetadata } from '../types/page-editor'
import type { SermonDto } from '../services/sermonService'

interface ListSourceResult {
  data: any[] | undefined
  isLoading: boolean
  isReady: boolean
  error: Error | null
}

export type ListSourceResolverOptions = {
  /** Overrides URL :groupId (e.g. page editor at /pages/:id/edit?groupId=...) */
  groupId?: string
}

/**
 * Resolves a ListViewMetadata config to the appropriate TanStack DB collection query.
 *
 * Strategy (Local-First):
 * 1. Render: renders immediately from local DB (useLiveQuery)
 * 2. Fetch: if local collection is empty, triggers an API call via conditionalGet to the .NET API
 * 3. Persist: Results stored in TanStack DB via httpCache (conditionalGet writes to idb-keyval)
 */
export function useListSourceResolver(metadata: ListViewMetadata, options?: ListSourceResolverOptions): ListSourceResult {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const auth = useAuthStore()

  const currentGroupId = (options?.groupId?.trim() || routeGroupId || '').trim()
  const sourceType = metadata.sourceType
  const sourceScope = metadata.sourceScope
  const limit = Math.min(Math.max(metadata.limit || 10, 1), 50)

  // Determine the config for the query
  const queryConfig = useMemo(() => {
    let isGlobal = false

    switch (sourceType) {
      case 'sermons':
        isGlobal = true
        break
      case 'members':
      case 'subgroups':
        isGlobal = false
        break
      case 'events':
      case 'pages':
        isGlobal = sourceScope === 'global'
        break
      default:
        isGlobal = true
    }

    return { isGlobal, limit }
  }, [sourceType, sourceScope, limit])

  // ----- useLiveQuery: use callback that returns a Collection or `undefined` -----
  // Do not pass `undefined` as the direct collection overload (crashes in _getQuery).
  // Do not rely on q.from().select(({ row }) => row) here — returning the collection matches SermonList.

  const isSermons = sourceType === 'sermons'
  const isSubgroups = sourceType === 'subgroups'
  const isMembers = sourceType === 'members'
  const isGroupPages = sourceType === 'pages' && !queryConfig.isGlobal
  const isGlobalPages = sourceType === 'pages' && queryConfig.isGlobal

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

  // Subgroups (group-scoped)
  const subgroupsLive = useLiveQuery(
    () => {
      if (!isSubgroups || !currentGroupId) return undefined
      return subgroupsCollection(currentGroupId)
    },
    [isSubgroups, currentGroupId],
  )
  const subgroupsData = isSubgroups
    ? ((subgroupsLive.data ?? []) as Array<{ id: string; name: string; accessType: string; parentGroupId: string | null }>)
    : ([] as Array<{ id: string; name: string; accessType: string; parentGroupId: string | null }>)
  const subgroupsLoading = isSubgroups ? (subgroupsLive.isLoading ?? true) : false
  const subgroupsReady = isSubgroups ? (subgroupsLive.isReady ?? false) : true
  const subgroupsError = isSubgroups ? (subgroupsLive.isError ?? false) : false

  // Members (group-scoped)
  const membershipsLive = useLiveQuery(
    () => {
      if (!isMembers || !currentGroupId) return undefined
      return groupMembershipsCollection(currentGroupId)
    },
    [isMembers, currentGroupId],
  )
  const membershipsData = isMembers
    ? ((membershipsLive.data ?? []) as Array<{ memberId: string; status: string; role: string }>)
    : ([] as Array<{ memberId: string; status: string; role: string }>)
  const membershipsLoading = isMembers ? (membershipsLive.isLoading ?? true) : false
  const membershipsReady = isMembers ? (membershipsLive.isReady ?? false) : true
  const membershipsError = isMembers ? (membershipsLive.isError ?? false) : false

  // Group-scoped pages
  const groupPagesLive = useLiveQuery(
    () => {
      if (!isGroupPages || !currentGroupId) return undefined
      return groupPagesCollection(currentGroupId, auth.language)
    },
    [isGroupPages, currentGroupId, auth.language],
  )
  const groupPagesData = isGroupPages ? ((groupPagesLive.data ?? []) as any[]) : ([] as any[])
  const groupPagesLoading = isGroupPages ? (groupPagesLive.isLoading ?? true) : false
  const groupPagesReady = isGroupPages ? (groupPagesLive.isReady ?? false) : true
  const groupPagesError = isGroupPages ? (groupPagesLive.isError ?? false) : false

  // Global pages
  const globalPagesLive = useLiveQuery(
    () => {
      if (!isGlobalPages) return undefined
      return globalPagesCollection(auth.language)
    },
    [isGlobalPages, auth.language],
  )
  const globalPagesData = isGlobalPages ? ((globalPagesLive.data ?? []) as any[]) : ([] as any[])
  const globalPagesLoading = isGlobalPages ? (globalPagesLive.isLoading ?? true) : false
  const globalPagesReady = isGlobalPages ? (globalPagesLive.isReady ?? false) : true
  const globalPagesError = isGlobalPages ? (globalPagesLive.isError ?? false) : false

  // Build the result data based on source type
  const result = useMemo(() => {
    switch (sourceType) {
      case 'sermons':
        return (sermonsData as SermonDto[]).slice(0, queryConfig.limit)
      case 'subgroups':
        return (subgroupsData as Array<{ id: string; name: string; accessType: string; parentGroupId: string | null }>)
          .filter((s) => s.parentGroupId === currentGroupId)
          .slice(0, queryConfig.limit)
      case 'members':
        return (membershipsData as Array<{ memberId: string; status: string; role: string }>)
          .filter((m) => m.status === 'Approved')
          .slice(0, queryConfig.limit)
      case 'pages':
        if (queryConfig.isGlobal) {
          return (globalPagesData as any[]).slice(0, queryConfig.limit)
        }
        return (groupPagesData as any[]).slice(0, queryConfig.limit)
      case 'events':
        return []
      default:
        return []
    }
  }, [sourceType, sermonsData, subgroupsData, membershipsData, groupPagesData, globalPagesData, queryConfig.limit, currentGroupId])

  // Determine loading/ready/error state from the active source
  const { isLoading: isCollectionLoading, isReady, isError: hasError } = useMemo(() => {
    if (isSermons) return { isLoading: sermonsLoading, isReady: sermonsReady, isError: sermonsError }
    if (isSubgroups) return { isLoading: subgroupsLoading, isReady: subgroupsReady, isError: subgroupsError }
    if (isMembers) return { isLoading: membershipsLoading, isReady: membershipsReady, isError: membershipsError }
    if (isGroupPages) return { isLoading: groupPagesLoading, isReady: groupPagesReady, isError: groupPagesError }
    if (isGlobalPages) return { isLoading: globalPagesLoading, isReady: globalPagesReady, isError: globalPagesError }
    return { isLoading: false, isReady: true, isError: false }
  }, [
    isSermons, isSubgroups, isMembers, isGroupPages, isGlobalPages,
    sermonsLoading, sermonsReady, sermonsError,
    subgroupsLoading, subgroupsReady, subgroupsError,
    membershipsLoading, membershipsReady, membershipsError,
    groupPagesLoading, groupPagesReady, groupPagesError,
    globalPagesLoading, globalPagesReady, globalPagesError,
  ])

  // Build the error (only if collection has failed)
  const error = useMemo(() => {
    if (!hasError) return null
    if (isSermons) return new Error('Failed to load sermons')
    if (isSubgroups) return new Error('Failed to load subgroups')
    if (isMembers) return new Error('Failed to load members')
    if (isGroupPages || isGlobalPages) return new Error('Failed to load pages')
    return null
  }, [hasError, isSermons, isSubgroups, isMembers, isGroupPages, isGlobalPages])

  return {
    data: result,
    isLoading: !isReady && isCollectionLoading,
    isReady,
    error,
  }
}
