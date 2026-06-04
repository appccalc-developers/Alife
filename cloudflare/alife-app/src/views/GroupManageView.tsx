import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import GroupOverviewPanel from '../components/group/GroupOverviewPanel'
import MembershipStatusBadge from '../components/group/MembershipStatusBadge'
import { useGroupScreen, type GroupMemberToolRow } from '../hooks/useGroupScreen'
import { useAuthStore } from '../stores/auth'
import { localizeText, toLocalizedText } from '../utils/localizedText'
import { useCurrentGroupStore } from '../stores/currentGroup'
import { translateUi, useUiText } from '../i18n/uiText'
import type { GroupPageDto } from '../types/group'
import type { GroupEventRecord } from '../types/event'

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const formatDate = (value: string, language: string) => {
  if (!value) return translateUi(language, 'noDate')
  return new Date(value).toLocaleDateString()
}

type MembersPanelProps = {
  memberships: GroupMemberToolRow[]
  onInviteMember: () => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
}

const MembersPanel = ({ memberships, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader }: MembersPanelProps) => {
  const t = useUiText()
  const requestedMembers = memberships.filter((member) => member.status === 'requested')
  const approvedMembers = memberships.filter((member) => member.status === 'approved')

  return (
    <AppSectionCard
      dense
      title={t('members')}
      subtitle={t('membersPanelSubtitle')}
      action={
        <AppActionButton variant="primary" onClick={onInviteMember}>{t('inviteMember')}</AppActionButton>
      }
    >
      {requestedMembers.length > 0 ? (
        <div className="mb-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('requests')}</h3>
          {requestedMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <div>
                <p className="font-medium text-slate-950">{member.displayName || t('memberShort', { id: shortId(member.memberId) })}</p>
                <MembershipStatusBadge status="requested" />
              </div>
              <div className="flex gap-2">
                <AppActionButton size="sm" variant="primary" onClick={() => onApproveMember(member.memberId)}>{t('approve')}</AppActionButton>
                <AppActionButton size="sm" variant="danger" onClick={() => onRejectMember(member.memberId)}>{t('reject')}</AppActionButton>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('activeMembers')}</h3>
        {approvedMembers.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noApprovedMembers')}</p>
        ) : (
          approvedMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-950">{member.displayName || t('memberShort', { id: shortId(member.memberId) })}</p>
                <AppBadge variant="info">{member.role}</AppBadge>
              </div>
              {member.role !== 'leader' ? (
                <div className="flex gap-2">
                  <AppActionButton size="sm" variant="secondary" onClick={() => onSetCoLeader(member.memberId, member.role !== 'coLeader')}>
                    {member.role === 'coLeader' ? t('resetCoLeader') : t('setCoLeader')}
                  </AppActionButton>
                  <AppActionButton size="sm" variant="danger" onClick={() => onKickMember(member.memberId)}>{t('remove')}</AppActionButton>
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

const PagesPanel = ({ groupId, language, pages, onAddPage, onDeletePage, onTogglePageVisibility }: PagesPanelProps) => {
  const t = useUiText()

  return (
    <AppSectionCard
      dense
      title={t('pages')}
      subtitle={t('pagesPanelSubtitle')}
      action={<AppActionButton variant="primary" onClick={onAddPage}>{t('addPage')}</AppActionButton>}
    >
      {pages.length === 0 ? (
        <p className="text-sm text-slate-500">{t('noPagesYet')}</p>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <div key={page.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-950">{localizeText(page.title, language)}</p>
                <p className="mt-1 text-xs text-slate-500">{page.visibility}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" to={`/groups/${groupId}?page=${encodeURIComponent(page.id)}`}>{t('open')}</Link>
                <Link className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" to={`/pages/${page.id}/edit?groupId=${groupId}`}>{t('edit')}</Link>
                <AppActionButton size="sm" variant="secondary" onClick={() => onTogglePageVisibility(page)}>
                  {page.visibility === 'draft' ? t('publish') : t('moveToDraft')}
                </AppActionButton>
                <AppActionButton size="sm" variant="danger" onClick={() => onDeletePage(page.id)}>{t('delete')}</AppActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppSectionCard>
  )
}

type EventsPanelProps = {
  groupId: string
  events: GroupEventRecord[]
  onOpenEnrollDialog: (eventId: string) => void
  onOpenReviewDialog: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
}

const EventsPanel = ({ groupId, events, onOpenEnrollDialog, onOpenReviewDialog, onDeleteEvent }: EventsPanelProps) => {
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()

  return (
    <AppSectionCard
      dense
      title={t('events')}
      subtitle={t('eventsPanelSubtitle')}
      action={<AppActionButton variant="primary" onClick={() => navigate(`/events/new?groupId=${groupId}`)}>{t('createEvent')}</AppActionButton>}
    >
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">{t('noEventsYet')}</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const title = (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh || t('untitled')
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-950">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(event.startDate, language)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppActionButton size="sm" variant="primary" onClick={() => onOpenEnrollDialog(event.id)}>{t('enroll')}</AppActionButton>
                  <AppActionButton size="sm" variant="secondary" onClick={() => onOpenReviewDialog(event.id)}>{t('review')}</AppActionButton>
                  <AppActionButton size="sm" variant="secondary" onClick={() => navigate(`/events/${event.id}/edit?groupId=${groupId}`, { state: { event } })}>{t('edit')}</AppActionButton>
                  <AppActionButton size="sm" variant="danger" onClick={() => onDeleteEvent(event.id)}>{t('delete')}</AppActionButton>
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
  const t = useUiText()
  const { groupId = '' } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { language } = useAuthStore()
  const { setCurrentGroup } = useCurrentGroupStore()
  const [savingGroup, setSavingGroup] = useState(false)
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
    updateGroup,
    addSubgroup: createSubgroup,
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
          <Link to={`/groups/${groupId}`} className="text-sm font-medium text-slate-600 hover:text-slate-950">{t('backToViews')}</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{t('groupManagementTitle', { name: localizeText(group?.name, language) || t('group') })}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('groupManagementDescription')}</p>
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
          <p className="text-sm text-slate-600">{t('loadingManagementWorkspace')}</p>
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
            <GroupOverviewPanel
              group={group}
              subgroupCount={subgroups.length}
              pageCount={pages.length}
              saving={savingGroup}
              onSave={async (payload) => {
                setSavingGroup(true)
                try {
                  const updated = await updateGroup(payload)
                  if (updated) {
                    setCurrentGroup(updated)
                    setStatusMessage(t('groupUpdated'))
                  }
                } catch {
                  setStatusMessage(t('updateGroupFailed'))
                } finally {
                  setSavingGroup(false)
                }
              }}
            />
          ) : null}

          {activeSection === 'subgroups' ? (
            <AppSectionCard
              dense
              title={t('subgroups')}
              subtitle={t('subgroupsPanelSubtitle')}
              action={
                <AppActionButton variant="primary" onClick={() => {
                  const subgroupName = window.prompt(t('subgroupName'))
                  if (!subgroupName?.trim()) return
                  createSubgroup(toLocalizedText(subgroupName.trim()), 'protected').catch(() => setStatusMessage(t('addSubgroupFailed')))
                }}>
                  {t('addSubgroup')}
                </AppActionButton>
              }
            >
              {subgroups.length === 0 ? (
                <p className="text-sm text-slate-500">{t('noSubgroupsYet')}</p>
              ) : (
                <div className="space-y-2">
                  {subgroups.map((subgroup) => (
                    <div key={subgroup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-medium text-slate-950">{localizeText(subgroup.name, language)}</p>
                        <AccessTypeBadge accessType={subgroup.accessType} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AppActionButton size="sm" variant="secondary" onClick={() => navigate(`/groups/${subgroup.id}`)}>{t('open')}</AppActionButton>
                        <AppActionButton size="sm" variant="secondary" onClick={() => {
                          runEditSubgroup(subgroup.id).catch((reason) => {
                            setStatusMessage(reason instanceof Error ? reason.message : t('subgroupEditUnavailable'))
                          })
                        }}>
                          {t('edit')}
                        </AppActionButton>
                        <AppActionButton size="sm" variant="danger" onClick={() => {
                          if (!window.confirm(t('removeSubgroupConfirm'))) return
                          runDeleteSubgroup(subgroup.id).catch((reason) => {
                            setStatusMessage(reason instanceof Error ? reason.message : t('subgroupDeleteUnavailable'))
                          })
                        }}>
                          {t('delete')}
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
              onInviteMember={() => navigate(`/groups/${groupId}/manage/invite-members`)}
              onApproveMember={(memberId) => approveMember(memberId).catch(() => setStatusMessage(t('approveFailed')))}
              onRejectMember={(memberId) => rejectMember(memberId).catch(() => setStatusMessage(t('rejectFailed')))}
              onKickMember={(memberId) => {
                if (!window.confirm(t('removeMemberConfirm'))) return
                kickMember(memberId).catch(() => setStatusMessage(t('removeMemberFailed')))
              }}
              onSetCoLeader={(memberId, isCoLeader) => setCoLeader(memberId, isCoLeader).catch(() => setStatusMessage(t('updateCoLeaderFailed')))}
            />
          ) : null}

          {activeSection === 'pages' ? (
            <PagesPanel
              groupId={groupId}
              language={language}
              pages={pages}
              onAddPage={() => navigate(`/groups/${groupId}/pages/new`)}
              onDeletePage={(pageId) => {
                if (!window.confirm(t('removePageConfirm'))) return
                deletePage(pageId).catch(() => setStatusMessage(t('removePageFailed')))
              }}
              onTogglePageVisibility={(page) => togglePageVisibility(page).catch(() => setStatusMessage(t('updatePageVisibilityFailed')))}
            />
          ) : null}

          {activeSection === 'events' ? (
            <EventsPanel
              groupId={groupId}
              events={events}
              onOpenEnrollDialog={(eventId) => navigate(`/groups/${groupId}/events/${eventId}/enroll`)}
              onOpenReviewDialog={(eventId) => navigate(`/groups/${groupId}/events/${eventId}/review`)}
              onDeleteEvent={(eventId) => {
                if (!window.confirm(t('deleteEventConfirm'))) return
                deleteEvent(eventId).catch(() => setStatusMessage(t('deleteEventFailed')))
              }}
            />
          ) : null}
        </div>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState title={t('groupNotFound')} description={t('groupNotFoundDescription')} />
      ) : null}
    </AppPageShell>
  )
}

export default GroupManageView
