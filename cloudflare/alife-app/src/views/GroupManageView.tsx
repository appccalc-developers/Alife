import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { UserMinus } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import GroupOverviewPanel from '../components/group/GroupOverviewPanel'
import MembershipStatusBadge from '../components/group/MembershipStatusBadge'
import { useGroupScreen, type GroupMemberToolRow } from '../hooks/useGroupScreen'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useAuthStore } from '../stores/auth'
import { localizeText, toLocalizedText } from '../utils/localizedText'
import { useCurrentGroupStore } from '../stores/currentGroup'
import { translateUi, useUiText } from '../i18n/uiText'
import { activeEntityService } from '../services/activeEntityService'
import type { GroupPageDto } from '../types/group'
import type { GroupEventRecord } from '../types/event'
import { groupService } from '../api/groupService'

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

const iconButtonClass = 'h-8 w-8 p-0'

const MembersPanel = ({ memberships, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader }: MembersPanelProps) => {
  const t = useUiText()
  const [roleTarget, setRoleTarget] = useState<GroupMemberToolRow | null>(null)
  const requestedMembers = memberships.filter((member) => member.status === 'requested')
  const approvedMembers = memberships.filter((member) => member.status === 'approved')
  const inactiveMembers = memberships.filter((member) => member.status !== 'requested' && member.status !== 'approved')

  const getDisplayName = (member: GroupMemberToolRow) => member.displayName || t('memberShort', { id: shortId(member.memberId) })
  const getRoleLabel = (member: GroupMemberToolRow) => member.role === 'coLeader' ? t('coLeaderRole') : t('groupMemberRole')

  const handleRoleChoice = (isCoLeader: boolean) => {
    if (!roleTarget) return
    if ((roleTarget.role === 'coLeader') !== isCoLeader) {
      onSetCoLeader(roleTarget.memberId, isCoLeader)
    }
    setRoleTarget(null)
  }

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
                <p className="font-medium text-slate-950">{getDisplayName(member)}</p>
                {member.role === 'leader' ? (
                  <AppBadge variant="info">{member.role}</AppBadge>
                ) : (
                  <button
                    type="button"
                    className="mt-1 inline-flex rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    onClick={() => setRoleTarget(member)}
                  >
                    <AppBadge variant="info">{getRoleLabel(member)}</AppBadge>
                  </button>
                )}
              </div>
              {member.role !== 'leader' ? (
                <div className="flex gap-2">
                  <AppActionButton
                    size="sm"
                    variant="danger"
                    className={iconButtonClass}
                    aria-label={t('kickOffMember')}
                    title={t('kickOffMember')}
                    onClick={() => onKickMember(member.memberId)}
                  >
                    <UserMinus size={16} aria-hidden="true" />
                  </AppActionButton>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {roleTarget ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/45 px-4 py-6 desktop:items-center desktop:justify-center">
          <button type="button" className="absolute inset-0" aria-label={t('cancel')} onClick={() => setRoleTarget(null)} />
          <section className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-950">{t('setCoLeader')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('coLeaderRolePrompt', {
                name: getDisplayName(roleTarget),
                role: getRoleLabel(roleTarget),
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <AppActionButton variant="secondary" onClick={() => handleRoleChoice(false)}>{t('no')}</AppActionButton>
              <AppActionButton variant="primary" onClick={() => handleRoleChoice(true)}>{t('yes')}</AppActionButton>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{t('inactiveMembers')}</h3>
        {inactiveMembers.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noInactiveMembers')}</p>
        ) : (
          inactiveMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div>
                <p className="font-medium text-slate-950">{member.displayName || t('memberShort', { id: shortId(member.memberId) })}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <MembershipStatusBadge status={member.status} />
                  <AppBadge variant="neutral">{member.role}</AppBadge>
                </div>
              </div>
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
  const navigate = useNavigate()

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
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    activeEntityService.setPage(page.id, groupId)
                    navigate('/groups')
                  }}
                >
                  {t('open')}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    activeEntityService.setPage(page.id, groupId)
                    navigate('/pages/edit')
                  }}
                >
                  {t('edit')}
                </button>
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
  onDeleteEvent: (eventId: string) => void
}

const EventsPanel = ({ groupId, events, onDeleteEvent }: EventsPanelProps) => {
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()

  return (
    <AppSectionCard
      dense
      title={t('events')}
      subtitle={t('eventsPanelSubtitle')}
      action={<AppActionButton variant="primary" onClick={() => {
        activeEntityService.set({ groupId, eventId: '' })
        navigate('/events/new')
      }}>{t('createEvent')}</AppActionButton>}
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
                  <AppActionButton size="sm" variant="secondary" onClick={() => {
                    activeEntityService.setEvent(event.id, groupId)
                    navigate('/events/edit', { state: { event } })
                  }}>{t('edit')}</AppActionButton>
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

type ChurchOperationsPanelProps = {
  groupId: string
  onStatusMessage: (message: string) => void
}

const ChurchOperationsPanel = ({ groupId, onStatusMessage }: ChurchOperationsPanelProps) => {
  const t = useUiText()
  const [refreshingCache, setRefreshingCache] = useState(false)
  const [syncingSermons, setSyncingSermons] = useState(false)

  const refreshCloudflareCache = async () => {
    setRefreshingCache(true)
    try {
      const response = await groupService.refreshCloudflareCache(groupId)
      onStatusMessage(response.message || t('cloudflareCacheRefreshTriggered'))
    } catch {
      onStatusMessage(t('cloudflareCacheRefreshFailed'))
    } finally {
      setRefreshingCache(false)
    }
  }

  const syncSermons = async () => {
    setSyncingSermons(true)
    try {
      const response = await groupService.syncSermons()
      onStatusMessage(response.message || t('sermonSyncTriggered'))
    } catch {
      onStatusMessage(t('sermonSyncFailed'))
    } finally {
      setSyncingSermons(false)
    }
  }

  return (
    <AppSectionCard dense title={t('churchOperations')} subtitle={t('churchOperationsSubtitle')}>
      <div className="flex flex-wrap gap-3">
        <AppActionButton
          variant="secondary"
          disabled={refreshingCache}
          onClick={() => {
            refreshCloudflareCache().catch(() => undefined)
          }}
        >
          {refreshingCache ? t('refreshing') : t('refreshCloudflareCache')}
        </AppActionButton>
        <AppActionButton
          variant="primary"
          disabled={syncingSermons}
          onClick={() => {
            syncSermons().catch(() => undefined)
          }}
        >
          {syncingSermons ? t('syncing') : t('syncAzureSermonList')}
        </AppActionButton>
      </div>
    </AppSectionCard>
  )
}

type DangerZonePanelProps = {
  groupName: { en?: string; cn?: string }
  closing: boolean
  onCloseGroup: () => Promise<void>
}

const normalizeConfirmationValue = (value: string | undefined) => (value ?? '').trim()

const DangerZonePanel = ({ groupName, closing, onCloseGroup }: DangerZonePanelProps) => {
  const t = useUiText()
  const [englishName, setEnglishName] = useState('')
  const [chineseName, setChineseName] = useState('')

  const expectedEnglishName = normalizeConfirmationValue(groupName.en)
  const expectedChineseName = normalizeConfirmationValue(groupName.cn)
  const canDelete =
    !closing &&
    normalizeConfirmationValue(englishName) === expectedEnglishName &&
    normalizeConfirmationValue(chineseName) === expectedChineseName

  const handleDelete = async () => {
    if (!canDelete) return
    if (!window.confirm(t('deleteGroupFinalConfirm'))) return
    await onCloseGroup()
  }

  return (
    <AppSectionCard dense title={t('dangerZone')} subtitle={t('deleteGroupDangerSubtitle')}>
      <div className="grid gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div>
          <p className="text-sm font-medium text-rose-950">{t('deleteGroup')}</p>
          <p className="mt-1 text-sm leading-6 text-rose-800">{t('deleteGroupDangerDescription')}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-rose-700">{t('confirmGroupNameEnglish')}</span>
            <input
              value={englishName}
              onChange={(event) => setEnglishName(event.target.value)}
              placeholder={expectedEnglishName}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>

          <label>
            <span className="text-xs font-medium uppercase tracking-wide text-rose-700">{t('confirmGroupNameChinese')}</span>
            <input
              value={chineseName}
              onChange={(event) => setChineseName(event.target.value)}
              placeholder={expectedChineseName}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <AppActionButton variant="danger" disabled={!canDelete} onClick={() => {
            handleDelete().catch(() => undefined)
          }}>
            {closing ? t('deletingGroup') : t('deleteGroup')}
          </AppActionButton>
        </div>
      </div>
    </AppSectionCard>
  )
}

const GroupManageView = () => {
  const t = useUiText()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId } = useActiveEntityIds({ groupId: routeGroupId })
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const auth = useAuthStore()
  const { language } = auth
  const { setCurrentGroup } = useCurrentGroupStore()
  const [savingGroup, setSavingGroup] = useState(false)
  const [closingGroup, setClosingGroup] = useState(false)
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
    closeGroup,
    deletePage,
    togglePageVisibility,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    deleteEvent,
  } = useGroupScreen(groupId, { loadEvents: true })

  const activeSection = searchParams.get('section') ?? 'group'
  const canManageSubgroup = (subgroupId: string) =>
    auth.memberships.some(
      (membership) =>
        membership.groupId === subgroupId &&
        membership.status === 'approved' &&
        (membership.role === 'leader' || membership.role === 'coLeader'),
    )

  const handleOpenSubgroup = async (subgroupId: string) => {
    if (canManageSubgroup(subgroupId)) {
      activeEntityService.setGroup(subgroupId)
      navigate('/groups/manage?section=group')
      return
    }

    if (!window.confirm(t('claimSubgroupCoLeaderConfirm'))) return

    try {
      await groupService.claimSubgroupCoLeader(groupId, subgroupId)
      await auth.fetchMe()
      activeEntityService.setGroup(subgroupId)
      navigate('/groups/manage?section=group')
    } catch {
      setStatusMessage(t('claimSubgroupCoLeaderFailed'))
    }
  }

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  const handleCreateSubgroup = async () => {
    const subgroupName = window.prompt(t('subgroupName'))
    if (!subgroupName?.trim()) return

    try {
      const subgroup = await createSubgroup(toLocalizedText(subgroupName.trim()), 'protected')
      if (subgroup) {
        activeEntityService.setGroup(subgroup.id)
        navigate('/groups/manage?section=group')
      }
    } catch {
      setStatusMessage(t('addSubgroupFailed'))
    }
  }

  const handleCloseGroup = async () => {
    if (!group) return
    setClosingGroup(true)
    try {
      await closeGroup()
      await auth.fetchMe()
      if (group.parentGroupId) {
        activeEntityService.setGroup(group.parentGroupId)
      }
      navigate(group.parentGroupId ? '/groups/manage?section=subgroups' : '/groups', { replace: true })
    } catch {
      setStatusMessage(t('deleteGroupFailed'))
    } finally {
      setClosingGroup(false)
    }
  }

  if (!groupId) {
    return <Navigate to="/" replace />
  }

  if (!loading && !canManageGroup) {
    return <Navigate to="/groups" replace />
  }

  return (
    <AppPageShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/groups" className="text-sm font-medium text-slate-600 hover:text-slate-950">{t(group?.isChurch ? 'backToChurch' : 'backToViews')}</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {t(group?.isChurch ? 'churchManagementTitle' : 'groupManagementTitle', { name: localizeText(group?.name, language) || t(group?.isChurch ? 'church' : 'group') })}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t(group?.isChurch ? 'churchManagementDescription' : 'groupManagementDescription')}</p>
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
              saving={savingGroup}
              onStatusMessage={setStatusMessage}
              onSave={async (payload) => {
                setSavingGroup(true)
                try {
                  const updated = await updateGroup(payload)
                  if (updated) {
                    setCurrentGroup(updated)
                    setStatusMessage(t(group.isChurch ? 'churchUpdated' : 'groupUpdated'))
                  }
                } catch {
                  setStatusMessage(t(group.isChurch ? 'updateChurchFailed' : 'updateGroupFailed'))
                } finally {
                  setSavingGroup(false)
                }
              }}
            />
          ) : null}

          {activeSection === 'group' && group.isChurch ? (
            <ChurchOperationsPanel groupId={groupId} onStatusMessage={setStatusMessage} />
          ) : null}

          {activeSection === 'group' && !group.isChurch ? (
            <DangerZonePanel
              groupName={toLocalizedText(group.name)}
              closing={closingGroup}
              onCloseGroup={handleCloseGroup}
            />
          ) : null}

          {activeSection === 'subgroups' ? (
            <AppSectionCard
              dense
              title={t('subgroups')}
              subtitle={t('subgroupsPanelSubtitle')}
              action={
                <AppActionButton variant="primary" onClick={() => {
                  handleCreateSubgroup().catch(() => setStatusMessage(t('addSubgroupFailed')))
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
                        <AppActionButton size="sm" variant="secondary" onClick={() => {
                          handleOpenSubgroup(subgroup.id).catch(() => setStatusMessage(t('claimSubgroupCoLeaderFailed')))
                        }}>{t('open')}</AppActionButton>
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
              onInviteMember={() => navigate('/groups/manage/invite-members')}
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
              onAddPage={() => {
                activeEntityService.setGroup(groupId, { clearPage: true })
                navigate('/pages/new')
              }}
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
