import AppBadge from '../layout/AppBadge'
import type { AccessType } from '../../types/group'
import { useUiText } from '../../i18n/uiText'

const AccessTypeBadge = ({ accessType, showProtected = false }: { accessType: AccessType; showProtected?: boolean }) => {
  const t = useUiText()
  if (accessType === 'protected' && !showProtected) return null

  const variant = accessType === 'public' ? 'success' : accessType === 'protected' ? 'info' : 'neutral'
  const label = accessType === 'public' ? t('public') : accessType === 'protected' ? t('protected') : t('private')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default AccessTypeBadge
