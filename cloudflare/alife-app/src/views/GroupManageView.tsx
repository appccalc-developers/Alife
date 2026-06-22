import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, CalendarDays, Crown, FileText, Network, Settings, ShieldCheck, UserPlus, UserMinus, UsersRound } from 'lucide-react'
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
import { groupService } from '../services/groupService'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import type { GroupPageDto, PageVisibility } from '../types/group'
import type { GroupEventRecord } from '../types/event'

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const formatDate = (value: string, language: string) => {
  if (!value) return translateUi(language, 'noDate')
  return new Date(value).toLocaleDateString()
}

const isPlatformAdminRole = (role?: string | null) => role === 'admin' || role === 'superadmin'

const formatPlatformRole = (role: string | undefined | null, language: string) => {
  if (role === 'superadmin') return language === 'zh' ? '系统管理员' : 'System Admin'
  if (role === 'admin') return language === 'zh' ? '管理员' : 'Admin'
  return ''
}

type ManageSection = 'members' | 'events' | 'pages' | 'subgroups' | 'group'

const manageSectionKeys: ManageSection[] = ['members', 'events', 'pages', 'subgroups', 'group']

const normalizeManageSection = (value: string | null): ManageSection =>
  manageSectionKeys.includes(value as ManageSection) ? value as ManageSection : 'members'

const managementCopy = (language: string, isChurch?: boolean) => {
  const workspace = isChurch ? (language === 'zh' ? '教会' : 'Church') : (language === 'zh' ? '小组' : 'Group')
  return language === 'zh'
    ? {
      title: `${workspace}运营中心`,
      subtitle: '把成员、活动、内容和设置放在一个清晰的工作台里处理。',
      back: `返回${workspace}`,
      members: '成员',
      membersHint: '审批、邀请、角色和成员状态',
      events: '活动',
      eventsHint: '创建活动、维护报名和后续回顾',
      pages: '内容',
      pagesHint: '发布页面和小组资料',
      subgroups: '下属小组',
      subgroupsHint: '管理小组结构和负责人',
      settings: '设置',
      settingsHint: `${workspace}资料、访问规则和高级操作`,
      pending: '待审批',
      approved: '活跃成员',
      inactive: '非活跃',
      totalMembers: '成员总数',
      upcomingEvents: '近期活动',
      totalEvents: '全部活动',
      pastEvents: '已结束',
      publishedPages: '页面',
      quickActions: '常用操作',
      inviteMember: '邀请成员',
      createEvent: '创建活动',
      addPage: '新建页面',
      emptyMembersTitle: '还没有成员记录',
      emptyMembersBody: '可以先邀请成员，或等待成员提交加入申请。',
      emptyEventsTitle: '还没有活动',
      emptyEventsBody: '用 AI 活动助理创建第一场活动，之后可在这里维护报名和回顾。',
      openEvent: '查看',
      editEvent: '编辑',
    }
    : {
      title: `${workspace} Operations`,
      subtitle: 'A focused workspace for people, events, content, and settings.',
      back: `Back to ${workspace.toLowerCase()}`,
      members: 'People',
      membersHint: 'Approvals, invitations, roles, and member status',
      events: 'Events',
      eventsHint: 'Create events, manage enrollment, and capture memories',
      pages: 'Content',
      pagesHint: 'Published pages and group resources',
      subgroups: 'Subgroups',
      subgroupsHint: 'Team structure and leaders',
      settings: 'Settings',
      settingsHint: `${workspace} profile, access rules, and advanced operations`,
      pending: 'Pending',
      approved: 'Active',
      inactive: 'Inactive',
      totalMembers: 'Total people',
      upcomingEvents: 'Upcoming events',
      totalEvents: 'Total events',
      pastEvents: 'Past events',
      publishedPages: 'Pages',
      quickActions: 'Quick actions',
      inviteMember: 'Invite people',
      createEvent: 'Create event',
      addPage: 'Add page',
      emptyMembersTitle: 'No member records yet',
      emptyMembersBody: 'Invite people or wait for join requests to appear here.',
      emptyEventsTitle: 'No events yet',
      emptyEventsBody: 'Create the first event with the AI event assistant, then manage enrollment and memories here.',
      openEvent: 'Open',
      editEvent: 'Edit',
    }
}

const StatCard = ({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) => (
  <div className="rounded-2xl border border-[#2f4b42]/10 bg-white/75 p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]">{icon}</span>
      <span className="text-2xl font-black text-[#18332d]">{value}</span>
    </div>
    <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6e7c76]">{label}</p>
  </div>
)

const ManagementTabs = ({
  activeSection,
  basePath,
  copy,
}: {
  activeSection: ManageSection
  basePath: string
  copy: ReturnType<typeof managementCopy>
}) => {
  const items = [
    { key: 'members' as ManageSection, label: copy.members, hint: copy.membersHint, icon: <UsersRound className="h-5 w-5" /> },
    { key: 'events' as ManageSection, label: copy.events, hint: copy.eventsHint, icon: <CalendarDays className="h-5 w-5" /> },
    { key: 'pages' as ManageSection, label: copy.pages, hint: copy.pagesHint, icon: <FileText className="h-5 w-5" /> },
    { key: 'subgroups' as ManageSection, label: copy.subgroups, hint: copy.subgroupsHint, icon: <Network className="h-5 w-5" /> },
    { key: 'group' as ManageSection, label: copy.settings, hint: copy.settingsHint, icon: <Settings className="h-5 w-5" /> },
  ]

  return (
    <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="Management sections">
      {items.map((item) => {
        const active = activeSection === item.key
        return (
          <Link
            key={item.key}
            to={`${basePath}?section=${item.key}`}
            className={[
              'rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md',
              active
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-[0_14px_34px_rgba(23,107,90,0.1)]'
                : 'border-[#2f4b42]/10 bg-white/75 text-[#18332d] hover:bg-white',
            ].join(' ')}
          >
            <span className={['flex h-10 w-10 items-center justify-center rounded-2xl', active ? 'bg-white text-emerald-700 shadow-sm' : 'bg-[#e3f0eb] text-[#176b5a]'].join(' ')}>
              {item.icon}
            </span>
            <span className="mt-3 block text-sm font-black">{item.label}</span>
            <span className={['mt-1 block text-xs leading-5', active ? 'text-emerald-700' : 'text-[#6e7c76]'].join(' ')}>{item.hint}</span>
          </Link>
        )
      })}
    </nav>
  )
}

type MembersPanelProps = {
  memberships: GroupMemberToolRow[]
  copy: ReturnType<typeof managementCopy>
  onInviteMember: () => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
}

const iconButtonClass = 'h-8 w-8 p-0'

type LeadershipPanelProps = {
  memberships: GroupMemberToolRow[]
  currentMemberId?: string
  onTransferLeadership: (memberId: string) => void
}

const LeadershipPanel = ({ memberships, currentMemberId, onTransferLeadership }: LeadershipPanelProps) => {
  const t = useUiText()
  const { language } = useAuthStore()
  const groupLeadLabel = language === 'zh' ? '组长' : 'Group lead'
  const assistantLeadLabel = language === 'zh' ? '副组长' : 'Assistant lead'
  const approvedMembers = memberships.filter((member) => member.status === 'approved')
  const leader = approvedMembers.find((member) => member.role === 'leader')
  const coLeaderCandidates = approvedMembers.filter(
    (member) => member.role === 'coLeader' && member.memberId !== currentMemberId,
  )
  const canTransferLeadership = Boolean(leader && currentMemberId && leader.memberId === currentMemberId)
  const getDisplayName = (member: GroupMemberToolRow) => member.displayName || t('memberShort', { id: shortId(member.memberId) })

  return (
    <AppSectionCard
      dense
      title={groupLeadLabel}
      subtitle={t('leadershipPanelSubtitle')}
    >
      {leader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Crown size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-slate-500">{language === 'zh' ? '当前组长' : 'Current group lead'}</p>
              <p className="truncate font-medium text-slate-950">{getDisplayName(leader)}</p>
            </div>
          </div>
          <AppBadge variant="info">{groupLeadLabel}</AppBadge>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('noGroupLeader')}</p>
      )}

      {canTransferLeadership ? (
        <div className="mt-4 space-y-2">
          {coLeaderCandidates.length > 0 ? (
            coLeaderCandidates.map((member) => {
              const displayName = getDisplayName(member)
              return (
                <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-950">{displayName}</p>
                    <AppBadge variant="info">{assistantLeadLabel}</AppBadge>
                  </div>
                  <AppActionButton
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      if (!window.confirm(t('transferLeadershipConfirm', { name: displayName }))) return
                      onTransferLeadership(member.memberId)
                    }}
                  >
                    <ArrowRightLeft size={14} aria-hidden="true" className="mr-1.5" />
                    {t('transferLeadershipTo', { name: displayName })}
                  </AppActionButton>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-slate-500">{t('transferLeadershipNoCandidates')}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{t('transferLeadershipHelp')}</p>
      )}
    </AppSectionCard>
  )
}

const MembersPanel = ({ memberships, copy, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader }: MembersPanelProps) => {
  const t = useUiText()
  const auth = useAuthStore()
  const [roleTarget, setRoleTarget] = useState<GroupMemberToolRow | null>(null)
  const requestedMembers = memberships.filter((member) => member.status === 'requested')
  const approvedMembers = memberships.filter((member) => member.status === 'approved')
  const inactiveMembers = memberships.filter((member) => member.status !== 'requested' && member.status !== 'approved')

  const getDisplayName = (member: GroupMemberToolRow) => member.displayName || t('memberShort', { id: shortId(member.memberId) })
  const getRoleLabel = (member: GroupMemberToolRow) =>
    member.role === 'coLeader'
      ? auth.language === 'zh' ? '副组长' : 'Assistant lead'
      : t('groupMemberRole')
  const groupLeadLabel = auth.language === 'zh' ? '组长' : 'Group lead'
  const renderPlatformRoleBadge = (member: GroupMemberToolRow) => {
    if (!isPlatformAdminRole(member.platformRole)) return null
    return (
      <AppBadge variant={member.platformRole === 'superadmin' ? 'warning' : 'info'}>
        <ShieldCheck size={12} aria-hidden="true" className="mr-1" />
        {formatPlatformRole(member.platformRole, auth.language)}
      </AppBadge>
    )
  }
  const currentRole = memberships.find((member) => member.memberId === auth.me?.id)?.role
  const canManageRoles = currentRole === 'leader' || auth.isAdmin || isPlatformAdminRole(auth.me?.platformRole)
  const canRemoveMember = (member: GroupMemberToolRow) => {
    if (member.memberId === auth.me?.id || member.role === 'leader') return false
    if (auth.isAdmin || isPlatformAdminRole(auth.me?.platformRole)) return true
    return currentRole === 'leader' || (currentRole === 'coLeader' && member.role === 'member')
  }

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
      title={copy.members}
      subtitle={copy.membersHint}
      action={
        <AppActionButton variant="primary" onClick={onInviteMember}>
          <UserPlus size={16} aria-hidden="true" className="mr-1.5" />
          {copy.inviteMember}
        </AppActionButton>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={copy.pending} value={requestedMembers.length} icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label={copy.approved} value={approvedMembers.length} icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label={copy.inactive} value={inactiveMembers.length} icon={<UserMinus className="h-5 w-5" />} />
      </div>

      {memberships.length === 0 ? (
        <AppEmptyState title={copy.emptyMembersTitle} description={copy.emptyMembersBody} actionLabel={copy.inviteMember} onAction={onInviteMember} />
      ) : null}

      {requestedMembers.length > 0 ? (
        <div className="mb-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{copy.pending}</h3>
          {requestedMembers.map((member) => (
            <div key={member.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <div>
                <p className="font-medium text-slate-950">{member.displayName || t('memberShort', { id: shortId(member.memberId) })}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <MembershipStatusBadge status="requested" />
                  {renderPlatformRoleBadge(member)}
                </div>
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
                <div className="mt-1 flex flex-wrap gap-2">
                  {member.role === 'leader' || !canManageRoles ? (
                    <AppBadge variant="info">{member.role === 'leader' ? groupLeadLabel : getRoleLabel(member)}</AppBadge>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                      onClick={() => setRoleTarget(member)}
                    >
                      <AppBadge variant="info">{getRoleLabel(member)}</AppBadge>
                    </button>
                  )}
                  {renderPlatformRoleBadge(member)}
                </div>
              </div>
              {canRemoveMember(member) ? (
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
                  {renderPlatformRoleBadge(member)}
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
  onUpdatePageVisibility: (page: GroupPageDto, visibility: PageVisibility) => void
}

const pageVisibilityOptions: PageVisibility[] = ['draft', 'group', 'public']

const PagesPanel = ({ groupId, language, pages, onAddPage, onDeletePage, onUpdatePageVisibility }: PagesPanelProps) => {
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
                <label className="sr-only" htmlFor={`page-visibility-${page.id}`}>
                  {t('visibility')}
                </label>
                <select
                  id={`page-visibility-${page.id}`}
                  value={page.visibility}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  onChange={(event) => onUpdatePageVisibility(page, event.target.value as PageVisibility)}
                >
                  {pageVisibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(option)}
                    </option>
                  ))}
                </select>
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
  copy: ReturnType<typeof managementCopy>
  onDeleteEvent: (eventId: string) => void
}

const EventsPanel = ({ groupId, events, copy, onDeleteEvent }: EventsPanelProps) => {
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()
  const upcomingEvents = events.filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now())
  const pastEvents = events.filter((event) => event.endDate && new Date(event.endDate).getTime() < Date.now())

  return (
    <AppSectionCard
      dense
      title={copy.events}
      subtitle={copy.eventsHint}
      action={<AppActionButton variant="primary" onClick={() => {
        activeEntityService.set({ groupId, eventId: '' })
        navigate('/events/new')
      }}>
        <CalendarDays size={16} aria-hidden="true" className="mr-1.5" />
        {copy.createEvent}
      </AppActionButton>}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={copy.totalEvents} value={events.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label={copy.upcomingEvents} value={upcomingEvents.length} icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label={copy.pastEvents} value={pastEvents.length} icon={<CalendarDays className="h-5 w-5" />} />
      </div>

      {events.length === 0 ? (
        <AppEmptyState title={copy.emptyEventsTitle} description={copy.emptyEventsBody} actionLabel={copy.createEvent} onAction={() => {
          activeEntityService.set({ groupId, eventId: '' })
          navigate('/events/new')
        }} />
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const title = (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh || t('untitled')
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                <div>
                  <p className="font-medium text-slate-950">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(event.startDate, language)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppActionButton size="sm" variant="secondary" onClick={() => {
                    activeEntityService.setEvent(event.id, groupId)
                    navigate('/events')
                  }}>{copy.openEvent}</AppActionButton>
                  <AppActionButton size="sm" variant="secondary" onClick={() => {
                    activeEntityService.setEvent(event.id, groupId)
                    navigate('/events/edit', { state: { event } })
                  }}>{copy.editEvent}</AppActionButton>
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

type GroupManageViewProps = {
  embeddedWorkspace?: boolean
}

const GroupManageView = ({ embeddedWorkspace = false }: GroupManageViewProps) => {
  const t = useUiText()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = activeGroupId || ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const auth = useAuthStore()
  const { language } = auth
  const { setCurrentGroup } = useCurrentGroupStore()
  const [savingGroup, setSavingGroup] = useState(false)
  const [hasUnsavedGroupProfileChanges, setHasUnsavedGroupProfileChanges] = useState(false)
  const browserBackGuardRegistered = useRef(false)
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
    canManageGroup,
    updateGroup,
    addSubgroup: createSubgroup,
    deletePage,
    updatePageVisibility,
    approveMember,
    rejectMember,
    kickMember,
    setCoLeader,
    transferLeadership,
    deleteEvent,
  } = useGroupScreen(groupId, { loadEvents: true })

  const activeSection = normalizeManageSection(searchParams.get('section'))
  const copy = managementCopy(language, group?.isChurch)
  const workspacePath = '/groups'
  const sectionBasePath = embeddedWorkspace ? workspacePath : `${workspacePath}/manage`
  const requestedCount = memberships.filter((member) => member.status === 'requested').length
  const approvedCount = memberships.filter((member) => member.status === 'approved').length
  const upcomingEventCount = events.filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now()).length
  const groupWorkspaceTarget = (_targetGroupId: string) =>
    embeddedWorkspace ? '/groups?section=group' : '/groups/manage?section=group'
  const unsavedGroupProfileMessage = t('groupProfileUnsavedChangesPrompt')
  const guardGroupProfileNavigation = useCallback(() => {
    if (!hasUnsavedGroupProfileChanges) {
      return true
    }

    window.alert(unsavedGroupProfileMessage)
    return false
  }, [hasUnsavedGroupProfileChanges, unsavedGroupProfileMessage])
  const canManageSubgroup = (subgroupId: string) =>
    auth.isAdmin ||
    isPlatformAdminRole(auth.me?.platformRole) ||
    auth.memberships.some(
      (membership) =>
        membership.groupId === subgroupId &&
        membership.status === 'approved' &&
        (membership.role === 'leader' || membership.role === 'coLeader'),
    )

  const handleOpenSubgroup = async (subgroupId: string) => {
    if (!guardGroupProfileNavigation()) return

    if (canManageSubgroup(subgroupId)) {
      activeEntityService.setGroup(subgroupId)
      navigate(groupWorkspaceTarget(subgroupId))
      return
    }

    if (!window.confirm(t('manageClaimSubgroupCoLeaderConfirm'))) return

    try {
      await groupService.claimSubgroupCoLeader(groupId, subgroupId)
      await auth.fetchMe()
      activeEntityService.setGroup(subgroupId)
      navigate(groupWorkspaceTarget(subgroupId))
    } catch {
      setStatusMessage(t('manageClaimSubgroupCoLeaderFailed'))
    }
  }

  useEffect(() => {
    if (group) {
      setCurrentGroup(group)
    }
  }, [group, setCurrentGroup])

  useEffect(() => {
    setUnsavedChangesGuard(hasUnsavedGroupProfileChanges, unsavedGroupProfileMessage)
    return () => setUnsavedChangesGuard(false)
  }, [hasUnsavedGroupProfileChanges, unsavedGroupProfileMessage])

  useEffect(() => {
    if (!hasUnsavedGroupProfileChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedGroupProfileChanges])

  useEffect(() => {
    if (!hasUnsavedGroupProfileChanges) {
      browserBackGuardRegistered.current = false
      return
    }

    if (!browserBackGuardRegistered.current) {
      window.history.pushState({ alifeUnsavedGroupProfileGuard: true }, '', window.location.href)
      browserBackGuardRegistered.current = true
    }

    const handlePopState = () => {
      window.alert(unsavedGroupProfileMessage)
      window.history.pushState({ alifeUnsavedGroupProfileGuard: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hasUnsavedGroupProfileChanges, unsavedGroupProfileMessage])

  const handleCreateSubgroup = async () => {
    if (!guardGroupProfileNavigation()) return

    const subgroupName = window.prompt(t('subgroupName'))
    if (!subgroupName?.trim()) return

    try {
      const subgroup = await createSubgroup(toLocalizedText(subgroupName.trim()), 'protected')
      if (subgroup) {
        activeEntityService.setGroup(subgroup.id)
        navigate(groupWorkspaceTarget(subgroup.id))
      }
    } catch {
      setStatusMessage(t('manageAddSubgroupFailed'))
    }
  }

  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  if (!loading && !canManageGroup) {
    return <Navigate to="/groups" replace />
  }

  return (
    <AppPageShell>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-[#fff4ea] px-6 py-7 text-[#18332d] shadow-[0_20px_55px_rgba(23,107,90,0.08)] sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              {!embeddedWorkspace ? (
                <Link
                  to={workspacePath}
                  className="text-sm font-bold text-emerald-700 transition hover:text-emerald-900"
                  onClick={(event) => {
                    if (!guardGroupProfileNavigation()) {
                      event.preventDefault()
                    }
                  }}
                >
                  {copy.back}
                </Link>
              ) : null}
              <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">{localizeText(group?.name, language) || copy.title}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{embeddedWorkspace ? (language === 'zh' ? '小组工作台' : 'Group Workspace') : copy.title}</h1>
              <p className="mt-3 text-sm leading-6 text-[#5f716a]">{embeddedWorkspace ? (language === 'zh' ? '成员、活动、内容和设置都在这里处理。' : 'People, events, content, and settings in one place.') : copy.subtitle}</p>
            </div>
            {group ? (
              <div className="flex flex-wrap gap-2">
                <AccessTypeBadge accessType={group.accessType} />
              </div>
            ) : null}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label={copy.pending} value={requestedCount} icon={<UserPlus className="h-5 w-5" />} />
          <StatCard label={copy.approved} value={approvedCount} icon={<UsersRound className="h-5 w-5" />} />
          <StatCard label={copy.upcomingEvents} value={upcomingEventCount} icon={<CalendarDays className="h-5 w-5" />} />
          <StatCard label={copy.publishedPages} value={pages.length} icon={<FileText className="h-5 w-5" />} />
        </div>

        <AppSectionCard dense title={copy.quickActions}>
          <div className="flex flex-wrap gap-2">
            <AppActionButton variant="primary" onClick={() => navigate('/groups/manage/invite-members')}>
              <UserPlus size={16} aria-hidden="true" className="mr-1.5" />
              {copy.inviteMember}
            </AppActionButton>
            <AppActionButton variant="secondary" onClick={() => {
              activeEntityService.set({ groupId, eventId: '' })
              navigate('/events/new')
            }}>
              <CalendarDays size={16} aria-hidden="true" className="mr-1.5" />
              {copy.createEvent}
            </AppActionButton>
            <AppActionButton variant="secondary" onClick={() => {
              activeEntityService.setGroup(groupId, { clearPage: true })
              navigate('/pages/new')
            }}>
              <FileText size={16} aria-hidden="true" className="mr-1.5" />
              {copy.addPage}
            </AppActionButton>
          </div>
        </AppSectionCard>

        <ManagementTabs activeSection={activeSection} basePath={sectionBasePath} copy={copy} />
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
            <>
              <LeadershipPanel
                memberships={memberships}
                currentMemberId={auth.me?.id}
                onTransferLeadership={(memberId) => {
                  transferLeadership(memberId).catch(() => setStatusMessage(t('leadershipTransferFailed')))
                }}
              />
              <GroupOverviewPanel
                group={group}
                saving={savingGroup}
                onStatusMessage={setStatusMessage}
                onDirtyChange={setHasUnsavedGroupProfileChanges}
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
            </>
          ) : null}

          {activeSection === 'group' && group.isChurch ? (
            <ChurchOperationsPanel groupId={groupId} onStatusMessage={setStatusMessage} />
          ) : null}

          {activeSection === 'subgroups' ? (
            <AppSectionCard
              dense
              title={t('manageSubgroups')}
              subtitle={t('manageSubgroupsPanelSubtitle')}
              action={
                <AppActionButton variant="primary" onClick={() => {
                  handleCreateSubgroup().catch(() => setStatusMessage(t('manageAddSubgroupFailed')))
                }}>
                  {t('manageAddSubgroup')}
                </AppActionButton>
              }
            >
              {subgroups.length === 0 ? (
                <p className="text-sm text-slate-500">{t('manageNoSubgroupsYet')}</p>
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
                          handleOpenSubgroup(subgroup.id).catch(() => setStatusMessage(t('manageClaimSubgroupCoLeaderFailed')))
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
              copy={copy}
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
              onUpdatePageVisibility={(page, visibility) => updatePageVisibility(page, visibility).catch(() => setStatusMessage(t('updatePageVisibilityFailed')))}
            />
          ) : null}

          {activeSection === 'events' ? (
            <EventsPanel
              groupId={groupId}
              events={events}
              copy={copy}
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
