import { useShellNavigationText } from '../../i18n/useShellNavigation.ts'
import { BookMarked, Church, ClipboardCheck, Globe2, Handshake, MessageSquareText, Settings2, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { translateUi } from '../../i18n/uiText'
import { siteForumEntryEnabled } from '../forumAvailability'
import { EnrollmentIcon, EventsIcon, MemoriesIcon, OnboardingIcon } from './icons'
import type { NavigationCopy, ShellNavItem, ShellNavSection } from './types'
import type { GroupEventRecord } from '../../types/event'
import { getEventLifecycle, readEventLifecycleData } from '../../utils/eventLifecycle'
import { canAccessChurchManagement, hasSystemManagementAdminPermission } from '../routing/churchManagementAccess'
import { useCurrentTasks } from '../../hooks/useCurrentTasks'
import { countCurrentTasks, formatTaskCount } from '../../utils/currentTasks'
import { PERSONAL_CENTER_PATH, PROFILE_SETTINGS_PATH } from '../routing/personalCenterRoutes'
import { getGroupLifeMemberships } from './groupLifeMemberships'
import { localizeText } from '../../utils/localizedText'
import { useGroupLifeDirectory } from '../../hooks/useGroupLifeDirectory'

type Args = {
  contextualGroupId: string
  churchGroupId: string
  eventDetailScreen: boolean
  contextualEventId?: string
  contextualEvent?: GroupEventRecord | null
  currentGroupIsChurch: boolean
  workspaceEnabled: boolean
}

const isPresent = <T,>(value: T | null | undefined): value is T => Boolean(value)
export const useShellNavigation = ({
  contextualGroupId,
  churchGroupId,
  eventDetailScreen,
  contextualEventId,
  contextualEvent,
  currentGroupIsChurch,
  workspaceEnabled,
}: Args) => {
  const auth = useAuthStore()
  const groupDirectory = useGroupLifeDirectory()
  const currentTasksQuery = useCurrentTasks()
  const isChinese = auth.language === 'zh'
  const memberAccountLabel = isChinese ? useShellNavigationText.memberAccount.zh : useShellNavigationText.memberAccount.en
  const personalCenterLabel = isChinese ? useShellNavigationText.personalCenter.zh : useShellNavigationText.personalCenter.en
  const contextualWorkspaceGroupId = currentGroupIsChurch ? '' : contextualGroupId
  const groupContentItems: ShellNavItem[] = getGroupLifeMemberships(auth.memberships, churchGroupId, groupDirectory.data ?? [])
    .map((membership) => ({
      key: `group-life:${membership.groupId}`,
      label: localizeText(membership.groupName, auth.language) || (isChinese ? useShellNavigationText.unnamedGroup.zh : useShellNavigationText.unnamedGroup.en),
      description: membership.role === 'leader'
        ? (isChinese ? useShellNavigationText.groupLeader.zh : useShellNavigationText.groupLeader.en)
        : membership.role === 'coLeader'
          ? (isChinese ? useShellNavigationText.coLeader.zh : useShellNavigationText.coLeader.en)
          : (isChinese ? useShellNavigationText.activeMember.zh : useShellNavigationText.activeMember.en),
      to: `/groups/${encodeURIComponent(membership.groupId)}?view=overview`,
      matchPathOnly: true,
      matchDescendants: true,
      icon: <UsersRound className="h-5 w-5" />,
    }))

  const activeEventId = contextualEventId || ''
  const eventBasePath = contextualWorkspaceGroupId && activeEventId
    ? `/groups/${encodeURIComponent(contextualWorkspaceGroupId)}/events/${encodeURIComponent(activeEventId)}`
    : ''
  const eventLifecycle = contextualEvent ? getEventLifecycle(contextualEvent) : null
  const acceptsEnrollments = contextualEvent ? readEventLifecycleData(contextualEvent).acceptsEnrollments : false
  const eventItems: ShellNavItem[] = eventBasePath ? [
    {
      key: 'event:notice',
      label: isChinese ? useShellNavigationText.notice.zh : useShellNavigationText.notice.en,
      description: isChinese ? useShellNavigationText.eventDetailsAndPublishedContent.zh : useShellNavigationText.eventDetailsAndPublishedContent.en,
      to: eventBasePath,
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    },
    eventLifecycle === 'upcoming' && acceptsEnrollments ? {
      key: 'event:enrollments',
      label: isChinese ? useShellNavigationText.enrollment.zh : useShellNavigationText.enrollment.en,
      description: isChinese ? useShellNavigationText.registrationsAndAttendanceStatus.zh : useShellNavigationText.registrationsAndAttendanceStatus.en,
      to: `${eventBasePath}?section=enrollments`,
      matchSearch: '?section=enrollments',
      icon: <EnrollmentIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    eventLifecycle === 'past' ? {
      key: 'event:memories',
      label: isChinese ? useShellNavigationText.memories.zh : useShellNavigationText.memories.en,
      description: isChinese ? useShellNavigationText.photosRecapsAndEventMemory.zh : useShellNavigationText.photosRecapsAndEventMemory.en,
      to: `${eventBasePath}?section=memories`,
      matchSearch: '?section=memories',
      icon: <MemoriesIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
  ].filter(isPresent) : []

  const contextualItems = eventDetailScreen ? eventItems : []
  const workspaceVisible = workspaceEnabled && contextualItems.length > 0

  const canOpenChurchManagement = canAccessChurchManagement({
    churchGroupId,
    canManageGroup: auth.hasLeaderAccess,
  })
  const canOpenSystemManagement = !auth.loading && (
    hasSystemManagementAdminPermission(auth.hasAdminPermission)
  )

  const guestItem: ShellNavItem | null = !auth.loading && auth.isGuest
    ? {
      key: 'app:onboarding',
      label: translateUi(auth.language, 'onboarding'),
      description: isChinese ? useShellNavigationText.completeYourMemberProfile.zh : useShellNavigationText.completeYourMemberProfile.en,
      to: '/onboarding',
      icon: <OnboardingIcon />,
    }
    : null

  const taskCounts = countCurrentTasks(currentTasksQuery.data ?? [])
  const accountItems: ShellNavItem[] = !auth.loading && !auth.isGuest
    ? [{
      key: 'app:profile-settings',
      label: isChinese ? useShellNavigationText.profileSettings.zh : useShellNavigationText.profileSettings.en,
      description: isChinese ? useShellNavigationText.contactDetailsSignInSecurityAndGroupInvitations.zh : useShellNavigationText.contactDetailsSignInSecurityAndGroupInvitations.en,
      to: PROFILE_SETTINGS_PATH,
      matchPathOnly: true,
      icon: <UserRound className="h-5 w-5" />,
    }, {
      key: 'app:tasks',
      label: isChinese ? useShellNavigationText.currentTasks.zh : useShellNavigationText.currentTasks.en,
      description: isChinese ? useShellNavigationText.handleDutyTasksAndMemberNotifications.zh : useShellNavigationText.handleDutyTasksAndMemberNotifications.en,
      to: '/tasks',
      matchPathOnly: true,
      icon: <ClipboardCheck className="h-5 w-5" />,
      badges: [
        {
          text: String(taskCounts.urgent),
          compactText: formatTaskCount(taskCounts.urgent),
          accessibleLabel: `${isChinese ? useShellNavigationText.urgentTasks.zh : useShellNavigationText.urgentTasks.en}: ${taskCounts.urgent}`,
          tone: 'urgent',
        },
        {
          text: String(taskCounts.general),
          compactText: formatTaskCount(taskCounts.general),
          accessibleLabel: `${isChinese ? useShellNavigationText.generalTasks.zh : useShellNavigationText.generalTasks.en}: ${taskCounts.general}`,
          tone: 'general',
        },
      ],
    }, {
      key: 'app:study',
      label: isChinese ? useShellNavigationText.bibleStudyProgress.zh : useShellNavigationText.bibleStudyProgress.en,
      description: isChinese ? useShellNavigationText.bilingualScriptureReadingAndGroupStudy.zh : useShellNavigationText.bilingualScriptureReadingAndGroupStudy.en,
      to: '/study',
      matchPathOnly: true,
      icon: <BookMarked className="h-5 w-5" />,
    }]
    : []

  const contentItems: ShellNavItem[] = [
    ...(siteForumEntryEnabled ? [{
      key: 'app:forum',
      label: isChinese ? useShellNavigationText.forum.zh : useShellNavigationText.forum.en,
      description: isChinese ? useShellNavigationText.siteWideSharingQAAndResources.zh : useShellNavigationText.siteWideSharingQAAndResources.en,
      to: '/forum',
      icon: <MessageSquareText className="h-5 w-5" />,
    }] : []),
  ].filter(isPresent)

  const profileItem: ShellNavItem | null = !auth.loading && !auth.isGuest
    ? {
      key: 'app:profile',
      label: personalCenterLabel,
      description: auth.me?.displayName || memberAccountLabel,
      to: PERSONAL_CENTER_PATH,
      icon: <UserRound className="h-5 w-5" />,
    }
    : null
  const personalCenterItem = guestItem || profileItem
  const headerItems = guestItem ? [{ ...guestItem, key: 'app:onboarding-header' }] : []

  const workspaceSections: ShellNavSection[] = [
    contextualItems.length
      ? { key: 'workspace-event', label: isChinese ? useShellNavigationText.currentEvent.zh : useShellNavigationText.currentEvent.en, description: isChinese ? useShellNavigationText.noticeEnrollmentAndMemories.zh : useShellNavigationText.noticeEnrollmentAndMemories.en, items: contextualItems }
      : null,
  ].filter(isPresent)

  const platformSections: ShellNavSection[] = [
    {
      key: 'platform-church-life',
      label: isChinese ? useShellNavigationText.churchLife.zh : useShellNavigationText.churchLife.en,
      description: auth.isGuest
        ? (isChinese ? useShellNavigationText.sundaySermonsAndPublicChurchContent.zh : useShellNavigationText.sundaySermonsAndPublicChurchContent.en)
        : (isChinese ? useShellNavigationText.congregationWebsiteAndChurchEvents.zh : useShellNavigationText.congregationWebsiteAndChurchEvents.en),
      to: auth.isGuest ? '/sermons' : '/church',
      icon: <Church className="h-5 w-5" />,
      collapsible: true,
      toggleOnHeaderClick: false,
      activePathPrefixes: ['/church', '/sermons'],
      mobileNavigateFirst: true,
      items: [
        ...(canOpenChurchManagement ? [{
          key: 'church:management',
          label: isChinese ? useShellNavigationText.churchManagement.zh : useShellNavigationText.churchManagement.en,
          description: isChinese ? useShellNavigationText.churchProfileVenuesMembersContactsFellowshipsAndMinistries.zh : useShellNavigationText.churchProfileVenuesMembersContactsFellowshipsAndMinistries.en,
          to: '/church/manage?section=group',
          matchPathOnly: true,
          icon: <Settings2 className="h-5 w-5" />,
        }] : []),
        ...(!auth.loading && !auth.isGuest && auth.canReviewPages ? [{
          key: 'church:homepage',
          label: isChinese ? useShellNavigationText.homepageManagement.zh : useShellNavigationText.homepageManagement.en,
          description: isChinese ? useShellNavigationText.homepageContentPublicNavigationAndPagePublicationReview.zh : useShellNavigationText.homepageContentPublicNavigationAndPagePublicationReview.en,
          to: '/church/homepage',
          matchPathOnly: true,
          icon: <Globe2 className="h-5 w-5" />,
        }] : []),
        ...(!auth.loading && !auth.isGuest && auth.hasAdminPermission('admin.visitRequests.receive') ? [{
          key: 'church:visitors',
          label: isChinese ? useShellNavigationText.visitorCare.zh : useShellNavigationText.visitorCare.en,
          description: isChinese ? useShellNavigationText.visitRequestsAndFollowUpStatus.zh : useShellNavigationText.visitRequestsAndFollowUpStatus.en,
          to: '/church/visit-requests',
          matchPathOnly: true,
          icon: <Handshake className="h-5 w-5" />,
        }] : []),
      ],
    },
    {
      key: 'platform-group-life',
      label: isChinese ? useShellNavigationText.groupLife.zh : useShellNavigationText.groupLife.en,
      description: isChinese ? useShellNavigationText.yourGroupsOrderedByLeaderCoLeaderThenActive.zh : useShellNavigationText.yourGroupsOrderedByLeaderCoLeaderThenActive.en,
      to: '/groups',
      icon: <UsersRound className="h-5 w-5" />,
      collapsible: groupContentItems.length > 0,
      toggleOnHeaderClick: false,
      mobileNavigateFirst: true,
      activePathPrefixes: ['/groups', '/albums'],
      items: groupContentItems,
    },
    personalCenterItem
      ? {
        key: 'platform-personal-center',
        label: personalCenterItem.label,
        description: personalCenterItem.description,
        to: personalCenterItem.to,
        icon: personalCenterItem.icon,
        collapsible: true,
        showDescription: true,
        toggleOnHeaderClick: true,
        mobileDirectLink: true,
        items: auth.isGuest ? [] : accountItems,
      }
      : null,
    contentItems.length
      ? { key: 'platform-content', label: isChinese ? useShellNavigationText.publicContent.zh : useShellNavigationText.publicContent.en, description: isChinese ? useShellNavigationText.visitorAndMemberFacingEntryPoints.zh : useShellNavigationText.visitorAndMemberFacingEntryPoints.en, items: contentItems }
      : null,
    canOpenSystemManagement
      ? {
        key: 'platform-management',
        label: isChinese ? useShellNavigationText.systemManagement.zh : useShellNavigationText.systemManagement.en,
        description: isChinese ? useShellNavigationText.platformRolesContentFilesAndAuditCapabilities.zh : useShellNavigationText.platformRolesContentFilesAndAuditCapabilities.en,
        to: '/admin',
        icon: <ShieldCheck className="h-5 w-5" />,
        collapsible: false,
        alignToBottom: true,
        matchDescendants: true,
        items: [],
      }
      : null,
  ].filter(isPresent)

  const copy: NavigationCopy = isChinese
    ? { ...useShellNavigationText.localizedCopy.zh }
    : { ...useShellNavigationText.localizedCopy.en }

  return {
    copy,
    headerItems,
    platformSections,
    workspaceSections,
    workspaceVisible,
  }
}
