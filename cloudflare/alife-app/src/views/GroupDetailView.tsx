import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import GroupDashboard from '../components/group/GroupDashboard'
import GroupManageView from './GroupManageView'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { activeEntityService } from '../services/activeEntityService'
import { useCurrentGroupStore } from '../stores/currentGroup'

const GroupDetailView = () => {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId, pageId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const navigate = useNavigate()
  const { setCurrentGroup } = useCurrentGroupStore()

  const {
    activeTab,
    group,
    subgroups,
    pages,
    events,
    loading,
    error,
    statusMessage,
    canManageGroup,
    canCreatePage,
    canEditAllPages,
    refreshPages,
  } = useGroupScreen(groupId, { loadEvents: true })

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  if (!pageId && !loading && canManageGroup) {
    return <GroupManageView embeddedWorkspace />
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
      contentMode={pageId ? 'pages' : 'dashboard'}
      dashboard={group ? (
        <GroupDashboard
          group={group}
          pages={pages}
          subgroups={subgroups}
          events={events}
          canManage={canManageGroup}
        />
      ) : null}
      selectedPageId={pageId}
      statusMessage={statusMessage}
      onAddPage={() => {
        activeEntityService.setGroup(groupId, { clearPage: true })
        navigate(`/groups/${groupId}/pages/new`)
      }}
      onPageSaved={() => {
        refreshPages().catch(() => undefined)
      }}
    />
  )
}

export default GroupDetailView
