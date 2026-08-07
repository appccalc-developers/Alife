import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { groupPagesQueryKey, groupQueryKey, subgroupsQueryKey } from '../../db/collections/groupCollection'
import { conditionalGet } from '../../db/httpCache'
import { useActiveEntityIds } from '../../hooks/useActiveEntityIds'
import { activeEntityService } from '../../services/activeEntityService'
import { groupService } from '../../services/groupService'
import { useAuthStore } from '../../stores/auth'
import { useCurrentGroupStore } from '../../stores/currentGroup'
import { useLeaderUiPreferences } from '../../stores/leaderUiPreferences'
import type { GroupDto, GroupSummaryDto, PageSummaryDto } from '../../types'
import { normalizeGroup, normalizePageSummary } from '../../utils/apiEnums'
import { normalizeRouteGroupId } from '../../utils/groupRouteIds'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { eventService } from '../../services/eventService'
import type { GroupEventRecord } from '../../types/event'

export const useShellContext = () => {
  const auth = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const { preferences } = useLeaderUiPreferences(auth.me?.id)
  const location = useLocation()
  const navigate = useNavigate()
  const [currentGroupPages, setCurrentGroupPages] = useState<PageSummaryDto[]>([])
  const [currentSubgroups, setCurrentSubgroups] = useState<GroupSummaryDto[]>([])
  const [contextualGroup, setContextualGroup] = useState<GroupSummaryDto | null>(null)
  const [churchGroup, setChurchGroup] = useState<GroupSummaryDto | null>(null)
  const [contextualEvent, setContextualEvent] = useState<GroupEventRecord | null>(null)
  const pagesGroupIdRef = useRef('')
  const groupDataIdRef = useRef('')

  const path = location.pathname
  const searchParams = new URLSearchParams(location.search)
  const groupScreenMatchCandidate = path.match(/^\/groups\/([^/]+)$/)
  const groupScreenMatch = groupScreenMatchCandidate && !['select', 'join', 'manage'].includes(groupScreenMatchCandidate[1])
    ? groupScreenMatchCandidate
    : null
  const groupJoinMatch = path.match(/^\/groups\/([^/]+)\/join$/)
  const groupManageMatch = path.match(/^\/groups\/([^/]+)\/manage$/)
  const groupCreatePageMatch = path.match(/^\/groups\/([^/]+)\/pages\/new$/)
  const groupEventCreateMatch = path.match(/^\/groups\/([^/]+)\/events\/new$/)
  const groupEventEditMatch = path.match(/^\/groups\/([^/]+)\/events\/([^/]+)\/edit$/)
  const groupEventDetailMatch = groupEventCreateMatch ? null : path.match(/^\/groups\/([^/]+)\/events\/([^/]+)$/)
  const groupEventEnrollmentMatch = path.match(/^\/groups\/([^/]+)\/events\/[^/]+\/enroll$/)
  const groupEventReviewMatch = path.match(/^\/groups\/([^/]+)\/events\/[^/]+\/review$/)
  const eventCreateMatch = path.match(/^\/events\/new$/)
  const eventEditMatch = path.match(/^\/events\/[^/]+\/edit$/)
  const sermonDetailMatch = path.match(/^\/sermons\/[^/]+$/)
  const pageEditMatch = path.match(/^\/pages\/([^/]+)\/edit$/)

  const routeGroupIds = [
    groupScreenMatch?.[1],
    groupJoinMatch?.[1],
    groupManageMatch?.[1],
    groupCreatePageMatch?.[1],
    groupEventDetailMatch?.[1],
    groupEventEnrollmentMatch?.[1],
    groupEventReviewMatch?.[1],
    groupEventCreateMatch?.[1],
    groupEventEditMatch?.[1],
  ].map(normalizeRouteGroupId)
  const routeGroupScreenId = routeGroupIds[0]
  const routeGroupManageId = routeGroupIds[2]
  const routeGroupCreatePageId = routeGroupIds[3]
  const routeGroupEventDetailId = routeGroupIds[4]
  const routeGroupEventEnrollmentId = routeGroupIds[5]
  const routeGroupEventReviewId = routeGroupIds[6]
  const routeSearchGroupId = normalizeRouteGroupId(searchParams.get('groupId'))

  const activeIds = useActiveEntityIds({
    groupId: routeGroupIds.find(Boolean) || routeSearchGroupId || undefined,
    pageId: pageEditMatch?.[1] || searchParams.get('page') || undefined,
    eventId: groupEventDetailMatch?.[2] || groupEventEditMatch?.[2] || eventEditMatch?.[0]?.split('/')[2] || undefined,
    sermonId: sermonDetailMatch?.[0]?.split('/')[2] || undefined,
  })

  const isGroupScreen = Boolean(routeGroupScreenId) || path === '/groups'
  const isManagementScreen = Boolean(routeGroupManageId) || path === '/groups/manage'
  const isPageEditorScreen = Boolean(routeGroupCreatePageId || pageEditMatch || path === '/pages/edit')
  const isEventScreen = Boolean(
    eventCreateMatch ||
    eventEditMatch ||
    groupEventCreateMatch ||
    groupEventEditMatch ||
    routeGroupEventDetailId ||
    routeGroupEventEnrollmentId ||
    routeGroupEventReviewId ||
    ['/events', '/events/enroll', '/events/review', '/events/edit'].includes(path),
  )
  const isSermonDetailScreen = Boolean(sermonDetailMatch || path === '/sermons/watch')
  const isProfileScreen = path === '/profile'
  const isOnboardingScreen = path === '/onboarding'
  const isGroupSelectScreen = path === '/groups/select'
  const contextualGroupId = isGroupSelectScreen
    ? ''
    : routeGroupIds.find(Boolean) ||
      activeIds.groupId ||
      ((eventCreateMatch || eventEditMatch || pageEditMatch) ? CurrentGroup?.id || '' : '')

  const membership = contextualGroupId ? auth.memberships.find((item) => item.groupId === contextualGroupId) : null
  const isPlatformAdmin = auth.isAdmin || auth.me?.platformRole === 'admin' || auth.me?.platformRole === 'superadmin'
  const canManageCurrentGroup = isPlatformAdmin || (membership?.status === 'approved' && (membership.role === 'leader' || membership.role === 'coLeader'))
  const canOpenCurrentGroupManagement = canManageCurrentGroup && preferences.exerciseGroupManagement
  const shouldUseGroupPageNav = (isGroupScreen || isPageEditorScreen) && !isManagementScreen && !isEventScreen
  const managementGroup = CurrentGroup?.id === contextualGroupId ? CurrentGroup : contextualGroup

  useEffect(() => {
    if (!contextualGroupId) {
      return
    }

    if (pagesGroupIdRef.current !== contextualGroupId) {
      pagesGroupIdRef.current = contextualGroupId
      setCurrentGroupPages([])
    }

    let cancelled = false
    conditionalGet<PageSummaryDto[]>({ queryKey: groupPagesQueryKey(contextualGroupId), path: `/api/groups/${contextualGroupId}/pages` })
      .then((pages) => {
        if (!cancelled) setCurrentGroupPages(pages.map(normalizePageSummary))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [contextualGroupId])

  useEffect(() => {
    if (!contextualGroupId || !shouldUseGroupPageNav || currentGroupPages.length === 0) return
    if (isGroupScreen) return
    if (!currentGroupPages.some((page) => page.id === activeIds.pageId)) {
      activeEntityService.setPage(currentGroupPages[0].id, contextualGroupId)
    }
  }, [activeIds.pageId, contextualGroupId, currentGroupPages, isGroupScreen, shouldUseGroupPageNav])

  useEffect(() => {
    if (!contextualGroupId) {
      setCurrentSubgroups([])
      setContextualGroup(null)
      groupDataIdRef.current = ''
      return
    }

    if (groupDataIdRef.current !== contextualGroupId) {
      groupDataIdRef.current = contextualGroupId
      setCurrentSubgroups([])
      setContextualGroup(null)
    }

    let cancelled = false
    conditionalGet<GroupDto>({ queryKey: groupQueryKey(contextualGroupId), path: `/api/groups/${contextualGroupId}` })
      .then((group) => {
        if (!cancelled) setContextualGroup(normalizeGroup(group))
      })
      .catch(() => undefined)

    if (auth.isGuest) {
      setCurrentSubgroups([])
    } else {
      conditionalGet<GroupSummaryDto[]>({ queryKey: subgroupsQueryKey(contextualGroupId), path: `/api/groups/${contextualGroupId}/subgroups` })
        .then((groups) => {
          if (!cancelled) setCurrentSubgroups(groups.map(normalizeGroup))
        })
        .catch(() => undefined)
    }
    return () => { cancelled = true }
  }, [auth.isGuest, contextualGroupId])

  useEffect(() => {
    const contextualEventId = groupEventDetailMatch?.[2] || (path === '/events' ? activeIds.eventId : '')
    if (!contextualGroupId || !contextualEventId) {
      setContextualEvent(null)
      return
    }

    let cancelled = false
    eventService.getGroupEvents(contextualGroupId)
      .then((events) => {
        if (!cancelled) setContextualEvent(events.find((event) => event.id === contextualEventId) ?? null)
      })
      .catch(() => {
        if (!cancelled) setContextualEvent(null)
      })

    return () => { cancelled = true }
  }, [activeIds.eventId, contextualGroupId, groupEventDetailMatch?.[2], path])

  useEffect(() => {
    if (!contextualGroup?.parentGroupId) {
      setChurchGroup(null)
      return
    }
    let cancelled = false
    groupService.getChurch().then((group) => {
      if (!cancelled) setChurchGroup(group)
    }).catch(() => {
      if (!cancelled) setChurchGroup(null)
    })
    return () => { cancelled = true }
  }, [contextualGroup?.parentGroupId])

  const openGroup = (groupId: string) => {
    const continueNavigation = () => {
      activeEntityService.setGroup(groupId, { clearPage: true })
      navigate('/groups')
    }

    if (confirmUnsavedChangesNavigation('/groups', continueNavigation)) {
      continueNavigation()
    }
  }

  const openSubgroup = (groupId: string) => {
    const subgroupMembership = auth.memberships.find((item) => item.groupId === groupId)
    const target = subgroupMembership?.status === 'approved' ? '/groups' : '/groups/join'
    const continueNavigation = () => {
      activeEntityService.setGroup(groupId, { clearPage: true })
      navigate(target)
    }

    if (confirmUnsavedChangesNavigation(target, continueNavigation)) {
      continueNavigation()
    }
  }

  return {
    activeIds,
    canOpenCurrentGroupManagement,
    churchGroup,
    contextualGroup,
    contextualGroupId,
    contextualEvent,
    currentGroup: CurrentGroup,
    currentGroupPages,
    currentSubgroups,
    groupEventDetailMatch,
    isEventScreen,
    isGroupScreen,
    isManagementScreen,
    isOnboardingScreen,
    isPageEditorScreen,
    isProfileScreen,
    isSermonDetailScreen,
    location,
    managementGroup,
    navigate,
    openGroup,
    openSubgroup,
    shouldUseGroupPageNav,
  }
}
