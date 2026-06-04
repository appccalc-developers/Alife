import AppBadge from '../layout/AppBadge'
import type { AccessType } from '../../types/group'
import { useUiText } from '../../i18n/uiText'

const AccessTypeBadge = ({ accessType }: { accessType: AccessType }) => {
  const t = useUiText()
  const variant = accessType === 'public' ? 'success' : accessType === 'protected' ? 'warning' : 'neutral'
  const label = accessType === 'public' ? t('public') : accessType === 'protected' ? t('protected') : t('private')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default AccessTypeBadge
