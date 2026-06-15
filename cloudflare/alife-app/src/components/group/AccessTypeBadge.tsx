import AppBadge from '../layout/AppBadge'
import type { AccessType } from '../../types/group'
import { useUiText } from '../../i18n/uiText'

const AccessTypeBadge = ({ accessType }: { accessType: AccessType }) => {
  const t = useUiText()
  if (accessType === 'protected') return null

  const variant = accessType === 'public' ? 'success' : 'neutral'
  const label = accessType === 'public' ? t('public') : t('private')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default AccessTypeBadge
