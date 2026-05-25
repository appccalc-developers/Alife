import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import EnrollmentChatDialog from '../components/group/EnrollmentChatDialog'
import GroupOverviewPanel from '../components/group/GroupOverviewPanel'
import MembershipStatusBadge from '../components/group/MembershipStatusBadge'
import { useGroupScreen, type GroupMemberToolRow } from '../hooks/useGroupScreen'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { GroupPageDto } from '../types/group'
import type { GroupEventRecord } from '../types/event'

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const formatDate = (value: string) => {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString()
}

const sectionStats = (items: Array<{ label: string; value: number }>) => (
  <div className="grid gap-2 sm:grid-cols-4">
    {items.map((item) => (
      <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">{item.label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">{item.value}</p>
      </div>
    ))}
  </div>
)

type MembersPanelProps = {
  memberships: GroupMemberToolRow[]
  onInviteMember: () => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
}

const MembersPanel = ({ memberships, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader }: MembersPanelProps) => {
  const requestedMembers = memberships.filter((member) => member.status === 'Requested')
  const approvedMembers = memberships.filter((member) => member.status === 'Approved')

  return (
    <AppSectionCard title="Members" subtitle="Review requests, invite people, and delegate co-leaders.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {sectionStats([
          { label: 'Pending', value: requestedMembers.length },
          { label: 'Approved', value: approvedMembers.length },
          { label: 'Co-leaders', value: approvedMembers.filter((member) => member.role === 'CoLeader').length },
          { label: 'Total rows', value: memberships.length },
        ])}
        <AppActionButton variant="primary" onClick={onInviteMember}>Invite member</AppActionButton>
      </div>

      {requestedMembers.length > 0 ? (
        <div className="mb-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Requests</h3>
          {requestedMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <div>
                <p className="font-medium text-slate-950">Member {shortId(member.memberId)}</p>
                <MembershipStatusBadge status="Requested" />
              </div>
              <div className="flex gap-2">
                <AppActionButton size="sm" variant="primary" onClick={() => onApproveMember(member.memberId)}>Approve</AppActionButton>
                <AppActionButton size="sm" variant="danger" onClick={() => onRejectMember(member.memberId)}>Reject</AppActionButton>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Active members</h3>
        {approvedMembers.length === 0 ? (
          <p className="text-sm text-slate-500">No approved members found.</p>
        ) : (
          approvedMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-950">Member {shortId(member.memberId)}</p>
                <AppBadge variant="info">{member.role}</AppBadge>
              </div>
              {member.role !== 'Leader' ? (
                <div className="flex gap-2">
                  <AppActionButton size="sm" variant="secondary" onClick={() => onSetCoLeader(member.memberId, member.role !== 'CoLeader')}>
                    {member.role === 'CoLeader' ? 'Reset co-leader' : 'Set co-leader'}
                  </AppActionButton>
                  <AppActionButton size="sm" variant="danger" onClick={() => onKickMember(member.memberId)}>Remove</AppActionButton>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </AppSectionCard>
  )
}

type PagesPanelProps = {
  groupId: string
  language: string
  pages: GroupPageDto[]
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onTogglePageVisibility: (page: GroupPageDto) => void
}

const PagesPanel = ({ groupId, language, pages, onAddPage, onDeletePage, onTogglePageVisibility }: PagesPanelProps) => (
  <AppSectionCard title="Pages" subtitle="Create, edit, publish, and retire group pages.">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {sectionStats([
        { label: 'Pages', value: pages.length },
        { label: 'Published', value: pages.filter((page) => page.visibility !== 'InvisibleDraft').length },
        { label: 'Drafts', value: pages.filter((page) => page.visibility === 'InvisibleDraft').length },
        { label: 'Group', value: 1 },
      ])}
      <AppActionButton variant="primary" onClick={onAddPage}>Add page</AppActionButton>
    </div>

    {pages.length === 0 ? (
      <p className="text-sm text-slate-500">No pages yet.</p>
    ) : (
      <div className="space-y-2">
        {pages.map((page) => (
          <div key={page.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div>
              <p className="font-medium text-slate-950">{localizeText(page.title, language)}</p>
              <p className="mt-1 text-xs text-slate-500">{page.visibility}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" to={`/groups/${groupId}?page=${encodeURIComponent(page.id)}`}>Open</Link>
              <Link className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" to={`/pages/${page.id}/edit?groupId=${groupId}`}>Edit</Link>
              <AppActionButton size="sm" variant="secondary" onClick={() => onTogglePageVisibility(page)}>
                {page.visibility === 'InvisibleDraft' ? 'Publish' : 'Move to draft'}
              </AppActionButton>
              <AppActionButton size="sm" variant="danger" onClick={() => onDeletePage(page.id)}>Delete</AppActionButton>
            </div>
          </div>
        ))}
      </div>
    )}
  </AppSectionCard>
)

type EventsPanelProps = {
  groupId: string
  events: GroupEventRecord[]
  onOpenEnrollDialog: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
}

const EventsPanel = ({ groupId, events, onOpenEnrollDialog, onDeleteEvent }: EventsPanelProps) => {
  const navigate = useNavigate()

  return (
    <AppSectionCard title="Events" subtitle="Create activities and maintain the event list.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {sectionStats([
          { label: 'Events', value: events.length },
          { label: 'Upcoming', value: events.filter((event) => event.startDate && new Date(event.startDate) >= new Date()).length },
          { label: 'Past', value: events.filter((event) => event.startDate && new Date(event.startDate) < new Date()).length },
          { label: 'Group', value: 1 },
        ])}
        <AppActionButton variant="primary" onClick={() => navigate(`/events/new?groupId=${groupId}`)}>Create event</AppActionButton>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const title = event.titleEn || event.titleZh || 'Untitled'
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-950">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(event.startDate)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppActionButton size="sm" variant="primary" onClick={() => onOpenEnrollDialog(event.id)}>Enroll</AppActionButton>
                  <AppActionButton size="sm" variant="secondary" onClick={() => navigate(`/events/${event.id}/edit?groupId=${groupId}`, { state: { event } })}>Edit</AppActionButton>
                  <AppActionButton size="sm" variant="danger" onClick={() => onDeleteEvent(event.id)}>Delete</AppActionButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppSectionCard>
  )
}

const GroupManageView = () => {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language, me } = useAuthStore()
  const { setCurrentGroup } = useCurrentGroupStore()
  const [enrollingEventId, setEnrollingEventId] = useState('')
  const {
    group,
    subgroups,
    pages,
    memberships,
    events,
    loading,
    error,
    statusMessage,
    setStatusMessage,
    membershipStatus,
    canManageGroup,
    addSubgroup: createSubgroup,
    inviteMember: inviteMemberByPhone,
    editSubgroup: runEditSubgroup,
    deleteSubgroup: runDeleteSubgroup,
    deletePage,
    togglePageVisibility,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    deleteEvent,
  } = useGroupScreen(groupId)

  const enrollingEvent = useMemo(
    () => events.find((event) => event.id === enrollingEventId) ?? null,
    [enrollingEventId, events],
  )
  const activeSection = searchParams.get('section') ?? 'group'

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  if (!loading && !canManageGroup) {
    return <Navigate to={`/groups/${groupId}`} replace />
  }

  return (
    <AppPageShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/groups/${groupId}`} className="text-sm font-medium text-slate-600 hover:text-slate-950">Back to group</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{group?.name ?? 'Group'} management</h1>
          <p className="mt-1 text-sm text-slate-600">Manage group settings, subgroups, members, pages, and activities.</p>
        </div>
        {group ? (
          <div className="flex flex-wrap gap-2">
            <AccessTypeBadge accessType={group.accessType} />
            <MembershipStatusBadge status={membershipStatus} />
          </div>
        ) : null}
      </div>

      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">Loading management workspace...</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && group ? (
        <div className="space-y-6">
          {statusMessage ? (
            <AppSectionCard dense>
              <p className="text-sm text-slate-600">{statusMessage}</p>
            </AppSectionCard>
          ) : null}

          {activeSection === 'group' ? (
            <GroupOverviewPanel group={group} subgroupCount={subgroups.length} pageCount={pages.length} />
          ) : null}

          {activeSection === 'subgroups' ? (
            <AppSectionCard title="Subgroups" subtitle="Create child groups and open their own workspace.">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {sectionStats([
                  { label: 'Subgroups', value: subgroups.length },
                  { label: 'Public', value: subgroups.filter((subgroup) => subgroup.accessType === 'Public').length },
                  { label: 'Protected', value: subgroups.filter((subgroup) => subgroup.accessType === 'Protected').length },
                  { label: 'Private', value: subgroups.filter((subgroup) => subgroup.accessType === 'Private').length },
                ])}
                <AppActionButton variant="primary" onClick={() => {
                  const subgroupName = window.prompt('Subgroup name')
                  if (!subgroupName?.trim()) return
                  createSubgroup(subgroupName.trim(), 'Protected').catch(() => setStatusMessage('Failed to add subgroup.'))
                }}>
                  Add subgroup
                </AppActionButton>
              </div>

              {subgroups.length === 0 ? (
                <p className="text-sm text-slate-500">No subgroups yet.</p>
              ) : (
                <div className="space-y-2">
                  {subgroups.map((subgroup) => (
                    <div key={subgroup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-medium text-slate-950">{subgroup.name}</p>
                        <AccessTypeBadge accessType={subgroup.accessType} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AppActionButton size="sm" variant="secondary" onClick={() => navigate(`/groups/${subgroup.id}`)}>Open</AppActionButton>
                        <AppActionButton size="sm" variant="secondary" onClick={() => {
                          runEditSubgroup(subgroup.id).catch((reason) => {
                            setStatusMessage(reason instanceof Error ? reason.message : 'Subgroup edit is not available yet.')
                          })
                        }}>
                          Edit
                        </AppActionButton>
                        <AppActionButton size="sm" variant="danger" onClick={() => {
                          if (!window.confirm('Remove this subgroup?')) return
                          runDeleteSubgroup(subgroup.id).catch((reason) => {
                            setStatusMessage(reason instanceof Error ? reason.message : 'Subgroup delete is not available yet.')
                          })
                        }}>
                          Delete
                        </AppActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AppSectionCard>
          ) : null}

          {activeSection === 'members' ? (
            <MembersPanel
              memberships={memberships}
              onInviteMember={() => {
                const phone = window.prompt('Invite member by phone (E.164), e.g. +10000000008')
                if (!phone?.trim()) return
                inviteMemberByPhone(phone.trim()).catch(() => setStatusMessage('Failed to send invite.'))
              }}
              onApproveMember={(memberId) => approveMember(memberId).catch(() => setStatusMessage('Failed to approve member.'))}
              onRejectMember={(memberId) => rejectMember(memberId).catch(() => setStatusMessage('Failed to reject member.'))}
              onKickMember={(memberId) => {
                if (!window.confirm('Remove this member from the group?')) return
                kickMember(memberId).catch(() => setStatusMessage('Failed to remove member.'))
              }}
              onSetCoLeader={(memberId, isCoLeader) => setCoLeader(memberId, isCoLeader).catch(() => setStatusMessage('Failed to update co-leader.'))}
            />
          ) : null}

          {activeSection === 'pages' ? (
            <PagesPanel
              groupId={groupId}
              language={language}
              pages={pages}
              onAddPage={() => navigate(`/groups/${groupId}/pages/new`)}
              onDeletePage={(pageId) => {
                if (!window.confirm('Remove this page?')) return
                deletePage(pageId).catch(() => setStatusMessage('Failed to remove page.'))
              }}
              onTogglePageVisibility={(page) => togglePageVisibility(page).catch(() => setStatusMessage('Failed to update page visibility.'))}
            />
          ) : null}

          {activeSection === 'events' ? (
            <EventsPanel
              groupId={groupId}
              events={events}
              onOpenEnrollDialog={(eventId) => setEnrollingEventId(eventId)}
              onDeleteEvent={(eventId) => {
                if (!window.confirm('Delete this event?')) return
                deleteEvent(eventId).catch(() => setStatusMessage('Failed to delete event.'))
              }}
            />
          ) : null}
        </div>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState title="Group not found" description="Try returning to the group list and selecting a different group." />
      ) : null}

      {enrollingEvent ? (
        <EnrollmentChatDialog
          open
          groupId={groupId}
          event={enrollingEvent}
          memberId={me?.id}
          language={language}
          onClose={() => setEnrollingEventId('')}
          onSuccess={(message) => setStatusMessage(message)}
        />
      ) : null}
    </AppPageShell>
  )
}

export default GroupManageView
