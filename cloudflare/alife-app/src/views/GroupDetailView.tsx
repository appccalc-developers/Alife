import { useEffect } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  scope?: 'group' | 'church'
}

const GroupBrowseView = ({ groupId, pageId, scope = 'group' }: GroupBrowseViewProps) => {
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
    if (group && scope === 'group' && !group.isChurch) {
      setCurrentGroup(group)
    }
  }, [group, scope, setCurrentGroup])

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
          scope={scope}
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

type GroupWorkspaceViewProps = {
  groupId: string
  pageId?: string
  scope?: 'group' | 'church'
  managementEnabled?: boolean
}

export const GroupWorkspaceView = ({ groupId, pageId = '', scope = 'group', managementEnabled = true }: GroupWorkspaceViewProps) => {
  const auth = useAuthStore()

  if (managementEnabled && !pageId && auth.canManageGroup(groupId)) {
    return (
      <GroupManageView
        embeddedWorkspace
        explicitGroupId={scope === 'church' ? groupId : undefined}
        workspaceBasePath={scope === 'church' ? '/church' : '/groups'}
      />
    )
  }

  return <GroupBrowseView groupId={groupId} pageId={pageId} scope={scope} />
}

const GroupDetailView = () => {
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const [searchParams] = useSearchParams()
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

  return (
    <GroupWorkspaceView
      groupId={groupId}
      pageId={pageId}
      managementEnabled={searchParams.get('view') !== 'overview' && searchParams.has('section')}
    />
  )
}

export default GroupDetailView
