import { useMemo } from 'react'
import { BookOpenText, Home, LayoutDashboard, ShieldCheck } from 'lucide-react'
import type { PageSummaryDto } from '../../types'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { translateUi } from '../../i18n/uiText'
import { EnrollmentIcon, EventsIcon, MemoriesIcon, OnboardingIcon, PageIcon } from './icons'
import type { NavigationCopy, ShellNavItem } from './types'

type Args = {
  contextualGroupId: string
  currentGroupPages: PageSummaryDto[]
  eventDetailScreen: boolean
  contextualEventId?: string
  workspaceEnabled: boolean
}

export const useShellNavigation = ({
  contextualGroupId,
  currentGroupPages,
  eventDetailScreen,
  contextualEventId,
  workspaceEnabled,
}: Args) => {
  const auth = useAuthStore()
  const isChinese = auth.language === 'zh'

  const pageItems = useMemo<ShellNavItem[]>(
    () => currentGroupPages.map((page) => ({
      key: `page:${page.id}`,
      label: localizeText(page.title, auth.language) || translateUi(auth.language, 'untitledPage'),
      to: '/groups',
      pageId: page.id,
      icon: <PageIcon />,
      onClick: () => activeEntityService.setPage(page.id, contextualGroupId),
    })),
    [auth.language, contextualGroupId, currentGroupPages],
  )

  const workspaceHome: ShellNavItem[] = contextualGroupId ? [
    {
      key: 'workspace:home',
      label: isChinese ? '小组工作台' : 'Group workspace',
      to: '/groups',
      icon: <LayoutDashboard className="h-5 w-5" />,
      requireNoActivePage: true,
      onClick: () => activeEntityService.setGroup(contextualGroupId, { clearPage: true }),
    },
  ] : []

  const eventItems: ShellNavItem[] = contextualGroupId && contextualEventId ? [
    {
      key: 'event:notice',
      label: isChinese ? '活动通知' : 'Notice',
      to: '/events',
      icon: <EventsIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, contextualGroupId),
    },
    {
      key: 'event:enrollments',
      label: isChinese ? '报名管理' : 'Enrollment',
      to: '/events?section=enrollments',
      matchSearch: '?section=enrollments',
      icon: <EnrollmentIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, contextualGroupId),
    },
    {
      key: 'event:memories',
      label: isChinese ? '图文回忆' : 'Memories',
      to: '/events?section=memories',
      matchSearch: '?section=memories',
      icon: <MemoriesIcon />,
      onClick: () => activeEntityService.setEvent(contextualEventId, contextualGroupId),
    },
  ] : []

  const contextualItems = eventDetailScreen ? eventItems : []
  const workspaceItems = [...workspaceHome, ...pageItems, ...contextualItems]
  const workspaceVisible = Boolean(contextualGroupId) && workspaceEnabled
  const adminItem: ShellNavItem | null = !auth.loading && auth.me?.isAdmin
    ? { key: 'app:admin', label: isChinese ? '平台工作台' : 'Platform workspace', to: '/admin', icon: <ShieldCheck className="h-5 w-5" /> }
    : null
  const guestItem: ShellNavItem | null = !auth.loading && auth.isGuest
    ? { key: 'app:onboarding', label: translateUi(auth.language, 'onboarding'), to: '/onboarding', icon: <OnboardingIcon /> }
    : null
  const primaryItems: ShellNavItem[] = [
    adminItem,
    { key: 'app:home', label: translateUi(auth.language, 'home'), to: '/', icon: <Home className="h-5 w-5" /> },
    { key: 'app:sermons', label: translateUi(auth.language, 'sermons'), to: '/sermons', icon: <BookOpenText className="h-5 w-5" /> },
    guestItem,
  ].filter((item): item is ShellNavItem => Boolean(item))
  const headerItems = guestItem ? [{ ...guestItem, key: 'app:onboarding-header' }] : []
  const mobileItems = [
    adminItem || primaryItems.find((item) => item.key === 'app:home'),
    workspaceItems[0],
    primaryItems.find((item) => item.key === 'app:sermons'),
  ].filter((item): item is ShellNavItem => Boolean(item))
  const workspaceLabel = isChinese ? '小组工作区' : 'Group workspace'
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
    }

  return {
    copy,
    headerItems,
    mobileItems,
    pageItems,
    primaryItems,
    workspaceItems,
    workspaceLabel,
    workspaceVisible,
  }
}
