import { useNavigate, useParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import { useGroupScreen } from '../hooks/useGroupScreen'

const GroupDetailView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const {
    activeTab,
    setActiveTab,
    group,
    subgroups,
    pages,
    loading,
    error,
    statusMessage,
    membershipStatus,
    membershipRole,
    canManageGroup,
    canCreatePage,
    joinOrRequest,
  } = useGroupScreen(groupId)

  return (
    <GroupScreenShell
      group={group}
      subgroups={subgroups}
      pages={pages}
      loading={loading}
      error={error}
      activeTab={activeTab}
      summary={group ? `${subgroups.length} subgroups - ${pages.length} pages - ${group.accessType}` : ''}
      membershipStatus={membershipStatus}
      membershipRole={membershipRole}
      canManageGroup={Boolean(canManageGroup)}
      canCreatePage={Boolean(canCreatePage)}
      canEditAllPages={false}
      canPublishPages={false}
      statusMessage={statusMessage}
      onActiveTabChange={setActiveTab}
      onJoin={() => {
        joinOrRequest().catch(() => undefined)
      }}
      onManage={() => {
        navigate(`/groups/${groupId}/manage`)
      }}
      onAddSubgroup={() => undefined}
      onAddPage={() => {
        navigate(`/groups/${groupId}/pages/new`)
      }}
      onInviteMember={() => undefined}
      onOpenSubgroup={(subgroupId) => {
        navigate(`/groups/${subgroupId}`)
      }}
      onEditSubgroup={() => undefined}
      onDeleteSubgroup={() => undefined}
      onOpenPage={(slug) => {
        navigate(`/pages/${slug}`)
      }}
      onEditPage={() => undefined}
      onDeletePage={() => undefined}
      onTogglePageVisibility={() => undefined}
    />
  )
}

export default GroupDetailView
