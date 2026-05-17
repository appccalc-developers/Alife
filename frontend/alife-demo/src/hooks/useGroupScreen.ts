import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { useQueryClient } from '@tanstack/react-query'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { eventService } from '../services/eventService'
import { useAuthStore } from '../stores/auth'
import { conditionalGet } from '../db/httpCache'
import { groupQueryKey, getCachedSubgroups } from '../db/collections/groupCollection'
import { subgroupsCollection } from '../db/collections/groupCollection'
import { groupPagesCollection, getCachedGroupPages } from '../db/collections/groupCollection'
import { groupMembershipsCollection, getCachedGroupMemberships } from '../db/collections/groupCollection'
import type { GroupDto, GroupTab, PageSummaryDto } from '../types/group'
import type { GroupEventRecord } from '../types/event'
import type { GroupDto, GroupTab, PageSummaryDto } from '../types/group'

type MembershipStatusLabel = 'Not joined' | 'Requested' | 'Approved' | 'Invited'
type MembershipRole = 'Member' | 'CoLeader' | 'Leader' | null
export type GroupMemberToolRow = {
  memberId: string
  status: 'Invited' | 'Requested' | 'Approved' | 'Rejected' | 'Removed'
  role: 'Member' | 'CoLeader' | 'Leader'
  createdUtc?: string
  updatedUtc?: string
}

export const useGroupScreen = (groupId: string) => {
  const auth = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<GroupTab>('overview')
  const [group, setGroup] = useState<GroupDto | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [events, setEvents] = useState<GroupEventRecord[]>([])

  // group（单个对象，用 conditionalGet）
  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setGroupLoading(true)
    conditionalGet<GroupDto>({
      queryKey: groupQueryKey(groupId),
      path: `/api/groups/${groupId}`,
    })
      .then((data) => {
        if (!cancelled) setGroup(data)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load group.')
      })
      .finally(() => {
        if (!cancelled) setGroupLoading(false)
      })
    return () => { cancelled = true }
  }, [groupId])

  // subgroups（数组，用 useLiveQuery）
  const subCollection = useMemo(() => (groupId ? subgroupsCollection(groupId) : null), [groupId])
  const { data: subgroups = [] } = useLiveQuery(subCollection as NonNullable<typeof subCollection>)

  // pages（数组，用 useLiveQuery）
  const pagesColl = useMemo(() => (groupId ? groupPagesCollection(groupId, auth.language) : null), [groupId, auth.language])
  const { data: pages = [] } = useLiveQuery(pagesColl as NonNullable<typeof pagesColl>)

  // memberships（数组，用 useLiveQuery）
  const membershipsColl = useMemo(() => (groupId ? groupMembershipsCollection(groupId) : null), [groupId])
  const { data: membershipsRaw = [] } = useLiveQuery(membershipsColl as NonNullable<typeof membershipsColl>)
  const memberships = useMemo(() => membershipsRaw as GroupMemberToolRow[], [membershipsRaw])

  const membership = useMemo(
    () => auth.memberships.find((item) => item.groupId === groupId),
    [auth.memberships, groupId],
  )

  const membershipStatus = useMemo<MembershipStatusLabel>(() => {
    const status = membership?.status
    if (status === 'Requested' || status === 'Approved' || status === 'Invited') {
      return status
    }
    return 'Not joined'
  }, [membership?.status])

  const membershipRole = useMemo<MembershipRole>(() => membership?.role ?? null, [membership?.role])

  const canManageGroup = membership?.status === 'Approved' && (membership.role === 'Leader' || membership.role === 'CoLeader')
  const canCreatePage = membership?.status === 'Approved'
  const canEditAllPages = canManageGroup
  const canPublishPages = canManageGroup

  // Fetch events for leaders/co-leaders
  useEffect(() => {
    if (!groupId || !canManageGroup) return
    let cancelled = false
    eventService.getGroupEvents(groupId)
      .then((data) => { if (!cancelled) setEvents(data) })
      .catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [groupId, canManageGroup])

  const summary = useMemo(() => {
    if (!group) return ''
    return `${subgroups.length} subgroups - ${pages.length} pages - ${group.accessType}`
  }, [group, subgroups.length, pages.length])

  const loading = groupLoading

  const refreshSubgroups = useCallback(async () => {
    if (!groupId) return
    await queryClient.invalidateQueries({ queryKey: ['subgroups', groupId] })
    return getCachedSubgroups(groupId)
  }, [queryClient, groupId])

  const refreshPages = useCallback(async () => {
    if (!groupId) return
    await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId, auth.language] })
    return getCachedGroupPages(groupId, auth.language)
  }, [queryClient, groupId, auth.language])

  const refreshMemberships = useCallback(async () => {
    if (!groupId || !canManageGroup) return []
    await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
    return getCachedGroupMemberships(groupId)
  }, [queryClient, groupId, canManageGroup])

  const joinOrRequest = useCallback(async () => {
    if (!groupId) return
    const result = await groupService.requestJoin(groupId)
    setStatusMessage(`Join status: ${result.status}`)
    await auth.fetchMe()
  }, [groupId, auth])

  const addSubgroup = useCallback(
    async (name: string, accessType: GroupDto['accessType']) => {
      if (!groupId) return
      await groupService.createSubgroup(groupId, { name, accessType })
      await queryClient.invalidateQueries({ queryKey: ['subgroups', groupId] })
      setStatusMessage('Subgroup added.')
    },
    [groupId, queryClient],
  )

  const inviteMember = useCallback(
    async (targetPhoneE164: string) => {
      if (!groupId) return
      await groupService.inviteMember(groupId, { targetPhoneE164 })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage('Invite sent.')
    },
    [groupId, queryClient],
  )

  const approveMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.approveMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage('Member approved.')
    },
    [groupId, queryClient],
  )

  const rejectMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.rejectMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage('Member request rejected.')
    },
    [groupId, queryClient],
  )

  const kickMember = useCallback(
    async (memberId: string) => {
      if (!groupId) return
      await groupService.kickMember(groupId, { memberId })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage('Member removed.')
    },
    [groupId, queryClient],
  )

  const setCoLeader = useCallback(
    async (memberId: string, isCoLeader: boolean) => {
      if (!groupId) return
      await groupService.setCoLeader(groupId, { memberId, isCoLeader })
      await queryClient.invalidateQueries({ queryKey: ['groupMemberships', groupId] })
      setStatusMessage(isCoLeader ? 'Co-leader set.' : 'Co-leader reset.')
    },
    [groupId, queryClient],
  )

  const editSubgroup = useCallback(async (subgroupId: string) => {
    await groupService.updateSubgroup(subgroupId, { name: 'TODO', accessType: 'Protected' })
  }, [])

  const deleteSubgroup = useCallback(async (subgroupId: string) => {
    await groupService.deleteSubgroup(subgroupId)
  }, [])

  const deletePage = useCallback(
    async (pageId: string) => {
      await pageService.deletePage(pageId)
      await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId, auth.language] })
      setStatusMessage('Page deleted.')
    },
    [queryClient, groupId, auth.language],
  )

  const togglePageVisibility = useCallback(
    async (page: PageSummaryDto) => {
      const nextVisibility = page.visibility === 'InvisibleDraft' ? 'VisibleToGroup' : 'InvisibleDraft'
      await pageService.publishPage(page.id, { visibility: nextVisibility })
      await queryClient.invalidateQueries({ queryKey: ['groupPages', groupId, auth.language] })
      setStatusMessage(nextVisibility === 'VisibleToGroup' ? 'Page published.' : 'Page moved to draft.')
    },
    [queryClient, groupId, auth.language],
  )

  const deleteEvent = useCallback(
    async (eventId: string) => {
      if (!groupId) return
      await eventService.deleteGroupEvent(groupId, eventId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      setStatusMessage('Event deleted.')
    },
    [groupId],
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
    inviteMember,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    editSubgroup,
    deleteSubgroup,
    deletePage,
    togglePageVisibility,
    deleteEvent,
  }
}

