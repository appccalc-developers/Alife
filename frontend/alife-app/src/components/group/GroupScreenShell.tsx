import AppEmptyState from '../layout/AppEmptyState'
import AppActionButton from '../layout/AppActionButton'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto, GroupSummaryDto, GroupTab } from '../../types/group'
import GroupPageTabs from './GroupPageTabs'
import GroupHeaderCard from './GroupHeaderCard'

type Props = {
  group: GroupDto | null
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  loading: boolean
  error: string
  activeTab: GroupTab
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  canCreatePage: boolean
  canEditAllPages: boolean
  contentMode?: 'pages' | 'tabs'
  selectedPageId?: string
  statusMessage?: string
  onJoin: () => void
  onAddPage: () => void
  onPageSaved?: () => void
}

const GroupScreenShell = ({
  group,
  subgroups,
  pages,
  loading,
  error,
  activeTab,
  membershipStatus,
  membershipRole,
  canCreatePage,
  canEditAllPages,
  contentMode = 'tabs',
  selectedPageId = '',
  statusMessage,
  onJoin,
  onAddPage,
  onPageSaved = () => undefined,
}: Props) => (
    <AppPageShell
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
        <div className="space-y-6">
          <GroupHeaderCard
            group={group}
            membershipStatus={membershipStatus}
            membershipRole={membershipRole}
            summary={group.description || `${subgroups.length} subgroups · ${pages.length} pages`}
            actions={
              membershipStatus === 'Not joined' || membershipStatus === 'Invited' ? (
                <AppActionButton variant="primary" onClick={onJoin}>Join group</AppActionButton>
              ) : null
            }
          />

            {(contentMode === 'pages' || activeTab === 'pages') ? (
              <GroupPageTabs
                pages={pages}
                subgroups={subgroups}
                selectedPageId={selectedPageId}
                mode="view"
                canEditAllPages={canEditAllPages}
                onSaved={onPageSaved}
                showCreateAction={contentMode === 'tabs' && canCreatePage}
                onCreate={onAddPage}
              />
            ) : null}

            {statusMessage ? (
              <AppSectionCard dense>
                <p className="text-sm text-slate-600">{statusMessage}</p>
              </AppSectionCard>
            ) : null}
        </div>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState
          title="Group not found"
          description="Try returning to the group list and selecting a different group."
        />
      ) : null}
    </AppPageShell>
)

export default GroupScreenShell
