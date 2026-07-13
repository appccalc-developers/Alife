import { useMemo } from 'react'
import { Activity, Bell, BookMarked, BookOpenText, ClipboardCheck, FileImage, Handshake, Home, LayoutDashboard, MessageSquareText, ShieldCheck, UserCog, UsersRound } from 'lucide-react'
import type { PageSummaryDto } from '../../types'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { translateUi } from '../../i18n/uiText'
import { EnrollmentIcon, EventsIcon, MemoriesIcon, OnboardingIcon, PageIcon } from './icons'
import type { NavigationCopy, ShellNavItem, ShellNavSection } from './types'

type Args = {
  contextualGroupId: string
  currentGroupPages: PageSummaryDto[]
  eventDetailScreen: boolean
  contextualEventId?: string
  workspaceEnabled: boolean
}

const isPresent = <T,>(value: T | null | undefined): value is T => Boolean(value)

const adminPermissions = {
  access: 'admin.access',
  overview: 'admin.overview.view',
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
  currentGroupPages,
  eventDetailScreen,
  contextualEventId,
  workspaceEnabled,
}: Args) => {
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'
  const workspaceGroupId = contextualGroupId
  const canEditReviewedGroupPages = Boolean(
    workspaceGroupId &&
    auth.canReviewPages &&
    auth.hasLeaderAccess(workspaceGroupId),
  )

  const pageItems = useMemo<ShellNavItem[]>(
    () => workspaceGroupId ? currentGroupPages.map((page) => ({
      key: `page:${page.id}`,
      label: localizeText(page.title, auth.language) || translateUi(auth.language, 'untitledPage'),
      description: isChinese ? '小组页面' : 'Group page',
      to: canEditReviewedGroupPages && page.visibility === 'public'
        ? `/pages/${page.id}/edit?preservePublicationReviewStatus=true&fromReview=true`
        : '/groups',
      pageId: page.id,
      icon: <PageIcon />,
      onClick: () => activeEntityService.setPage(page.id, workspaceGroupId),
    })) : [],
    [auth.language, canEditReviewedGroupPages, currentGroupPages, isChinese, workspaceGroupId],
  )

  const workspaceHome: ShellNavItem[] = workspaceGroupId ? [
    {
      key: 'workspace:home',
      label: isChinese ? '小组总览' : 'Group overview',
      description: isChinese ? '成员、页面和小组动态' : 'Members, pages, and group activity',
      to: '/groups',
      icon: <LayoutDashboard className="h-5 w-5" />,
      requireNoActivePage: true,
      onClick: () => activeEntityService.setGroup(workspaceGroupId, { clearPage: true }),
    },
  ] : []

  const eventItems: ShellNavItem[] = workspaceGroupId && contextualEventId ? [
    {
      key: 'event:notice',
      label: isChinese ? '活动通知' : 'Notice',
      description: isChinese ? '活动详情与发布内容' : 'Event details and published content',
      to: '/events',
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, workspaceGroupId),
    },
    {
      key: 'event:enrollments',
      label: isChinese ? '报名管理' : 'Enrollment',
      description: isChinese ? '报名名单和参与状态' : 'Registrations and attendance status',
      to: '/events?section=enrollments',
      matchSearch: '?section=enrollments',
      icon: <EnrollmentIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, workspaceGroupId),
    },
    {
      key: 'event:memories',
      label: isChinese ? '图文回顾' : 'Memories',
      description: isChinese ? '照片、回顾和活动沉淀' : 'Photos, recaps, and event memory',
      to: '/events?section=memories',
      matchSearch: '?section=memories',
      icon: <MemoriesIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, workspaceGroupId),
    },
  ] : []

  const contextualItems = eventDetailScreen ? eventItems : []
  const workspaceItems = [...workspaceHome, ...pageItems, ...contextualItems]
  const workspaceVisible = Boolean(workspaceGroupId) && workspaceEnabled

  const adminPlatformItems: ShellNavItem[] = !auth.loading && (auth.isAdmin || auth.hasAdminPermission(adminPermissions.access))
    ? [
      auth.hasAdminPermission(adminPermissions.overview)
        ? {
        key: 'app:admin',
        label: isChinese ? '平台总览' : 'Platform overview',
        description: isChinese ? '平台状态和待办入口' : 'Status, queue, and quick actions',
        to: '/admin',
        icon: <ShieldCheck className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.members)
        ? {
        key: 'app:admin-users',
        label: isChinese ? '成员管理' : 'Members',
        description: isChinese ? '账号、注册状态和角色分配' : 'Accounts, registration, and role assignment',
        to: '/admin/users',
        icon: <UsersRound className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.roles)
        ? {
        key: 'app:admin-roles',
        label: isChinese ? '角色管理' : 'Roles',
        description: isChinese ? '角色、权限和自定义后台能力' : 'Roles, permissions, and custom access',
        to: '/admin/roles',
        icon: <UserCog className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.messages)
        ? {
        key: 'app:admin-messages',
        label: isChinese ? '通知管理' : 'Notices',
        description: isChinese ? '发送通知并查看阅读状态' : 'Send notices and review delivery state',
        to: '/admin/messages',
        icon: <Bell className="h-5 w-5" />,
        }
        : null,
      auth.hasAdminPermission(adminPermissions.visitRequests)
        ? {
        key: 'app:admin-visit-requests',
        label: isChinese ? '访客接待' : 'Visitor care',
        description: isChinese ? '查看参观联系请求并标记跟进状态' : 'Review visit requests and follow-up state',
        to: '/admin/visit-requests',
        icon: <Handshake className="h-5 w-5" />,
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

  const reviewItems: ShellNavItem[] = !auth.loading && (auth.canReviewPages || auth.hasAdminPermission(adminPermissions.pageReview))
    ? [
      {
        key: 'app:page-review',
        label: isChinese ? '发布审核' : 'Page review',
        description: isChinese ? '审核公开页面发布请求' : 'Review public page publishing requests',
        to: '/admin/page-review',
        icon: <ClipboardCheck className="h-5 w-5" />,
      },
    ]
    : []

  const guestItem: ShellNavItem | null = !auth.loading && auth.isGuest
    ? {
      key: 'app:onboarding',
      label: translateUi(auth.language, 'onboarding'),
      description: isChinese ? '完成成员资料' : 'Complete your member profile',
      to: '/onboarding',
      icon: <OnboardingIcon />,
    }
    : null

  const contentItems: ShellNavItem[] = [
    {
      key: 'app:home',
      label: translateUi(auth.language, 'home'),
      description: isChinese ? '公开首页和访客入口' : 'Public home and visitor entry',
      to: '/',
      icon: <Home className="h-5 w-5" />,
    },
    {
      key: 'app:sermons',
      label: translateUi(auth.language, 'sermons'),
      description: isChinese ? '讲道视频和信息库' : 'Sermons and teaching library',
      to: '/sermons',
      icon: <BookOpenText className="h-5 w-5" />,
    },
    ...(!auth.isGuest ? [{
      key: 'app:study',
      label: isChinese ? '查经' : 'Bible study',
      description: isChinese ? '中英文经文阅读与小组查经' : 'Bilingual Scripture reading and group study',
      to: '/study',
      matchPathOnly: true,
      icon: <BookMarked className="h-5 w-5" />,
    }] : []),
    {
      key: 'app:forum',
      label: isChinese ? '论坛' : 'Forum',
      description: isChinese ? '全站分享、问答和资源' : 'Site-wide sharing, Q&A, and resources',
      to: '/forum',
      icon: <MessageSquareText className="h-5 w-5" />,
    },
    guestItem,
  ].filter(isPresent)

  const platformItems = [...adminPlatformItems, ...reviewItems]
  const primaryItems = [...platformItems, ...contentItems]
  const headerItems = guestItem ? [{ ...guestItem, key: 'app:onboarding-header' }] : []
  const adminManagementItems = adminPlatformItems.filter((item) => item.key !== 'app:admin-logs')
  const reviewAndAuditItems = [...reviewItems, ...adminPlatformItems.filter((item) => item.key === 'app:admin-logs')]
  const mobileItems = [
    adminPlatformItems[0] || reviewItems[0] || contentItems.find((item) => item.key === 'app:home'),
    workspaceItems[0],
    contentItems.find((item) => item.key === 'app:sermons'),
  ].filter(isPresent)

  const workspaceLabel = isChinese ? '小组工作区' : 'Group workspace'
  const groupContentItems = [...workspaceHome, ...pageItems]
  const workspaceSections: ShellNavSection[] = [
    groupContentItems.length
      ? { key: 'workspace-group', label: isChinese ? '当前小组' : 'Current group', description: isChinese ? '小组总览和页面内容' : 'Group overview and pages', items: groupContentItems }
      : null,
    contextualItems.length
      ? { key: 'workspace-event', label: isChinese ? '当前活动' : 'Current event', description: isChinese ? '活动通知、报名和回顾' : 'Notice, enrollment, and memories', items: contextualItems }
      : null,
  ].filter(isPresent)

  const platformSections: ShellNavSection[] = [
    adminManagementItems.length
      ? { key: 'platform-management', label: isChinese ? '平台管理' : 'Platform management', description: isChinese ? '总览、成员、角色、通知和文件' : 'Overview, members, roles, notices, and files', items: adminManagementItems }
      : null,
    reviewAndAuditItems.length
      ? { key: 'platform-governance', label: isChinese ? '审核与记录' : 'Review and records', description: isChinese ? '发布审核和操作日志' : 'Publishing review and audit logs', items: reviewAndAuditItems }
      : null,
    contentItems.length
      ? { key: 'platform-content', label: isChinese ? '公开内容' : 'Public content', description: isChinese ? '面向访客和成员的入口' : 'Visitor and member-facing entry points', items: contentItems }
      : null,
  ].filter(isPresent)

  const copy: NavigationCopy = isChinese
    ? {
      alife: '平台入口',
      memberAccount: '成员账号',
      collapse: '收起侧边栏',
      expand: '展开侧边栏',
      menu: '菜单',
      openMenu: '打开导航菜单',
      closeMenu: '关闭导航菜单',
      communityWorkspace: '小组工作台',
      platformWorkspace: '平台工作区',
      contentWorkspace: '内容入口',
      currentSpace: '当前空间',
      pagesSection: '页面',
      eventsSection: '活动',
      accountSection: '账号',
    }
    : {
      alife: 'Platform',
      memberAccount: 'Member account',
      collapse: 'Collapse sidebar',
      expand: 'Expand sidebar',
      menu: 'Menu',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
      communityWorkspace: 'Group workspace',
      platformWorkspace: 'Platform workspace',
      contentWorkspace: 'Content',
      currentSpace: 'Current space',
      pagesSection: 'Pages',
      eventsSection: 'Events',
      accountSection: 'Account',
    }

  return {
    copy,
    headerItems,
    mobileItems,
    pageItems,
    platformSections,
    primaryItems,
    workspaceItems,
    workspaceLabel,
    workspaceSections,
    workspaceVisible,
  }
}
