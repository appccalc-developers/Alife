import { useCallback, useEffect, useMemo, useState } from 'react'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, GroupTab, PageSummaryDto } from '../types/group'

type MembershipStatusLabel = 'Not joined' | 'Requested' | 'Approved' | 'Invited'
type MembershipRole = 'Member' | 'CoLeader' | 'Leader' | null
export type GroupMembershipRow = Omit<GroupMembershipDto, 'groupId'> & { memberId: string }

export const useGroupScreen = (groupId: string) => {
  const auth = useAuthStore()
  const [activeTab, setActiveTab] = useState<GroupTab>('overview')
  const [group, setGroup] = useState<GroupDto | null>(null)
  const [subgroups, setSubgroups] = useState<GroupSummaryDto[]>([])
  const [pages, setPages] = useState<PageSummaryDto[]>([])
  const [memberships, setMemberships] = useState<GroupMembershipRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

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

  const summary = useMemo(() => {
    if (!group) {
      return ''
    }

    return `${subgroups.length} subgroups - ${pages.length} pages - ${group.accessType}`
  }, [group, pages.length, subgroups.length])

  const load = useCallback(async () => {
    if (!groupId) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const [nextGroup, nextSubgroups, nextPages] = await Promise.all([
        groupService.getGroup(groupId),
        groupService.getSubgroups(groupId),
        groupService.getGroupPages(groupId, auth.language),
      ])

      setGroup(nextGroup)
      setSubgroups(nextSubgroups)
      setPages(nextPages)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load group screen.')
    } finally {
      setLoading(false)
    }
  }, [auth.language, groupId])

  const refreshSubgroups = useCallback(async () => {
    if (!groupId) {
      return
    }

    const next = await groupService.getSubgroups(groupId)
    setSubgroups(next)
    return next
  }, [groupId])

  const refreshPages = useCallback(async () => {
    if (!groupId) {
      return
    }

    const next = await groupService.getGroupPages(groupId, auth.language)
    setPages(next)
    return next
  }, [auth.language, groupId])

  const refreshMemberships = useCallback(async () => {
    if (!groupId || !canManageGroup) {
      setMemberships([])
      return []
    }

    const next = await groupService.getGroupMemberships(groupId)
    setMemberships(next)
    return next
  }, [canManageGroup, groupId])

  const joinOrRequest = useCallback(async () => {
    if (!groupId) {
      return
    }

    const result = await groupService.requestJoin(groupId)
    setStatusMessage(`Join status: ${result.status}`)
    await auth.fetchMe()
  }, [auth, groupId])

  const addSubgroup = useCallback(async (name: string, accessType: GroupDto['accessType']) => {
    if (!groupId) {
      return
    }

    await groupService.createSubgroup(groupId, { name, accessType })
    await refreshSubgroups()
    setStatusMessage('Subgroup added.')
  }, [groupId, refreshSubgroups])

  const inviteMember = useCallback(async (targetPhoneE164: string) => {
    if (!groupId) {
      return
    }

    await groupService.inviteMember(groupId, { targetPhoneE164 })
    setStatusMessage('Invite sent.')
  }, [groupId])

  const approveMember = useCallback(async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.approveMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member approved.')
  }, [groupId, refreshMemberships])

  const rejectMember = useCallback(async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.rejectMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member rejected.')
  }, [groupId, refreshMemberships])

  const kickMember = useCallback(async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.kickMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member removed.')
  }, [groupId, refreshMemberships])

  const setCoLeader = useCallback(async (memberId: string, isCoLeader: boolean) => {
    if (!groupId) {
      return
    }

    await groupService.setCoLeader(groupId, { memberId, isCoLeader })
    await refreshMemberships()
    setStatusMessage(isCoLeader ? 'Co-leader set.' : 'Co-leader reset.')
  }, [groupId, refreshMemberships])

  const closeGroup = useCallback(async () => {
    if (!groupId) {
      return
    }

    await groupService.closeGroup(groupId)
    await load()
    setStatusMessage('Group deactivated.')
  }, [groupId, load])

  const editSubgroup = useCallback(async (subgroupId: string) => {
    await groupService.updateSubgroup(subgroupId, { name: 'TODO', accessType: 'Protected' })
  }, [])

  const deleteSubgroup = useCallback(async (subgroupId: string) => {
    await groupService.deleteSubgroup(subgroupId)
  }, [])

  const deletePage = useCallback(async (pageId: string) => {
    await pageService.deletePage(pageId)
    await refreshPages()
    setStatusMessage('Page deleted.')
  }, [refreshPages])

  const togglePageVisibility = useCallback(async (page: PageSummaryDto) => {
    const nextVisibility = page.visibility === 'InvisibleDraft' ? 'VisibleToGroup' : 'InvisibleDraft'
    await pageService.publishPage(page.id, { visibility: nextVisibility })
    await refreshPages()
    setStatusMessage(nextVisibility === 'VisibleToGroup' ? 'Page published.' : 'Page moved to draft.')
  }, [refreshPages])

  useEffect(() => {
    load().catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Failed to load group screen.')
    })
  }, [load])

  useEffect(() => {
    refreshMemberships().catch(() => {
      setMemberships([])
    })
  }, [refreshMemberships])

  return {
    activeTab,
    setActiveTab,
    group,
    subgroups,
    pages,
    memberships,
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
    load,
    refreshSubgroups,
    refreshPages,
    refreshMemberships,
    joinOrRequest,
    addSubgroup,
    inviteMember,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    closeGroup,
    editSubgroup,
    deleteSubgroup,
    deletePage,
    togglePageVisibility,
  }
}

