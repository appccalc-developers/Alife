import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Activity, Bell, BookMarked, BookOpenText, Building2, CalendarClock, Church, ClipboardCheck, ClipboardList, FileCheck2, FileImage, Globe2, Home, Images, MessageSquareText, Settings2, ShieldCheck, UserRound, UsersRound, WalletCards } from 'lucide-react'
import { groupMembershipsCollectionQueryKey } from '../../db/collections/groupCollection'
import { queryClient } from '../../db/queryClient'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { translateUi } from '../../i18n/uiText'
import { siteForumEntryEnabled } from '../forumAvailability'
import { EnrollmentIcon, EventsIcon, MemoriesIcon, OnboardingIcon } from './icons'
import type { NavigationCopy, ShellNavItem, ShellNavSection } from './types'
import type { GroupEventRecord } from '../../types/event'
import { eventUsesPreparationModule, getEventLifecycle, readEventLifecycleData } from '../../utils/eventLifecycle'
import type { GroupMembershipDto } from '../../types'
import { canAccessChurchManagement } from '../routing/churchManagementAccess'
import { useCurrentTasks } from '../../hooks/useCurrentTasks'
import { countCurrentTasks, formatTaskCount } from '../../utils/currentTasks'

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
  venueCatalog: 'admin.venues.manageCatalog',
  venueBookings: 'admin.venues.reviewBookings',
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
  const currentTasksQuery = useCurrentTasks()
  const isChinese = auth.language === 'zh'
  const memberAccountLabel = isChinese ? '成员账号' : 'Member account'
  const personalCenterLabel = isChinese ? '个人中心' : 'Personal Center'
  const workspaceGroupId = requestedGroupLifeGroupId && requestedGroupLifeGroupId !== churchGroupId
    ? requestedGroupLifeGroupId
    : ''
  const contextualWorkspaceGroupId = currentGroupIsChurch ? '' : contextualGroupId
  const canManageWorkspace = Boolean(workspaceGroupId && auth.hasLeaderAccess(workspaceGroupId))
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
      key: 'workspace:roster-capabilities',
      label: isChinese ? '岗位资格' : 'Roster capabilities',
      description: isChinese ? '维护常用岗位资格、有效期规则和双语名称' : 'Maintain common qualifications, expiry rules, and bilingual names',
      to: `/groups/${encodeURIComponent(workspaceGroupId)}/roster-capabilities`,
      matchPathOnly: true,
      icon: <ShieldCheck className="h-5 w-5" />,
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
    !auth.isGuest && auth.isRegistered ? {
      key: 'church:forum',
      label: isChinese ? '教会论坛' : 'Church forum',
      description: isChinese ? '面向全教会成员的分享与讨论' : 'Church-wide sharing and conversations',
      to: '/church/forum',
      matchPathOnly: true,
      matchDescendants: true,
      icon: <MessageSquareText className="h-5 w-5" />,
    } : null,
    !auth.isGuest && auth.isRegistered ? {
      key: 'church:albums',
      label: isChinese ? '相册' : 'Albums',
      description: isChinese ? '浏览教会及下属事工的相册' : 'Browse albums from the church and its ministries',
      to: '/church/albums',
      matchPathOnly: true,
      matchDescendants: true,
      icon: <Images className="h-5 w-5" />,
    } : null,
    ...(!auth.isGuest && auth.isRegistered ? [{
      key: 'church:events',
      label: isChinese ? '活动' : 'Events',
      description: isChinese ? '浏览教会及下属事工已批准的活动' : 'Browse approved events across church ministries',
      to: '/church?section=events',
      matchSearch: '?section=events',
      icon: <EventsIcon />,
    },
    {
      key: 'church:announcements',
      label: isChinese ? '公告' : 'Announcements',
      description: isChinese ? '浏览教会及下属事工的有效公告' : 'Browse active announcements across church ministries',
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
  const contextualEventData = contextualEvent ? readEventLifecycleData(contextualEvent) : null
  const eventLifecycle = contextualEvent ? getEventLifecycle(contextualEvent) : null
  const acceptsEnrollments = contextualEventData?.acceptsEnrollments ?? false
  const eventUsesModule = (moduleKey: 'venue' | 'registration' | 'finance' | 'ram' | 'roster' | 'programme') =>
    eventUsesPreparationModule(contextualEventData, moduleKey)
  const canManageContextualEvent = contextualEvent ? auth.isAdmin || auth.hasLeaderAccess(contextualEvent.groupId) : false
  const eventItems: ShellNavItem[] = eventBasePath ? [
    {
      key: 'event:notice',
      label: isChinese ? '活动总览' : 'Event overview',
      description: isChinese ? '查看活动内容、筹备流程和当前进度' : 'See event content, preparation flow, and progress',
      to: eventBasePath,
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    },
    workspaceEnabled && eventUsesModule('roster') ? {
      key: 'event:my-roster',
      label: isChinese ? '我的排班' : 'My assignments',
      description: isChinese ? '接受、拒绝或请求调整分配给我的岗位' : 'Accept, decline or request changes to my roles',
      to: `${eventBasePath}/my-roster`,
      matchPathOnly: true,
      icon: <ClipboardCheck className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventLifecycle === 'upcoming' && acceptsEnrollments ? {
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
    canManageContextualEvent && eventUsesModule('venue') ? {
      key: 'event:venue-request',
      label: isChinese ? '场地申请' : 'Venue request',
      description: isChinese ? '选择已登记场地，保存草稿并提交审批' : 'Choose a registered venue, save a draft, and submit it for review',
      to: `${eventBasePath}/venue-request`,
      matchPathOnly: true,
      icon: <Building2 className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventUsesModule('registration') ? {
      key: 'event:registration-settings',
      label: isChinese ? '报名设置' : 'Registration settings',
      description: isChinese ? '设置容量和截止时间，查看报名进度' : 'Set capacity and deadline, then review registrations',
      to: `${eventBasePath}/registration`,
      matchPathOnly: true,
      icon: <EnrollmentIcon />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventUsesModule('finance') ? {
      key: 'event:finance',
      label: isChinese ? '费用与收款' : 'Fees and payments',
      description: isChinese ? '确认收费、付款说明、退款规则和凭证要求' : 'Confirm charges, payment instructions, refunds and evidence requirements',
      to: `${eventBasePath}/finance`,
      matchPathOnly: true,
      icon: <WalletCards className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventUsesModule('ram') ? {
      key: 'event:ram',
      label: isChinese ? '风险评估' : 'Risk assessment',
      description: isChinese ? '填写风险控制、人工确认并提交给另一位审计人员审批' : 'Prepare controls, confirm the facts, and submit to a different event auditor',
      to: `${eventBasePath}/edit?step=ram`,
      matchSearch: '?step=ram',
      icon: <ShieldCheck className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventUsesModule('roster') ? {
      key: 'event:roster',
      label: isChinese ? '同工排班' : 'Roster',
      description: isChinese ? '按时间限制和岗位标签生成建议，再由负责人确认' : 'Suggest from availability and role labels, then confirm manually',
      to: `${eventBasePath}/roster`,
      matchPathOnly: true,
      icon: <UsersRound className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventUsesModule('programme') ? {
      key: 'event:programme',
      label: isChinese ? '程序单与交接' : 'Programme and handover',
      description: isChinese ? '按时间查看环节、负责人、排班回复和现场交接' : 'Timeline, owners, roster responses, and operational handovers',
      to: `${eventBasePath}/programme`,
      matchPathOnly: true,
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
    canManageContextualEvent && eventLifecycle === 'past' ? {
      key: 'event:closure',
      label: isChinese ? '活动总结' : 'Closure report',
      description: isChinese ? '汇总结果、确认结项并保留可复用经验' : 'Confirm outcomes and retain reusable learning',
      to: `${eventBasePath}/closure`,
      matchPathOnly: true,
      icon: <FileCheck2 className="h-5 w-5" />,
      onClick: () => activeEntityService.setEvent(activeEventId),
    } : null,
  ].filter(isPresent) : []

  const contextualItems = eventDetailScreen ? eventItems : []
  const contextualMemberItems = contextualItems.filter((item) =>
    ['event:notice', 'event:my-roster', 'event:memories'].includes(item.key))
  const contextualManagementItems = contextualItems.filter((item) =>
    !['event:notice', 'event:my-roster', 'event:memories'].includes(item.key))
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
      auth.hasAdminPermission(adminPermissions.venueCatalog)
        ? {
        key: 'app:venue-catalog',
        label: isChinese ? '场地目录' : 'Venue catalog',
        description: isChinese ? '维护真实场地、空间、容量和设备' : 'Maintain real venues, spaces, capacity, and equipment',
        to: '/system/venues',
        icon: <Building2 className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.venueBookings)
        ? {
        key: 'app:venue-bookings',
        label: isChinese ? '场地审批' : 'Venue requests',
        description: isChinese ? '处理活动负责人提交的场地申请' : 'Review venue requests submitted by event leaders',
        to: '/system/venue-bookings',
        icon: <FileCheck2 className="h-5 w-5" />,
        }
        : null,
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
  const taskCounts = countCurrentTasks(currentTasksQuery.data ?? [])
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
      key: 'app:tasks',
      label: isChinese ? '当前事务' : 'Current tasks',
      description: isChinese ? '处理职能待办和成员通知' : 'Handle duty tasks and member notifications',
      to: '/tasks',
      matchPathOnly: true,
      icon: <ClipboardCheck className="h-5 w-5" />,
      badges: [
        {
          text: String(taskCounts.urgent),
          compactText: formatTaskCount(taskCounts.urgent),
          accessibleLabel: `${isChinese ? '紧要事务' : 'Urgent tasks'}: ${taskCounts.urgent}`,
          tone: 'urgent',
        },
        {
          text: String(taskCounts.general),
          compactText: formatTaskCount(taskCounts.general),
          accessibleLabel: `${isChinese ? '一般事务' : 'General tasks'}: ${taskCounts.general}`,
          tone: 'general',
        },
      ],
    }, {
      key: 'app:scheduling-profile',
      label: isChinese ? '我的排班资料' : 'My scheduling profile',
      description: isChinese ? '维护可服务时间、岗位偏好和每日上限' : 'Maintain availability, role preferences, and daily limits',
      to: '/profile/scheduling',
      matchPathOnly: true,
      icon: <CalendarClock className="h-5 w-5" />,
    }, {
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
    contextualMemberItems.length
      ? { key: 'workspace-event', label: isChinese ? '当前活动' : 'Current event', description: isChinese ? '查看活动与处理分配给我的事项' : 'View the event and handle items assigned to me', items: contextualMemberItems }
      : null,
    contextualManagementItems.length
      ? { key: 'workspace-event-management', label: isChinese ? '活动筹备与执行' : 'Event preparation', description: isChinese ? '负责人按活动需要处理场地、报名、费用、风险与排班' : 'Leader tools for optional venue, registration, finance, risk, and roster work', items: contextualManagementItems }
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
