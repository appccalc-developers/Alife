import { adminViewText } from '../i18n/adminView.ts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import {
  groupService,
  type AdminGroupOptionDto,
  type AdminMemberDto,
  type AdminNotificationDto,
  type AdminPagedResultDto,
  type AdminPlatformRoleDto,
  type UpdateAdminMemberProfilePayload,
  type AuditLogDto,
  type VisitContactRequestDto,
  type VisitContactRequestStatus,
} from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { aiTranslationService } from '../services/aiTranslationService'
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import { invalidateCurrentTasks } from '../hooks/useCurrentTasks'
import type { MissingTranslatableField } from '../utils/bilingualValidation'
import { VisitRequestsSection } from './admin/VisitRequestsSection'
import { MessagesSection } from './admin/MessagesSection'
import { RolesSection } from './admin/RolesSection'
import { LogsSection } from './admin/LogsSection'
import { PlatformFilesSection } from './admin/FilesSection'
import MembersSection from './admin/MembersSection'
import SystemManagementFrame, { systemManagementIcons, type SystemManagementIconKey } from './admin/SystemManagementFrame'
import AppPageShell from '../components/layout/AppPageShell'
import type { GroupDto } from '../types'

type AdminSection = 'overview' | 'users' | 'roles' | 'logs' | 'messages' | 'visitRequests' | 'files'
type SystemManagementAreaConfig = { key: string; label: string; description: string; iconKey: SystemManagementIconKey; to: string }
type MessageTranslationDirection = 'zh-en' | 'en-zh'
type LocalText = { en: string; zh: string }
type LabelFn = (key: string, values?: Record<string, string | number>) => string

const labels: Record<string, LocalText> = adminViewText.labels satisfies Record<string, LocalText>

const emptyPage = <T,>(pageSize = 25): AdminPagedResultDto<T> => ({ items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 })
const overviewActivityPageSize = 50
const roleCodePattern = /^[a-z][a-z0-9._-]{1,49}$/
const normalizeRoleCodeInput = (value: string) => value.trim().toLowerCase()
const canonicalRoleCode = (value: string) => {
  const normalized = normalizeRoleCodeInput(value)
  if (normalized === 'super_admin' || normalized === 'super-admin') return 'superadmin'
  if (normalized === 'member') return 'user'
  return normalized
}

const runQuietly = async (...tasks: Array<Promise<unknown>>) => {
  await Promise.allSettled(tasks)
}
const sectionFromPath = (pathname: string): AdminSection => pathname.endsWith('/users') ? 'users' : pathname.endsWith('/roles') ? 'roles' : pathname.endsWith('/logs') ? 'logs' : pathname.endsWith('/messages') ? 'messages' : pathname.endsWith('/visit-requests') ? 'visitRequests' : pathname.endsWith('/files') ? 'files' : 'overview'

type AdminViewProps = {
  embedded?: boolean
  sectionOverride?: AdminSection
}

const AdminView = ({ embedded = false, sectionOverride }: AdminViewProps = {}) => {
  const t = useUiText()
  const { language, me, hasAdminPermission, canManageGroup } = useAuthStore()
  const routeSection = sectionFromPath(useLocation().pathname)
  const section = sectionOverride ?? routeSection
  const l = useCallback<LabelFn>((key, values) => {
    const template = labels[key][language] || labels[key].en
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`))
  }, [language])
  const formatLoadError = useCallback(async (reason: unknown, source?: string) => {
    const apiError = normalizeApiError(reason)
    const sourceLabel = source ? ` [${source}]` : ''
    const status = apiError.status ? ` (${apiError.status})` : ''
    const hint = apiError.message === 'Network Error' ? ` ${l('networkHint')}` : ''
    return `${l('loadFailed')}${sourceLabel}${status}: ${apiError.message}.${hint}`
  }, [l])
  const formatActionError = useCallback((reason: unknown, fallback: string) => {
    const apiError = normalizeApiError(reason)
    const status = apiError.status ? ` (${apiError.status})` : ''
    const message = apiError.message && apiError.message !== 'Unknown error.' ? apiError.message : ''
    return message ? `${fallback}${status}: ${message}` : fallback
  }, [])

  const [roles, setRoles] = useState<AdminPlatformRoleDto[]>([])
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [groups, setGroups] = useState<AdminGroupOptionDto[]>([])
  const [members, setMembers] = useState(emptyPage<AdminMemberDto>())
  const [logs, setLogs] = useState(emptyPage<AuditLogDto>())
  const [messages, setMessages] = useState(emptyPage<AdminNotificationDto>())
  const [visitRequests, setVisitRequests] = useState(emptyPage<VisitContactRequestDto>())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [updatingMemberProfileId, setUpdatingMemberProfileId] = useState<string | null>(null)
  const [updatingMembershipId, setUpdatingMembershipId] = useState<string | null>(null)
  const [updatingRolePermissionId, setUpdatingRolePermissionId] = useState<number | null>(null)
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null)
  const [creatingRole, setCreatingRole] = useState(false)
  const [messageAiDirection, setMessageAiDirection] = useState<MessageTranslationDirection | null>(null)
  const [logFilters, setLogFilters] = useState({ search: '', action: '', entityType: '', fromUtc: '', toUtc: '' })
  const [messageFilters, setMessageFilters] = useState({ search: '', actionType: '', status: '' })
  const [visitRequestFilters, setVisitRequestFilters] = useState({ search: '', status: '' })
  const [updatingVisitRequestId, setUpdatingVisitRequestId] = useState<string | null>(null)
  const [sendForm, setSendForm] = useState({
    scope: 'platform' as 'platform' | 'group' | 'member' | 'role',
    groupId: '',
    recipientMemberId: '',
    roleCodes: [] as string[],
    actionType: 'platform.message',
    titleEn: adminViewText.sendFormSetSendForm.en,
    titleZh: adminViewText.sendFormSetSendForm.zh,
    bodyEn: adminViewText.sendFormSetSendForm.en,
    bodyZh: adminViewText.sendFormSetSendForm.zh,
  })
  const [roleForm, setRoleForm] = useState({
    code: '',
    nameEn: adminViewText.sendFormSetSendForm.en,
    nameZh: adminViewText.sendFormSetSendForm.zh,
    permissionCodes: [] as string[],
  })

  const isSuperAdmin = me?.platformRole === 'superadmin'
  const roleOptions = useMemo(() => {
    const seeded = roles.length ? roles : [
      { id: 0, code: 'user', name: { ...adminViewText.userName }, level: 0, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
      { id: 10, code: 'admin', name: { ...adminViewText.adminName }, level: 10, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
      { id: 100, code: 'superadmin', name: { ...adminViewText.superadminName }, level: 100, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
    ]
    return seeded.slice().sort((a, b) => a.level - b.level)
  }, [roles])
  const normalizedRoleCode = useMemo(() => normalizeRoleCodeInput(roleForm.code), [roleForm.code])
  const canonicalNewRoleCode = useMemo(() => canonicalRoleCode(roleForm.code), [roleForm.code])
  const roleCodeValidation = useMemo(() => {
    if (!normalizedRoleCode) return l('roleCodeRequired')
    if (!roleCodePattern.test(normalizedRoleCode)) return l('roleCodeFormatError')
    if (['user', 'admin', 'superadmin'].includes(canonicalNewRoleCode)) return l('roleCodeReserved')
    if (roleOptions.some((role) => role.code === canonicalNewRoleCode)) return l('roleCodeDuplicate')
    return ''
  }, [canonicalNewRoleCode, l, normalizedRoleCode, roleOptions])
  const roleCodeFeedback = roleCodeValidation || l('roleCodeValid')
  const roleNamesValidation = roleForm.nameEn.trim() && roleForm.nameZh.trim() ? '' : l('roleNamesRequired')
  const canSubmitCreateRole = !creatingRole && !roleCodeValidation && !roleNamesValidation

  const loadRolesAndGroups = useCallback(async () => {
    const [nextRoles, nextGroups] = await Promise.all([
      groupService.getAdminPlatformRoles(),
      groupService.getAdminGroups({ pageSize: 100 }),
    ])
    setRoles(nextRoles)
    setGroups(nextGroups.items)
  }, [])

  const loadChurch = useCallback(async () => {
    setChurch(await groupService.getChurch())
  }, [])

  const loadUsers = useCallback(async (page = members.page, pageSize = section === 'overview' ? 100 : 25) => {
    setLoading(true)
    setError('')
    try {
      setMembers(await groupService.getAdminMembers({ page, pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'members'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, members.page, section])

  const loadLogs = useCallback(async (page = logs.page, pageSize = logs.pageSize) => {
    setLoading(true)
    setError('')
    try {
      setLogs(await groupService.getAuditLogs({ ...logFilters, page, pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'audit-logs'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, logFilters, logs.page, logs.pageSize])

  const loadMessages = useCallback(async (page = messages.page) => {
    setLoading(true)
    setError('')
    try {
      setMessages(await groupService.getAdminMessages({ ...messageFilters, page, pageSize: messages.pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'messages'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, messageFilters, messages.page, messages.pageSize])

  const loadVisitRequests = useCallback(async (page = visitRequests.page) => {
    setLoading(true)
    setError('')
    try {
      setVisitRequests(await groupService.getVisitContactRequests({ ...visitRequestFilters, page, pageSize: visitRequests.pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'visit-contact-requests'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, visitRequestFilters, visitRequests.page, visitRequests.pageSize])

  const refreshCurrent = useCallback(async () => {
    setMessage('')
    if (section === 'users') await loadChurch()
    else if (section === 'logs') await loadLogs(logs.page, 25)
    else if (section === 'messages') await loadMessages()
    else if (section === 'visitRequests') await loadVisitRequests()
    else {
      const tasks: Promise<unknown>[] = []
      if (hasAdminPermission('admin.messages.manage')) tasks.push(loadMessages(1))
      await Promise.all(tasks)
    }
    setMessage(l('refreshed'))
  }, [hasAdminPermission, l, loadChurch, loadLogs, loadMessages, loadVisitRequests, logs.page, section])

  useEffect(() => {
    if (!['users', 'roles', 'messages'].includes(section)) return
    loadRolesAndGroups().catch((reason) => { formatLoadError(reason).then(setError).catch(() => setError(l('loadFailed'))) })
  }, [formatLoadError, l, loadRolesAndGroups, section])

  useEffect(() => {
    if (section === 'users') loadChurch().catch(() => undefined)
    if (section === 'roles') loadRolesAndGroups().catch(() => undefined)
    if (section === 'logs') loadLogs(1, 25).catch(() => undefined)
    if (section === 'messages') Promise.all([loadMessages(1), loadUsers(1)]).catch(() => undefined)
    if (section === 'visitRequests') loadVisitRequests(1).catch(() => undefined)
    if (section === 'overview') {
      const tasks: Promise<unknown>[] = []
      if (hasAdminPermission('admin.messages.manage')) tasks.push(loadMessages(1))
      Promise.all(tasks).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  const syncSermons = async () => {
    setSyncing(true)
    setError('')
    setMessage('')
    try {
      const response = await groupService.syncSermons()
      setMessage(response.message || t('sermonSyncTriggered'))
    } catch {
      setError(t('sermonSyncFailed'))
    } finally {
      setSyncing(false)
    }
  }

  const updateMemberRoles = async (member: AdminMemberDto, roleCode: string, enabled: boolean) => {
    if (member.id === me?.id) throw new Error(l('cannotChangeOwnRole'))
    if (roleCode === 'superadmin') throw new Error(l('cannotAssignSuperAdmin'))
    const currentRoles = member.platformRoles.filter((role) => role !== 'user')
    const roleCodes = enabled
      ? Array.from(new Set([...currentRoles, roleCode]))
      : currentRoles.filter((role) => role !== roleCode)
    if (currentRoles.length === roleCodes.length && currentRoles.every((role) => roleCodes.includes(role))) return member
    setUpdatingMemberId(member.id)
    setError('')
    setMessage('')
    try {
      const updated = await groupService.setMemberPlatformRoles(member.id, roleCodes)
      setMembers((current) => ({
        ...current,
        items: current.items.map((item) => item.id === updated.id ? updated : item),
      }))
      setMessage(l('roleUpdated'))
      await runQuietly(loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
      return updated
    } catch (reason) {
      setError(formatActionError(reason, l('roleUpdateFailed')))
      throw reason
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const updateMemberProfile = async (memberId: string, payload: UpdateAdminMemberProfilePayload) => {
    setUpdatingMemberProfileId(memberId)
    setError('')
    setMessage('')
    try {
      const updated = await groupService.updateAdminMemberProfile(memberId, payload)
      setMembers((current) => ({
        ...current,
        items: current.items.map((member) => member.id === updated.id ? updated : member),
      }))
      setMessage(l('memberUpdated'))
      await runQuietly(loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
      return updated
    } catch (reason) {
      setError(formatActionError(reason, l('memberUpdateFailed')))
      throw reason
    } finally {
      setUpdatingMemberProfileId(null)
    }
  }

  const updateChurchMembership = async (member: AdminMemberDto, action: 'approve' | 'reject' | 'deactivate' | 'invite') => {
    if (!church) throw new Error(language === 'zh' ? adminViewText.churchDataIsUnavailable.zh : adminViewText.churchDataIsUnavailable.en)
    setUpdatingMembershipId(member.id)
    setError('')
    setMessage('')
    try {
      if (action === 'approve') await groupService.approveMember(church.id, { memberId: member.id }, me?.id)
      if (action === 'reject') await groupService.rejectMember(church.id, { memberId: member.id }, me?.id)
      if (action === 'deactivate') await groupService.kickMember(church.id, { memberId: member.id }, me?.id)
      if (action === 'invite') await groupService.inviteMemberById(church.id, member.id, me?.id)
      setMessage(l('membershipUpdated'))
    } catch (reason) {
      setError(formatActionError(reason, l('membershipUpdateFailed')))
      throw reason
    } finally {
      setUpdatingMembershipId(null)
    }
  }

  const updateRolePermissions = async (role: AdminPlatformRoleDto, permissionCode: string, enabled: boolean) => {
    if (!role.canEditPermissions) return
    const permissionCodes = enabled
      ? Array.from(new Set([...role.permissions, permissionCode]))
      : role.permissions.filter((code) => code !== permissionCode)
    setUpdatingRolePermissionId(role.id)
    setError('')
    setMessage('')
    try {
      const updatedRole = await groupService.updatePlatformRolePermissions(role.id, permissionCodes)
      setRoles((current) => current.map((item) => item.id === updatedRole.id ? updatedRole : item))
      setMessage(l('rolePermissionsUpdated'))
      await runQuietly(loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
    } catch (reason) {
      setError(formatActionError(reason, l('rolePermissionsUpdateFailed')))
    } finally {
      setUpdatingRolePermissionId(null)
    }
  }

  const createRole = async () => {
    if (roleCodeValidation || roleNamesValidation) {
      setError(roleCodeValidation || roleNamesValidation)
      return false
    }
    setCreatingRole(true)
    setError('')
    setMessage('')
    try {
      const role = await groupService.createPlatformRole(roleForm)
      setRoles((current) => [...current, role].sort((a, b) => a.level - b.level || a.code.localeCompare(b.code)))
      setRoleForm({ code: '', nameEn: adminViewText.sendFormSetSendForm.en, nameZh: adminViewText.sendFormSetSendForm.zh, permissionCodes: [] })
      setMessage(l('roleCreated'))
      await runQuietly(loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
      return true
    } catch (reason) {
      setError(formatActionError(reason, l('roleCreateFailed')))
      return false
    } finally {
      setCreatingRole(false)
    }
  }

  const deleteRole = async (role: AdminPlatformRoleDto) => {
    if (!role.canDelete) return
    setDeletingRoleId(role.id)
    setError('')
    setMessage('')
    try {
      await groupService.deletePlatformRole(role.id)
      setRoles((current) => current.filter((item) => item.id !== role.id))
      setMessage(l('roleDeleted'))
      await runQuietly(loadUsers(1), loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
    } catch (reason) {
      setError(formatActionError(reason, l('roleDeleteFailed')))
    } finally {
      setDeletingRoleId(null)
    }
  }

  const updateVisitRequestStatus = async (item: VisitContactRequestDto, status: VisitContactRequestStatus) => {
    if (item.status === status) return
    setUpdatingVisitRequestId(item.id)
    setError('')
    setMessage('')
    try {
      const updated = await groupService.updateVisitContactRequestStatus(item.id, status)
      setVisitRequests((current) => ({
        ...current,
        items: current.items.map((request) => request.id === item.id ? updated : request),
      }))
      setMessage(l('visitRequestUpdated'))
      await invalidateCurrentTasks(me?.id)
      await runQuietly(loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
    } catch (reason) {
      setError(formatActionError(reason, l('visitRequestUpdateFailed')))
    } finally {
      setUpdatingVisitRequestId(null)
    }
  }

  const sendMessage = async () => {
    setError('')
    setMessage('')
    try {
      const result = await groupService.sendAdminMessage({
        ...sendForm,
        groupId: sendForm.scope === 'group' ? sendForm.groupId : null,
        recipientMemberId: sendForm.scope === 'member' ? sendForm.recipientMemberId : null,
        roleCodes: sendForm.scope === 'role' ? sendForm.roleCodes : null,
      })
      setMessage(l('messageSent', { count: result.createdCount }))
      setSendForm((current) => ({ ...current, titleEn: adminViewText.sendFormSetSendForm.en, titleZh: adminViewText.sendFormSetSendForm.zh, bodyEn: adminViewText.sendFormSetSendForm.en, bodyZh: adminViewText.sendFormSetSendForm.zh }))
      await runQuietly(loadMessages(1), loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
    } catch (reason) {
      setError(formatActionError(reason, l('sendFailed')))
    }
  }

  const translateMessage = async (direction: MessageTranslationDirection) => {
    if (messageAiDirection) return
    const sourceLanguage = direction === 'zh-en' ? 'zh' : 'en'
    const targetLanguage = direction === 'zh-en' ? 'en' : 'zh'
    const sourceTitle = (direction === 'zh-en' ? sendForm.titleZh : sendForm.titleEn).trim()
    const sourceBody = (direction === 'zh-en' ? sendForm.bodyZh : sendForm.bodyEn).trim()
    const fields: MissingTranslatableField[] = []

    if (sourceTitle) {
      fields.push({
        field: 'title',
        sourceLanguage,
        targetLanguage,
        sourceText: sourceTitle,
        textType: direction === 'zh-en' ? 'Chinese notification title' : 'English notification title',
      })
    }
    if (sourceBody) {
      fields.push({
        field: 'body',
        sourceLanguage,
        targetLanguage,
        sourceText: sourceBody,
        textType: direction === 'zh-en' ? 'Chinese notification body' : 'English notification body',
      })
    }

    if (!fields.length) {
      setError(l('aiTranslationNeedsSource'))
      return
    }

    setError('')
    setMessage('')
    setMessageAiDirection(direction)
    try {
      const translatedFields = await aiTranslationService.translateTextFields({ scope: 'church', fields })
      setSendForm((current) => {
        const next = { ...current }
        translatedFields.forEach((field) => {
          if (field.field === 'title' && field.language === 'en') next.titleEn = field.text
          if (field.field === 'body' && field.language === 'en') next.bodyEn = field.text
          if (field.field === 'title' && field.language === 'zh') next.titleZh = field.text
          if (field.field === 'body' && field.language === 'zh') next.bodyZh = field.text
        })
        return next
      })
      setMessage(l('aiTranslationComplete'))
    } catch {
      setError(l('aiTranslationFailed'))
    } finally {
      setMessageAiDirection(null)
    }
  }

  const managementPage: { title: string; subtitle: string; iconKey: SystemManagementIconKey } | null =
    section === 'roles'
      ? { title: l('roles'), subtitle: l('rolesDescription'), iconKey: 'roles' }
      : section === 'logs'
        ? { title: l('logs'), subtitle: l('logsDescription'), iconKey: 'logs' }
        : section === 'messages'
          ? { title: l('messages'), subtitle: l('messagesDescription'), iconKey: 'messages' }
          : section === 'files'
            ? { title: l('files'), subtitle: l('filesDescription'), iconKey: 'files' }
            : null

  return (
    <section className={embedded || section === 'visitRequests' ? 'w-full space-y-5' : 'mx-auto w-full max-w-7xl space-y-5 px-2 py-3 sm:px-4'}>
      {message || error ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/25 px-4 py-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm sm:items-center">
          <div className={`w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl ${error ? 'border-rose-200' : 'border-emerald-200'}`} role="alertdialog" aria-modal="true">
            <div className={`h-1.5 ${error ? 'bg-rose-500' : 'bg-emerald-600'}`} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={`text-base font-black ${error ? 'text-rose-900' : 'text-emerald-900'}`}>{error ? l('actionFailed') : l('actionSucceeded')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{error || message}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                  aria-label={l('closeDialog')}
                  onClick={() => { setError(''); setMessage('') }}
                >
                  <span className="text-lg leading-none">x</span>
                </button>
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-black text-white transition ${error ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}
                  onClick={() => { setError(''); setMessage('') }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'overview' ? (
        <SystemManagementDashboard
          messages={messages}
          syncing={syncing}
          loading={loading}
          syncSermons={syncSermons}
          refresh={refreshCurrent}
          language={language}
        />
      ) : null}
      {section === 'users' ? <MembersSection embedded={embedded} roles={roleOptions} groups={groups} isSuperAdmin={isSuperAdmin} canAssignPlatformRoles={hasAdminPermission('admin.members.assignPlatformRoles')} canManageMemberProfiles={hasAdminPermission('admin.members.manageProfiles')} canManageMembership={Boolean(church && canManageGroup(church.id))} updatingMemberId={updatingMemberId} updatingMemberProfileId={updatingMemberProfileId} updatingMembershipId={updatingMembershipId} updateMemberRoles={updateMemberRoles} updateMemberProfile={updateMemberProfile} updateMembership={updateChurchMembership} language={language} currentMemberId={me?.id || ''} /> : null}
      {section === 'visitRequests' ? (
        <AppPageShell
          title={l('visitRequests')}
          context={language === 'zh' ? adminViewText.churchLifeVisitorCare.zh : adminViewText.churchLifeVisitorCare.en}
          subtitle={l('visitRequestsDescription')}
        >
          <div className="overflow-hidden rounded-[var(--alife-radius-card)] border border-[var(--alife-line)]">
            <VisitRequestsSection l={l} loading={loading} page={visitRequests} filters={visitRequestFilters} setFilters={setVisitRequestFilters} apply={() => loadVisitRequests(1)} goToPage={loadVisitRequests} updateStatus={updateVisitRequestStatus} updatingId={updatingVisitRequestId} language={language} connected />
          </div>
        </AppPageShell>
      ) : null}
      {managementPage ? (
        <SystemManagementFrame
          title={managementPage.title}
          subtitle={managementPage.subtitle}
          language={language}
          iconKey={managementPage.iconKey}
          bodyClassName={section === 'logs' || section === 'files' ? '' : 'p-4 sm:p-5 lg:p-6'}
          actions={section === 'messages' ? (
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="button" onClick={() => refreshCurrent().catch(() => undefined)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {l('refresh')}
            </button>
          ) : undefined}
        >
          {section === 'roles' ? <RolesSection l={l} roles={roleOptions} roleForm={roleForm} setRoleForm={setRoleForm} creatingRole={creatingRole} deletingRoleId={deletingRoleId} updatingRolePermissionId={updatingRolePermissionId} roleCodeValidation={roleCodeValidation} roleCodeFeedback={roleCodeFeedback} canSubmitCreateRole={canSubmitCreateRole} createRole={createRole} deleteRole={deleteRole} updateRolePermissions={updateRolePermissions} refresh={refreshCurrent} loading={loading} language={language} /> : null}
          {section === 'logs' ? <LogsSection l={l} loading={loading} page={logs} filters={logFilters} setFilters={setLogFilters} apply={() => loadLogs(1, 25)} goToPage={(page) => loadLogs(page, 25)} language={language} connected /> : null}
          {section === 'messages' ? <MessagesSection l={l} loading={loading} page={messages} filters={messageFilters} setFilters={setMessageFilters} apply={() => loadMessages(1)} goToPage={loadMessages} groups={groups} roles={roleOptions} members={members.items} sendForm={sendForm} setSendForm={setSendForm} sendMessage={sendMessage} translateMessage={translateMessage} aiTranslating={messageAiDirection} language={language} /> : null}
          {section === 'files' ? <PlatformFilesSection l={l} language={language} groups={groups} connected /> : null}
        </SystemManagementFrame>
      ) : null}
    </section>
  )
}

const SystemManagementDashboard = ({ messages, syncing, loading, syncSermons, refresh, language }: {
  messages: AdminPagedResultDto<AdminNotificationDto>
  syncing: boolean
  loading: boolean
  syncSermons: () => Promise<void>
  refresh: () => Promise<void>
  language: string
}) => {
  const auth = useAuthStore()
  const isChinese = language === 'zh'
  const unreadCount = messages.items.filter((message) => !message.readUtc).length
  const showMessageMetric = auth.hasAdminPermission('admin.messages.manage')
  const showSermonSync = auth.hasAdminPermission('admin.sermons.sync')
  const sections: SystemManagementAreaConfig[] = [
    ...(auth.hasAdminPermission('admin.roles.managePermissions') ? [{ key: 'roles', label: isChinese ? adminViewText.roleManagement.zh : adminViewText.roleManagement.en, description: isChinese ? adminViewText.platformRolesPermissionsAndFeatureAccess.zh : adminViewText.platformRolesPermissionsAndFeatureAccess.en, iconKey: 'roles' as const, to: '/admin/roles' }] : []),
    ...(auth.hasAdminPermission('admin.events.managePackagePolicies') ? [{ key: 'event-package-policies', label: isChinese ? adminViewText.eventPackagePolicies.zh : adminViewText.eventPackagePolicies.en, description: isChinese ? adminViewText.manageApprovalTiersValidityDelegationAndRollout.zh : adminViewText.manageApprovalTiersValidityDelegationAndRollout.en, iconKey: 'eventPackagePolicies' as const, to: '/admin/event-package-policies' }] : []),
    ...(auth.hasAdminPermission('admin.events.manageRamPolicies') ? [{ key: 'ram-policies', label: isChinese ? adminViewText.ramPoliciesAndQuestions.zh : adminViewText.ramPoliciesAndQuestions.en, description: isChinese ? adminViewText.manageChurchRiskMatricesQuestionsAndPolicyVersions.zh : adminViewText.manageChurchRiskMatricesQuestionsAndPolicyVersions.en, iconKey: 'ramPolicies' as const, to: '/admin/ram-policies' }] : []),
    ...(auth.hasAdminPermission('admin.events.manageTemplates') ? [{ key: 'event-templates', label: isChinese ? adminViewText.eventTemplates.zh : adminViewText.eventTemplates.en, description: isChinese ? adminViewText.manageCreationTemplatesWithinTheFourFixedEventCategories.zh : adminViewText.manageCreationTemplatesWithinTheFourFixedEventCategories.en, iconKey: 'eventTemplates' as const, to: '/admin/event-templates' }] : []),
    ...(showMessageMetric ? [{ key: 'notices', label: isChinese ? adminViewText.notificationManagement.zh : adminViewText.notificationManagement.en, description: isChinese ? adminViewText.sendNotificationsAndReviewReadAndReplyStatus.zh : adminViewText.sendNotificationsAndReviewReadAndReplyStatus.en, iconKey: 'messages' as const, to: '/admin/messages' }] : []),
    ...(auth.hasAdminPermission('admin.files.view') ? [{ key: 'files', label: isChinese ? adminViewText.fileManagement.zh : adminViewText.fileManagement.en, description: isChinese ? adminViewText.reviewUploadsVisibilityAndOwnership.zh : adminViewText.reviewUploadsVisibilityAndOwnership.en, iconKey: 'files' as const, to: '/admin/files' }] : []),
    ...(auth.hasAdminPermission('admin.auditLogs.view') ? [{ key: 'logs', label: isChinese ? adminViewText.auditLogs.zh : adminViewText.auditLogs.en, description: isChinese ? adminViewText.reviewSensitivePlatformActions.zh : adminViewText.reviewSensitivePlatformActions.en, iconKey: 'logs' as const, to: '/admin/logs' }] : []),
  ]

  return (
    <SystemManagementFrame
      title={isChinese ? adminViewText.systemManagement.zh : adminViewText.systemManagement.en}
      subtitle={isChinese ? adminViewText.managePlatformPermissionsContentOperationsAndOversightInOne.zh : adminViewText.managePlatformPermissionsContentOperationsAndOversightInOne.en}
      language={language}
      iconKey="overview"
      showBackLink={false}
      actions={<>{showMessageMetric ? <div><p className="text-2xl font-black tabular-nums">{unreadCount}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{isChinese ? adminViewText.unread.zh : adminViewText.unread.en}</p></div> : null}<button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60" type="button" disabled={loading} onClick={() => refresh().catch(() => undefined)} aria-label={isChinese ? adminViewText.refreshSystemManagement.zh : adminViewText.refreshSystemManagement.en}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></>}
    >
      <div className={showSermonSync ? 'grid xl:grid-cols-[minmax(0,1fr)_19rem]' : 'grid'}>
        <div className="min-w-0">
          <div className="px-6 pb-3 pt-5 sm:px-8"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#176b5a]">{isChinese ? adminViewText.systemAreas.zh : adminViewText.systemAreas.en}</p><h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#18332d]">{isChinese ? adminViewText.chooseWhatToManage.zh : adminViewText.chooseWhatToManage.en}</h2></div>
          <div className="grid border-t border-[#e3e8e5] md:grid-cols-2">
          {sections.map((section, index) => {
            const Icon = systemManagementIcons[section.iconKey]
            return (
              <Link key={section.key} to={section.to} className={`group flex min-h-28 items-center gap-4 border-b border-[#e3e8e5] px-6 py-5 transition hover:bg-[#f2f7f4] sm:px-8 ${index % 2 === 0 ? 'md:border-r' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a] transition group-hover:bg-[#173f36] group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#18332d]">{section.label}</span><span className="mt-1 block text-xs font-semibold leading-5 text-[#718079]">{section.description}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa7a1] transition group-hover:translate-x-1 group-hover:text-[#176b5a]" />
              </Link>
            )
          })}
          </div>
        </div>

        {showSermonSync ? <aside className="border-t border-[#e3e8e5] bg-[#f7f4ed] px-6 py-5 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7b8882]">{isChinese ? adminViewText.quickActions.zh : adminViewText.quickActions.en}</p>
          <div className="mt-3 divide-y divide-[#dfe5e1] border-y border-[#dfe5e1]">
            <button type="button" disabled={syncing} onClick={() => syncSermons().catch(() => undefined)} className="group flex w-full items-center gap-3 py-4 text-left text-[#31544b] transition hover:text-[#176b5a] disabled:opacity-60">{syncing ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <RefreshCw className="h-5 w-5 shrink-0" />}<span className="min-w-0 flex-1"><span className="block text-sm font-black">{syncing ? (isChinese ? adminViewText.syncing.zh : adminViewText.syncing.en) : (isChinese ? adminViewText.syncSermons.zh : adminViewText.syncSermons.en)}</span><span className="mt-0.5 block text-xs font-semibold text-[#7a8782]">{isChinese ? adminViewText.refreshSermonSources.zh : adminViewText.refreshSermonSources.en}</span></span><ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
          </div>
          <p className="mt-5 text-xs font-semibold leading-5 text-[#7a8782]">{isChinese ? adminViewText.systemAreasAllAvailableFromThisPage.zh(sections.length) : adminViewText.systemAreasAllAvailableFromThisPage.en(sections.length)}</p>
        </aside> : null}
      </div>
    </SystemManagementFrame>
  )
}


export default AdminView
