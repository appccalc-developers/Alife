import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { TerminalSquare } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useAuthStore } from '../../stores/auth'
import LanguageSelector from '../../components/i18n/LanguageSelector'
import { CacheInspectorToggleButton } from '../../components/diagnostics/CacheInspectorHud'
import NotificationToastHost from '../../components/notifications/NotificationToastHost'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { HeaderNavigation } from '../navigation/AppNavigation'
import type { ShellNavItem } from '../navigation/types'

type Props = {
  appNavItems: ShellNavItem[]
  contextualGroupId: string
  onboarding: boolean
  debugLoading: boolean
  onDebug: () => void
}

const ShellHeader = ({ appNavItems, contextualGroupId, onboarding, debugLoading, onDebug }: Props) => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const showDebug = import.meta.env.DEV && !onboarding && Boolean(contextualGroupId)
  const guardProfileNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmUnsavedChangesNavigation('/profile', () => navigate('/profile'))) {
      event.preventDefault()
    }
  }

  return (
    <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="sticky top-[env(safe-area-inset-top)] z-30 border-b border-[#2f4b42]/10 bg-[#fbfaf6]/88 backdrop-blur-xl">
      <div className="flex min-h-[4.25rem] items-center justify-between gap-2 px-3 py-3 sm:min-h-[4.5rem] sm:gap-3 sm:px-6 desktop:px-7">
        <HeaderNavigation items={appNavItems} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!auth.loading && auth.me?.displayName ? <Link className="hidden max-w-40 truncate rounded-xl px-2 py-1.5 text-sm font-semibold text-[#40554e] hover:bg-[#e3f0eb] hover:text-[#176b5a] sm:block" to="/profile" onClick={guardProfileNavigation}>{auth.me.displayName}</Link> : null}
          <NotificationToastHost />
          <CacheInspectorToggleButton />
          <LanguageSelector language={auth.language} onChange={auth.updateLanguage} />
          {showDebug ? (
            <button type="button" className="alife-icon-button hidden border-amber-200 bg-amber-50 text-amber-800 disabled:cursor-wait disabled:opacity-60 sm:inline-flex" aria-label="Debug API" disabled={debugLoading} onClick={onDebug}>
              <TerminalSquare aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.header>
  )
}

export default ShellHeader
