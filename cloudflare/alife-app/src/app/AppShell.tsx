import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { localizeText } from '../utils/localizedText'
import { useAuthStore } from '../stores/auth'
import { groupService } from '../services/groupService'
import AppRouteLoading from './components/AppRouteLoading'
import AppRoutes from './routing/AppRoutes'
import { useShellContext } from './context/useShellContext'
import { useShellNavigation } from './navigation/useShellNavigation'
import { BottomNavigation, DesktopNavigation, MobileNavigationDrawer } from './navigation/AppNavigation'
import { useShellActions } from './actions/useShellActions'
import FloatingActionButtons from './actions/FloatingActionButtons'
import GroupDrawer from './shell/GroupDrawer'
import ShellHeader from './shell/ShellHeader'
import HomeNavHeader from '../views/home/HomeNavHeader'
import HomeFooter from '../views/home/HomeFooter'
import { getCopy } from '../views/home/homeCopy'
import { buildMinistriesNavItem, insertMinistriesNavItem } from '../views/home/homeUtils'
import { pageService } from '../services/pageService'
import type { PageSummaryDto } from '../types'

const readSidebarCollapsedPreference = () => {
  try {
    return window.localStorage.getItem('alife:sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

const writeSidebarCollapsedPreference = (collapsed: boolean) => {
  try {
    window.localStorage.setItem('alife:sidebar-collapsed', String(collapsed))
  } catch {
    // Storage can be unavailable in restricted browser contexts; the shell should still render.
  }
}

const WorkspaceShell = () => {
  const auth = useAuthStore()
  const context = useShellContext()
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsedPreference)
  const [debugLoading, setDebugLoading] = useState(false)

  const navigation = useShellNavigation({
    contextualGroupId: context.contextualGroupId,
    currentGroupPages: context.currentGroupPages,
    eventDetailScreen: Boolean(context.groupEventDetailMatch || context.location.pathname === '/events'),
    contextualEventId: context.groupEventDetailMatch?.[2] || context.activeIds.eventId,
    workspaceEnabled: !context.isOnboardingScreen,
  })
  const actions = useShellActions({
    isManagementScreen: context.isManagementScreen,
    isEventScreen: context.isEventScreen,
    isSermonDetailScreen: context.isSermonDetailScreen,
    isProfileScreen: context.isProfileScreen,
  })

  const headerGroupName = !context.isOnboardingScreen && context.contextualGroupId
    ? localizeText(context.managementGroup?.name, auth.language)
    : ''
  const headerGroupManageTo = !context.isOnboardingScreen && context.contextualGroupId && context.canOpenCurrentGroupManagement
    ? '/groups?section=group'
    : undefined

  useEffect(() => {
    setGroupDrawerOpen(false)
    setMobileNavOpen(false)
  }, [context.location.pathname, context.location.search])

  useEffect(() => {
    writeSidebarCollapsedPreference(sidebarCollapsed)
  }, [sidebarCollapsed])

  const sendDebugCall = async () => {
    if (!context.contextualGroupId || debugLoading) return
    setDebugLoading(true)
    try {
      const group = await groupService.getGroup(context.contextualGroupId)
      console.info(`[debug] GET /api/groups/${context.contextualGroupId}`, group)
    } catch (error) {
      console.error(`[debug] GET /api/groups/${context.contextualGroupId} failed`, error)
    } finally {
      setDebugLoading(false)
    }
  }

  return (
    <div className="alife-workspace relative min-h-screen text-[#18332d]">
      <ShellHeader
        appNavItems={navigation.headerItems}
        groupName={headerGroupName}
        groupManageTo={headerGroupManageTo}
        contextualGroupId={context.contextualGroupId}
        onboarding={context.isOnboardingScreen}
        debugLoading={debugLoading}
        onDebug={() => void sendDebugCall()}
        onOpenGroupDrawer={() => setGroupDrawerOpen(true)}
      />

      <div className={['relative z-10 min-h-screen transition-[padding] duration-300', sidebarCollapsed ? 'desktop:pl-24' : 'desktop:pl-80'].join(' ')}>
        <DesktopNavigation
          primaryItems={navigation.primaryItems}
          workspaceItems={navigation.workspaceItems}
          platformSections={navigation.platformSections}
          workspaceSections={navigation.workspaceSections}
          workspaceVisible={navigation.workspaceVisible}
          workspaceName={headerGroupName}
          workspaceLabel={navigation.workspaceLabel}
          workspaceTo="/groups/select"
          userName={auth.me?.displayName}
          copy={navigation.copy}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
        />
        <motion.main
          key={context.location.pathname + context.location.search}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={context.isPageEditorScreen
            ? 'mx-auto max-w-none px-0 pb-36 pt-5 sm:pt-7 desktop:pb-14'
            : 'mx-auto max-w-[94rem] px-4 pb-36 pt-5 sm:px-6 sm:pt-7 desktop:px-8 desktop:pb-14'}
        >
          {auth.loading ? <AppRouteLoading /> : null}
          <AppRoutes />
        </motion.main>
      </div>

      <BottomNavigation items={navigation.mobileItems} onOpenMenu={() => setMobileNavOpen(true)} copy={navigation.copy} />
      <MobileNavigationDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        primaryItems={navigation.primaryItems}
        workspaceItems={navigation.workspaceItems}
        platformSections={navigation.platformSections}
        workspaceSections={navigation.workspaceSections}
        workspaceVisible={navigation.workspaceVisible}
        workspaceName={headerGroupName}
        workspaceLabel={navigation.workspaceLabel}
        workspaceTo="/groups/select"
        userName={auth.me?.displayName}
        copy={navigation.copy}
      />
      <FloatingActionButtons items={actions} />
      <GroupDrawer
        currentGroup={context.contextualGroup || (context.currentGroup?.id === context.contextualGroupId ? context.currentGroup : null)}
        churchGroup={context.churchGroup}
        items={context.currentSubgroups}
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
        onOpenGroup={context.openGroup}
        onOpenSubgroup={context.openSubgroup}
      />
    </div>
  )
}

type RouteLocation = {
  pathname: string
  search: string
}

const hasPublicPageMenuName = (search: string) =>
  Boolean(new URLSearchParams(search).get('page')?.trim())

const isPublicPagePath = (pathname: string) =>
  /^\/public\/pages\/[^/]+$/.test(pathname)

const isPublicPageLocation = (location: RouteLocation) =>
  isPublicPagePath(location.pathname) ||
  (location.pathname === '/home' && hasPublicPageMenuName(location.search))

const isHomeLocation = (location: RouteLocation) =>
  location.pathname === '/' ||
  (location.pathname === '/home' && !hasPublicPageMenuName(location.search))

const isPublicBrowsePath = (pathname: string) =>
  pathname === '/' ||
  pathname === '/home' ||
  pathname === '/groups' ||
  pathname === '/groups/select' ||
  /^\/groups\/[^/]+$/.test(pathname) ||
  /^\/groups\/[^/]+\/events\/[^/]+$/.test(pathname) ||
  pathname === '/events' ||
  pathname === '/forum' ||
  /^\/forum\/posts\/[^/]+$/.test(pathname) ||
  isPublicPagePath(pathname) ||
  pathname === '/sermons' ||
  pathname === '/sermons/watch' ||
  /^\/sermons\/[^/]+$/.test(pathname)

const PublicHomeShell = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const [publicPages, setPublicPages] = useState<PageSummaryDto[]>([])
  const isPublicPage = isPublicPageLocation(location)
  const isHome = isHomeLocation(location)
  const copy = getCopy(auth.language, '')
  const footerNavItems = useMemo(() => [
    { href: '/#about', label: copy.nav.about },
    { href: '/#visit', label: copy.nav.visit },
    { href: '/#groups', label: copy.nav.groups },
    { href: '/forum', label: auth.language === 'zh' ? '论坛' : 'Forum' },
    { href: '/#events', label: copy.nav.events },
    { href: '/#sermons', label: copy.nav.sermons },
    { href: '/#location', label: copy.nav.location },
  ], [auth.language, copy.nav.about, copy.nav.events, copy.nav.groups, copy.nav.location, copy.nav.sermons, copy.nav.visit])
  const ministriesNavItem = useMemo(
    () => buildMinistriesNavItem(publicPages, auth.language, copy.nav.ministries),
    [auth.language, copy.nav.ministries, publicPages],
  )
  const headerNavItems = useMemo(
    () => insertMinistriesNavItem(footerNavItems, ministriesNavItem),
    [footerNavItems, ministriesNavItem],
  )

  useEffect(() => {
    let cancelled = false
    pageService.getPublicPages()
      .then((pages) => {
        if (!cancelled) {
          setPublicPages(pages)
        }
      })
      .catch((error) => console.error('[PublicHomeShell] public pages load failed:', error))

    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f3ea] text-[#18332d]">
      {isHome ? null : <HomeNavHeader copy={copy} language={auth.language} navItems={headerNavItems} solid={!isPublicPage} />}
      <div className={isHome ? '' : isPublicPage ? 'pb-16' : 'px-4 pb-16 pt-24 sm:px-6 lg:px-8'}>
        <AppRoutes />
      </div>
      {isPublicPage ? <HomeFooter copy={copy} navItems={footerNavItems} /> : null}
    </div>
  )
}

const AppShell = () => {
  const auth = useAuthStore()
  const location = useLocation()

  if (isHomeLocation(location)) {
    return <PublicHomeShell />
  }

  return isPublicPageLocation(location) || (auth.isGuest && isPublicBrowsePath(location.pathname)) ? <PublicHomeShell /> : <WorkspaceShell />
}

export default AppShell
