import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { translateUi } from '../../i18n/uiText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import type { ShellFabItem } from './types'

const BackIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7 7-7-7 7-7" /></svg>

type Args = {
  isManagementScreen: boolean
  isEventScreen: boolean
  isSermonDetailScreen: boolean
  isProfileScreen: boolean
}

export const useShellActions = (args: Args): ShellFabItem[] => {
  const auth = useAuthStore()
  const navigate = useNavigate()

  if (args.isManagementScreen) {
    return [
      {
        label: translateUi(auth.language, 'backToViews'),
        tone: 'exit',
        icon: <BackIcon />,
        onClick: () => {
          const continueNavigation = () => {
            navigate('/groups')
          }

          if (confirmUnsavedChangesNavigation('/groups', continueNavigation)) {
            continueNavigation()
          }
        },
      },
    ]
  }
  if (args.isEventScreen || args.isSermonDetailScreen || args.isProfileScreen) {
    return [
      {
        label: translateUi(auth.language, 'back'),
        tone: 'exit',
        icon: <BackIcon />,
        onClick: () => {
          const continueNavigation = () => {
            navigate(-1)
          }

          if (confirmUnsavedChangesNavigation(undefined, continueNavigation)) {
            continueNavigation()
          }
        },
      },
    ]
  }
  return []
}
