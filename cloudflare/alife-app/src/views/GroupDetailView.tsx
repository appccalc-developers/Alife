import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import GroupScreenShell from '../components/group/GroupScreenShell'
import GroupDashboard from '../components/group/GroupDashboard'
import GroupManageView from './GroupManageView'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { activeEntityService } from '../services/activeEntityService'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'

type GroupBrowseViewProps = {
  groupId: string
  pageId: string
}

const GroupBrowseView = ({ groupId, pageId }: GroupBrowseViewProps) => {
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

const GroupDetailView = () => {
  const auth = useAuthStore()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId, pageId } = useActiveEntityIds({ groupId: routeGroupId })
  const { CurrentGroup, setCurrentGroup } = useCurrentGroupStore()
  const groupId = activeGroupId || ''
  const isChurchRoute = Boolean(groupId && CurrentGroup?.id === groupId && CurrentGroup.isChurch)

  useEffect(() => {
    if (!isChurchRoute) return
    activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
    setCurrentGroup(null)
  }, [isChurchRoute, setCurrentGroup])

  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  if (isChurchRoute) {
    return <Navigate to="/church" replace />
  }

  if (!pageId && auth.canManageGroup(groupId)) {
    return <GroupManageView embeddedWorkspace />
  }

  return <GroupBrowseView groupId={groupId} pageId={pageId} />
}

export default GroupDetailView
