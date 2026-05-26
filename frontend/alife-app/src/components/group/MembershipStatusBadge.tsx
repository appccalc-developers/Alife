import AppBadge from '../layout/AppBadge'
import { useUiText } from '../../i18n/uiText'

type Status = 'Not joined' | 'Requested' | 'Approved' | 'Invited'

const MembershipStatusBadge = ({ status }: { status: Status }) => {
  const t = useUiText()
  const variant = status === 'Approved' ? 'success' : status === 'Requested' ? 'warning' : status === 'Invited' ? 'info' : 'neutral'
  const label =
    status === 'Approved' ? t('approved')
      : status === 'Requested' ? t('requested')
        : status === 'Invited' ? t('invited')
          : t('notJoined')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default MembershipStatusBadge
