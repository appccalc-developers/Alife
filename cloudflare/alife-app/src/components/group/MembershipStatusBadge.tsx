import AppBadge from '../layout/AppBadge'
import { useUiText } from '../../i18n/uiText'
import type { MembershipStatus } from '../../types'

type Status = 'Not joined' | MembershipStatus

const MembershipStatusBadge = ({ status }: { status: Status }) => {
  const t = useUiText()
  const variant =
    status === 'approved'
      ? 'success'
      : status === 'requested'
        ? 'warning'
        : status === 'invited'
          ? 'info'
          : status === 'rejected' || status === 'removed'
            ? 'danger'
            : 'neutral'
  const label =
    status === 'approved' ? t('approved')
      : status === 'requested' ? t('requested')
        : status === 'invited' ? t('invited')
          : status === 'rejected' ? t('rejected')
            : status === 'removed' ? t('removed')
              : t('notJoined')
  return <AppBadge variant={variant}>{label}</AppBadge>
}

export default MembershipStatusBadge
