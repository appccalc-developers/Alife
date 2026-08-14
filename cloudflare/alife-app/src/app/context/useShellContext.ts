import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { fetchGroupForViewer, subgroupsQueryKey } from '../../db/collections/groupCollection'
import { conditionalGet } from '../../db/httpCache'
import { useActiveEntityIds } from '../../hooks/useActiveEntityIds'
import { activeEntityService } from '../../services/activeEntityService'
import { groupService } from '../../services/groupService'
import { useAuthStore } from '../../stores/auth'
import { useCurrentGroupStore } from '../../stores/currentGroup'
import { useLeaderUiPreferences } from '../../stores/leaderUiPreferences'
import type { GroupSummaryDto } from '../../types'
import { normalizeGroup } from '../../utils/apiEnums'
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
  const [currentSubgroups, setCurrentSubgroups] = useState<GroupSummaryDto[]>([])
  const [contextualGroup, setContextualGroup] = useState<GroupSummaryDto | null>(null)
  const [churchGroup, setChurchGroup] = useState<GroupSummaryDto | null>(null)
  const [churchGroupLoading, setChurchGroupLoading] = useState(true)
  const [contextualEvent, setContextualEvent] = useState<GroupEventRecord | null>(null)
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
  const groupForumMatch = path.match(/^\/groups\/([^/]+)\/forum(?:\/posts\/[^/]+)?$/)
  const groupAlbumMatch = path.match(/^\/groups\/([^/]+)\/albums(?:\/[^/]+)?$/)
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
    groupForumMatch?.[1],
    groupAlbumMatch?.[1],
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
  const isGroupSelectScreen = path === '/groups/select' || path === '/groups/select/tree'
  const isGroupJoinScreen = path === '/groups/join' || Boolean(groupJoinMatch)
  const isChurchLifeScreen = path === '/church' || path.startsWith('/church/forum')
  const contextualGroupId = isGroupSelectScreen || isGroupJoinScreen || isChurchLifeScreen
    ? ''
    : routeGroupIds.find(Boolean) ||
      activeIds.groupId ||
      ((eventCreateMatch || eventEditMatch || pageEditMatch) ? CurrentGroup?.id || '' : '')

  const membership = contextualGroupId ? auth.memberships.find((item) => item.groupId === contextualGroupId) : null
  const isPlatformAdmin = auth.isAdmin
  const canManageCurrentGroup = isPlatformAdmin || (membership?.status === 'approved' && (membership.role === 'leader' || membership.role === 'coLeader'))
  const canOpenCurrentGroupManagement = canManageCurrentGroup && preferences.exerciseGroupManagement
  const managementGroup = CurrentGroup?.id === contextualGroupId ? CurrentGroup : contextualGroup

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
    fetchGroupForViewer(contextualGroupId, auth.me?.id)
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
  }, [auth.isGuest, auth.me?.id, contextualGroupId])

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
    let cancelled = false
    groupService.getChurch().then((group) => {
      if (!cancelled) {
        setChurchGroup(group)
        if (activeEntityService.getAll().groupId === group.id) {
          activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
        }
      }
    }).catch(() => {
      if (!cancelled) setChurchGroup(null)
    }).finally(() => {
      if (!cancelled) setChurchGroupLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const openGroup = (groupId: string) => {
    const continueNavigation = async () => {
      try {
        const targetGroup = await groupService.getGroup(groupId)
        if (targetGroup.isChurch) {
          navigate('/church')
          return
        }
      } catch {
        navigate('/groups/select')
        return
      }

      activeEntityService.setGroup(groupId, { clearPage: true, clearEvent: true })
      navigate(`/groups/${encodeURIComponent(groupId)}?view=overview`)
    }

    const target = `/groups/${encodeURIComponent(groupId)}?view=overview`
    if (confirmUnsavedChangesNavigation(target, () => { void continueNavigation() })) {
      void continueNavigation()
    }
  }

  const openSubgroup = (groupId: string) => {
    const subgroupMembership = auth.memberships.find((item) => item.groupId === groupId)
    const target = subgroupMembership?.status === 'approved'
      ? `/groups/${encodeURIComponent(groupId)}?view=overview`
      : `/groups/${encodeURIComponent(groupId)}/join`
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
    churchGroupLoading,
    contextualGroup,
    contextualGroupId,
    contextualEvent,
    currentGroup: CurrentGroup,
    currentSubgroups,
    groupEventDetailMatch,
    isEventScreen,
    isGroupScreen,
    isManagementScreen,
    isOnboardingScreen,
    isChurchLifeScreen,
    isPageEditorScreen,
    isProfileScreen,
    isSermonDetailScreen,
    location,
    managementGroup,
    navigate,
    openGroup,
    openSubgroup,
  }
}
