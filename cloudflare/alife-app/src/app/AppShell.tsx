import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { CacheInspectorHud } from '../components/diagnostics/CacheInspectorHud'
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
import { buildPageMenuNavItems } from '../views/home/homeUtils'
import { pageService } from '../services/pageService'
import type { PageSummaryDto } from '../types'
import { isHomeLocation, isPublicArticlePath, isPublicPageLocation, isPublicPagePath } from './routing/publicRoutePolicy'

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
    eventDetailScreen: Boolean(context.groupEventDetailMatch || context.location.pathname === '/events'),
    contextualEventId: context.groupEventDetailMatch?.[2] || context.activeIds.eventId,
    contextualEvent: context.contextualEvent,
    currentGroupIsChurch: context.managementGroup?.isChurch === true,
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

      <div className={['relative z-10 min-h-screen transition-[padding] duration-300', sidebarCollapsed ? 'desktop:pl-20' : 'desktop:pl-72'].join(' ')}>
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

        <main
          className={context.isPageEditorScreen
            ? 'mx-auto max-w-none px-0 pb-36 pt-5 sm:pt-7 desktop:pb-14'
            : 'mx-auto max-w-[94rem] px-4 pb-36 pt-5 sm:px-6 sm:pt-7 desktop:px-8 desktop:pb-14'}
        >
          {auth.loading ? <AppRouteLoading /> : null}
          <AppRoutes />
        </main>
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

const isPublicBrowsePath = (pathname: string) =>
  pathname === '/' ||
  pathname === '/home' ||
  pathname === '/groups' ||
  pathname === '/groups/select' ||
  /^\/groups\/[^/]+$/.test(pathname) ||
  /^\/groups\/[^/]+\/events\/[^/]+$/.test(pathname) ||
  /^\/groups\/[^/]+\/forum(?:\/posts\/[^/]+)?$/.test(pathname) ||
  pathname === '/events' ||
  pathname === '/forum' ||
  /^\/forum\/posts\/[^/]+$/.test(pathname) ||
  isPublicArticlePath(pathname) ||
  isPublicPagePath(pathname) ||
  pathname === '/sermons' ||
  pathname === '/sermons/watch' ||
  /^\/sermons\/[^/]+$/.test(pathname)

const PublicHomeShell = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const [publicPages, setPublicPages] = useState<PageSummaryDto[]>([])
  const isPublicPage = isPublicPageLocation(location)
  const isPublicArticle = isPublicArticlePath(location.pathname)
  const isPublicSiteContent = isPublicPage || isPublicArticle
  const isHome = isHomeLocation(location)
  const copy = getCopy(auth.language, '')
  const welcomeNavItem = useMemo(
    () => ({ href: '/#welcome', label: copy.nav.welcome }),
    [copy.nav.welcome],
  )
  const footerNavItems = useMemo(() => [welcomeNavItem], [welcomeNavItem])
  const headerNavItems = useMemo(
    () => [
      welcomeNavItem,
      ...buildPageMenuNavItems(publicPages, auth.language, copy.nav.ministries),
      { to: '/articles', label: copy.nav.articles },
    ],
    [auth.language, copy.nav.articles, copy.nav.ministries, publicPages, welcomeNavItem],
  )

  useEffect(() => {
    if (isHome) {
      return undefined
    }

    let cancelled = false
    pageService.getPublicPages()
      .then((pages) => {
        if (!cancelled) {
          setPublicPages(pages)
        }
      })
      .catch((error) => console.error('[PublicHomeShell] public pages load failed:', error))

    return () => { cancelled = true }
  }, [isHome])

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f3ea] text-[#18332d]">
      {isHome ? null : <HomeNavHeader copy={copy} language={auth.language} navItems={headerNavItems} solid={!isPublicPage} />}
      <div className={`flex-1 ${isHome ? '' : isPublicPage ? 'pb-16' : 'px-4 pb-16 pt-24 sm:px-6 lg:px-8'}`}>
        <AppRoutes />
      </div>
      {isPublicSiteContent ? <HomeFooter copy={copy} navItems={footerNavItems} /> : null}
    </div>
  )
}

const AppShell = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const showPublicShell = isHomeLocation(location) ||
    isPublicPageLocation(location) ||
    isPublicArticlePath(location.pathname) ||
    (auth.isGuest && isPublicBrowsePath(location.pathname))

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={showPublicShell ? 'public' : 'workspace'}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeInOut' }}
        >
          {showPublicShell ? <PublicHomeShell /> : <WorkspaceShell />}
        </motion.div>
      </AnimatePresence>
      <CacheInspectorHud />
    </>
  )
}

export default AppShell
