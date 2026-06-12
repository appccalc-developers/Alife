import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { activeEntityService } from '../services/activeEntityService'
import { useCurrentGroupStore } from '../stores/currentGroup'

const GroupDetailView = () => {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId, pageId } = useActiveEntityIds({ groupId: routeGroupId })
  const navigate = useNavigate()
  const { setCurrentGroup } = useCurrentGroupStore()

  const {
    activeTab,
    group,
    subgroups,
    pages,
    loading,
    error,
    statusMessage,
    canCreatePage,
    canEditAllPages,
    refreshPages,
  } = useGroupScreen(groupId)

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  if (!groupId) {
    return <Navigate to="/" replace />
  }

  return (
    <GroupScreenShell
      group={group}
      subgroups={subgroups}
      pages={pages}
      loading={loading}
      error={error}
      activeTab={activeTab}
      canCreatePage={Boolean(canCreatePage)}
      canEditAllPages={Boolean(canEditAllPages)}
      contentMode="pages"
      selectedPageId={pageId}
      statusMessage={statusMessage}
      onAddPage={() => {
        activeEntityService.setGroup(groupId, { clearPage: true })
        navigate('/pages/new')
      }}
      onPageSaved={() => {
        refreshPages().catch(() => undefined)
      }}
    />
  )
}

export default GroupDetailView
