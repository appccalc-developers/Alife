import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AccessTypeBadge from './AccessTypeBadge'
import type { GroupDto, GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { GroupMembershipRow } from '../../hooks/useGroupScreen'
import type { ReactNode } from 'react'

type Props = {
  group: GroupDto | null
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  memberships: GroupMembershipRow[]
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  canManageGroup: boolean
  canCreatePage: boolean
  canEditAllPages: boolean
  canPublishPages: boolean
  statusMessage?: string
  onJoin: () => void
  onManage: () => void
  onAddSubgroup: () => void
  onCloseGroup: () => void
  onInviteMember: () => void
  onOpenSubgroup: (subgroupId: string) => void
  onEditSubgroup: (subgroupId: string) => void
  onDeleteSubgroup: (subgroupId: string) => void
  onAddPage: () => void
  onOpenPage: (slug: string) => void
  onEditPage: (slug: string) => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
}

const DrawerSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-b border-slate-200 py-5 first:pt-0 last:border-b-0">
    <h3 className="mb-3 text-sm font-semibold text-slate-950">{title}</h3>
    {children}
  </section>
)

const GroupToolsDrawer = ({
  group,
  subgroups,
  pages,
  memberships,
  membershipStatus,
  membershipRole,
  canManageGroup,
  canCreatePage,
  canEditAllPages,
  canPublishPages,
  statusMessage,
  onJoin,
  onManage,
  onAddSubgroup,
  onCloseGroup,
  onInviteMember,
  onOpenSubgroup,
  onEditSubgroup,
  onDeleteSubgroup,
  onAddPage,
  onOpenPage,
  onEditPage,
  onDeletePage,
  onTogglePageVisibility,
  onApproveMember,
  onRejectMember,
  onKickMember,
  onSetCoLeader,
}: Props) => {
  const showJoinAction = membershipStatus === 'Not joined' || membershipStatus === 'Invited'

  return (
    <div className="space-y-0 text-sm">
      <DrawerSection title="Group Details">
        {group ? (
          <div className="space-y-3">
            <div>
              <p className="text-lg font-semibold leading-tight text-slate-950">{group.name}</p>
              <p className="mt-1 text-slate-600">{group.description || 'No description yet.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-500">Access</p>
                <div className="mt-1">
                  <AccessTypeBadge accessType={group.accessType} />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-500">Status</p>
                <p className="mt-1 font-semibold text-slate-900">{group.isClosed ? 'Closed' : 'Active'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-500">Pages</p>
                <p className="mt-1 font-semibold text-slate-900">{pages.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-500">Subgroups</p>
                <p className="mt-1 font-semibold text-slate-900">{subgroups.length}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <AppBadge variant={membershipStatus === 'Approved' ? 'success' : 'info'}>{membershipStatus}</AppBadge>
              {membershipRole ? <AppBadge variant="info">{membershipRole}</AppBadge> : null}
            </div>
            {showJoinAction ? (
              <AppActionButton variant="primary" block onClick={onJoin}>
                Join / Request
              </AppActionButton>
            ) : null}
          </div>
        ) : (
          <p className="text-slate-600">Group details are not available.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Subgroups">
        {canManageGroup ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <AppActionButton size="sm" variant="primary" onClick={onAddSubgroup}>
              Add
            </AppActionButton>
            <AppActionButton size="sm" onClick={onManage}>
              Manage
            </AppActionButton>
          </div>
        ) : null}
        {subgroups.length === 0 ? (
          <p className="text-slate-600">No subgroups yet.</p>
        ) : (
          <ul className="space-y-2">
            {subgroups.map((subgroup) => (
              <li key={subgroup.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{subgroup.name}</p>
                    <div className="mt-1">
                      <AccessTypeBadge accessType={subgroup.accessType} />
                    </div>
                  </div>
                  <AppActionButton size="sm" onClick={() => onOpenSubgroup(subgroup.id)}>
                    Open
                  </AppActionButton>
                </div>
                {canManageGroup ? (
                  <div className="mt-3 flex gap-2">
                    <AppActionButton size="sm" variant="ghost" onClick={() => onEditSubgroup(subgroup.id)}>
                      Edit
                    </AppActionButton>
                    <AppActionButton size="sm" variant="danger" onClick={() => onDeleteSubgroup(subgroup.id)}>
                      Remove
                    </AppActionButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DrawerSection>

      {canCreatePage || canEditAllPages ? (
        <DrawerSection title="Page Tools">
          {canCreatePage ? (
            <AppActionButton variant="primary" block onClick={onAddPage}>
              Add Page
            </AppActionButton>
          ) : null}
          {pages.length === 0 ? (
            <p className="mt-3 text-slate-600">No pages to manage yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pages.map((page) => (
                <li key={page.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{page.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{page.visibility}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppActionButton size="sm" onClick={() => onOpenPage(page.slug)}>
                      Open
                    </AppActionButton>
                    {canEditAllPages ? (
                      <>
                        <AppActionButton size="sm" variant="ghost" onClick={() => onEditPage(page.slug)}>
                          Edit
                        </AppActionButton>
                        <AppActionButton size="sm" variant="danger" onClick={() => onDeletePage(page.id)}>
                          Remove
                        </AppActionButton>
                      </>
                    ) : null}
                    {canPublishPages ? (
                      <AppActionButton size="sm" variant="secondary" onClick={() => onTogglePageVisibility(page)}>
                        {page.visibility === 'InvisibleDraft' ? 'Publish' : 'Unpublish'}
                      </AppActionButton>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DrawerSection>
      ) : null}

      {canManageGroup ? (
        <DrawerSection title="Member Management">
          <AppActionButton variant="primary" block onClick={onInviteMember}>
            Invite Member
          </AppActionButton>
          {memberships.length === 0 ? (
            <p className="mt-3 text-slate-600">No member records available.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {memberships.map((member) => (
                <li key={member.memberId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="break-all font-semibold text-slate-900">{member.memberId}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AppBadge variant={member.status === 'Approved' ? 'success' : 'warning'}>{member.status}</AppBadge>
                    <AppBadge variant="info">{member.role}</AppBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {member.status === 'Requested' ? (
                      <>
                        <AppActionButton size="sm" onClick={() => onApproveMember(member.memberId)}>
                          Approve
                        </AppActionButton>
                        <AppActionButton size="sm" variant="ghost" onClick={() => onRejectMember(member.memberId)}>
                          Reject
                        </AppActionButton>
                      </>
                    ) : null}
                    {member.status === 'Approved' && member.role !== 'Leader' ? (
                      <>
                        <AppActionButton
                          size="sm"
                          variant="secondary"
                          onClick={() => onSetCoLeader(member.memberId, member.role !== 'CoLeader')}
                        >
                          {member.role === 'CoLeader' ? 'Reset Co-leader' : 'Set Co-leader'}
                        </AppActionButton>
                        <AppActionButton size="sm" variant="danger" onClick={() => onKickMember(member.memberId)}>
                          Kick
                        </AppActionButton>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DrawerSection>
      ) : null}

      {canManageGroup ? (
        <DrawerSection title="Group Management">
          <AppActionButton variant="danger" block disabled={Boolean(group?.isClosed)} onClick={onCloseGroup}>
            Deactivate Group
          </AppActionButton>
        </DrawerSection>
      ) : null}

      {statusMessage ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{statusMessage}</p>
      ) : null}
    </div>
  )
}

export default GroupToolsDrawer
