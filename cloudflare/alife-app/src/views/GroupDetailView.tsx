import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import GroupScreenShell from '../components/group/GroupScreenShell'
import GroupDashboard from '../components/group/GroupDashboard'
import GroupManageView from './GroupManageView'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { ensureGroupForViewer } from '../db/collections/groupCollection'
import { activeEntityService } from '../services/activeEntityService'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'

type GroupBrowseViewProps = {
  groupId: string
  pageId: string
  scope?: 'group' | 'church'
  explicitGroupRoute?: boolean
}

const GroupBrowseView = ({ groupId, pageId, scope = 'group', explicitGroupRoute = false }: GroupBrowseViewProps) => {
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
    if (group && scope === 'group' && !explicitGroupRoute && !group.isChurch) {
      setCurrentGroup(group)
    }
  }, [explicitGroupRoute, group, scope, setCurrentGroup])

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
          explicitGroupRoute={explicitGroupRoute}
        />
      ) : null}
      selectedPageId={pageId}
      statusMessage={statusMessage}
      onAddPage={() => {
        if (!explicitGroupRoute) activeEntityService.setGroup(groupId, { clearPage: true })
        navigate(scope === 'group' && !explicitGroupRoute ? '/pages/new' : `/groups/${encodeURIComponent(groupId)}/pages/new`)
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
  explicitGroupRoute?: boolean
}

export const GroupWorkspaceView = ({ groupId, pageId = '', scope = 'group', managementEnabled = true, explicitGroupRoute = false }: GroupWorkspaceViewProps) => {
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

  return <GroupBrowseView groupId={groupId} pageId={pageId} scope={scope} explicitGroupRoute={explicitGroupRoute} />
}

const GroupDetailView = () => {
  const auth = useAuthStore()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const [searchParams] = useSearchParams()
  const { groupId: activeGroupId, pageId: activePageId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const pageId = routeGroupId ? searchParams.get('page')?.trim() ?? '' : activePageId
  const routeGroupQuery = useQuery({
    queryKey: ['group-route-scope', routeGroupId ?? '', auth.me?.id ?? 'guest'],
    queryFn: () => ensureGroupForViewer(routeGroupId || '', auth.me?.id),
    enabled: Boolean(routeGroupId),
    staleTime: 1_000,
  })
  const isChurchRoute = routeGroupQuery.data?.isChurch === true

  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  if (routeGroupId && routeGroupQuery.isPending) {
    return (
      <AppPageShell>
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 text-sm text-[#60716a]">
          {auth.language === 'zh' ? '正在确认小组入口…' : 'Checking group access…'}
        </section>
      </AppPageShell>
    )
  }

  if (isChurchRoute) {
    return <Navigate to="/church" replace />
  }

  return (
    <GroupWorkspaceView
      groupId={groupId}
      pageId={pageId}
      explicitGroupRoute={Boolean(routeGroupId)}
      managementEnabled={searchParams.get('view') !== 'overview' && searchParams.has('section')}
    />
  )
}

export default GroupDetailView
