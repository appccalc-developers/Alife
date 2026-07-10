import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUiText } from '../../i18n/uiText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import AppActionButton from './AppActionButton'

type Props = {
  label?: string
  fallbackTo?: string
  onClick?: () => void | Promise<void>
  className?: string
}

const AppBackButton = ({ label, fallbackTo = '/', onClick, className = '' }: Props) => {
  const navigate = useNavigate()
  const t = useUiText()

  const handleClick = () => {
    if (onClick) {
      void onClick()
      return
    }

    const continueNavigation = () => {
      if (window.history.length > 1) {
        navigate(-1)
        return
      }

      navigate(fallbackTo, { replace: true })
    }

    if (confirmUnsavedChangesNavigation(undefined, continueNavigation)) {
      continueNavigation()
    }
  }

  return (
    <AppActionButton variant="secondary" size="sm" onClick={handleClick} className={className}>
      <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {label || t('back')}
    </AppActionButton>
  )
}

export default AppBackButton
