import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto, GroupSummaryDto, GroupTab } from '../../types/group'
import GroupActionBar from './GroupActionBar'
import GroupHeaderCard from './GroupHeaderCard'
import GroupOverviewPanel from './GroupOverviewPanel'
import ManagementBanner from './ManagementBanner'
import GroupTabs from './GroupTabs'
import PageList from './PageList'
import SubgroupList from './SubgroupList'

type Props = {
  group: GroupDto | null
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  loading: boolean
  error: string
  activeTab: GroupTab
  summary: string
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  managementMode?: boolean
  canManageGroup: boolean
  canCreatePage: boolean
  canEditAllPages: boolean
  canPublishPages: boolean
  statusMessage?: string
  onActiveTabChange: (value: GroupTab) => void
  onJoin: () => void
  onManage: () => void
  onAddSubgroup: () => void
  onAddPage: () => void
  onInviteMember: () => void
  onOpenSubgroup: (subgroupId: string) => void
  onEditSubgroup: (subgroupId: string) => void
  onDeleteSubgroup: (subgroupId: string) => void
  onOpenPage: (slug: string) => void
  onEditPage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
}

const GroupScreenShell = ({
  group,
  subgroups,
  pages,
  loading,
  error,
  activeTab,
  summary,
  membershipStatus,
  membershipRole,
  managementMode,
  canManageGroup,
  canCreatePage,
  canEditAllPages,
  canPublishPages,
  statusMessage,
  onActiveTabChange,
  onJoin,
  onManage,
  onAddSubgroup,
  onAddPage,
  onInviteMember,
  onOpenSubgroup,
  onEditSubgroup,
  onDeleteSubgroup,
  onOpenPage,
  onEditPage,
  onDeletePage,
  onTogglePageVisibility,
}: Props) => {
  const showJoinAction = membershipStatus === 'Not joined' || membershipStatus === 'Invited'
  const subtitle = managementMode ? 'Management workspace for this group.' : 'Group workspace'

  return (
    <AppPageShell
      title={group?.name || 'Group'}
      subtitle={subtitle}
      actions={
        <>
          {showJoinAction && !managementMode ? (
            <AppActionButton variant="primary" onClick={onJoin}>
              Join / Request
            </AppActionButton>
          ) : null}
          {canManageGroup && !managementMode ? <AppActionButton onClick={onManage}>Manage Group</AppActionButton> : null}
        </>
      }
    >
      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">Loading group...</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && group ? (
        <>
          <GroupHeaderCard
            group={group}
            membershipStatus={membershipStatus}
            membershipRole={membershipRole}
            summary={summary}
            managementMode={managementMode}
            actions={
              canCreatePage && !managementMode ? (
                <div className="flex flex-wrap gap-2">
                  <AppActionButton variant="secondary" onClick={onAddPage}>
                    Create Page
                  </AppActionButton>
                </div>
              ) : undefined
            }
          />

          {managementMode ? (
            <ManagementBanner>
              <GroupActionBar onAddSubgroup={onAddSubgroup} onAddPage={onAddPage} onInviteMember={onInviteMember} />
            </ManagementBanner>
          ) : null}

          <GroupTabs value={activeTab} onChange={onActiveTabChange} />

          {activeTab === 'overview' ? (
            <div className="space-y-3">
              <GroupOverviewPanel group={group} subgroupCount={subgroups.length} pageCount={pages.length} />
            </div>
          ) : null}

          {activeTab === 'subgroups' ? (
            <div className="space-y-3">
              <SubgroupList
                items={subgroups}
                canManage={managementMode}
                onOpen={onOpenSubgroup}
                onEdit={onEditSubgroup}
                onDelete={onDeleteSubgroup}
              />
            </div>
          ) : null}

          {activeTab === 'pages' ? (
            <div className="space-y-3">
              <PageList
                items={pages}
                canManage={canEditAllPages}
                canPublish={canPublishPages}
                showCreateAction={canCreatePage || managementMode}
                onCreate={onAddPage}
                onOpen={onOpenPage}
                onEdit={onEditPage}
                onDelete={onDeletePage}
                onToggleVisibility={onTogglePageVisibility}
              />
            </div>
          ) : null}

          {statusMessage ? (
            <AppSectionCard dense>
              <p className="text-sm text-slate-600">{statusMessage}</p>
            </AppSectionCard>
          ) : null}
        </>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState
          title="Group not found"
          description="Try returning to the group list and selecting a different group."
        />
      ) : null}
    </AppPageShell>
  )
}

export default GroupScreenShell
