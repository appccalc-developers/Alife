import AppBadge from '../layout/AppBadge'

type Status = 'Not joined' | 'Requested' | 'Approved' | 'Invited'

const MembershipStatusBadge = ({ status }: { status: Status }) => {
  const variant = status === 'Approved' ? 'success' : status === 'Requested' ? 'warning' : status === 'Invited' ? 'info' : 'neutral'
  return <AppBadge variant={variant}>{status}</AppBadge>
}

export default MembershipStatusBadge
