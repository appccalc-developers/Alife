import AppActionButton from '../layout/AppActionButton'
import AppToolbar from '../layout/AppToolbar'

type Props = {
  onAddSubgroup: () => void
  onAddPage: () => void
  onInviteMember: () => void
}

const GroupActionBar = ({ onAddSubgroup, onAddPage, onInviteMember }: Props) => (
  <AppToolbar title="Workspace Actions" description="Quick actions for leaders and co-leaders.">
    <AppActionButton variant="primary" onClick={onAddSubgroup}>Add Subgroup</AppActionButton>
    <AppActionButton variant="secondary" onClick={onAddPage}>Add Page</AppActionButton>
    <AppActionButton variant="ghost" onClick={onInviteMember}>Invite Member</AppActionButton>
  </AppToolbar>
)

export default GroupActionBar
