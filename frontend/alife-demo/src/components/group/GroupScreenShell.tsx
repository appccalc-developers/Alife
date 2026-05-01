import { useEffect, useState } from 'react'
import AppEmptyState from '../layout/AppEmptyState'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto, GroupSummaryDto, GroupTab } from '../../types/group'
import type { GroupMemberToolRow } from '../../hooks/useGroupScreen'
import GroupPageTabs from './GroupPageTabs'
import GroupToolsDrawer from './GroupToolsDrawer'

type Props = {
  group: GroupDto | null
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  memberships?: GroupMemberToolRow[]
  loading: boolean
  error: string
  activeTab: GroupTab
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  canManageGroup: boolean
  canCreatePage: boolean
  canEditAllPages: boolean
  canPublishPages: boolean
  contentMode?: 'pages' | 'tabs'
  selectedPageId?: string
  statusMessage?: string
  onJoin: () => void
  onAddSubgroup: () => void
  onAddPage: () => void
  onInviteMember: () => void
  onOpenSubgroup: (subgroupId: string) => void
  onEditSubgroup: (subgroupId: string) => void
  onDeleteSubgroup: (subgroupId: string) => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
  onPageSaved?: () => void
  onApproveMember?: (memberId: string) => void
  onRejectMember?: (memberId: string) => void
  onKickMember?: (memberId: string) => void
  onSetCoLeader?: (memberId: string, isCoLeader: boolean) => void
}

const GroupScreenShell = ({
  group,
  subgroups,
  pages,
  memberships = [],
  loading,
  error,
  activeTab,
  membershipStatus,
  membershipRole,
  canManageGroup,
  canCreatePage,
  canEditAllPages,
  canPublishPages,
  contentMode = 'tabs',
  selectedPageId = '',
  statusMessage,
  onJoin,
  onAddSubgroup,
  onAddPage,
  onInviteMember,
  onOpenSubgroup,
  onEditSubgroup,
  onDeleteSubgroup,
  onDeletePage,
  onTogglePageVisibility,
  onPageSaved = () => undefined,
  onApproveMember = () => undefined,
  onRejectMember = () => undefined,
  onKickMember = () => undefined,
  onSetCoLeader = () => undefined,
}: Props) => {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [pageContentMode, setPageContentMode] = useState<'view' | 'edit'>('view')

  useEffect(() => {
    const openTools = () => setToolsOpen(true)
    window.addEventListener('open-group-tools', openTools)

    return () => {
      window.removeEventListener('open-group-tools', openTools)
    }
  }, [])

  return (
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
        <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {(contentMode === 'pages' || activeTab === 'pages') ? (
              <GroupPageTabs
                pages={pages}
                subgroups={subgroups}
                selectedPageId={selectedPageId}
                mode={pageContentMode}
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

          <GroupToolsDrawer
            open={toolsOpen}
            group={group}
            subgroups={subgroups}
            pages={pages}
            memberships={memberships}
            membershipStatus={membershipStatus}
            membershipRole={membershipRole}
            canManageGroup={canManageGroup}
            canCreatePage={canCreatePage}
            canEditAllPages={canEditAllPages}
            canPublishPages={canPublishPages}
            selectedPageId={selectedPageId}
            pageContentMode={pageContentMode}
            onClose={() => setToolsOpen(false)}
            onJoin={onJoin}
            onAddSubgroup={onAddSubgroup}
            onAddPage={onAddPage}
            onInviteMember={onInviteMember}
            onOpenSubgroup={onOpenSubgroup}
            onEditSubgroup={onEditSubgroup}
            onDeleteSubgroup={onDeleteSubgroup}
            onPageContentModeChange={setPageContentMode}
            onDeletePage={onDeletePage}
            onTogglePageVisibility={onTogglePageVisibility}
            onApproveMember={onApproveMember}
            onRejectMember={onRejectMember}
            onKickMember={onKickMember}
            onSetCoLeader={onSetCoLeader}
          />
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
}

export default GroupScreenShell
