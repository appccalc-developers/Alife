import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { useQueryClient } from '@tanstack/react-query'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { eventService } from '../services/eventService'
import { useAuthStore } from '../stores/auth'
import { removeCachedRecord } from '../db/httpCache'
import { normalizeGroup } from '../utils/apiEnums'
import { ensureGroupForViewer, groupQueryKey, getCachedSubgroups, subgroupsQueryKey } from '../db/collections/groupCollection'
import { subgroupsCollection } from '../db/collections/groupCollection'
import { groupPagesCollection, getCachedGroupPages } from '../db/collections/groupCollection'
import { groupMembershipsCollection, getCachedGroupMemberships } from '../db/collections/groupCollection'
import { useUiText } from '../i18n/uiText'
import type { GroupDto, GroupTab, PageSummaryDto, PageVisibility } from '../types/group'
import type { LocalizedText } from '../types'
import type { GroupEventRecord } from '../types/event'

type MembershipStatusLabel = 'Not joined' | 'requested' | 'approved' | 'invited'
type MembershipRole = 'member' | 'coLeader' | 'leader' | null
export type GroupMemberToolRow = {
  memberId: string
  displayName?: string
  status: 'invited' | 'requested' | 'approved' | 'rejected' | 'removed'
  role: 'member' | 'coLeader' | 'leader'
  platformRole?: 'user' | 'admin' | 'superadmin' | string
  platformRoles?: string[]
  createdUtc?: string
  updatedUtc?: string
}

type GroupScreenOptions = {
  loadEvents?: boolean
}

export const useGroupScreen = (groupId: string, options: GroupScreenOptions = {}) => {
  const auth = useAuthStore()
  const t = useUiText()
  const queryClient = useQueryClient()
  const shouldLoadEvents = options.loadEvents === true
  const [activeTab, setActiveTab] = useState<GroupTab>('overview')
  const [loadedGroup, setLoadedGroup] = useState<GroupDto | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [events, setEvents] = useState<GroupEventRecord[]>([])
  const group = loadedGroup?.id === groupId ? loadedGroup : null

  // The shell validates the active group; the screen shares that viewer-scoped result.
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setGroupLoading(true)
    ensureGroupForViewer(groupId, auth.me?.id)
      .then((data) => {
        if (!cancelled) setLoadedGroup(normalizeGroup(data))
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('groupLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setGroupLoading(false)
      })
    return () => { cancelled = true }
  }, [auth.me?.id, groupId])

  const canPubliclyBrowseGroup = group?.isChurch || group?.accessType === 'public'

  // Load subgroups as a live collection.
  const canLoadSubgroups = !auth.isGuest || Boolean(canPubliclyBrowseGroup)
  const subCollection = useMemo(() => (groupId ? subgroupsCollection(groupId, canLoadSubgroups) : null), [canLoadSubgroups, groupId])
  const { data: subgroups = [] } = useLiveQuery(
    () => subCollection ?? undefined,
    [subCollection],
  )

  // Load pages as a live collection.
  const pagesColl = useMemo(() => (groupId ? groupPagesCollection(groupId) : null), [groupId])
  const { data: pages = [] } = useLiveQuery(
    () => pagesColl ?? undefined,
    [pagesColl],
  )

  // Load memberships as a live collection.
  const canLoadMemberships = !auth.isGuest && auth.canManageGroup(groupId)
  const includeLineCandidates = canLoadMemberships && group?.isChurch === true
  const membershipsColl = useMemo(
    () => (groupId ? groupMembershipsCollection(groupId, canLoadMemberships, includeLineCandidates) : null),
    [canLoadMemberships, groupId, includeLineCandidates],
  )
  const { data: membershipsRaw = [] } = useLiveQuery(
    () => membershipsColl ?? undefined,
    [membershipsColl],
  )
  const memberships = useMemo(() => membershipsRaw as GroupMemberToolRow[], [membershipsRaw])

  const membership = useMemo(
    () => auth.memberships.find((item) => item.groupId === groupId),
    [auth.memberships, groupId],
  )

  const membershipStatus = useMemo<MembershipStatusLabel>(() => {
    const status = membership?.status
    if (status === 'requested' || status === 'approved' || status === 'invited') {
      return status
    }
    return 'Not joined'
  }, [membership?.status])

  const membershipRole = useMemo<MembershipRole>(() => membership?.role ?? null, [membership?.role])

  const isPlatformAdmin = auth.isAdmin || auth.me?.platformRole === 'admin' || auth.me?.platformRole === 'superadmin'
  const canManageGroup = isPlatformAdmin || (membership?.status === 'approved' && (membership.role === 'leader' || membership.role === 'coLeader'))
  const canCreatePage = isPlatformAdmin || membership?.status === 'approved'
  const canEditAllPages = canManageGroup
  const canPublishPages = canManageGroup
  const canLoadEvents = shouldLoadEvents && Boolean(groupId) && (membership?.status === 'approved' || Boolean(canPubliclyBrowseGroup))
  const eventViewerId = auth.me?.id || 'guest'

  // Fetch events for approved members and for public group access.
  useEffect(() => {
    if (!canLoadEvents) {
      setEvents([])
      return
    }

    let cancelled = false
    eventService.getGroupEvents(groupId, eventViewerId)
      .then((data) => { if (!cancelled) setEvents(data) })
      .catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [canLoadEvents, eventViewerId, groupId])

  const summary = useMemo(() => {
    if (!group) return ''
    return t('groupSummaryLine', {
      subgroups: subgroups.length,
      pages: pages.length,
      access: t(group.accessType),
    })
  }, [group, pages.length, subgroups.length, t])

  const loading = groupLoading

  const refreshSubgroups = useCallback(async () => {
    if (!groupId) return
    await queryClient.invalidateQueries({ queryKey: ['subgroups', groupId] })
    return getCachedSubgroups(groupId)
  }, [queryClient, groupId])

  const refreshPages = useCallback(async () => {
    if (!groupId) return
    await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId] })
    return getCachedGroupPages(groupId)
  }, [queryClient, groupId])

  const refreshMemberships = useCallback(async () => {
    if (!groupId || !canManageGroup) return []
    await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
    return getCachedGroupMemberships(groupId)
  }, [queryClient, groupId, canManageGroup])

  const joinOrRequest = useCallback(async () => {
    if (!groupId) return
    const result = await groupService.requestJoin(groupId)
    const localizedStatus =
      result.status === 'approved'
        ? t('approved')
        : result.status === 'requested'
          ? t('requested')
          : result.status === 'invited'
            ? t('invited')
            : result.status === 'rejected'
              ? t('rejected')
              : result.status === 'removed'
                ? t('removed')
                : result.status
    setStatusMessage(t('joinStatus', { status: localizedStatus }))
    await auth.fetchMe()
  }, [auth, groupId, t])

  const addSubgroup = useCallback(
    async (name: LocalizedText, accessType: GroupDto['accessType'], description?: LocalizedText) => {
      if (!groupId) return null
      const subgroup = await groupService.createSubgroup(groupId, { name, description, accessType })
      await queryClient.invalidateQueries({ queryKey: ['subgroups', groupId] })
      await auth.fetchMe()
      setStatusMessage(t('subgroupAdded'))
      return subgroup
    },
    [auth, groupId, queryClient, t],
  )

  const updateGroup = useCallback(
    async (payload: { name: LocalizedText; description?: LocalizedText; accessType: GroupDto['accessType']; isClosed: boolean }) => {
      if (!groupId) return null
      const updated = await groupService.updateGroup(groupId, payload)
      setLoadedGroup(updated)
      await removeCachedRecord(groupQueryKey(groupId))
      await queryClient.invalidateQueries({ queryKey: groupQueryKey(groupId) })
      if (updated.parentGroupId) {
        await queryClient.invalidateQueries({ queryKey: ['subgroups', updated.parentGroupId] })
      }
      setStatusMessage(t('groupUpdated'))
      return updated
    },
    [groupId, queryClient, t],
  )

  const inviteMember = useCallback(
    async (targetPhoneE164: string) => {
      if (!groupId) return
      await groupService.inviteMember(groupId, { targetPhoneE164 })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(t('inviteSent'))
    },
    [groupId, queryClient, t],
  )

  const inviteMemberById = useCallback(
    async (targetMemberId: string) => {
      if (!groupId) return
      await groupService.inviteMemberById(groupId, targetMemberId)
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
    },
    [groupId, queryClient],
  )

  const approveMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.approveMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(t('memberApprovedSuccess'))
    },
    [groupId, queryClient, t],
  )

  const rejectMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.rejectMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(t('memberRequestRejected'))
    },
    [groupId, queryClient, t],
  )

  const kickMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.kickMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(t('memberRemovedSuccess'))
    },
    [groupId, queryClient, t],
  )

  const setCoLeader = useCallback(
    async (memberId: string, isCoLeader: boolean) => {
      if (!groupId) return
      await groupService.setCoLeader(groupId, { memberId, isCoLeader })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(isCoLeader ? t('coLeaderSetSuccess') : t('coLeaderResetSuccess'))
    },
    [groupId, queryClient, t],
  )

  const transferLeadership = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.transferLeadership(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      await auth.fetchMe()
      setStatusMessage(t('leadershipTransferSuccess'))
    },
    [auth, groupId, queryClient, t],
  )

  const editSubgroup = useCallback(async (subgroupId: string) => {
    await groupService.updateSubgroup(subgroupId, { name: { en: 'TODO', zh: 'TODO' }, accessType: 'protected' })
  }, [])

  const deleteSubgroup = useCallback(async (subgroupId: string) => {
    if (!groupId) return
    await groupService.deleteSubgroup(subgroupId)
    await removeCachedRecord(subgroupsQueryKey(groupId))
    await queryClient.invalidateQueries({ queryKey: ['subgroups', groupId] })
    setStatusMessage(t('subgroupDeleted'))
  }, [groupId, queryClient, t])

  const closeGroup = useCallback(async () => {
    if (!groupId) return
    await groupService.closeGroup(groupId)
    await removeCachedRecord(groupQueryKey(groupId))
    await queryClient.invalidateQueries({ queryKey: groupQueryKey(groupId) })
    if (group?.parentGroupId) {
      await removeCachedRecord(subgroupsQueryKey(group.parentGroupId))
      await queryClient.invalidateQueries({ queryKey: ['subgroups', group.parentGroupId] })
    }
    setStatusMessage(t('groupDeleted'))
  }, [group?.parentGroupId, groupId, queryClient, t])

  const deletePage = useCallback(
    async (pageId: string) => {
      await pageService.deletePage(pageId)
      await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId] })
      setStatusMessage(t('pageDeleted'))
    },
    [queryClient, groupId, t],
  )

  const updatePageVisibility = useCallback(
    async (page: PageSummaryDto, nextVisibility: PageVisibility) => {
      if (page.visibility === nextVisibility) {
        return
      }

      await pageService.publishPage(page.id, { visibility: nextVisibility })
      await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId] })
      setStatusMessage(nextVisibility === 'draft' ? t('pageMovedToDraft') : t('pagePublished'))
    },
    [queryClient, groupId, t],
  )

  const deleteEvent = useCallback(
    async (eventId: string) => {
      if (!groupId) return
      await eventService.deleteGroupEvent(eventId, groupId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      setStatusMessage(t('eventDeleted'))
    },
    [groupId, t],
  )

  const refreshEvents = useCallback(async () => {
    if (!groupId) return
    const data = await eventService.getGroupEvents(groupId)
    setEvents(data)
  }, [groupId])

  return {
    activeTab,
    setActiveTab,
    group,
    subgroups,
    pages,
    memberships,
    events,
    loading,
    error,
    statusMessage,
    setStatusMessage,
    membership,
    membershipStatus,
    membershipRole,
    canManageGroup,
    canCreatePage,
    canEditAllPages,
    canPublishPages,
    summary,
    load: refreshSubgroups,
    refreshSubgroups,
    refreshPages,
    refreshMemberships,
    refreshEvents,
    joinOrRequest,
    addSubgroup,
    updateGroup,
    inviteMember,
    inviteMemberById,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    transferLeadership,
    editSubgroup,
    deleteSubgroup,
    closeGroup,
    deletePage,
    updatePageVisibility,
    deleteEvent,
  }
}
