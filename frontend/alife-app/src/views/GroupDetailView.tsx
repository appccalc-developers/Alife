import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { useCurrentGroupStore } from '../stores/currentGroup'

const GroupDetailView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setCurrentGroup } = useCurrentGroupStore()

  const {
    activeTab,
    group,
    subgroups,
    pages,
    loading,
    error,
    statusMessage,
    membershipStatus,
    membershipRole,
    canCreatePage,
    canEditAllPages,
    joinOrRequest,
    refreshPages,
  } = useGroupScreen(groupId)

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  return (
    <GroupScreenShell
      group={group}
      subgroups={subgroups}
      pages={pages}
      loading={loading}
      error={error}
      activeTab={activeTab}
      membershipStatus={membershipStatus}
      membershipRole={membershipRole}
      canCreatePage={Boolean(canCreatePage)}
      canEditAllPages={Boolean(canEditAllPages)}
      contentMode="pages"
      selectedPageId={searchParams.get('page') ?? ''}
      statusMessage={statusMessage}
      onJoin={() => {
        joinOrRequest().catch(() => undefined)
      }}
      onAddPage={() => {
        navigate(`/groups/${groupId}/pages/new`)
      }}
      onPageSaved={() => {
        refreshPages().catch(() => undefined)
      }}
    />
  )
}

export default GroupDetailView
