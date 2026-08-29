import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronDown,
  Crown,
  Loader2,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import {
  groupService,
  type AdminGroupOptionDto,
  type AdminMemberDto,
  type AdminMemberFilters,
  type AdminMemberStatusFilter,
  type AdminPagedResultDto,
  type AdminPlatformRoleDto,
  type UpdateAdminMemberProfilePayload,
} from '../../services/groupService'
import { normalizeApiError } from '../../services/http'
import { formatRole, groupNameLabel, parseLocalizedJson, parseUtcDate, readLocalized } from './adminUtils'
import useConfirmation from '../../hooks/useConfirmation'
import { identityAccessService, type ActivationInvitation } from '../../services/identityAccessService'
import PersonApplicationsPanel from './PersonApplicationsPanel'

type MembershipAction = 'approve' | 'reject' | 'deactivate' | 'invite'

type MembersSectionProps = {
  roles: AdminPlatformRoleDto[]
  groups: AdminGroupOptionDto[]
  language: string
  currentMemberId: string
  canManageMemberProfiles: boolean
  canAssignPlatformRoles: boolean
  canManageMembership: boolean
  isSuperAdmin: boolean
  updatingMemberId: string | null
  updatingMemberProfileId: string | null
  updatingMembershipId: string | null
  updateMemberRoles: (member: AdminMemberDto, roleCode: string, enabled: boolean) => Promise<AdminMemberDto>
  updateMemberProfile: (memberId: string, payload: UpdateAdminMemberProfilePayload) => Promise<AdminMemberDto>
  updateMembership: (member: AdminMemberDto, action: MembershipAction) => Promise<void>
}

const initialFilters: AdminMemberFilters = {
  search: '',
  managementOnly: false,
  leadersOnly: false,
  memberStatuses: ['pending', 'active', 'inactive'],
  groupIds: [],
}

const emptyPage: AdminPagedResultDto<AdminMemberDto> = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
}

const roleTone: Record<string, string> = {
  superadmin: 'border-rose-200 bg-rose-50 text-rose-700',
  admin: 'border-amber-200 bg-amber-50 text-amber-800',
  user: 'border-slate-200 bg-slate-50 text-slate-600',
}

const memberState = (member: AdminMemberDto): AdminMemberStatusFilter =>
  member.churchMembershipStatus === 'requested'
    ? 'pending'
    : member.churchMembershipStatus === 'approved'
      ? 'active'
      : 'inactive'

const formatMemberDate = (value: string, isChinese: boolean) =>
  new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parseUtcDate(value))

const MembersSection = ({
  roles,
  groups,
  language,
  currentMemberId,
  canManageMemberProfiles,
  canAssignPlatformRoles,
  canManageMembership,
  isSuperAdmin,
  updatingMemberId,
  updatingMemberProfileId,
  updatingMembershipId,
  updateMemberRoles,
  updateMemberProfile,
  updateMembership,
}: MembersSectionProps) => {
  const isChinese = language === 'zh'
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const copy = isChinese ? {
    title: '成员管理',
    description: '集中查看教会成员资格、管理职能、账号状态和所在小组。',
    search: '按姓名搜索',
    filters: '筛选成员',
    management: '管理人员',
    leader: '组长',
    pending: '待审批',
    active: '活跃',
    inactive: '不活跃',
    groups: '所在组',
    allGroups: '全部小组',
    selectedGroups: (count: number) => `已选 ${count} 个小组`,
    clear: '重置筛选',
    member: '成员',
    membership: '成员资格',
    managementRole: '管理角色',
    account: '账号状态',
    groupColumn: '所在组（不含教会）',
    registered: '已注册',
    guest: '未注册账号',
    noManagementRole: '无管理职能',
    noGroups: '未加入其他小组',
    personalInfo: '个人信息',
    name: '姓名',
    salutation: '称谓',
    gender: '性别',
    activeQuestion: '是否活跃',
    yes: '是',
    no: '否',
    notProvided: '未填写',
    male: '男',
    female: '女',
    other: '其他',
    groupLeader: '组长',
    assistantLeader: '副组长',
    memberRole: '成员',
    roleAssignment: '管理权限',
    roleAssignmentHint: '更改该成员在系统管理中的职能。',
    accountDetails: '账号',
    createdAt: '建立时间',
    updatedAt: '最近更新',
    membershipActions: '成员资格',
    membershipActionsHint: '成员资格以教会组中的状态为准。',
    approve: '批准为活跃成员',
    reject: '拒绝申请',
    deactivate: '设为不活跃',
    invite: '邀请加入教会',
    edit: '修改个人信息',
    editDescription: '这里只修改姓名、称谓和性别；联系方式不会显示在成员管理中。',
    save: '保存修改',
    saving: '保存中…',
    cancel: '取消',
    close: '关闭',
    required: '请填写姓名。',
    loadFailed: '无法读取成员列表。',
    noResults: '没有符合当前条件的成员。',
    loadingResults: '正在更新成员结果…',
    results: (count: number) => `${count} 位成员`,
    previous: '上一页',
    next: '下一页',
    page: (current: number, total: number) => `第 ${current} / ${total || 1} 页`,
    confirmDeactivate: (name: string) => `确定要把 ${name} 设为不活跃吗？这也会移除其子组成员资格。`,
    confirmReject: (name: string) => `确定拒绝 ${name} 的成员申请吗？`,
  } : {
    title: 'Member management',
    description: 'Review church membership, management duties, account state, and group participation in one place.',
    search: 'Search by name',
    filters: 'Filter members',
    management: 'Management staff',
    leader: 'Group leaders',
    pending: 'Pending approval',
    active: 'Active',
    inactive: 'Inactive',
    groups: 'Groups',
    allGroups: 'All groups',
    selectedGroups: (count: number) => `${count} groups selected`,
    clear: 'Reset filters',
    member: 'Member',
    membership: 'Membership',
    managementRole: 'Management roles',
    account: 'Account state',
    groupColumn: 'Groups (church excluded)',
    registered: 'Registered',
    guest: 'Unregistered account',
    noManagementRole: 'No management duties',
    noGroups: 'No other groups',
    personalInfo: 'Personal information',
    name: 'Name',
    salutation: 'Preferred address',
    gender: 'Gender',
    activeQuestion: 'Active',
    yes: 'Yes',
    no: 'No',
    notProvided: 'Not provided',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    groupLeader: 'Group leader',
    assistantLeader: 'Assistant leader',
    memberRole: 'Member',
    roleAssignment: 'Management permissions',
    roleAssignmentHint: 'Change this member’s duties in system management.',
    accountDetails: 'Account',
    createdAt: 'Created',
    updatedAt: 'Last updated',
    membershipActions: 'Membership',
    membershipActionsHint: 'Membership state is based on the church group record.',
    approve: 'Approve as active',
    reject: 'Reject request',
    deactivate: 'Set inactive',
    invite: 'Invite to church',
    edit: 'Edit personal information',
    editDescription: 'Only name, preferred address, and gender are edited here. Contact details are not shown in member management.',
    save: 'Save changes',
    saving: 'Saving…',
    cancel: 'Cancel',
    close: 'Close',
    required: 'Name is required.',
    loadFailed: 'Unable to load members.',
    noResults: 'No members match these filters.',
    loadingResults: 'Updating member results…',
    results: (count: number) => `${count} members`,
    previous: 'Previous',
    next: 'Next',
    page: (current: number, total: number) => `Page ${current} of ${total || 1}`,
    confirmDeactivate: (name: string) => `Set ${name} as inactive? This also removes their subgroup memberships.`,
    confirmReject: (name: string) => `Reject ${name}’s membership request?`,
  }

  const [filters, setFilters] = useState<AdminMemberFilters>(initialFilters)
  const [querySearch, setQuerySearch] = useState('')
  const [requestedPage, setRequestedPage] = useState(1)
  const [page, setPage] = useState<AdminPagedResultDto<AdminMemberDto>>(emptyPage)
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [expandedMemberId, setExpandedMemberId] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editTarget, setEditTarget] = useState<AdminMemberDto | null>(null)
  const [editForm, setEditForm] = useState({ displayName: '', salutation: '', sex: '' })
  const [editError, setEditError] = useState('')
  const [activations, setActivations] = useState<ActivationInvitation[]>([])
  const [activationForm, setActivationForm] = useState({ displayName: '', phoneE164: '', purpose: 'firstActivation', groupId: '', role: 'member' })
  const [activationBusy, setActivationBusy] = useState('')
  const [activationError, setActivationError] = useState('')
  const requestSequence = useRef(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRequestedPage(1)
      setQuerySearch(filters.search.trim())
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [filters.search])

  useEffect(() => {
    const sequence = ++requestSequence.current
    setResultsLoading(true)
    setResultsError('')
    groupService.getAdminMembers({
      ...filters,
      search: querySearch,
      page: requestedPage,
      pageSize: 25,
    }).then((nextPage) => {
      if (sequence !== requestSequence.current) return
      setPage(nextPage)
      setExpandedMemberId((current) => nextPage.items.some((member) => member.id === current) ? current : '')
    }).catch((reason) => {
      if (sequence !== requestSequence.current) return
      setResultsError(normalizeApiError(reason).message || copy.loadFailed)
    }).finally(() => {
      if (sequence === requestSequence.current) setResultsLoading(false)
    })
  }, [copy.loadFailed, filters.groupIds, filters.leadersOnly, filters.managementOnly, filters.memberStatuses, querySearch, refreshVersion, requestedPage])

  useEffect(() => {
    if (!canManageMembership) return
    identityAccessService.listActivations().then(setActivations).catch(() => undefined)
  }, [canManageMembership])

  const groupOptions = useMemo(() => groups
    .filter((group) => !group.isChurch && !group.isClosed)
    .sort((left, right) => groupNameLabel(left, language).localeCompare(groupNameLabel(right, language))), [groups, language])

  const setBooleanFilter = (key: 'managementOnly' | 'leadersOnly', value: boolean) => {
    setRequestedPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const toggleStatus = (status: AdminMemberStatusFilter) => {
    setRequestedPage(1)
    setFilters((current) => {
      const selected = current.memberStatuses.includes(status)
      if (selected && current.memberStatuses.length === 1) return current
      return {
        ...current,
        memberStatuses: selected
          ? current.memberStatuses.filter((item) => item !== status)
          : [...current.memberStatuses, status],
      }
    })
  }

  const toggleGroup = (groupId: string) => {
    setRequestedPage(1)
    setFilters((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }))
  }

  const resetFilters = () => {
    setRequestedPage(1)
    setFilters(initialFilters)
    setQuerySearch('')
  }

  const replaceMember = (updated: AdminMemberDto) => {
    setPage((current) => ({
      ...current,
      items: current.items.map((member) => member.id === updated.id ? updated : member),
    }))
    setEditTarget((current) => current?.id === updated.id ? updated : current)
  }

  const submitProfile = async () => {
    if (!editTarget || updatingMemberProfileId === editTarget.id) return
    const displayName = editForm.displayName.trim()
    if (!displayName) {
      setEditError(copy.required)
      return
    }
    setEditError('')
    try {
      const updated = await updateMemberProfile(editTarget.id, {
        displayName,
        salutation: editForm.salutation.trim() || null,
        sex: editForm.sex || null,
        email: editTarget.email,
        phoneE164: editTarget.phoneE164,
      })
      replaceMember(updated)
      setEditTarget(null)
    } catch (reason) {
      setEditError(normalizeApiError(reason).message)
    }
  }

  const runMembershipAction = async (member: AdminMemberDto, action: MembershipAction) => {
    const name = member.displayName || copy.member
    if (action === 'deactivate' && !await requestConfirmation({
      title: copy.deactivate,
      description: copy.confirmDeactivate(name),
      confirmLabel: copy.deactivate,
      tone: 'danger',
    })) return
    if (action === 'reject' && !await requestConfirmation({
      title: copy.reject,
      description: copy.confirmReject(name),
      confirmLabel: copy.reject,
      tone: 'danger',
    })) return
    await updateMembership(member, action)
    setRefreshVersion((current) => current + 1)
  }

  const createActivation = async () => {
    if (!activationForm.displayName.trim() || !activationForm.phoneE164.trim()) return
    setActivationBusy('create')
    setActivationError('')
    try {
      const created = await identityAccessService.createActivation({
        displayName: activationForm.displayName.trim(),
        phoneE164: activationForm.phoneE164.trim(),
        purpose: activationForm.purpose,
        grants: activationForm.groupId ? [{ groupId: activationForm.groupId, role: activationForm.role }] : [],
      })
      setActivations((current) => [created, ...current])
      setActivationForm({ displayName: '', phoneE164: '', purpose: 'firstActivation', groupId: '', role: 'member' })
    } catch (reason) {
      setActivationError(normalizeApiError(reason).message)
    } finally {
      setActivationBusy('')
    }
  }

  const changeActivation = async (activation: ActivationInvitation, action: 'revoke' | 'resend') => {
    setActivationBusy(activation.id)
    setActivationError('')
    try {
      const result = await identityAccessService.changeActivation(activation.id, action)
      if (typeof result === 'boolean') {
        setActivations((current) => current.map((item) => item.id === activation.id ? { ...item, status: 'revoked' } : item))
      } else {
        setActivations((current) => [result, ...current.map((item) => item.id === activation.id ? { ...item, status: 'revoked' } : item)])
      }
    } catch (reason) {
      setActivationError(normalizeApiError(reason).message)
    } finally {
      setActivationBusy('')
    }
  }

  const roleLabel = (roleCode: string) =>
    readLocalized(roles.find((role) => role.code === roleCode)?.name, language) || formatRole(roleCode)
  const activeRoleCodes = (member: AdminMemberDto) => member.platformRoles.filter((role) => role !== 'user')
  const displayRoleCodes = (member: AdminMemberDto) => activeRoleCodes(member).length ? activeRoleCodes(member) : ['user']
  const displayGender = (value: string | null) => {
    const normalized = value?.trim().toLowerCase()
    if (!normalized) return copy.notProvided
    if (normalized === 'male') return copy.male
    if (normalized === 'female') return copy.female
    if (normalized === 'other') return copy.other
    return value!
  }
  const groupRoleLabel = (role: AdminMemberDto['groups'][number]['role']) =>
    role === 'leader' ? copy.groupLeader : role === 'coLeader' ? copy.assistantLeader : copy.memberRole

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#cadbd4] bg-[#fbfdfc] shadow-[0_18px_55px_rgba(25,63,53,0.09)]">
      <header className="border-b border-[#dce7e2] bg-white px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#21705f]">{isChinese ? '教会名册' : 'Church directory'}</p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{copy.title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#687770]">{copy.description}</p>
          </div>
          <div className="rounded-2xl bg-[#e5f1ec] px-4 py-2 text-sm font-black text-[#176b5a]">{copy.results(page.totalCount)}</div>
        </div>
      </header>

      {canManageMembership ? (
        <details className="border-b border-[#dce7e2] bg-[#fffaf4] px-4 py-4 sm:px-6">
          <summary className="cursor-pointer list-none text-sm font-black text-[#18332d] marker:hidden">{isChinese ? '预登记与激活邀请' : 'Pre-registration and activation invitations'}</summary>
          <p className="mt-2 text-xs leading-5 text-[#687770]">{isChinese ? '预登记不会自动授予权限；短信提供方未配置时，邀请会明确停留在待交付状态。' : 'Pre-registration never grants permissions automatically. Without a configured message provider, delivery remains explicitly pending.'}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <label className="block text-xs font-bold text-[#62736c]">{copy.name}<input className="alife-input mt-1" maxLength={150} value={activationForm.displayName} onChange={(event) => setActivationForm((current) => ({ ...current, displayName: event.target.value }))} /></label>
            <label className="block text-xs font-bold text-[#62736c]">{isChinese ? '规范化手机号' : 'Phone number'}<input className="alife-input mt-1" type="tel" placeholder="+64…" value={activationForm.phoneE164} onChange={(event) => setActivationForm((current) => ({ ...current, phoneE164: event.target.value }))} /></label>
            <label className="block text-xs font-bold text-[#62736c]">{isChinese ? '邀请用途' : 'Invitation purpose'}<select className="alife-input mt-1" value={activationForm.purpose} onChange={(event) => setActivationForm((current) => ({ ...current, purpose: event.target.value }))}><option value="firstActivation">{isChinese ? '首次激活' : 'First activation'}</option><option value="passkeyRecovery">{isChinese ? 'Passkey 恢复' : 'Passkey recovery'}</option></select></label>
            <label className="block text-xs font-bold text-[#62736c]">{isChinese ? '可选小组授权' : 'Optional group grant'}<select className="alife-input mt-1" value={activationForm.groupId} onChange={(event) => setActivationForm((current) => ({ ...current, groupId: event.target.value }))}><option value="">{isChinese ? '仅教会成员' : 'Church member only'}</option>{groupOptions.map((group) => <option key={group.id} value={group.id}>{groupNameLabel(group, language)}</option>)}</select></label>
            <label className="block text-xs font-bold text-[#62736c]">{isChinese ? '暂存角色' : 'Staged role'}<select className="alife-input mt-1" disabled={!activationForm.groupId} value={activationForm.role} onChange={(event) => setActivationForm((current) => ({ ...current, role: event.target.value }))}><option value="member">{copy.memberRole}</option><option value="coLeader">{copy.assistantLeader}</option><option value="leader">{copy.groupLeader}</option></select></label>
          </div>
          <button className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#176b5a] px-4 py-2 text-sm font-black text-white disabled:opacity-50" type="button" disabled={activationBusy === 'create' || !activationForm.displayName.trim() || !activationForm.phoneE164.trim()} onClick={() => void createActivation()}><Send className="mr-2 h-4 w-4" />{isChinese ? '建立并尝试交付' : 'Create and attempt delivery'}</button>
          {activationError ? <p className="mt-3 text-sm text-rose-700" role="alert">{activationError}</p> : null}
          {activations.length ? <div className="mt-4 space-y-2">{activations.slice(0, 10).map((activation) => <div key={activation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3d8ca] bg-white p-3"><div><p className="text-sm font-bold text-[#18332d]">{activation.displayName} · {activation.maskedPhone}</p><p className="mt-1 text-xs text-[#687770]">{activation.status} · {activation.deliveryStatus} · {new Date(activation.expiresUtc).toLocaleString()}</p>{activation.previewUrl ? <a className="mt-1 block break-all text-xs font-semibold text-[#176b5a] underline" href={activation.previewUrl}>{isChinese ? '开发预览链接' : 'Development preview link'}</a> : null}</div><div className="flex gap-2"><button className="min-h-9 rounded-lg border border-[#cbdad4] px-3 text-xs font-bold" type="button" disabled={Boolean(activationBusy)} onClick={() => void changeActivation(activation, 'resend')}>{isChinese ? '重发' : 'Resend'}</button><button className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700" type="button" disabled={Boolean(activationBusy) || activation.status === 'used' || activation.status === 'revoked'} onClick={() => void changeActivation(activation, 'revoke')}>{isChinese ? '撤销' : 'Revoke'}</button></div></div>)}</div> : null}
        </details>
      ) : null}

      {canManageMembership ? <PersonApplicationsPanel language={language} /> : null}

      <div className="border-b border-[#dce7e2] bg-[#f1f6f3] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <label className="block min-w-0 flex-1 xl:max-w-xs">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-[#62736c]">{copy.search}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9992]" aria-hidden="true" />
              <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} className="min-h-11 w-full rounded-xl border border-[#cbdad4] bg-white pl-9 pr-3 text-sm text-[#18332d] outline-none transition focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]" placeholder={copy.search} />
            </span>
          </label>

          <fieldset className="flex min-w-0 flex-wrap gap-2">
            <legend className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-[#62736c]">{copy.filters}</legend>
            <FilterCheck checked={filters.managementOnly} label={copy.management} onChange={(checked) => setBooleanFilter('managementOnly', checked)} />
            <FilterCheck checked={filters.leadersOnly} label={copy.leader} onChange={(checked) => setBooleanFilter('leadersOnly', checked)} />
            <FilterCheck checked={filters.memberStatuses.includes('pending')} label={copy.pending} tone="amber" onChange={() => toggleStatus('pending')} />
            <FilterCheck checked={filters.memberStatuses.includes('active')} label={copy.active} tone="green" onChange={() => toggleStatus('active')} />
            <FilterCheck checked={filters.memberStatuses.includes('inactive')} label={copy.inactive} onChange={() => toggleStatus('inactive')} />
          </fieldset>

          <div className="flex flex-wrap items-end gap-2 xl:ml-auto">
            <details className="group relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[#cbdad4] bg-white px-3 text-sm font-bold text-[#31544b] outline-none transition hover:bg-[#f7faf8] focus-visible:ring-4 focus-visible:ring-[#dcece6] [&::-webkit-details-marker]:hidden">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                {filters.groupIds.length ? copy.selectedGroups(filters.groupIds.length) : copy.allGroups}
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 max-h-72 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-[#cbdad4] bg-white p-2 shadow-2xl">
                <p className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-wide text-[#62736c]">{copy.groups}</p>
                {groupOptions.length ? groupOptions.map((group) => (
                  <label key={group.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-[#31544b] hover:bg-[#edf5f1]">
                    <input type="checkbox" checked={filters.groupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} className="h-4 w-4 rounded border-[#b8cbc3] text-[#176b5a] focus:ring-[#7ab3a4]" />
                    <span>{groupNameLabel(group, language)}</span>
                  </label>
                )) : <p className="px-2 py-3 text-sm text-[#7a8782]">{copy.noGroups}</p>}
              </div>
            </details>
            <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl border border-[#cbdad4] bg-white px-3 text-sm font-bold text-[#60716a] transition hover:bg-[#f7faf8]">{copy.clear}</button>
          </div>
        </div>
      </div>

      <div className="relative" aria-busy={resultsLoading}>
        {resultsLoading ? <div className="absolute inset-x-0 top-0 z-20 flex h-1 overflow-hidden bg-[#dceae4]"><span className="w-1/3 animate-pulse bg-[#21705f]" /></div> : null}
        <div className="hidden grid-cols-[minmax(15rem,1.5fr)_minmax(8rem,.75fr)_minmax(11rem,1fr)_minmax(8rem,.72fr)_minmax(12rem,1.2fr)_2.5rem] gap-4 border-b border-[#dce7e2] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#718079] lg:grid">
          <span>{copy.member}</span><span>{copy.membership}</span><span>{copy.managementRole}</span><span>{copy.account}</span><span>{copy.groupColumn}</span><span />
        </div>

        {resultsError ? <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{copy.loadFailed} {resultsError}</div> : null}
        {!resultsError && !page.items.length && !resultsLoading ? <p className="px-5 py-12 text-center text-sm font-semibold text-[#718079]">{copy.noResults}</p> : null}

        <div className={`divide-y divide-[#dce7e2] transition-opacity ${resultsLoading && page.items.length ? 'opacity-55' : 'opacity-100'}`}>
          {page.items.map((member) => {
            const expanded = expandedMemberId === member.id
            const name = member.displayName || copy.notProvided
            const state = memberState(member)
            const groupSummary = member.groups.map((group) => parseLocalizedJson(group.nameJson, language)).filter(Boolean)
            return (
              <article key={member.id} className="bg-white transition-colors focus-within:bg-[#fbfdfc]">
                <button type="button" aria-expanded={expanded} aria-controls={`member-${member.id}`} onClick={() => setExpandedMemberId(expanded ? '' : member.id)} className="grid w-full gap-3 px-4 py-4 text-left outline-none transition hover:bg-[#f5f9f7] focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#b9d9cf] sm:px-5 lg:grid-cols-[minmax(15rem,1.5fr)_minmax(8rem,.75fr)_minmax(11rem,1fr)_minmax(8rem,.72fr)_minmax(12rem,1.2fr)_2.5rem] lg:items-center lg:gap-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#173f36] text-xs font-black text-white">{name.trim().slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-black text-[#18332d]">{name}</span>{member.id === currentMemberId ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700">{isChinese ? '你' : 'You'}</span> : null}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[#718079]">{member.salutation || displayGender(member.sex)}</span>
                    </span>
                  </span>
                  <span><StatusPill state={state} labels={copy} /></span>
                  <span className="flex flex-wrap gap-1.5">{displayRoleCodes(member).slice(0, 2).map((roleCode) => <RolePill key={roleCode} roleCode={roleCode} label={roleLabel(roleCode)} />)}{displayRoleCodes(member).length > 2 ? <span className="text-xs font-bold text-[#718079]">+{displayRoleCodes(member).length - 2}</span> : null}</span>
                  <span className={`text-xs font-black ${member.isRegistered ? 'text-[#176b5a]' : 'text-[#7a8782]'}`}>{member.isRegistered ? copy.registered : copy.guest}</span>
                  <span className="min-w-0 truncate text-xs font-semibold text-[#60716a]">{groupSummary.length ? groupSummary.join(' · ') : copy.noGroups}</span>
                  <span className="flex justify-end"><ChevronDown className={`h-5 w-5 text-[#718079] transition-transform ${expanded ? 'rotate-180 text-[#176b5a]' : ''}`} aria-hidden="true" /></span>
                </button>

                {expanded ? (
                  <div id={`member-${member.id}`} className="border-t border-[#e3ebe7] bg-[#f4f8f6] px-4 py-5 sm:px-6">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(16rem,.8fr)_minmax(17rem,.9fr)]">
                      <section className="rounded-2xl border border-[#d6e3dd] bg-white p-4">
                        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-[#18332d]">{copy.personalInfo}</h3><p className="mt-1 text-xs text-[#718079]">{copy.editDescription}</p></div>{canManageMemberProfiles ? <button type="button" onClick={() => { setEditTarget(member); setEditForm({ displayName: member.displayName || '', salutation: member.salutation || '', sex: member.sex || '' }); setEditError('') }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#cbdad4] text-[#176b5a] transition hover:bg-[#edf5f1]" aria-label={copy.edit} title={copy.edit}><Pencil className="h-4 w-4" /></button> : null}</div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                          <InfoField label={copy.name} value={name} />
                          <InfoField label={copy.salutation} value={member.salutation || copy.notProvided} />
                          <InfoField label={copy.gender} value={displayGender(member.sex)} />
                          <InfoField label={copy.activeQuestion} value={state === 'active' ? copy.yes : copy.no} accent={state === 'active'} />
                        </dl>
                      </section>

                      <section className="rounded-2xl border border-[#d6e3dd] bg-white p-4">
                        <h3 className="text-sm font-black text-[#18332d]">{copy.accountDetails}</h3>
                        <div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.isRegistered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{member.isRegistered ? copy.registered : copy.guest}</span>{displayRoleCodes(member).map((roleCode) => <RolePill key={roleCode} roleCode={roleCode} label={roleLabel(roleCode)} />)}</div>
                        <dl className="mt-4 space-y-3"><InfoField label={copy.createdAt} value={formatMemberDate(member.createdUtc, isChinese)} /><InfoField label={copy.updatedAt} value={formatMemberDate(member.updatedUtc, isChinese)} /></dl>
                      </section>

                      <section className="rounded-2xl border border-[#d6e3dd] bg-white p-4">
                        <h3 className="text-sm font-black text-[#18332d]">{copy.groups}</h3>
                        <div className="mt-3 flex flex-wrap gap-2">{member.groups.length ? member.groups.map((group) => <span key={group.id} className="inline-flex items-center gap-1.5 rounded-xl bg-[#edf5f1] px-2.5 py-1.5 text-xs font-black text-[#31544b]">{group.role === 'leader' ? <Crown className="h-3.5 w-3.5 text-amber-600" /> : null}{parseLocalizedJson(group.nameJson, language)}<span className="font-semibold text-[#718079]">· {groupRoleLabel(group.role)}</span></span>) : <p className="text-sm text-[#718079]">{copy.noGroups}</p>}</div>
                      </section>
                    </div>

                    {(canAssignPlatformRoles || canManageMembership) ? <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {canAssignPlatformRoles ? <section className="rounded-2xl border border-[#d6e3dd] bg-white p-4"><h3 className="text-sm font-black text-[#18332d]">{copy.roleAssignment}</h3><p className="mt-1 text-xs text-[#718079]">{copy.roleAssignmentHint}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{roles.filter((role) => role.code !== 'user' && role.code !== 'superadmin').map((role) => { const checked = member.platformRoles.includes(role.code); const protectedRole = role.code === 'admin'; const disabled = member.id === currentMemberId || updatingMemberId === member.id || (!isSuperAdmin && protectedRole); return <label key={role.code} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-[#9cc6b9] bg-[#edf5f1]' : 'border-[#d6e3dd]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#9cc6b9]'}`}><span className="font-bold text-[#31544b]">{readLocalized(role.name, language) || formatRole(role.code)}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => updateMemberRoles(member, role.code, event.target.checked).then(replaceMember).catch(() => undefined)} className="h-4 w-4 rounded border-[#b8cbc3] text-[#176b5a] focus:ring-[#7ab3a4]" /></label> })}</div>{updatingMemberId === member.id ? <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[#176b5a]"><Loader2 className="h-3.5 w-3.5 animate-spin" />{copy.loadingResults}</p> : null}</section> : null}
                      {canManageMembership ? <section className="rounded-2xl border border-[#d6e3dd] bg-white p-4"><h3 className="text-sm font-black text-[#18332d]">{copy.membershipActions}</h3><p className="mt-1 text-xs text-[#718079]">{copy.membershipActionsHint}</p><div className="mt-4 flex flex-wrap gap-2">{state === 'pending' ? <><ActionButton busy={updatingMembershipId === member.id} onClick={() => runMembershipAction(member, 'approve').catch(() => undefined)}>{copy.approve}</ActionButton><ActionButton danger busy={updatingMembershipId === member.id} onClick={() => runMembershipAction(member, 'reject').catch(() => undefined)}>{copy.reject}</ActionButton></> : state === 'active' ? <ActionButton danger busy={updatingMembershipId === member.id} disabled={member.id === currentMemberId || member.churchMembershipRole === 'leader'} onClick={() => runMembershipAction(member, 'deactivate').catch(() => undefined)}>{copy.deactivate}</ActionButton> : <ActionButton busy={updatingMembershipId === member.id} disabled={!member.isRegistered} onClick={() => runMembershipAction(member, member.churchMembershipStatus ? 'approve' : 'invite').catch(() => undefined)}>{member.churchMembershipStatus ? copy.approve : copy.invite}</ActionButton>}</div></section> : null}
                    </div> : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>

        {resultsLoading && !page.items.length ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-bold text-[#60716a]"><Loader2 className="h-5 w-5 animate-spin" />{copy.loadingResults}</div> : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dce7e2] bg-[#f7faf8] px-4 py-3 text-xs font-bold text-[#60716a] sm:px-6">
        <span>{copy.page(page.page, page.totalPages)}</span>
        <div className="flex gap-2"><button type="button" disabled={resultsLoading || page.page <= 1} onClick={() => setRequestedPage(page.page - 1)} className="min-h-9 rounded-xl border border-[#cbdad4] bg-white px-3 disabled:opacity-45">{copy.previous}</button><button type="button" disabled={resultsLoading || page.totalPages === 0 || page.page >= page.totalPages} onClick={() => setRequestedPage(page.page + 1)} className="min-h-9 rounded-xl border border-[#cbdad4] bg-white px-3 disabled:opacity-45">{copy.next}</button></div>
      </footer>

      {editTarget ? <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-24 pt-6 backdrop-blur-sm sm:items-center sm:justify-center sm:py-6"><button type="button" className="absolute inset-0" aria-label={copy.close} disabled={updatingMemberProfileId === editTarget.id} onClick={() => setEditTarget(null)} /><section className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-member-title"><header className="flex items-start justify-between gap-4 border-b border-[#dce7e2] bg-[#edf5f1] px-5 py-4"><div><h2 id="edit-member-title" className="text-lg font-black text-[#18332d]">{copy.edit}</h2><p className="mt-1 text-sm leading-6 text-[#60716a]">{copy.editDescription}</p></div><button type="button" onClick={() => setEditTarget(null)} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#60716a] hover:bg-white" aria-label={copy.close}><X className="h-5 w-5" /></button></header><form className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); submitProfile().catch(() => undefined) }}><FormField label={copy.name}><input autoFocus required maxLength={150} value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} className="min-h-11 w-full rounded-xl border border-[#cbdad4] bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]" /></FormField><FormField label={copy.salutation}><input maxLength={100} value={editForm.salutation} onChange={(event) => setEditForm((current) => ({ ...current, salutation: event.target.value }))} className="min-h-11 w-full rounded-xl border border-[#cbdad4] bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]" /></FormField><FormField label={copy.gender}><select value={editForm.sex} onChange={(event) => setEditForm((current) => ({ ...current, sex: event.target.value }))} className="min-h-11 w-full rounded-xl border border-[#cbdad4] bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]"><option value="">{copy.notProvided}</option><option value="Male">{copy.male}</option><option value="Female">{copy.female}</option><option value="Other">{copy.other}</option></select></FormField>{editError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{editError}</p> : null}<div className="flex justify-end gap-2 border-t border-[#e3ebe7] pt-4"><button type="button" disabled={updatingMemberProfileId === editTarget.id} onClick={() => setEditTarget(null)} className="min-h-10 rounded-xl border border-[#cbdad4] px-4 text-sm font-black text-[#60716a]">{copy.cancel}</button><button type="submit" disabled={updatingMemberProfileId === editTarget.id || !editForm.displayName.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white disabled:opacity-55">{updatingMemberProfileId === editTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{updatingMemberProfileId === editTarget.id ? copy.saving : copy.save}</button></div></form></section></div> : null}
      {confirmationModal}
    </section>
  )
}

const FilterCheck = ({ checked, label, onChange, tone = 'slate' }: { checked: boolean; label: string; onChange: (checked: boolean) => void; tone?: 'slate' | 'amber' | 'green' }) => {
  const activeTone = tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-800' : tone === 'green' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-[#91bbae] bg-white text-[#31544b]'
  return <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${checked ? activeTone : 'border-[#cbdad4] bg-white text-[#718079]'}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-[#b8cbc3] text-[#176b5a] focus:ring-[#7ab3a4]" />{label}</label>
}

const StatusPill = ({ state, labels }: { state: AdminMemberStatusFilter; labels: { pending: string; active: string; inactive: string } }) => {
  const style = state === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-800' : state === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${style}`}>{labels[state]}</span>
}

const RolePill = ({ roleCode, label }: { roleCode: string; label: string }) => <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black ${roleTone[roleCode] || 'border-teal-200 bg-teal-50 text-teal-800'}`}>{roleCode === 'user' ? <UserRoundCheck className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}{label}</span>

const InfoField = ({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) => <div><dt className="text-[10px] font-black uppercase tracking-wide text-[#829089]">{label}</dt><dd className={`mt-1 text-sm font-bold ${accent ? 'text-[#176b5a]' : 'text-[#31544b]'}`}>{value}</dd></div>

const ActionButton = ({ children, onClick, danger = false, busy = false, disabled = false }: { children: string; onClick: () => void; danger?: boolean; busy?: boolean; disabled?: boolean }) => <button type="button" disabled={disabled || busy} onClick={onClick} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${danger ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-[#176b5a] text-white hover:bg-[#0f5447]'}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{children}</button>

const FormField = ({ label, children }: { label: string; children: ReactNode }) => <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#60716a]">{label}</span>{children}</label>

export default MembersSection
