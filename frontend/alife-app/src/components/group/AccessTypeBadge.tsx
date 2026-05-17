import AppBadge from '../layout/AppBadge'
import type { AccessType } from '../../types/group'

const AccessTypeBadge = ({ accessType }: { accessType: AccessType }) => {
  const variant = accessType === 'Public' ? 'success' : accessType === 'Protected' ? 'warning' : 'neutral'
  return <AppBadge variant={variant}>{accessType}</AppBadge>
}

export default AccessTypeBadge
