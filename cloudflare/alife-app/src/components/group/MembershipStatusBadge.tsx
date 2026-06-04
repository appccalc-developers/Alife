import AppBadge from '../layout/AppBadge'
import { useUiText } from '../../i18n/uiText'

type Status = 'Not joined' | 'requested' | 'approved' | 'invited'

const MembershipStatusBadge = ({ status }: { status: Status }) => {
  const t = useUiText()
  const variant = status === 'approved' ? 'success' : status === 'requested' ? 'warning' : status === 'invited' ? 'info' : 'neutral'
  const label =
    status === 'approved' ? t('approved')
      : status === 'requested' ? t('requested')
        : status === 'invited' ? t('invited')
          : t('notJoined')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default MembershipStatusBadge
