import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Activity, Bell, BookMarked, BookOpenText, Church, FileImage, Globe2, Home, Images, MessageSquareText, Settings2, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { groupMembershipsCollectionQueryKey } from '../../db/collections/groupCollection'
import { queryClient } from '../../db/queryClient'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { translateUi } from '../../i18n/uiText'
import { siteForumEntryEnabled } from '../forumAvailability'
import { EnrollmentIcon, EventsIcon, MemoriesIcon, OnboardingIcon } from './icons'
import type { NavigationCopy, ShellNavItem, ShellNavSection } from './types'
import type { GroupEventRecord } from '../../types/event'
import { getEventLifecycle, readEventLifecycleData } from '../../utils/eventLifecycle'
import type { GroupMembershipDto } from '../../types'
import { canAccessChurchManagement } from '../routing/churchManagementAccess'

type Args = {
  contextualGroupId: string
  churchGroupId: string
  groupLifeGroupId: string
  groupLifeGroupName: string
  eventDetailScreen: boolean
  contextualEventId?: string
  contextualEvent?: GroupEventRecord | null
  currentGroupIsChurch: boolean
  workspaceEnabled: boolean
}

const isPresent = <T,>(value: T | null | undefined): value is T => Boolean(value)
const subscribeToLocalQueryCache = (onStoreChange: () => void) =>
  queryClient.getQueryCache().subscribe(() => onStoreChange())

const useLocalMembershipRecords = (groupId: string, includeLineCandidates: boolean) => {
  const queryKey = useMemo(
    () => groupMembershipsCollectionQueryKey(groupId, true, includeLineCandidates),
    [groupId, includeLineCandidates],
  )
  const getSnapshot = useCallback(
    () => queryClient.getQueryData<Array<Pick<GroupMembershipDto, 'status'>>>(queryKey),
    [queryKey],
  )

  return useSyncExternalStore(subscribeToLocalQueryCache, getSnapshot, getSnapshot)
}

const adminPermissions = {
  members: 'admin.members.view',
  roles: 'admin.roles.managePermissions',
  messages: 'admin.messages.manage',
  visitRequests: 'admin.visitRequests.receive',
  files: 'admin.files.view',
  logs: 'admin.auditLogs.view',
  pageReview: 'admin.pages.review',
} as const

export const useShellNavigation = ({
  contextualGroupId,
  churchGroupId,
  groupLifeGroupId: requestedGroupLifeGroupId,
  groupLifeGroupName,
  eventDetailScreen,
  contextualEventId,
  contextualEvent,
  currentGroupIsChurch,
  workspaceEnabled,
}: Args) => {
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'
  const memberAccountLabel = isChinese ? '成员账号' : 'Member account'
  const personalCenterLabel = isChinese ? '个人中心' : 'Personal Center'
  const workspaceGroupId = requestedGroupLifeGroupId && requestedGroupLifeGroupId !== churchGroupId
    ? requestedGroupLifeGroupId
    : ''
  const contextualWorkspaceGroupId = currentGroupIsChurch ? '' : contextualGroupId
  const canManageWorkspace = Boolean(workspaceGroupId && auth.hasLeaderAccess(workspaceGroupId))
  const canManageChurch = Boolean(churchGroupId && auth.hasLeaderAccess(churchGroupId))
  const workspaceMembership = auth.memberships.find((item) => item.groupId === workspaceGroupId)
  const isWorkspaceLeader = workspaceMembership?.status === 'approved' &&
    (workspaceMembership.role === 'leader' || workspaceMembership.role === 'coLeader')
  const localMemberships = useLocalMembershipRecords(workspaceGroupId, false)
  const pendingReviewCount = isWorkspaceLeader && localMemberships
    ? localMemberships.filter((member) => member.status === 'requested').length
    : undefined

  const workspaceHome: ShellNavItem[] = canManageWorkspace ? [
    {
      key: 'workspace:home',
      label: isChinese ? '小组管理' : 'Group Management',
      description: isChinese ? '成员、联系人、下属小组、相册、页面和设置' : 'Members, contacts, subgroups, albums, pages, and settings',
      to: '/groups?section=group',
      matchSearch: ['', '?section=group', '?section=members', '?section=contacts', '?section=subgroups', '?section=albums', '?section=pages'],
      icon: <Settings2 className="h-5 w-5" />,
      requireNoActivePage: true,
      onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
      badge: pendingReviewCount === undefined ? undefined : {
        text: `${isChinese ? '待审核' : 'Pending review'} ${pendingReviewCount}`,
        compactText: String(pendingReviewCount),
        accessibleLabel: `${isChinese ? '待审核' : 'Pending review'}: ${pendingReviewCount}`,
        tone: pendingReviewCount > 0 ? 'attention' : 'neutral',
      },
    },
  ] : []

  const workspaceManagement: ShellNavItem[] = canManageWorkspace ? [
    {
      key: 'workspace:events',
      label: isChinese ? '活动' : 'Events',
      description: isChinese ? '管理当前小组的过往、即将举行和筹备中活动' : 'Manage past, upcoming, and planning events owned by this group',
      to: '/groups?section=events',
      matchSearch: '?section=events',
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
    },
    {
      key: 'workspace:announcements',
      label: isChinese ? '公告' : 'Announcements',
      description: isChinese ? '发布和管理小组公告' : 'Publish and manage group announcements',
      to: '/groups?section=announcements',
      matchSearch: '?section=announcements',
      icon: <Bell className="h-5 w-5" />,
      onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
    },
  ] : []

  const canAccessGroupLifeContent = auth.isAdmin || workspaceMembership?.status === 'approved'
  const groupForumItems: ShellNavItem[] = workspaceGroupId && canAccessGroupLifeContent ? [{
    key: 'workspace:forum',
    label: isChinese ? '小组论坛' : 'Group forum',
    description: isChinese ? '只查看和发布当前小组的讨论' : 'Discussions scoped to the current group',
    to: '/groups/forum',
    matchPathOnly: true,
    matchDescendants: true,
    icon: <MessageSquareText className="h-5 w-5" />,
    onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
  }] : []

  const groupAlbumItems: ShellNavItem[] = workspaceGroupId && canAccessGroupLifeContent ? [{
    key: 'workspace:albums',
    label: isChinese ? '相册' : 'Albums',
    description: isChinese ? '浏览当前小组的相册和图片' : 'Browse albums and photos for the selected group',
    to: '/albums',
    matchPathOnly: true,
    matchDescendants: true,
    icon: <Images className="h-5 w-5" />,
    onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
  }] : []

  const churchContentItems: ShellNavItem[] = [
    !auth.isGuest ? {
      key: 'church:forum',
      label: isChinese ? '教会论坛' : 'Church forum',
      description: isChinese ? '面向全教会成员的分享与讨论' : 'Church-wide sharing and conversations',
      to: '/church/forum',
      matchPathOnly: true,
      matchDescendants: true,
      icon: <MessageSquareText className="h-5 w-5" />,
    } : null,
    !auth.isGuest && churchGroupId ? {
      key: 'church:albums',
      label: isChinese ? '相册' : 'Albums',
      description: isChinese ? '浏览教会相册和公开图片' : 'Browse church albums and published photos',
      to: `/groups/${encodeURIComponent(churchGroupId)}/albums`,
      matchPathOnly: true,
      matchDescendants: true,
      icon: <Images className="h-5 w-5" />,
    } : null,
    ...(canManageChurch ? [{
      key: 'church:events',
      label: isChinese ? '活动' : 'Events',
      description: isChinese ? '管理教会范围的过往、即将举行和筹备中活动' : 'Manage church-wide past, upcoming, and planning events',
      to: '/church?section=events',
      matchSearch: '?section=events',
      icon: <EventsIcon />,
    },
    {
      key: 'church:announcements',
      label: isChinese ? '公告' : 'Announcements',
      description: isChinese ? '发布和管理教会公告' : 'Publish and manage church announcements',
      to: '/church?section=announcements',
      matchSearch: '?section=announcements',
      icon: <Bell className="h-5 w-5" />,
    }] : []),
  ].filter(isPresent)

  const activeEventId = contextualEventId || ''
  const eventBasePath = contextualWorkspaceGroupId && activeEventId
    ? contextualWorkspaceGroupId === workspaceGroupId
      ? `/events/${encodeURIComponent(activeEventId)}`
      : `/groups/${encodeURIComponent(contextualWorkspaceGroupId)}/events/${encodeURIComponent(activeEventId)}`
    : ''
  const eventLifecycle = contextualEvent ? getEventLifecycle(contextualEvent) : null
  const acceptsEnrollments = contextualEvent ? readEventLifecycleData(contextualEvent).acceptsEnrollments : false
  const eventItems: ShellNavItem[] = eventBasePath ? [
    {
      key: 'event:notice',
      label: isChinese ? '活动通知' : 'Notice',
      description: isChinese ? '活动详情与发布内容' : 'Event details and published content',
      to: eventBasePath,
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    },
    eventLifecycle === 'upcoming' && acceptsEnrollments ? {
      key: 'event:enrollments',
      label: isChinese ? '报名管理' : 'Enrollment',
      description: isChinese ? '报名名单和参与状态' : 'Registrations and attendance status',
      to: `${eventBasePath}?section=enrollments`,
      matchSearch: '?section=enrollments',
      icon: <EnrollmentIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    eventLifecycle === 'past' ? {
      key: 'event:memories',
      label: isChinese ? '图文回顾' : 'Memories',
      description: isChinese ? '照片、回顾和活动沉淀' : 'Photos, recaps, and event memory',
      to: `${eventBasePath}?section=memories`,
      matchSearch: '?section=memories',
      icon: <MemoriesIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
  ].filter(isPresent) : []

  const contextualItems = eventDetailScreen ? eventItems : []
  const groupContentItems = [...workspaceHome, ...groupForumItems, ...groupAlbumItems, ...workspaceManagement]
  const workspaceVisible = workspaceEnabled && contextualItems.length > 0

  const canOpenChurchManagement = canAccessChurchManagement({
    churchGroupId,
    canManageGroup: auth.hasLeaderAccess,
    hasAdminPermission: auth.hasAdminPermission,
  })

  const churchAdminItems: ShellNavItem[] = canOpenChurchManagement ? [
    {
      key: 'app:admin-church-management',
      label: isChinese ? '教会管理' : 'Church Management',
      description: isChinese ? '进入教会管理中心' : 'Open the church management center',
      to: '/admin?church=dashboard',
      icon: <Settings2 className="h-5 w-5" />,
    },
  ] : []

  const adminPlatformItems: ShellNavItem[] = !auth.loading
    ? [
      auth.hasAdminPermission(adminPermissions.files)
        ? {
        key: 'app:admin-files',
        label: isChinese ? '文件管理' : 'Files',
        description: isChinese ? '上传文件、可见范围和归属' : 'Uploads, visibility, and ownership',
        to: '/admin/files',
        icon: <FileImage className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.logs)
        ? {
        key: 'app:admin-logs',
        label: isChinese ? '操作日志' : 'Audit logs',
        description: isChinese ? '查看敏感平台操作记录' : 'Review sensitive platform actions',
        to: '/admin/logs',
        icon: <Activity className="h-5 w-5" />,
        }
        : null,
    ].filter(isPresent)
    : []

  const siteBuilderItems: ShellNavItem[] = !auth.loading && auth.canReviewPages
    ? [
      {
        key: 'app:page-review',
        label: isChinese ? '首页管理' : 'Homepage Management',
        description: isChinese ? '管理首页内容、公开导航与页面发布审核' : 'Manage homepage content, public navigation, and page publication review',
        to: '/admin/page-review',
        icon: <Globe2 className="h-5 w-5" />,
      },
    ]
    : []

  const platformManagementItems = [...churchAdminItems, ...siteBuilderItems, ...adminPlatformItems]
  const platformManagementChildItems = [...siteBuilderItems, ...adminPlatformItems]

  const guestItem: ShellNavItem | null = !auth.loading && auth.isGuest
    ? {
      key: 'app:onboarding',
      label: translateUi(auth.language, 'onboarding'),
      description: isChinese ? '完成成员资料' : 'Complete your member profile',
      to: '/onboarding',
      icon: <OnboardingIcon />,
    }
    : null

  const groupSelectionTo = auth.isGuest ? '/groups/select?from=alife' : '/groups/select'
  const churchWebsiteItems: ShellNavItem[] = [
    {
      key: 'app:home',
      label: isChinese ? '教会网站' : 'Church Website',
      description: isChinese ? '教会公开网站和访客入口' : 'Public church website and visitor entry',
      to: '/',
      icon: <Home className="h-5 w-5" />,
    },
    {
      key: 'app:sermons',
      label: isChinese ? '主日证道' : 'Sunday Sermons',
      description: isChinese ? '主日证道视频和信息库' : 'Sunday sermon videos and teaching library',
      to: '/sermons',
      icon: <BookOpenText className="h-5 w-5" />,
    },
  ]

  const accountItems: ShellNavItem[] = !auth.loading && !auth.isGuest
    ? [{
      key: 'app:study',
      label: isChinese ? '查经进度' : 'Bible Study Progress',
      description: isChinese ? '中英文经文阅读与小组查经' : 'Bilingual Scripture reading and group study',
      to: '/study',
      matchPathOnly: true,
      icon: <BookMarked className="h-5 w-5" />,
    }]
    : []

  const contentItems: ShellNavItem[] = [
    ...(siteForumEntryEnabled ? [{
      key: 'app:forum',
      label: isChinese ? '论坛' : 'Forum',
      description: isChinese ? '全站分享、问答和资源' : 'Site-wide sharing, Q&A, and resources',
      to: '/forum',
      icon: <MessageSquareText className="h-5 w-5" />,
    }] : []),
  ].filter(isPresent)

  const profileItem: ShellNavItem | null = !auth.loading && !auth.isGuest
    ? {
      key: 'app:profile',
      label: personalCenterLabel,
      description: auth.me?.displayName || memberAccountLabel,
      to: '/profile',
      icon: <UserRound className="h-5 w-5" />,
    }
    : null
  const personalCenterItem = guestItem || profileItem
  const headerItems = guestItem ? [{ ...guestItem, key: 'app:onboarding-header' }] : []

  const workspaceSections: ShellNavSection[] = [
    contextualItems.length
      ? { key: 'workspace-event', label: isChinese ? '当前活动' : 'Current event', description: isChinese ? '活动通知、报名和回顾' : 'Notice, enrollment, and memories', items: contextualItems }
      : null,
  ].filter(isPresent)

  const platformSections: ShellNavSection[] = [
    {
      key: 'platform-church-life',
      label: isChinese ? '教会生活' : 'Church Life',
      description: auth.isGuest
        ? (isChinese ? '教会网站与主日证道' : 'Church website and Sunday sermons')
        : (isChinese ? '教会范围的总览、活动与公告' : 'Church-wide overview, events, and announcements'),
      to: auth.isGuest ? '/sermons' : '/church',
      icon: <Church className="h-5 w-5" />,
      collapsible: true,
      toggleOnHeaderClick: true,
      items: [...churchWebsiteItems, ...churchContentItems],
    },
    {
      key: 'platform-group-life',
      label: groupLifeGroupName || (isChinese ? '小组生活' : 'Group Life'),
      description: isChinese ? '当前小组的总览、管理、论坛、活动和公告' : 'Overview, management, forum, events, and announcements for the selected group',
      to: workspaceGroupId ? '/groups?view=overview' : groupSelectionTo,
      icon: <UsersRound className="h-5 w-5" />,
      collapsible: Boolean(workspaceGroupId),
      toggleOnHeaderClick: Boolean(workspaceGroupId),
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
        items: auth.isGuest ? [] : accountItems,
      }
      : null,
    contentItems.length
      ? { key: 'platform-content', label: isChinese ? '公开内容' : 'Public content', description: isChinese ? '面向访客和成员的入口' : 'Visitor and member-facing entry points', items: contentItems }
      : null,
    platformManagementItems.length
      ? {
        key: 'platform-management',
        label: isChinese ? '系统管理' : 'System Management',
        description: isChinese ? '教会管理、首页管理、文件与审计能力' : 'Church management, homepage management, files, and audit capabilities',
        to: platformManagementItems[0].to,
        icon: <ShieldCheck className="h-5 w-5" />,
        collapsible: true,
        toggleOnHeaderClick: true,
        alignToBottom: true,
        items: platformManagementChildItems,
      }
      : null,
  ].filter(isPresent)

  const copy: NavigationCopy = isChinese
    ? {
      alife: '平台入口',
      collapse: '收起侧边栏',
      expand: '展开侧边栏',
      menu: '菜单',
      openMenu: '打开导航菜单',
      closeMenu: '关闭导航菜单',
      communityWorkspace: '未选择小组',
      platformWorkspace: '平台工作区',
      contentWorkspace: '内容入口',
      currentSpace: '当前小组',
      pagesSection: '页面',
      eventsSection: '活动',
      accountSection: '账号',
    }
    : {
      alife: 'Platform',
      collapse: 'Collapse sidebar',
      expand: 'Expand sidebar',
      menu: 'Menu',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
      communityWorkspace: 'No group selected',
      platformWorkspace: 'Platform workspace',
      contentWorkspace: 'Content',
      currentSpace: 'Current group',
      pagesSection: 'Pages',
      eventsSection: 'Events',
      accountSection: 'Account',
    }

  return {
    copy,
    headerItems,
    platformSections,
    workspaceSections,
    workspaceVisible,
  }
}
