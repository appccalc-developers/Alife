import AppBadge from '../layout/AppBadge'
import type { AccessType } from '../../types/group'
import { useUiText } from '../../i18n/uiText'

const AccessTypeBadge = ({ accessType }: { accessType: AccessType }) => {
  const t = useUiText()
  const variant = accessType === 'Public' ? 'success' : accessType === 'Protected' ? 'warning' : 'neutral'
  const label = accessType === 'Public' ? t('public') : accessType === 'Protected' ? t('protected') : t('private')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default AccessTypeBadge
