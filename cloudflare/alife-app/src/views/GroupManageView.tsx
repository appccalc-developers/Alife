import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, Bell, CalendarDays, Crown, FileText, Network, Settings, ShieldCheck, UserPlus, UserMinus, UsersRound } from 'lucide-react'
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
import { confirmUnsavedChangesNavigation, setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import type { GroupPageDto, PageVisibility } from '../types/group'
import type { GroupEventRecord } from '../types/event'
import AnnouncementManagementPanel from '../components/group/AnnouncementManagementPanel'

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

type ManageSection = 'announcements' | 'members' | 'events' | 'pages' | 'subgroups' | 'group'

const manageSectionKeys: ManageSection[] = ['pages', 'announcements', 'members', 'events', 'subgroups', 'group']

const normalizeManageSection = (value: string | null): ManageSection =>
  manageSectionKeys.includes(value as ManageSection) ? value as ManageSection : 'pages'

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
      pages: '页面',
      pagesHint: '发布页面和小组资料',
      announcements: '公告',
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
      overview: '运营概览',
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
      members: 'Members',
      membersHint: 'Approvals, invitations, roles, and member status',
      events: 'Events',
      eventsHint: 'Create events, manage enrollment, and capture memories',
      pages: 'Pages',
      pagesHint: 'Published pages and group resources',
      announcements: 'Announcements',
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
      overview: 'Operations overview',
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

type MetricListItem = {
  label: string
  value: number | string
  icon: ReactNode
}

const MetricList = ({ items, ariaLabel }: { items: MetricListItem[]; ariaLabel: string }) => (
  <div
    className="overflow-hidden rounded-lg border border-[#2f4b42]/10 bg-white/75 shadow-sm"
    role="list"
    aria-label={ariaLabel}
  >
    {items.map((item, index) => (
      <div
        key={`${item.label}-${index}`}
        className={[
          'flex min-h-12 items-center justify-between gap-3 px-3 py-2.5',
          index > 0 ? 'border-t border-[#2f4b42]/10' : '',
        ].join(' ')}
        role="listitem"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e3f0eb] text-[#176b5a]">
            {item.icon}
          </span>
          <span className="truncate text-xs font-bold uppercase tracking-wide text-[#6e7c76]">{item.label}</span>
        </div>
        <span className="shrink-0 text-lg font-black tabular-nums text-[#18332d]">{item.value}</span>
      </div>
    ))}
  </div>
)

type ManagementPanelShellProps = {
  title?: string
  subtitle?: string
  action?: ReactNode
  framed?: boolean
  children: ReactNode
}

const ManagementPanelHeader = ({ title, subtitle, action }: Pick<ManagementPanelShellProps, 'title' | 'subtitle' | 'action'>) => (
  title || subtitle || action ? (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/10 pb-4">
      <div className="min-w-0">
        {title ? <h2 className="text-base font-black leading-tight text-[#18332d] sm:text-lg">{title}</h2> : null}
        {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  ) : null
)

const ManagementPanelShell = ({ title, subtitle, action, framed = true, children }: ManagementPanelShellProps) => {
  if (framed) {
    return (
      <AppSectionCard dense title={title} subtitle={subtitle} action={action}>
        {children}
      </AppSectionCard>
    )
  }

  return (
    <section className="min-w-0">
      <ManagementPanelHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </section>
  )
}

const ManagementTabs = ({
  activeSection,
  onSectionChange,
  copy,
}: {
  activeSection: ManageSection
  onSectionChange: (section: ManageSection) => void
  copy: ReturnType<typeof managementCopy>
}) => {
  const items = [
    { key: 'pages' as ManageSection, label: copy.pages, icon: <FileText className="h-4 w-4" /> },
    { key: 'announcements' as ManageSection, label: copy.announcements, icon: <Bell className="h-4 w-4" /> },
    { key: 'members' as ManageSection, label: copy.members, icon: <UsersRound className="h-4 w-4" /> },
    { key: 'events' as ManageSection, label: copy.events, icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'subgroups' as ManageSection, label: copy.subgroups, icon: <Network className="h-4 w-4" /> },
    { key: 'group' as ManageSection, label: copy.settings, icon: <Settings className="h-4 w-4" /> },
  ]

  return (
    <div className="overflow-x-auto">
      <nav className="flex min-w-max gap-1" aria-label="Management sections" role="tablist">
        {items.map((item) => {
          const active = activeSection === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSectionChange(item.key)}
              className={[
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-black transition',
                active
                  ? 'bg-[#176b5a] text-white shadow-sm'
                  : 'text-[#40554e] hover:bg-[#e3f0eb] hover:text-[#0d4f43]',
              ].join(' ')}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const ManagementTabCard = ({
  activeSection,
  onSectionChange,
  copy,
  children,
}: {
  activeSection: ManageSection
  onSectionChange: (section: ManageSection) => void
  copy: ReturnType<typeof managementCopy>
  children: ReactNode
}) => (
  <section className="alife-panel overflow-hidden rounded-2xl p-0">
    <div className="border-b border-[#2f4b42]/10 bg-white/50 px-3 py-2 sm:px-4">
      <ManagementTabs activeSection={activeSection} onSectionChange={onSectionChange} copy={copy} />
    </div>
    <div className="p-4 sm:p-5">
      {children}
    </div>
  </section>
)

type MembersPanelProps = {
  memberships: GroupMemberToolRow[]
  copy: ReturnType<typeof managementCopy>
  onInviteMember: () => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
  framed?: boolean
}

const iconButtonClass = 'h-8 w-8 p-0'

type LeadershipPanelProps = {
  memberships: GroupMemberToolRow[]
  currentMemberId?: string
  onTransferLeadership: (memberId: string) => void
  framed?: boolean
}

const LeadershipPanel = ({ memberships, currentMemberId, onTransferLeadership, framed = true }: LeadershipPanelProps) => {
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
    <ManagementPanelShell
      framed={framed}
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
    </ManagementPanelShell>
  )
}

const MembersPanel = ({ memberships, copy, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader, framed = true }: MembersPanelProps) => {
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
    <ManagementPanelShell
      framed={framed}
      title={copy.members}
      subtitle={copy.membersHint}
      action={
        <AppActionButton variant="primary" onClick={onInviteMember}>
          <UserPlus size={16} aria-hidden="true" className="mr-1.5" />
          {copy.inviteMember}
        </AppActionButton>
      }
    >
      <div className="mb-5">
        <MetricList
          ariaLabel={copy.members}
          items={[
            { label: copy.pending, value: requestedMembers.length, icon: <UserPlus className="h-4 w-4" /> },
            { label: copy.approved, value: approvedMembers.length, icon: <UsersRound className="h-4 w-4" /> },
            { label: copy.inactive, value: inactiveMembers.length, icon: <UserMinus className="h-4 w-4" /> },
          ]}
        />
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
    </ManagementPanelShell>
  )
}

type PagesPanelProps = {
  groupId: string
  language: string
  pages: GroupPageDto[]
  onAddPage: () => void
  onDeletePage: (pageId: string) => void
  onUpdatePageVisibility: (page: GroupPageDto, visibility: PageVisibility) => void
  framed?: boolean
}

const pageVisibilityOptions: PageVisibility[] = ['draft', 'group', 'public']

const formatReviewDate = (value: string, language: string) => {
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const PagesPanel = ({ groupId, language, pages, onAddPage, onDeletePage, onUpdatePageVisibility, framed = true }: PagesPanelProps) => {
  const t = useUiText()
  const navigate = useNavigate()

  return (
    <ManagementPanelShell
      framed={framed}
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
                {page.reviewRefusal ? (
                  <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                    <p className="font-black text-rose-900">{t('pageGlobalReviewRefused')}</p>
                    <p className="mt-0.5 font-semibold">
                      {t('pageGlobalReviewRefusalMeta', {
                        reviewer: page.reviewRefusal.reviewerDisplayName || t('unknownReviewer'),
                        time: formatReviewDate(page.reviewRefusal.refusedUtc, language),
                      })}
                    </p>
                    <p className="mt-1">{t('pageGlobalReviewRefusalReason', { reason: page.reviewRefusal.reason })}</p>
                  </div>
                ) : null}
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
    </ManagementPanelShell>
  )
}

type EventsPanelProps = {
  groupId: string
  events: GroupEventRecord[]
  copy: ReturnType<typeof managementCopy>
  onDeleteEvent: (eventId: string) => void
  framed?: boolean
}

const EventsPanel = ({ groupId, events, copy, onDeleteEvent, framed = true }: EventsPanelProps) => {
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()
  const upcomingEvents = events.filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now())
  const pastEvents = events.filter((event) => event.endDate && new Date(event.endDate).getTime() < Date.now())

  return (
    <ManagementPanelShell
      framed={framed}
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
      <div className="mb-5">
        <MetricList
          ariaLabel={copy.events}
          items={[
            { label: copy.totalEvents, value: events.length, icon: <CalendarDays className="h-4 w-4" /> },
            { label: copy.upcomingEvents, value: upcomingEvents.length, icon: <CalendarDays className="h-4 w-4" /> },
            { label: copy.pastEvents, value: pastEvents.length, icon: <CalendarDays className="h-4 w-4" /> },
          ]}
        />
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
    </ManagementPanelShell>
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

  const [activeSection, setActiveSection] = useState<ManageSection>(() => normalizeManageSection(searchParams.get('section')))
  const copy = managementCopy(language, group?.isChurch)
  const workspacePath = '/groups'
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

    confirmUnsavedChangesNavigation()
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
      confirmUnsavedChangesNavigation()
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
        <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-[#fff4ea] px-6 py-6 text-[#18332d] shadow-[0_20px_55px_rgba(23,107,90,0.08)] sm:px-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="min-w-0">
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
            <div className="space-y-3">
              {group ? (
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  <AccessTypeBadge accessType={group.accessType} />
                </div>
              ) : null}
              <MetricList
                ariaLabel={copy.overview}
                items={[
                  { label: copy.pending, value: requestedCount, icon: <UserPlus className="h-4 w-4" /> },
                  { label: copy.approved, value: approvedCount, icon: <UsersRound className="h-4 w-4" /> },
                  { label: copy.upcomingEvents, value: upcomingEventCount, icon: <CalendarDays className="h-4 w-4" /> },
                  { label: copy.publishedPages, value: pages.length, icon: <FileText className="h-4 w-4" /> },
                ]}
              />
            </div>
          </div>
        </section>

        <ManagementTabCard activeSection={activeSection} onSectionChange={setActiveSection} copy={copy}>
          {loading ? (
            <p className="text-sm text-slate-600">{t('loadingManagementWorkspace')}</p>
          ) : null}

          {!loading && error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : null}

          {!loading && !error && group ? (
            <div className="space-y-5">
              {statusMessage ? (
                <div className="rounded-lg border border-[#2f4b42]/10 bg-white/70 px-3 py-2 text-sm text-slate-600">
                  {statusMessage}
                </div>
              ) : null}

              {activeSection === 'group' ? (
                <div className="space-y-5">
                  <LeadershipPanel
                    framed={false}
                    memberships={memberships}
                    currentMemberId={auth.me?.id}
                    onTransferLeadership={(memberId) => {
                      transferLeadership(memberId).catch(() => setStatusMessage(t('leadershipTransferFailed')))
                    }}
                  />
                  <GroupOverviewPanel
                    framed={false}
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
                </div>
              ) : null}

              {activeSection === 'subgroups' ? (
                <ManagementPanelShell
                  framed={false}
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
                </ManagementPanelShell>
              ) : null}

              {activeSection === 'members' ? (
                <MembersPanel
                  framed={false}
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
                  framed={false}
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
                  framed={false}
                  groupId={groupId}
                  events={events}
                  copy={copy}
                  onDeleteEvent={(eventId) => {
                    if (!window.confirm(t('deleteEventConfirm'))) return
                    deleteEvent(eventId).catch(() => setStatusMessage(t('deleteEventFailed')))
                  }}
                />
              ) : null}

              {activeSection === 'announcements' ? (
                <AnnouncementManagementPanel group={group} onMessage={setStatusMessage} />
              ) : null}
            </div>
          ) : null}

          {!loading && !error && !group ? (
            <AppEmptyState title={t('groupNotFound')} description={t('groupNotFoundDescription')} />
          ) : null}
        </ManagementTabCard>
      </div>
    </AppPageShell>
  )
}

export default GroupManageView
