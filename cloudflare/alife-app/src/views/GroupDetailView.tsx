import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Settings2 } from 'lucide-react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
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
import { localizeText } from '../utils/localizedText'

type GroupBrowseViewProps = {
  groupId: string
  pageId: string
  scope?: 'group' | 'church'
  explicitGroupRoute?: boolean
}

const GroupBrowseView = ({ groupId, pageId, scope = 'group', explicitGroupRoute = false }: GroupBrowseViewProps) => {
  const navigate = useNavigate()
  const { language } = useAuthStore()
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
    membershipStatus,
    refreshPages,
  } = useGroupScreen(groupId, { loadEvents: true })

  useEffect(() => {
    if (group && scope === 'group' && !explicitGroupRoute && !group.isChurch) {
      setCurrentGroup(group)
    }
  }, [explicitGroupRoute, group, scope, setCurrentGroup])

  const selectedPage = pages.find((page) => page.id === pageId) ?? pages[0] ?? null
  const groupName = group ? localizeText(group.name, language) : ''
  const pageTitle = selectedPage ? localizeText(selectedPage.title, language) : ''
  const visibilityLabel = selectedPage?.visibility === 'public'
    ? (language === 'zh' ? '公开' : 'Public')
    : selectedPage?.visibility === 'group'
      ? (language === 'zh' ? '小组可见' : 'Group only')
      : (language === 'zh' ? '草稿' : 'Draft')

  const content = (
    <GroupScreenShell
      group={group}
      subgroups={subgroups}
      pages={pages}
      loading={loading}
      error={error}
      activeTab={activeTab}
      canCreatePage={Boolean(canCreatePage)}
      canEditAllPages={Boolean(canEditAllPages)}
      canViewWorkingCopy={Boolean(canEditAllPages || membershipStatus === 'approved')}
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

  if (pageId) {
    const overviewPath = explicitGroupRoute
      ? `/groups/${encodeURIComponent(groupId)}?view=overview`
      : '/groups?view=overview'

    return (
      <AppPageShell
        title={pageTitle || (language === 'zh' ? '小组内容' : 'Group content')}
        context={scope === 'church'
          ? (language === 'zh' ? `${groupName} / 内容` : `${groupName} / Content`)
          : (language === 'zh' ? `小组生活 / ${groupName} / 内容` : `Group Life / ${groupName} / Content`)}
        subtitle={selectedPage ? localizeText(selectedPage.description, language) : undefined}
        status={selectedPage ? <AppBadge variant={selectedPage.visibility === 'draft' ? 'warning' : 'info'}>{visibilityLabel}</AppBadge> : undefined}
        backLink={{
          label: language === 'zh' ? '返回小组总览' : 'Back to group overview',
          to: overviewPath,
          onClick: explicitGroupRoute ? undefined : () => activeEntityService.setPage('', groupId),
        }}
        overflowLabel={language === 'zh' ? '更多操作' : 'More actions'}
        overflowActions={[
          ...(selectedPage && canEditAllPages ? [{
            label: language === 'zh' ? '编辑页面' : 'Edit page',
            icon: <Pencil className="h-4 w-4" />,
            to: `/pages/${encodeURIComponent(selectedPage.id)}/edit`,
          }] : []),
          ...(canManageGroup ? [{
            label: language === 'zh' ? '管理小组内容' : 'Manage group content',
            icon: <Settings2 className="h-4 w-4" />,
            to: explicitGroupRoute
              ? `/groups/${encodeURIComponent(groupId)}/manage?section=pages`
              : '/groups?section=pages',
          }] : []),
        ]}
      >
        {content}
      </AppPageShell>
    )
  }

  if (loading || error || !group) {
    return (
      <AppPageShell
        title={language === 'zh' ? '小组生活' : 'Group Life'}
        context={language === 'zh' ? '小组生活 / 总览' : 'Group Life / Overview'}
      >
        {content}
      </AppPageShell>
    )
  }

  return content
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
      <AppPageShell title={auth.language === 'zh' ? '小组生活' : 'Group Life'} context={auth.language === 'zh' ? '小组生活 / 总览' : 'Group Life / Overview'}>
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
