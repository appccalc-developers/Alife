import { useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
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
  onEditPage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
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
  onEditPage,
  onDeletePage,
  onTogglePageVisibility,
  onApproveMember = () => undefined,
  onRejectMember = () => undefined,
  onKickMember = () => undefined,
  onSetCoLeader = () => undefined,
}: Props) => {
  const [toolsOpen, setToolsOpen] = useState(false)
  const subtitle = contentMode === 'pages' ? 'Pages published for this group.' : 'Group workspace'
  const title = contentMode === 'pages' ? 'Group pages' : group?.name || 'Group'

  useEffect(() => {
    const openTools = () => setToolsOpen(true)
    window.addEventListener('open-group-tools', openTools)

    return () => {
      window.removeEventListener('open-group-tools', openTools)
    }
  }, [])

  return (
    <AppPageShell
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {group ? (
            <AppActionButton variant="primary" onClick={() => setToolsOpen(true)} className="desktop:hidden">
              Group tools
            </AppActionButton>
          ) : null}
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
        <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {(contentMode === 'pages' || activeTab === 'pages') ? (
              <GroupPageTabs
                pages={pages}
                subgroups={subgroups}
                selectedPageId={selectedPageId}
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
            onClose={() => setToolsOpen(false)}
            onJoin={onJoin}
            onAddSubgroup={onAddSubgroup}
            onAddPage={onAddPage}
            onInviteMember={onInviteMember}
            onOpenSubgroup={onOpenSubgroup}
            onEditSubgroup={onEditSubgroup}
            onDeleteSubgroup={onDeleteSubgroup}
            onEditPage={onEditPage}
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
