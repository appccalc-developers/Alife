import { useNavigate } from 'react-router-dom'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import { translateUi } from '../../i18n/uiText'
import type { ShellFabItem } from './types'

const EditIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const SaveIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8M7 3v5h8" /></svg>
const BackIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7 7-7-7 7-7" /></svg>

type Args = {
  contextualGroupId: string
  selectedPageId: string
  isGroupScreen: boolean
  isPageEditorScreen: boolean
  isManagementScreen: boolean
  isEventScreen: boolean
  isSermonDetailScreen: boolean
  isProfileScreen: boolean
  canShowCurrentPageEdit: boolean
}

export const useShellActions = (args: Args): ShellFabItem[] => {
  const auth = useAuthStore()
  const navigate = useNavigate()

  if (args.isGroupScreen && args.canShowCurrentPageEdit && args.selectedPageId) {
    return [{
      label: translateUi(auth.language, 'editCurrentPage'),
      tone: 'edit',
      icon: <EditIcon />,
      onClick: () => {
        activeEntityService.setPage(args.selectedPageId, args.contextualGroupId)
        navigate('/pages/edit')
      },
    }]
  }
  if (args.isPageEditorScreen) {
    return [
      { label: translateUi(auth.language, 'savePage'), tone: 'save', icon: <SaveIcon />, onClick: () => window.dispatchEvent(new Event('alife-page-editor-save')) },
      { label: translateUi(auth.language, 'exitEditor'), tone: 'exit', icon: <BackIcon />, onClick: () => window.dispatchEvent(new Event('alife-page-editor-exit')) },
    ]
  }
  if (args.isManagementScreen) {
    return [{ label: translateUi(auth.language, 'backToViews'), tone: 'exit', icon: <BackIcon />, onClick: () => navigate('/groups') }]
  }
  if (args.isEventScreen || args.isSermonDetailScreen || args.isProfileScreen) {
    return [{ label: translateUi(auth.language, 'back'), tone: 'exit', icon: <BackIcon />, onClick: () => navigate(-1) }]
  }
  return []
}
