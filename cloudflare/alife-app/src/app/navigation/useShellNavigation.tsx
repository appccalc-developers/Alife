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

  const workspaceHome: ShellNavItem[] = canManageWorkspace ? [
    {
      key: 'workspace:home',
      label: isChinese ? '小组管理' : 'Group Management',
      description: isChinese ? '成员、联系人、事工、页面和设置' : 'Members, contacts, ministries, pages, and settings',
      to: '/groups?section=group',
      matchSearch: ['', '?section=group', '?section=members', '?section=contacts', '?section=subgroups', '?section=albums', '?section=pages'],
      icon: <Settings2 className="h-5 w-5" />,
      requireNoActivePage: true,
      onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
    },
  ] : []

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
  const groupContentItems = [
    ...workspaceHome,
  ]
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
      description: isChinese ? '完成成员资料' : 'Complete your member profile',
      to: '/onboarding',
      icon: <OnboardingIcon />,
    }
    : null

  const groupSelectionTo = auth.isGuest ? '/groups/select?from=alife' : '/groups/select'
  const taskCounts = countCurrentTasks(currentTasksQuery.data ?? [])
  const accountItems: ShellNavItem[] = !auth.loading && !auth.isGuest
    ? [{
      key: 'app:profile-settings',
      label: isChinese ? '个人资料' : 'Profile settings',
      description: isChinese ? '联系方式、登录安全和小组邀请' : 'Contact details, sign-in security, and group invitations',
      to: PROFILE_SETTINGS_PATH,
      matchPathOnly: true,
      icon: <UserRound className="h-5 w-5" />,
    }, {
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
      to: PERSONAL_CENTER_PATH,
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
        ? (isChinese ? '主日证道与教会公开内容' : 'Sunday sermons and public church content')
        : (isChinese ? '会众网站与教会活动' : 'Congregation website and church events'),
      to: auth.isGuest ? '/sermons' : '/church',
      icon: <Church className="h-5 w-5" />,
      collapsible: true,
      toggleOnHeaderClick: false,
      activePathPrefixes: ['/church', '/sermons'],
      mobileNavigateFirst: true,
      items: [
        ...(canOpenChurchManagement ? [{
          key: 'church:management',
          label: isChinese ? '教会管理' : 'Church Management',
          description: isChinese ? '教会资料、成员、联系人、团契与事工' : 'Church profile, members, contacts, fellowships, and ministries',
          to: '/church/manage?section=group',
          matchPathOnly: true,
          icon: <Settings2 className="h-5 w-5" />,
        }] : []),
        ...(!auth.loading && !auth.isGuest && auth.canReviewPages ? [{
          key: 'church:homepage',
          label: isChinese ? '首页管理' : 'Homepage Management',
          description: isChinese ? '首页内容、公开导航与页面发布审核' : 'Homepage content, public navigation, and page publication review',
          to: '/church/homepage',
          matchPathOnly: true,
          icon: <Globe2 className="h-5 w-5" />,
        }] : []),
        ...(!auth.loading && !auth.isGuest && auth.hasAdminPermission('admin.visitRequests.receive') ? [{
          key: 'church:visitors',
          label: isChinese ? '访客接待' : 'Visitor Care',
          description: isChinese ? '参观联系请求和跟进状态' : 'Visit requests and follow-up status',
          to: '/church/visit-requests',
          matchPathOnly: true,
          icon: <Handshake className="h-5 w-5" />,
        }] : []),
      ],
    },
    {
      key: 'platform-group-life',
      label: groupLifeGroupName || (isChinese ? '小组生活' : 'Group Life'),
      description: isChinese ? '当前小组的总览、管理、公告、相册、活动和论坛' : 'Overview, management, announcements, albums, events, and forum for the selected group',
      to: workspaceGroupId ? '/groups?view=overview' : groupSelectionTo,
      icon: <UsersRound className="h-5 w-5" />,
      collapsible: Boolean(workspaceGroupId),
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
        items: auth.isGuest ? [] : accountItems,
      }
      : null,
    contentItems.length
      ? { key: 'platform-content', label: isChinese ? '公开内容' : 'Public content', description: isChinese ? '面向访客和成员的入口' : 'Visitor and member-facing entry points', items: contentItems }
      : null,
    canOpenSystemManagement
      ? {
        key: 'platform-management',
        label: isChinese ? '系统管理' : 'System Management',
        description: isChinese ? '平台角色、内容、文件与审计能力' : 'Platform roles, content, files, and audit capabilities',
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
