import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { TerminalSquare } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import NotificationToastHost from '../../components/notifications/NotificationToastHost'
import { HeaderNavigation } from '../navigation/AppNavigation'
import { MenuIcon } from '../navigation/icons'
import type { ShellNavItem } from '../navigation/types'

type Props = {
  appNavItems: ShellNavItem[]
  groupName?: string
  groupManageTo?: string
  contextualGroupId: string
  onboarding: boolean
  debugLoading: boolean
  onDebug: () => void
  onOpenGroupDrawer: () => void
}

const ShellHeader = ({ appNavItems, groupName, groupManageTo, contextualGroupId, onboarding, debugLoading, onDebug, onOpenGroupDrawer }: Props) => {
  const auth = useAuthStore()
  const showDebug = import.meta.env.DEV && !onboarding && Boolean(contextualGroupId)

  return (
    <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="sticky top-0 z-30 border-b border-[#2f4b42]/10 bg-[#f8f4eb]/86 backdrop-blur-xl">
      <div className="flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3 sm:px-6 desktop:px-7">
        <HeaderNavigation items={appNavItems} currentGroupName={groupName} currentGroupManageTo={groupManageTo} />
        <div className="ml-auto flex items-center gap-2">
          {!auth.loading && auth.me?.displayName ? <Link className="hidden max-w-36 truncate text-sm font-semibold text-[#40554e] hover:text-[#176b5a] sm:block" to="/profile">{auth.me.displayName}</Link> : null}
          <NotificationToastHost />
          <button type="button" className="alife-icon-button min-w-12 px-3 text-sm font-bold" onClick={() => void auth.updateLanguage(auth.language === 'en' ? 'zh' : 'en')}>
            {auth.language === 'zh' ? '漢' : auth.language.toUpperCase()}
          </button>
          {showDebug ? (
            <button type="button" className="alife-icon-button border-amber-200 bg-amber-50 text-amber-800 disabled:cursor-wait disabled:opacity-60" aria-label="Debug API" disabled={debugLoading} onClick={onDebug}>
              <TerminalSquare aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
          {contextualGroupId && !onboarding ? (
            <button type="button" className="alife-icon-button" aria-label={auth.language === 'zh' ? '切换小组' : 'Switch group'} onClick={onOpenGroupDrawer}>
              <MenuIcon />
            </button>
          ) : null}
        </div>
      </div>
    </motion.header>
  )
}

export default ShellHeader
