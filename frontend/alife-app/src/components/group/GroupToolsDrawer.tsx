import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AccessTypeBadge from './AccessTypeBadge'
import MembershipStatusBadge from './MembershipStatusBadge'
import type { GroupDto, GroupPageDto, GroupSummaryDto } from '../../types/group'
import type { GroupMemberToolRow } from '../../hooks/useGroupScreen'
import type { GroupEventRecord } from '../../types/event'

type Props = {
  open: boolean
  group: GroupDto
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  memberships: GroupMemberToolRow[]
  events: GroupEventRecord[]
  membershipStatus: 'Not joined' | 'Requested' | 'Approved' | 'Invited'
  membershipRole: 'Member' | 'CoLeader' | 'Leader' | null
  canManageGroup: boolean
  canCreatePage: boolean
  canEditAllPages: boolean
  canPublishPages: boolean
  selectedPageId?: string
  pageContentMode?: 'view' | 'edit'
  onClose: () => void
  onJoin: () => void
  onAddSubgroup: () => void
  onAddPage: () => void
  onInviteMember: () => void
  onOpenSubgroup: (subgroupId: string) => void
  onEditSubgroup: (subgroupId: string) => void
  onDeleteSubgroup: (subgroupId: string) => void
  onPageContentModeChange?: (mode: 'view' | 'edit') => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
  onDeleteEvent: (eventId: string) => void
}

const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const Icon = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
)

const AddIcon = () => (
  <Icon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
)

const OpenIcon = () => (
  <Icon>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Icon>
)

const EditIcon = () => (
  <Icon>
    <path d="m12 20 8-8-4-4-8 8-2 6 6-2Z" />
    <path d="m14 6 4 4" />
  </Icon>
)

const RemoveIcon = () => (
  <Icon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="m19 6-1 14H6L5 6" />
    <path d="M10 11v5" />
    <path d="M14 11v5" />
  </Icon>
)

const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

const EyeOffIcon = () => (
  <Icon>
    <path d="m3 3 18 18" />
    <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
    <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1" />
    <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1" />
  </Icon>
)

const UserAddIcon = () => (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6" />
    <path d="M16 11h6" />
  </Icon>
)

const CheckIcon = () => (
  <Icon>
    <path d="m20 6-11 11-5-5" />
  </Icon>
)

const RejectIcon = () => (
  <Icon>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
)

const StarIcon = () => (
  <Icon>
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  </Icon>
)

const UserMinusIcon = () => (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M16 11h6" />
  </Icon>
)

type DrawerIconButtonProps = {
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const DrawerIconButton = ({ label, variant = 'secondary', children, className = '', ...props }: DrawerIconButtonProps) => (
  <AppActionButton
    size="sm"
    variant={variant}
    className={`h-8 w-8 p-0 ${className}`.trim()}
    aria-label={label}
    title={label}
    {...props}
  >
    <span className="sr-only">{label}</span>
    {children}
  </AppActionButton>
)

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const DrawerPanel = ({
  group,
  subgroups,
  pages,
  memberships,
  events,
  membershipStatus,
  membershipRole,
  canManageGroup,
  canCreatePage,
  canEditAllPages,
  canPublishPages,
  selectedPageId = '',
  pageContentMode = 'view',
  onClose,
  onJoin,
  onAddSubgroup,
  onAddPage,
  onInviteMember,
  onOpenSubgroup,
  onEditSubgroup,
  onDeleteSubgroup,
  onPageContentModeChange = () => undefined,
  onDeletePage,
  onTogglePageVisibility,
  onApproveMember,
  onRejectMember,
  onKickMember,
  onSetCoLeader,
  onDeleteEvent,
}: Omit<Props, 'open'>) => {
  const navigate = useNavigate()
  const showJoinAction = membershipStatus === 'Not joined' || membershipStatus === 'Invited'
  const requestedMembers = memberships.filter((member) => member.status === 'Requested')
  const approvedMembers = memberships.filter((member) => member.status === 'Approved')
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null

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
          <div className="flex flex-wrap gap-2">
            {showJoinAction ? (
              <DrawerIconButton label="Join or request access" variant="primary" onClick={onJoin}>
                <UserAddIcon />
              </DrawerIconButton>
            ) : null}
          </div>
        </section>

        {(canCreatePage || canEditAllPages || canPublishPages) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Current page</h3>
              {canCreatePage ? (
                <DrawerIconButton label="Add page" variant="primary" onClick={onAddPage}>
                  <AddIcon />
                </DrawerIconButton>
              ) : null}
            </div>
            {canEditAllPages ? (
              <ul className="space-y-2">
                {activePage ? [activePage].map((page) => (
                  <li key={page.id} className="rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-900">{page.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{page.visibility}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-1">
                      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" aria-label={`${page.title} view mode`}>
                        <button
                          type="button"
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            pageContentMode === 'view' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          onClick={() => onPageContentModeChange('view')}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            pageContentMode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                          onClick={() => {
                            onPageContentModeChange('edit')
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      <DrawerIconButton label={`Remove ${page.title}`} variant="danger" onClick={() => onDeletePage(page.id)}>
                        <RemoveIcon />
                      </DrawerIconButton>
                      {canPublishPages ? (
                        <DrawerIconButton
                          label={page.visibility === 'InvisibleDraft' ? `Publish ${page.title}` : `Unpublish ${page.title}`}
                          variant="secondary"
                          onClick={() => onTogglePageVisibility(page)}
                        >
                          {page.visibility === 'InvisibleDraft' ? <EyeIcon /> : <EyeOffIcon />}
                        </DrawerIconButton>
                      ) : null}
                    </div>
                  </li>
                )) : null}
              </ul>
            ) : null}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Subgroups</h3>
            {canManageGroup ? (
              <DrawerIconButton label="Add subgroup" variant="ghost" onClick={onAddSubgroup}>
                <AddIcon />
              </DrawerIconButton>
            ) : null}
          </div>
          {subgroups.length === 0 ? (
            <p className="text-sm text-slate-500">No subgroups yet.</p>
          ) : (
            <ul className="space-y-2">
              {subgroups.map((subgroup) => (
                <li key={subgroup.id} className="rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{subgroup.name}</p>
                    <div className="mt-1">
                      <AccessTypeBadge accessType={subgroup.accessType} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-1">
                    <DrawerIconButton label={`Open ${subgroup.name}`} onClick={() => onOpenSubgroup(subgroup.id)}>
                      <OpenIcon />
                    </DrawerIconButton>
                    {canManageGroup ? (
                      <>
                        <DrawerIconButton label={`Edit ${subgroup.name}`} variant="ghost" onClick={() => onEditSubgroup(subgroup.id)}>
                          <EditIcon />
                        </DrawerIconButton>
                        <DrawerIconButton label={`Remove ${subgroup.name}`} variant="danger" onClick={() => onDeleteSubgroup(subgroup.id)}>
                          <RemoveIcon />
                        </DrawerIconButton>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManageGroup ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Events</h3>
              <DrawerIconButton
                label="Create event with AI"
                variant="ghost"
                onClick={() => navigate(`/events/new?groupId=${group.id}`)}
              >
                <AddIcon />
              </DrawerIconButton>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => {
                  const title = event.titleEn || event.titleZh || 'Untitled'
                  const start = event.startDate
                    ? new Date(event.startDate).toLocaleDateString()
                    : '—'
                  return (
                    <li key={event.id} className="rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-medium text-slate-900">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">{start}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-1">
                        <DrawerIconButton
                          label={`Edit event: ${title}`}
                          variant="ghost"
                          onClick={() => navigate(`/events/${event.id}/edit?groupId=${group.id}`, { state: { event } })}
                        >
                          <EditIcon />
                        </DrawerIconButton>
                        <DrawerIconButton label={`Delete event: ${title}`} variant="danger" onClick={() => onDeleteEvent(event.id)}>
                          <RemoveIcon />
                        </DrawerIconButton>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {canManageGroup ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Member tools</h3>
              <DrawerIconButton label="Invite member" variant="ghost" onClick={onInviteMember}>
                <UserAddIcon />
              </DrawerIconButton>
            </div>
            {requestedMembers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Requests</p>
                {requestedMembers.map((member) => (
                  <div key={member.memberId} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">Member {shortId(member.memberId)}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <DrawerIconButton label={`Approve member ${shortId(member.memberId)}`} variant="primary" onClick={() => onApproveMember(member.memberId)}>
                        <CheckIcon />
                      </DrawerIconButton>
                      <DrawerIconButton label={`Reject member ${shortId(member.memberId)}`} variant="danger" onClick={() => onRejectMember(member.memberId)}>
                        <RejectIcon />
                      </DrawerIconButton>
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
                          className="h-8 w-8 p-0"
                          aria-label={member.role === 'CoLeader' ? `Reset co-leader ${shortId(member.memberId)}` : `Set co-leader ${shortId(member.memberId)}`}
                          title={member.role === 'CoLeader' ? `Reset co-leader ${shortId(member.memberId)}` : `Set co-leader ${shortId(member.memberId)}`}
                          onClick={() => onSetCoLeader(member.memberId, member.role !== 'CoLeader')}
                        >
                          <span className="sr-only">{member.role === 'CoLeader' ? `Reset co-leader ${shortId(member.memberId)}` : `Set co-leader ${shortId(member.memberId)}`}</span>
                          {member.role === 'CoLeader' ? <UserMinusIcon /> : <StarIcon />}
                        </AppActionButton>
                        <DrawerIconButton label={`Remove member ${shortId(member.memberId)}`} variant="danger" onClick={() => onKickMember(member.memberId)}>
                          <RemoveIcon />
                        </DrawerIconButton>
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
    <aside className="hidden h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm desktop:sticky desktop:top-24 desktop:block">
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
