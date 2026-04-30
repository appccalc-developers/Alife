import { useEffect, useMemo, useState } from 'react'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupDto, GroupSummaryDto, GroupTab, PageSummaryDto } from '../types/group'

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
  const [activeTab, setActiveTab] = useState<GroupTab>('overview')
  const [group, setGroup] = useState<GroupDto | null>(null)
  const [subgroups, setSubgroups] = useState<GroupSummaryDto[]>([])
  const [pages, setPages] = useState<PageSummaryDto[]>([])
  const [memberships, setMemberships] = useState<GroupMemberToolRow[]>([])
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

  const load = async () => {
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
  }

  const refreshSubgroups = async () => {
    if (!groupId) {
      return
    }

    const next = await groupService.getSubgroups(groupId)
    setSubgroups(next)
    return next
  }

  const refreshPages = async () => {
    if (!groupId) {
      return
    }

    const next = await groupService.getGroupPages(groupId, auth.language)
    setPages(next)
    return next
  }

  const refreshMemberships = async () => {
    if (!groupId || !canManageGroup) {
      setMemberships([])
      return []
    }

    const next = await groupService.getGroupMemberships(groupId)
    setMemberships(next)
    return next
  }

  const joinOrRequest = async () => {
    if (!groupId) {
      return
    }

    const result = await groupService.requestJoin(groupId)
    setStatusMessage(`Join status: ${result.status}`)
    await auth.fetchMe()
  }

  const addSubgroup = async (name: string, accessType: GroupDto['accessType']) => {
    if (!groupId) {
      return
    }

    await groupService.createSubgroup(groupId, { name, accessType })
    await refreshSubgroups()
    setStatusMessage('Subgroup added.')
  }

  const inviteMember = async (targetPhoneE164: string) => {
    if (!groupId) {
      return
    }

    await groupService.inviteMember(groupId, { targetPhoneE164 })
    await refreshMemberships()
    setStatusMessage('Invite sent.')
  }

  const approveMember = async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.approveMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member approved.')
  }

  const rejectMember = async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.rejectMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member request rejected.')
  }

  const kickMember = async (memberId: string) => {
    if (!groupId) {
      return
    }

    await groupService.kickMember(groupId, { memberId })
    await refreshMemberships()
    setStatusMessage('Member removed.')
  }

  const setCoLeader = async (memberId: string, isCoLeader: boolean) => {
    if (!groupId) {
      return
    }

    await groupService.setCoLeader(groupId, { memberId, isCoLeader })
    await refreshMemberships()
    setStatusMessage(isCoLeader ? 'Co-leader set.' : 'Co-leader reset.')
  }

  const editSubgroup = async (subgroupId: string) => {
    await groupService.updateSubgroup(subgroupId, { name: 'TODO', accessType: 'Protected' })
  }

  const deleteSubgroup = async (subgroupId: string) => {
    await groupService.deleteSubgroup(subgroupId)
  }

  const deletePage = async (pageId: string) => {
    await pageService.deletePage(pageId)
    await refreshPages()
    setStatusMessage('Page deleted.')
  }

  const togglePageVisibility = async (page: PageSummaryDto) => {
    const nextVisibility = page.visibility === 'InvisibleDraft' ? 'VisibleToGroup' : 'InvisibleDraft'
    await pageService.publishPage(page.id, { visibility: nextVisibility })
    await refreshPages()
    setStatusMessage(nextVisibility === 'VisibleToGroup' ? 'Page published.' : 'Page moved to draft.')
  }

  useEffect(() => {
    load().catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Failed to load group screen.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, auth.language])

  useEffect(() => {
    refreshMemberships().catch(() => {
      setMemberships([])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, canManageGroup])

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
    editSubgroup,
    deleteSubgroup,
    deletePage,
    togglePageVisibility,
  }
}

