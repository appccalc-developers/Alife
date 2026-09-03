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
import { BottomNavigation, DesktopNavigation } from './navigation/AppNavigation'
import { useShellActions } from './actions/useShellActions'
import FloatingActionButtons from './actions/FloatingActionButtons'
import ShellHeader from './shell/ShellHeader'
import HomeNavHeader from '../views/home/HomeNavHeader'
import HomeFooter from '../views/home/HomeFooter'
import { getCopy } from '../views/home/homeCopy'
import { buildPageMenuNavItems } from '../views/home/homeUtils'
import { usePublicPagesQuery } from '../hooks/usePublicPageQueries'
import { workspaceResumeService } from '../services/workspaceResumeService'
import { isHomeLocation, isPublicArticlePath, isPublicPageLocation, usesPublicHomeLayout } from './routing/publicRoutePolicy'
import { getWorkspaceArea } from './routing/workspaceArea'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsedPreference)
  const [debugLoading, setDebugLoading] = useState(false)
  const storedGroupIsChurch = context.currentGroup?.isChurch === true ||
    Boolean(context.currentGroup?.id && context.currentGroup.id === context.churchGroup?.id)
  const groupLifeGroup = !storedGroupIsChurch ? context.currentGroup : null
  const groupLifeGroupId = groupLifeGroup?.id || ''
  const groupLifeGroupName = groupLifeGroupId
    ? localizeText(groupLifeGroup?.name, auth.language)
    : ''

  const navigation = useShellNavigation({
    contextualGroupId: context.contextualGroupId,
    churchGroupId: context.churchGroup?.id || '',
    groupLifeGroupId,
    groupLifeGroupName,
    eventDetailScreen: context.isEventDetailScreen,
    contextualEventId: context.contextualEventId,
    contextualEvent: context.contextualEvent,
    currentGroupIsChurch: context.isChurchLifeScreen || context.managementGroup?.isChurch === true,
    workspaceEnabled: !context.isIdentityScreen,
  })
  const actions = useShellActions({
    isManagementScreen: context.isManagementScreen,
    isEventScreen: context.isEventScreen,
    isSermonDetailScreen: context.isSermonDetailScreen,
  })

  const headerGroupContextId = !context.isIdentityScreen ? groupLifeGroupId : ''
  const workspaceArea = getWorkspaceArea(context.location.pathname)

  useEffect(() => {
    if (auth.isGuest) return
    workspaceResumeService.remember(auth.me?.id, {
      pathname: context.location.pathname,
      search: context.location.search,
      hash: context.location.hash,
    })
  }, [auth.isGuest, auth.me?.id, context.location.hash, context.location.pathname, context.location.search])

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
    <div className="alife-workspace relative min-h-screen text-[#18332d]" data-workspace-area={workspaceArea}>
      {context.isIdentityScreen ? null : (
        <DesktopNavigation
          platformSections={navigation.platformSections}
          workspaceSections={navigation.workspaceSections}
          workspaceVisible={navigation.workspaceVisible}
          copy={navigation.copy}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
        />
      )}

      <div className={['relative z-10 min-h-screen transition-[padding] duration-300', context.isIdentityScreen ? '' : sidebarCollapsed ? 'desktop:pl-20' : 'desktop:pl-72'].join(' ')}>
        <ShellHeader
          appNavItems={navigation.headerItems}
          contextualGroupId={headerGroupContextId}
          onboarding={context.isIdentityScreen}
          debugLoading={debugLoading}
          onDebug={() => void sendDebugCall()}
        />

        <main
          className={context.isPageEditorScreen
            ? 'mx-auto max-w-none px-0 pb-36 pt-5 sm:pt-7 desktop:pb-14'
            : 'mx-auto max-w-[94rem] px-4 pb-36 pt-5 sm:px-6 sm:pt-7 desktop:px-8 desktop:pb-14'}
        >
          {auth.loading && !auth.initialized ? <AppRouteLoading /> : null}
          <AppRoutes churchGroupId={context.churchGroup?.id || ''} churchGroupLoading={context.churchGroupLoading} />
        </main>
      </div>

      {context.isIdentityScreen ? null : (
        <>
          <BottomNavigation
            sections={[
              ...(navigation.workspaceVisible ? navigation.workspaceSections : []),
              ...navigation.platformSections,
            ]}
            copy={navigation.copy}
          />
          <FloatingActionButtons items={actions} />
        </>
      )}
    </div>
  )
}

const PublicHomeShell = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const publicPagesQuery = usePublicPagesQuery()
  const publicPages = publicPagesQuery.data ?? []
  const isPublicPage = isPublicPageLocation(location)
  const isPublicArticle = isPublicArticlePath(location.pathname)
  const isPublicSiteContent = isPublicPage || isPublicArticle
  const isHome = isHomeLocation(location)
  const copy = getCopy(auth.language, '')
  const headerNavItems = useMemo(
    () => buildPageMenuNavItems(publicPages, auth.language, copy.nav.ministries),
    [auth.language, copy.nav.ministries, publicPages],
  )
  const footerNavItems = useMemo(() => {
    const firstNavItem = headerNavItems[0]
    return firstNavItem ? [{ href: '/', label: firstNavItem.label }] : []
  }, [headerNavItems])

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
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const showPublicShell = usesPublicHomeLayout(location)

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
