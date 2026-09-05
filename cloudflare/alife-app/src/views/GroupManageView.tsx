import PersonalPasskeyRecovery from '../components/identity/PersonalPasskeyRecovery'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, CalendarDays, Crown, Loader2, Pencil, ShieldCheck, UserPlus, UserMinus, UsersRound, X } from 'lucide-react'
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
import { localizeText } from '../utils/localizedText'
import { useCurrentGroupStore } from '../stores/currentGroup'
import { translateUi, useUiText } from '../i18n/uiText'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { confirmUnsavedChangesNavigation, setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import type { GroupPageDto, PageVisibility } from '../types/group'
import type { GroupEventRecord } from '../types/event'
import AnnouncementManagementPanel from '../components/group/AnnouncementManagementPanel'
import ContactManagementPanel from '../components/group/ContactManagementPanel'
import RegionalPhoneInput from '../components/forms/RegionalPhoneInput'
import { isValidPhoneNumber } from '../utils/phoneNumber'
import { getEventLifecycle, readEventLifecycleData, sortEventsByLatestStart, type EventLifecycle } from '../utils/eventLifecycle'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import useConfirmation from '../hooks/useConfirmation'
import CreateSubgroupModal from '../components/group/CreateSubgroupModal'
import type { LocalizedText } from '../types'
import GroupApplicationsPanel from '../components/group/GroupApplicationsPanel'
import { resolveManageSection, type ManageSection } from '../utils/groupManagementSections'

const shortId = (value: string) => (value.length > 8 ? value.slice(0, 8) : value)

const formatDate = (value: string, language: string) => {
  if (!value) return translateUi(language, 'noDate')
  return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isPlatformAdminRole = (role?: string | null) => role === 'admin' || role === 'superadmin'

const formatPlatformRole = (role: string | undefined | null, language: string) => {
  if (role === 'superadmin') return language === 'zh' ? '系统管理员' : 'System Admin'
  if (role === 'admin') return language === 'zh' ? '管理员' : 'Admin'
  return ''
}

const managementCopy = (language: string, isChurch?: boolean) => {
  const workspace = isChurch ? (language === 'zh' ? '教会' : 'Church') : (language === 'zh' ? '小组' : 'Group')
  return language === 'zh'
    ? {
      title: `${workspace}运营中心`,
      subtitle: '把成员、活动、内容和设置放在一个清晰的工作台里处理。',
      back: `返回${workspace}`,
      members: '成员',
      membersHint: '审批、邀请、角色和成员状态',
      applications: '申请',
      applicationsHint: '二维码申请、组长身份核验与手机激活',
      contacts: '联系人',
      contactsHint: '联系人资料、公开范围和留言入口',
      events: '活动',
      eventsHint: '创建活动、维护报名和后续回顾',
      pages: '页面',
      pagesHint: '发布页面和小组资料',
      albums: '相册',
      albumsHint: '整理图片、子相册和页面展示',
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
      planningEvents: '筹备中活动',
      totalEvents: '全部活动',
      pastEvents: '已结束',
      inviteMember: '邀请成员',
      createEvent: '创建活动',
      addPage: '新建页面',
      emptyMembersTitle: '还没有成员记录',
      emptyMembersBody: '可以先邀请成员，或等待成员提交加入申请。',
      emptyEventsTitle: '还没有活动',
      emptyEventsBody: '用 AI 活动助理创建第一场活动，之后可在这里维护报名和回顾。',
      viewEventPosts: '查看发布内容',
      addReview: '添加回顾',
      enroll: '报名',
      enrollmentClosed: '报名已截止',
      noEnrollment: '无需报名',
      noEventsInSection: '此分类中还没有活动。',
    }
    : {
      title: `${workspace} Operations`,
      subtitle: 'A focused workspace for people, events, content, and settings.',
      back: `Back to ${workspace.toLowerCase()}`,
      members: 'Members',
      membersHint: 'Approvals, invitations, roles, and member status',
      applications: 'Applications',
      applicationsHint: 'QR applications, leader identity checks, and mobile activation',
      contacts: 'Contacts',
      contactsHint: 'Profiles, visibility, and inquiry entry points',
      events: 'Events',
      eventsHint: 'Create events, manage enrollment, and capture memories',
      pages: 'Pages',
      pagesHint: 'Published pages and group resources',
      albums: 'Albums',
      albumsHint: 'Organize photos, subalbums, and page galleries',
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
      planningEvents: 'Planning events',
      totalEvents: 'Total events',
      pastEvents: 'Past events',
      inviteMember: 'Invite people',
      createEvent: 'Create event',
      addPage: 'Add page',
      emptyMembersTitle: 'No member records yet',
      emptyMembersBody: 'Invite people or wait for join requests to appear here.',
      emptyEventsTitle: 'No events yet',
      emptyEventsBody: 'Create the first event with the AI event assistant, then manage enrollment and memories here.',
      viewEventPosts: 'View posts',
      addReview: 'Add review',
      enroll: 'Enroll',
      enrollmentClosed: 'Enrolment closed',
      noEnrollment: 'No enrolment needed',
      noEventsInSection: 'No events in this section.',
    }
}

type MetricListItem = {
  label: string
  value: number | string
  icon: ReactNode
}

const MetricList = ({ items, ariaLabel }: { items: MetricListItem[]; ariaLabel: string }) => {
  return (
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
}

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

const ManagementContentCard = ({
  children,
  labelledBy,
}: {
  children: ReactNode
  labelledBy?: string
}) => (
  <section
    id={labelledBy ? 'group-management-panel' : undefined}
    role={labelledBy ? 'tabpanel' : undefined}
    aria-labelledby={labelledBy}
    tabIndex={labelledBy ? 0 : undefined}
    className="alife-panel overflow-hidden rounded-2xl p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45"
  >
    <div className="p-4 sm:p-5">
      {children}
    </div>
  </section>
)

type MembersPanelProps = {
  groupId: string
  memberships: GroupMemberToolRow[]
  copy: ReturnType<typeof managementCopy>
  onInviteMember: () => void
  onApproveMember: (memberId: string) => void
  onRejectMember: (memberId: string) => void
  onKickMember: (memberId: string) => void
  onSetCoLeader: (memberId: string, isCoLeader: boolean) => void
  onProfileUpdated: () => Promise<void>
  allowInvite?: boolean
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
  const { requestConfirmation, confirmationModal } = useConfirmation()
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
    <>
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
                      requestConfirmation({
                        title: t('transferLeadership'),
                        description: t('transferLeadershipConfirm', { name: displayName }),
                        confirmLabel: t('transferLeadership'),
                      }).then((confirmed) => {
                        if (confirmed) onTransferLeadership(member.memberId)
                      }).catch(() => undefined)
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
    {confirmationModal}
    </>
  )
}

const MembersPanel = ({ groupId, memberships, copy, onInviteMember, onApproveMember, onRejectMember, onKickMember, onSetCoLeader, onProfileUpdated, allowInvite = true, framed = true }: MembersPanelProps) => {
  const t = useUiText()
  const auth = useAuthStore()
  const [roleTarget, setRoleTarget] = useState<GroupMemberToolRow | null>(null)
  const [profileTarget, setProfileTarget] = useState<GroupMemberToolRow | null>(null)
  const [profileForm, setProfileForm] = useState({ displayName: '', email: '', phoneE164: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
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
  const canManageRoles = currentRole === 'leader' || auth.isAdmin
  const canEditProfiles = currentRole === 'leader' || currentRole === 'coLeader' || auth.isAdmin
  const canRemoveMember = (member: GroupMemberToolRow) => {
    if (member.memberId === auth.me?.id || member.role === 'leader') return false
    if (auth.isAdmin) return true
    return currentRole === 'leader' || (currentRole === 'coLeader' && member.role === 'member')
  }

  const handleRoleChoice = (isCoLeader: boolean) => {
    if (!roleTarget) return
    if ((roleTarget.role === 'coLeader') !== isCoLeader) {
      onSetCoLeader(roleTarget.memberId, isCoLeader)
    }
    setRoleTarget(null)
  }

  const profileCopy = auth.language === 'zh'
    ? { edit: '修改资料', description: '修改该成员的基本账号资料。', displayName: '显示名称', email: '邮箱', phone: '手机号', phoneHint: '选择地区后输入本地号码，可以保留开头的 0。', phoneInvalid: '请检查电话号码和所选地区。', cancel: '取消', save: '保存修改', saving: '保存中…', loading: '正在读取资料…', required: '显示名称为必填项。', failed: '无法更新成员资料。', close: '关闭弹窗' }
    : { edit: 'Edit member', description: 'Update this member’s basic account information.', displayName: 'Display name', email: 'Email', phone: 'Phone', phoneHint: 'Choose a region and enter the local number. A leading zero is accepted.', phoneInvalid: 'Check the phone number and selected region.', cancel: 'Cancel', save: 'Save changes', saving: 'Saving…', loading: 'Loading profile…', required: 'Display name is required.', failed: 'Unable to update this member.', close: 'Close dialog' }

  const openProfileDialog = async (member: GroupMemberToolRow) => {
    setProfileTarget(member)
    setProfileForm({ displayName: member.displayName || '', email: '', phoneE164: '' })
    setProfileLoading(true)
    setProfileError('')
    try {
      const profile = await groupService.getGroupMemberProfile(groupId, member.memberId)
      setProfileForm({ displayName: profile.displayName || '', email: profile.email || '', phoneE164: profile.phoneE164 || '' })
    } catch {
      setProfileError(profileCopy.failed)
    } finally {
      setProfileLoading(false)
    }
  }

  const saveProfile = async () => {
    if (!profileTarget || profileSaving) return
    const displayName = profileForm.displayName.trim()
    if (!displayName) {
      setProfileError(profileCopy.required)
      return
    }
    if (!isValidPhoneNumber(profileForm.phoneE164)) {
      setProfileError(profileCopy.phoneInvalid)
      return
    }
    setProfileSaving(true)
    setProfileError('')
    try {
      await groupService.updateGroupMemberProfile(groupId, profileTarget.memberId, {
        displayName,
        email: profileForm.email.trim() || null,
        phoneE164: profileForm.phoneE164.trim() || null,
      })
      await onProfileUpdated()
      setProfileTarget(null)
    } catch (reason) {
      const message = typeof reason === 'object' && reason && 'response' in reason
        ? (reason as { response?: { data?: { message?: string } } }).response?.data?.message
        : null
      setProfileError(message || profileCopy.failed)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <ManagementPanelShell
      framed={framed}
      title={copy.members}
      subtitle={allowInvite ? copy.membersHint : (auth.language === 'zh' ? '查看教会成员、申请状态和成员角色。' : 'Review church members, requests, and member roles.')}
      action={allowInvite ? (
        <AppActionButton variant="primary" onClick={onInviteMember}>
          <UserPlus size={16} aria-hidden="true" className="mr-1.5" />
          {copy.inviteMember}
        </AppActionButton>
      ) : null}
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
        <AppEmptyState
          title={copy.emptyMembersTitle}
          description={allowInvite ? copy.emptyMembersBody : (auth.language === 'zh' ? '目前还没有教会成员记录。' : 'There are no church member records yet.')}
          actionLabel={allowInvite ? copy.inviteMember : undefined}
          onAction={allowInvite ? onInviteMember : undefined}
        />
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
              {canEditProfiles || canRemoveMember(member) ? (
                <div className="flex gap-2">
                  {canEditProfiles ? (
                    <AppActionButton
                      size="sm"
                      variant="secondary"
                      className={iconButtonClass}
                      aria-label={`${profileCopy.edit}: ${getDisplayName(member)}`}
                      title={profileCopy.edit}
                      onClick={() => { openProfileDialog(member).catch(() => undefined) }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </AppActionButton>
                  ) : null}
                  {canRemoveMember(member) ? (
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
                  ) : null}
                </div>
              ) : null}
              {canEditProfiles && member.memberId !== auth.me?.id && (member.role === 'member' || auth.isAdmin) ? <details className="w-full border-t border-slate-100 pt-3"><summary className="cursor-pointer py-2 text-sm font-semibold text-[#176b5a]">{t('passkeyRecoveryTitle')}</summary><div className="pt-2"><PersonalPasskeyRecovery groupId={groupId} memberId={member.memberId} displayName={getDisplayName(member)} /></div></details> : null}
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

      {profileTarget ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/50 px-4 pb-24 pt-6 backdrop-blur-sm sm:items-center sm:justify-center sm:py-6">
          <button type="button" className="absolute inset-0" aria-label={profileCopy.close} disabled={profileSaving} onClick={() => setProfileTarget(null)} />
          <section className="relative z-10 flex max-h-[calc(100dvh-7.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]" role="dialog" aria-modal="true" aria-labelledby="group-member-profile-title">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 sm:px-6">
              <div>
                <h2 id="group-member-profile-title" className="text-lg font-black text-slate-950">{profileCopy.edit}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{profileCopy.description}</p>
              </div>
              <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-slate-900" aria-label={profileCopy.close} disabled={profileSaving} onClick={() => setProfileTarget(null)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            {profileLoading ? (
              <div className="flex min-h-52 items-center justify-center gap-2 p-6 text-sm font-semibold text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {profileCopy.loading}
              </div>
            ) : (
              <form className="space-y-4 overflow-y-auto p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); saveProfile().catch(() => undefined) }}>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">{profileCopy.displayName}</span>
                  <input autoFocus required maxLength={150} value={profileForm.displayName} onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">{profileCopy.email}</span>
                  <input type="email" maxLength={200} value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <RegionalPhoneInput
                  value={profileForm.phoneE164}
                  onChange={(phoneE164) => setProfileForm((current) => ({ ...current, phoneE164 }))}
                  language={auth.language}
                  label={profileCopy.phone}
                  hint={profileCopy.phoneHint}
                />
                {profileError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{profileError}</p> : null}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <AppActionButton variant="secondary" disabled={profileSaving} onClick={() => setProfileTarget(null)}>{profileCopy.cancel}</AppActionButton>
                  <AppActionButton variant="primary" disabled={profileSaving || !profileForm.displayName.trim()} type="submit">
                    {profileSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {profileSaving ? profileCopy.saving : profileCopy.save}
                  </AppActionButton>
                </div>
              </form>
            )}
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
  isChurch?: boolean
  events: GroupEventRecord[]
  copy: ReturnType<typeof managementCopy>
  currentGroupRoute?: boolean
  framed?: boolean
}

const eventTabs: EventLifecycle[] = ['past', 'upcoming', 'planning']

const eventVisibilityLabel = (event: GroupEventRecord, language: string, isChurch = false) => {
  if (event.visibility === 'public') return language === 'zh' ? '公开可见' : 'Public'
  if (event.visibility === 'churchVisible') return language === 'zh' ? '教会内可见' : 'Church members'
  if (isChurch) return language === 'zh' ? '教会内可见' : 'Church members'
  return language === 'zh' ? '小组内可见' : 'Group members'
}

const EventsPanel = ({ groupId, isChurch = false, events, copy, currentGroupRoute = false, framed = true }: EventsPanelProps) => {
  const navigate = useNavigate()
  const t = useUiText()
  const { language } = useAuthStore()
  const [activeTab, setActiveTab] = useState<EventLifecycle>('planning')
  const eventsByTab = useMemo(() => {
    const grouped: Record<EventLifecycle, GroupEventRecord[]> = { past: [], upcoming: [], planning: [] }
    sortEventsByLatestStart(events).forEach((event) => grouped[getEventLifecycle(event)].push(event))
    return grouped
  }, [events])
  const tabLabels: Record<EventLifecycle, string> = {
    past: copy.pastEvents,
    upcoming: copy.upcomingEvents,
    planning: copy.planningEvents,
  }
  const displayedEvents = eventsByTab[activeTab]

  return (
    <ManagementPanelShell
      framed={framed}
      title={copy.events}
      subtitle={copy.eventsHint}
      action={<AppActionButton variant="primary" onClick={() => {
        if (currentGroupRoute) activeEntityService.set({ groupId, eventId: '' })
        navigate(currentGroupRoute ? '/events/new' : `/groups/${encodeURIComponent(groupId)}/events/new`)
      }}>
        <CalendarDays size={16} aria-hidden="true" className="mr-1.5" />
        {copy.createEvent}
      </AppActionButton>}
    >
      {events.length === 0 ? (
        <AppEmptyState title={copy.emptyEventsTitle} description={copy.emptyEventsBody} actionLabel={copy.createEvent} onAction={() => {
          if (currentGroupRoute) activeEntityService.set({ groupId, eventId: '' })
          navigate(currentGroupRoute ? '/events/new' : `/groups/${encodeURIComponent(groupId)}/events/new`)
        }} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[#2f4b42]/10 bg-white/70 p-1.5" role="tablist" aria-label={copy.events}>
            <div className="flex min-w-max gap-1.5">
              {eventTabs.map((tab) => {
                const selected = tab === activeTab
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      'min-h-11 rounded-xl px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45',
                      selected ? 'bg-[#173f36] text-white shadow-sm' : 'text-[#53665f] hover:bg-[#edf5f1] hover:text-[#123d34]',
                    ].join(' ')}
                  >
                    {tabLabels[tab]} <span className={selected ? 'text-white/70' : 'text-[#87938e]'}>({eventsByTab[tab].length})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {displayedEvents.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#176b5a]/25 bg-white/64 p-6 text-center text-sm text-[#66766f]">{copy.noEventsInSection}</p>
          ) : (
            <div className="space-y-2">
              {displayedEvents.map((event) => {
                const title = (language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh || t('untitled')
                const lifecycleData = readEventLifecycleData(event)
                const detailPath = buildScopedEventDetailPath(groupId, event.id, !currentGroupRoute)
                return (
                  <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-950">{title}</p>
                        <AppBadge variant={event.visibility === 'public' ? 'success' : 'neutral'}>{eventVisibilityLabel(event, language, isChurch)}</AppBadge>
                        {activeTab === 'upcoming' && lifecycleData.registrationDeadlineTime !== null && lifecycleData.registrationDeadlineTime < Date.now() ? <AppBadge variant="neutral">{copy.enrollmentClosed}</AppBadge> : null}
                        {activeTab === 'planning' && !lifecycleData.acceptsEnrollments ? <AppBadge variant="neutral">{copy.noEnrollment}</AppBadge> : null}
                        {activeTab === 'planning' ? <AppBadge variant="neutral">RAM: {event.ramStatus ?? 'draft'}</AppBadge> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(event.startDate, language)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AppActionButton size="sm" variant="secondary" onClick={() => {
                        activeEntityService.setEvent(event.id)
                        navigate(detailPath)
                      }}>{copy.viewEventPosts}</AppActionButton>
                      {activeTab === 'past' ? <AppActionButton size="sm" variant="primary" onClick={() => {
                        activeEntityService.setEvent(event.id)
                        navigate(`${detailPath}/review`)
                      }}>{copy.addReview}</AppActionButton> : null}
                      {activeTab === 'planning' ? <AppActionButton size="sm" variant="secondary" onClick={() => {
                        activeEntityService.setEvent(event.id)
                        navigate(`${detailPath}/edit`)
                      }}>{language === 'zh' ? '编辑 / RAM' : 'Edit / RAM'}</AppActionButton> : null}
                      {activeTab === 'upcoming' && lifecycleData.acceptsEnrollments && (lifecycleData.registrationDeadlineTime ?? 0) >= Date.now() ? <AppActionButton size="sm" variant="primary" onClick={() => {
                        activeEntityService.setEvent(event.id)
                        navigate(`${detailPath}/enroll`)
                      }}>{copy.enroll}</AppActionButton> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </ManagementPanelShell>
  )
}

type GroupManageViewProps = {
  embeddedWorkspace?: boolean
  explicitGroupId?: string
  workspaceBasePath?: string
  sectionParamName?: string
  integrated?: boolean
  refreshRequest?: number
  subgroupDetailBasePath?: string
  visibleSections?: readonly ManageSection[]
  sectionLabels?: Partial<Record<ManageSection, string>>
  membersContent?: ReactNode
  workspaceEyebrow?: ReactNode
  workspaceDescription?: string
}

const GroupManageView = ({
  embeddedWorkspace = false,
  explicitGroupId = '',
  workspaceBasePath = '/groups',
  sectionParamName = 'section',
  integrated = false,
  refreshRequest = 0,
  subgroupDetailBasePath = '',
  visibleSections,
  sectionLabels,
  membersContent,
  workspaceEyebrow,
  workspaceDescription,
}: GroupManageViewProps) => {
  const t = useUiText()
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const { groupId: routeGroupId } = useParams<{ groupId: string }>()
  const { groupId: activeGroupId } = useActiveEntityIds({ groupId: routeGroupId })
  const groupId = explicitGroupId || activeGroupId || ''
  const currentGroupRoute = !routeGroupId && !explicitGroupId
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const auth = useAuthStore()
  const { language } = auth
  const { setCurrentGroup } = useCurrentGroupStore()
  const [savingGroup, setSavingGroup] = useState(false)
  const [createSubgroupOpen, setCreateSubgroupOpen] = useState(false)
  const [creatingSubgroup, setCreatingSubgroup] = useState(false)
  const [createSubgroupError, setCreateSubgroupError] = useState('')
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
    refreshMemberships,
  } = useGroupScreen(groupId, { loadEvents: true })
  const lastRefreshRequest = useRef(refreshRequest)

  useEffect(() => {
    if (lastRefreshRequest.current === refreshRequest) return
    if (!group || !canManageGroup) return
    lastRefreshRequest.current = refreshRequest
    refreshMemberships().catch(() => undefined)
  }, [canManageGroup, group, refreshMemberships, refreshRequest])

  const activeSection = resolveManageSection(searchParams.get(sectionParamName), visibleSections)
  const copy = managementCopy(language, group?.isChurch)
  const allGroupManagementSections: Array<{ key: ManageSection; label: string; hint: string }> = [
    { key: 'group', label: language === 'zh' ? '资料与设置' : 'Profile & settings', hint: language === 'zh' ? '名称、介绍、带领团队与访问规则' : 'Name, description, leadership, and access' },
    { key: 'members', label: copy.members, hint: copy.membersHint },
    { key: 'applications', label: copy.applications, hint: copy.applicationsHint },
    { key: 'contacts', label: copy.contacts, hint: copy.contactsHint },
    { key: 'subgroups', label: copy.subgroups, hint: copy.subgroupsHint },
    { key: 'albums', label: copy.albums, hint: copy.albumsHint },
    { key: 'pages', label: copy.pages, hint: copy.pagesHint },
  ]
  const groupManagementSections = visibleSections?.length
    ? allGroupManagementSections.filter((section) => visibleSections.includes(section.key))
    : allGroupManagementSections
  const labelledGroupManagementSections = groupManagementSections.map((section) => ({
    ...section,
    label: sectionLabels?.[section.key] || section.label,
  }))
  const showGroupManagementNavigation = activeSection !== 'events' && activeSection !== 'announcements'
  const workspacePath = workspaceBasePath
  const groupWorkspaceTarget = (targetGroupId: string) =>
    subgroupDetailBasePath
      ? `${subgroupDetailBasePath}/${encodeURIComponent(targetGroupId)}`
      : embeddedWorkspace ? '/groups?section=group' : '/groups/manage?section=group'
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
    auth.memberships.some(
      (membership) =>
        membership.groupId === subgroupId &&
        membership.status === 'approved' &&
        (membership.role === 'leader' || membership.role === 'coLeader'),
    )

  const handleOpenSubgroup = async (subgroupId: string) => {
    if (!guardGroupProfileNavigation()) return

    if (subgroupDetailBasePath) {
      navigate(groupWorkspaceTarget(subgroupId))
      return
    }

    if (canManageSubgroup(subgroupId)) {
      activeEntityService.setGroup(subgroupId)
      navigate(groupWorkspaceTarget(subgroupId))
      return
    }

    if (!await requestConfirmation({
      title: t('manageClaimSubgroupCoLeaderTitle'),
      description: t('manageClaimSubgroupCoLeaderConfirm'),
      confirmLabel: t('open'),
    })) return

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
    if (group && currentGroupRoute) {
      setCurrentGroup(group)
    }
  }, [currentGroupRoute, group, setCurrentGroup])

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

  const handleCreateSubgroup = async (name: LocalizedText) => {
    setCreatingSubgroup(true)
    setCreateSubgroupError('')
    try {
      const subgroup = await createSubgroup(name, 'protected')
      if (subgroup) {
        setCreateSubgroupOpen(false)
        if (!subgroupDetailBasePath) activeEntityService.setGroup(subgroup.id)
        navigate(groupWorkspaceTarget(subgroup.id))
      }
    } catch {
      const message = t('manageAddSubgroupFailed')
      setCreateSubgroupError(message)
      setStatusMessage(message)
    } finally {
      setCreatingSubgroup(false)
    }
  }

  if (!groupId) {
    return <Navigate to="/groups/select" replace />
  }

  if (!loading && !canManageGroup) {
    return <Navigate to="/groups?view=overview" replace />
  }

  const managementWorkspace = (
      <div className={integrated ? 'space-y-4' : 'space-y-5'}>
        {!integrated && showGroupManagementNavigation ? (
          <nav
            aria-label={language === 'zh' ? `${group?.isChurch ? '教会' : '小组'}管理视图` : `${group?.isChurch ? 'Church' : 'Group'} management views`}
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max items-center gap-1 border-b border-[#ccd9d3]" role="tablist">
              {labelledGroupManagementSections.map((section) => {
                const target = `${workspaceBasePath}?${sectionParamName}=${section.key}`
                const active = activeSection === section.key
                return (
                  <Link
                    key={section.key}
                    to={target}
                    id={`group-management-tab-${section.key}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls="group-management-panel"
                    className={[
                      'relative flex min-h-11 items-center whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-black transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/45',
                      active
                        ? 'border-[#176b5a] text-[#173f36]'
                        : 'border-transparent text-[#64756e] hover:border-[#9cb8ad] hover:text-[#173f36]',
                    ].join(' ')}
                    onClick={(event) => {
                      if (!guardGroupProfileNavigation()) event.preventDefault()
                    }}
                  >
                    {section.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        ) : null}

        <ManagementContentCard labelledBy={showGroupManagementNavigation && !integrated ? `group-management-tab-${activeSection}` : undefined}>
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
                      if (!guardGroupProfileNavigation()) return
                      setCreateSubgroupError('')
                      setCreateSubgroupOpen(true)
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
                membersContent ?? <MembersPanel
                  framed={false}
                  groupId={groupId}
                  memberships={memberships}
                  copy={copy}
                  allowInvite={!group.isChurch}
                  onInviteMember={() => {
                    if (currentGroupRoute) activeEntityService.setGroup(groupId, { clearPage: true })
                    navigate(currentGroupRoute ? '/groups/manage/invite-members' : `/groups/${encodeURIComponent(groupId)}/manage/invite-members`)
                  }}
                  onApproveMember={(memberId) => approveMember(memberId).catch(() => setStatusMessage(t('approveFailed')))}
                  onRejectMember={(memberId) => rejectMember(memberId).catch(() => setStatusMessage(t('rejectFailed')))}
                  onKickMember={(memberId) => {
                    requestConfirmation({
                      title: t('removeMemberTitle'),
                      description: t('removeMemberConfirm'),
                      confirmLabel: t('remove'),
                      tone: 'danger',
                    }).then((confirmed) => {
                      if (confirmed) kickMember(memberId).catch(() => setStatusMessage(t('removeMemberFailed')))
                    }).catch(() => undefined)
                  }}
                  onSetCoLeader={(memberId, isCoLeader) => setCoLeader(memberId, isCoLeader).catch(() => setStatusMessage(t('updateCoLeaderFailed')))}
                  onProfileUpdated={() => refreshMemberships().then(() => undefined)}
                />
              ) : null}

              {activeSection === 'applications' ? (
                <GroupApplicationsPanel groupId={groupId} language={language} />
              ) : null}

              {activeSection === 'contacts' ? (
                <ContactManagementPanel groupId={groupId} memberships={memberships} />
              ) : null}

              {activeSection === 'pages' ? (
                <PagesPanel
                  framed={false}
                  groupId={groupId}
                  language={language}
                  pages={pages}
                  onAddPage={() => {
                    if (currentGroupRoute) activeEntityService.setGroup(groupId, { clearPage: true })
                    navigate(currentGroupRoute ? '/pages/new' : `/groups/${encodeURIComponent(groupId)}/pages/new`)
                  }}
                  onDeletePage={(pageId) => {
                    requestConfirmation({
                      title: t('removePageTitle'),
                      description: t('removePageConfirm'),
                      confirmLabel: t('remove'),
                      tone: 'danger',
                    }).then((confirmed) => {
                      if (confirmed) deletePage(pageId).catch(() => setStatusMessage(t('removePageFailed')))
                    }).catch(() => undefined)
                  }}
                  onUpdatePageVisibility={(page, visibility) => updatePageVisibility(page, visibility).catch(() => setStatusMessage(t('updatePageVisibilityFailed')))}
                />
              ) : null}

              {activeSection === 'albums' ? (
                <ManagementPanelShell
                  framed={false}
                  title={copy.albums}
                  subtitle={copy.albumsHint}
                  action={<AppActionButton variant="primary" onClick={() => navigate(currentGroupRoute ? '/albums' : `/groups/${encodeURIComponent(groupId)}/albums`)}>{copy.albums}</AppActionButton>}
                >
                  <p className="text-sm leading-6 text-slate-600">{copy.albumsHint}</p>
                </ManagementPanelShell>
              ) : null}

              {activeSection === 'events' ? (
                <EventsPanel
                  framed={false}
                  groupId={groupId}
                  isChurch={group.isChurch}
                  events={events}
                  copy={copy}
                  currentGroupRoute={currentGroupRoute}
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
        </ManagementContentCard>
      </div>
  )

  return (
    <>
      {integrated ? managementWorkspace : (
        <AppPageShell
          title={embeddedWorkspace ? localizeText(group?.name, language) || copy.title : copy.title}
          context={workspaceEyebrow || (activeSection === 'group'
            ? (group?.isChurch ? (language === 'zh' ? '教会生活 / 教会管理' : 'Church Life / Church Management') : (language === 'zh' ? '小组生活 / 小组管理' : 'Group Life / Group Management'))
            : `${group?.isChurch ? (language === 'zh' ? '教会管理' : 'Church Management') : (language === 'zh' ? '小组管理' : 'Group Management')} / ${copy[activeSection]}`)}
          subtitle={workspaceDescription || (embeddedWorkspace ? (language === 'zh' ? '在这里维护资料、成员、联系人和组织架构。' : 'Maintain profile, members, contacts, and organization here.') : copy.subtitle)}
          status={group ? <AccessTypeBadge accessType={group.accessType} showProtected /> : undefined}
          backLink={!embeddedWorkspace ? {
            to: workspacePath,
            label: copy.back,
            onClick: (event) => {
              if (!guardGroupProfileNavigation()) event.preventDefault()
            },
          } : undefined}
        >
          {managementWorkspace}
        </AppPageShell>
      )}
      <CreateSubgroupModal
        open={createSubgroupOpen}
        busy={creatingSubgroup}
        error={createSubgroupError}
        onClose={() => {
          if (!creatingSubgroup) setCreateSubgroupOpen(false)
        }}
        onCreate={(name) => {
          handleCreateSubgroup(name).catch(() => setCreateSubgroupError(t('manageAddSubgroupFailed')))
        }}
      />
      {confirmationModal}
    </>
  )
}

export default GroupManageView
