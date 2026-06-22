import { useEffect, useState } from 'react'
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

const WorkspaceShell = () => {
  const auth = useAuthStore()
  const context = useShellContext()
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('alife:sidebar-collapsed') === 'true')
  const [debugLoading, setDebugLoading] = useState(false)

  const navigation = useShellNavigation({
    contextualGroupId: context.contextualGroupId,
    currentGroupPages: context.currentGroupPages,
    eventDetailScreen: Boolean(context.groupEventDetailMatch || context.location.pathname === '/events'),
    contextualEventId: context.groupEventDetailMatch?.[2] || context.activeIds.eventId,
    workspaceEnabled: !context.isOnboardingScreen,
  })
  const selectedPageId = context.activeIds.pageId || navigation.pageItems[0]?.pageId || ''
  const actions = useShellActions({
    contextualGroupId: context.contextualGroupId,
    selectedPageId,
    isGroupScreen: context.isGroupScreen,
    isPageEditorScreen: context.isPageEditorScreen,
    isManagementScreen: context.isManagementScreen,
    isEventScreen: context.isEventScreen,
    isSermonDetailScreen: context.isSermonDetailScreen,
    isProfileScreen: context.isProfileScreen,
    canShowCurrentPageEdit: context.canShowCurrentPageEdit,
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
    window.localStorage.setItem('alife:sidebar-collapsed', String(sidebarCollapsed))
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
    <div className="min-h-screen text-[#18332d]">
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

      <div className={['min-h-screen transition-[padding] duration-300', sidebarCollapsed ? 'desktop:pl-24' : 'desktop:pl-80'].join(' ')}>
        <DesktopNavigation
          primaryItems={navigation.primaryItems}
          workspaceItems={navigation.workspaceItems}
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
          className="mx-auto max-w-[90rem] px-4 pb-36 pt-5 sm:px-6 sm:pt-7 desktop:px-8 desktop:pb-12"
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

const PublicHomeShell = () => (
  <div className="min-h-screen bg-[#f7f3ea] text-[#18332d]">
    <AppRoutes />
  </div>
)

const AppShell = () => {
  const location = useLocation()
  return location.pathname === '/' ? <PublicHomeShell /> : <WorkspaceShell />
}

export default AppShell
