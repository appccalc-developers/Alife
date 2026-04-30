import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AccessTypeBadge from './AccessTypeBadge'
import MembershipStatusBadge from './MembershipStatusBadge'
import type { GroupDto, GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { GroupMemberToolRow } from '../../hooks/useGroupScreen'

type Props = {
  open: boolean
  group: GroupDto
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  memberships: GroupMemberToolRow[]
  summary: string
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  canManageGroup: boolean
  canCreatePage: boolean
  canEditAllPages: boolean
  canPublishPages: boolean
  onClose: () => void
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
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
}

const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const DrawerPanel = ({
  group,
  subgroups,
  pages,
  memberships,
  summary,
  membershipStatus,
  membershipRole,
  canManageGroup,
  canCreatePage,
  canEditAllPages,
  canPublishPages,
  onClose,
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
  onApproveMember,
  onRejectMember,
  onKickMember,
  onSetCoLeader,
}: Omit<Props, 'open'>) => {
  const showJoinAction = membershipStatus === 'Not joined' || membershipStatus === 'Invited'
  const requestedMembers = memberships.filter((member) => member.status === 'Requested')
  const approvedMembers = memberships.filter((member) => member.status === 'Approved')

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Group tools</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{group.name}</h2>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-950 desktop:hidden"
          aria-label="Close group tools"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <AccessTypeBadge accessType={group.accessType} />
            <MembershipStatusBadge status={membershipStatus} />
            {membershipRole ? <AppBadge variant="info">Role: {membershipRole}</AppBadge> : null}
          </div>
          {group.description ? <p className="text-sm leading-6 text-slate-600">{group.description}</p> : null}
          <p className="text-sm text-slate-600">{summary}</p>
          <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="font-medium text-slate-500">Subgroups</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">{subgroups.length}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="font-medium text-slate-500">Pages</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">{pages.length}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {showJoinAction ? (
              <AppActionButton variant="primary" onClick={onJoin}>
                Join / Request
              </AppActionButton>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Subgroups</h3>
            {canManageGroup ? (
              <AppActionButton size="sm" variant="ghost" onClick={onAddSubgroup}>
                Add
              </AppActionButton>
            ) : null}
          </div>
          {subgroups.length === 0 ? (
            <p className="text-sm text-slate-500">No subgroups yet.</p>
          ) : (
            <ul className="space-y-2">
              {subgroups.map((subgroup) => (
                <li key={subgroup.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{subgroup.name}</p>
                      <div className="mt-1">
                        <AccessTypeBadge accessType={subgroup.accessType} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <AppActionButton size="sm" onClick={() => onOpenSubgroup(subgroup.id)}>
                        Open
                      </AppActionButton>
                      {canManageGroup ? (
                        <>
                          <AppActionButton size="sm" variant="ghost" onClick={() => onEditSubgroup(subgroup.id)}>
                            Edit
                          </AppActionButton>
                          <AppActionButton size="sm" variant="danger" onClick={() => onDeleteSubgroup(subgroup.id)}>
                            Remove
                          </AppActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(canCreatePage || canEditAllPages || canPublishPages) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Page tools</h3>
              {canCreatePage ? (
                <AppActionButton size="sm" variant="primary" onClick={onAddPage}>
                  Add page
                </AppActionButton>
              ) : null}
            </div>
            {canEditAllPages ? (
              <ul className="space-y-2">
                {pages.map((page) => (
                  <li key={page.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{page.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{page.visibility}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <AppActionButton size="sm" variant="ghost" onClick={() => onEditPage(page.id)}>
                        Edit
                      </AppActionButton>
                      <AppActionButton size="sm" variant="danger" onClick={() => onDeletePage(page.id)}>
                        Remove
                      </AppActionButton>
                      {canPublishPages ? (
                        <AppActionButton size="sm" variant="secondary" onClick={() => onTogglePageVisibility(page)}>
                          {page.visibility === 'InvisibleDraft' ? 'Publish' : 'Unpublish'}
                        </AppActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}

        {canManageGroup ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Member tools</h3>
              <AppActionButton size="sm" variant="ghost" onClick={onInviteMember}>
                Invite
              </AppActionButton>
            </div>
            {requestedMembers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Requests</p>
                {requestedMembers.map((member) => (
                  <div key={member.memberId} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">Member {shortId(member.memberId)}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <AppActionButton size="sm" variant="primary" onClick={() => onApproveMember(member.memberId)}>
                        Approve
                      </AppActionButton>
                      <AppActionButton size="sm" variant="danger" onClick={() => onRejectMember(member.memberId)}>
                        Reject
                      </AppActionButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Members</p>
              {approvedMembers.length === 0 ? (
                <p className="text-sm text-slate-500">No approved members found.</p>
              ) : (
                approvedMembers.map((member) => (
                  <div key={member.memberId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">Member {shortId(member.memberId)}</p>
                      <AppBadge variant="info">{member.role}</AppBadge>
                    </div>
                    {member.role !== 'Leader' ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        <AppActionButton
                          size="sm"
                          variant="ghost"
                          onClick={() => onSetCoLeader(member.memberId, member.role !== 'CoLeader')}
                        >
                          {member.role === 'CoLeader' ? 'Reset co-leader' : 'Set co-leader'}
                        </AppActionButton>
                        <AppActionButton size="sm" variant="danger" onClick={() => onKickMember(member.memberId)}>
                          Remove
                        </AppActionButton>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

const GroupToolsDrawer = ({ open, ...props }: Props) => (
  <>
    <aside className="hidden h-fit max-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm desktop:sticky desktop:top-24 desktop:block">
      <DrawerPanel {...props} />
    </aside>

    <div className={open ? 'fixed inset-0 z-50 desktop:hidden' : 'pointer-events-none fixed inset-0 z-50 desktop:hidden'} aria-hidden={!open}>
      <button
        type="button"
        className={['absolute inset-0 bg-slate-950/35 transition-opacity', open ? 'opacity-100' : 'opacity-0'].join(' ')}
        aria-label="Close group tools"
        onClick={props.onClose}
      />
      <aside
        className={[
          'absolute bottom-0 right-0 top-0 w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-label="Group tools"
      >
        <DrawerPanel {...props} />
      </aside>
    </div>
  </>
)

export default GroupToolsDrawer
