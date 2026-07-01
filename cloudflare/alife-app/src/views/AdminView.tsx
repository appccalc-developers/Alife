import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, SetStateAction, TextareaHTMLAttributes } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Activity, Bell, CheckCircle2, ChevronRight, Globe2, Loader2, MessageSquareWarning, RefreshCw, Search, Send, ShieldCheck, UserCheck, UsersRound } from 'lucide-react'
import {
  groupService,
  type AdminGroupOptionDto,
  type AdminMemberDto,
  type AdminNotificationDto,
  type AdminPagedResultDto,
  type AdminPlatformRoleDto,
  type AuditLogDto,
} from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { aiTranslationService } from '../services/aiTranslationService'
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import { activeEntityService } from '../services/activeEntityService'
import type { PageSummaryDto } from '../types'
import type { MissingTranslatableField } from '../utils/bilingualValidation'

type AdminSection = 'overview' | 'users' | 'logs' | 'messages'
type MessageTranslationDirection = 'zh-en' | 'en-zh'
type LocalText = { en: string; zh: string }
type LabelFn = (key: keyof typeof labels, values?: Record<string, string | number>) => string

const labels = {
  overview: { en: 'Platform workspace', zh: '平台工作台' },
  users: { en: 'Platform users', zh: '全平台用户' },
  logs: { en: 'Operation logs', zh: '操作日志' },
  messages: { en: 'Notices', zh: '通知管理' },
  usersDescription: { en: 'Manage accounts, registration state, and platform roles.', zh: '管理账号、注册状态和平台角色。' },
  logsDescription: { en: 'Review platform-level administrative actions.', zh: '查看平台级管理操作记录。' },
  messagesDescription: { en: 'Send notices to members and check whether they were read or replied to.', zh: '向成员发送通知，并查看是否已读或已回复。' },
  sermonsDescription: { en: 'Run a manual sync from connected sermon sources.', zh: '从已连接来源手动同步讲道。' },
  homeDescription: { en: 'Keep the public home page fresh for visitors, seekers, and members.', zh: '维护面向访客、慕道朋友和成员的公共首页。' },
  editHome: { en: 'Edit public home', zh: '编辑公共首页' },
  createDefaultHome: { en: 'Create default home', zh: '新建默认首页' },
  refresh: { en: 'Refresh', zh: '刷新' },
  apply: { en: 'Apply', zh: '筛选' },
  reset: { en: 'Reset', zh: '重置' },
  search: { en: 'Search', zh: '搜索' },
  allRoles: { en: 'All roles', zh: '全部角色' },
  allStatus: { en: 'All status', zh: '全部状态' },
  allRegistration: { en: 'All registration', zh: '全部注册状态' },
  registeredOnly: { en: 'Registered only', zh: '仅已注册' },
  guestsOnly: { en: 'Guests only', zh: '仅访客' },
  sync: { en: 'Sync sermons', zh: '同步讲道' },
  syncing: { en: 'Syncing...', zh: '同步中...' },
  loading: { en: 'Loading...', zh: '加载中...' },
  refreshed: { en: 'Admin data refreshed.', zh: '管理数据已刷新。' },
  roleUpdated: { en: 'Platform role updated.', zh: '平台角色已更新。' },
  messageSent: { en: 'Message sent to {count} recipient(s).', zh: '消息已发送给 {count} 位接收人。' },
  loadFailed: { en: 'Unable to load admin data.', zh: '无法加载管理数据。' },
  networkHint: { en: 'The API did not respond. Check that the backend host and Vite proxy are running.', zh: 'API 没有响应，请确认后端服务和 Vite 代理正在运行。' },
  roleUpdateFailed: { en: 'Unable to update this role.', zh: '无法更新这个角色。' },
  sendFailed: { en: 'Unable to send this message.', zh: '无法发送这条消息。' },
  superAdminOnly: { en: 'Only a super admin can change platform roles.', zh: '只有超级管理员可以修改平台角色。' },
  member: { en: 'Member', zh: '成员' },
  contact: { en: 'Contact', zh: '联系方式' },
  registration: { en: 'Registration', zh: '注册' },
  groups: { en: 'Groups', zh: '小组' },
  role: { en: 'Role', zh: '角色' },
  registered: { en: 'Registered', zh: '已注册' },
  guest: { en: 'Guest', zh: '访客' },
  you: { en: 'You', zh: '你' },
  cannotAssignSuperAdmin: { en: 'System Admin cannot be assigned from this screen. You can assign Admin instead.', zh: '不能在这里把其他人设为超级管理员，可以任命为管理员。' },
  cannotChangeOwnRole: { en: 'You cannot change your own platform role here.', zh: '不能在这里修改自己的平台角色。' },
  approved: { en: 'approved', zh: '已批准' },
  pending: { en: 'pending', zh: '待审核' },
  action: { en: 'Action', zh: '操作' },
  summary: { en: 'Summary', zh: '摘要' },
  context: { en: 'Context', zh: '上下文' },
  details: { en: 'Details', zh: '详情' },
  before: { en: 'Before', zh: '变更前' },
  after: { en: 'After', zh: '变更后' },
  metadata: { en: 'Metadata', zh: '元数据' },
  technicalIds: { en: 'Technical IDs', zh: '技术 ID' },
  actor: { en: 'Actor', zh: '操作者' },
  target: { en: 'Target', zh: '对象' },
  entityType: { en: 'Entity type', zh: '对象类型' },
  fromDate: { en: 'From date', zh: '开始日期' },
  toDate: { en: 'To date', zh: '结束日期' },
  time: { en: 'Time', zh: '时间' },
  recipient: { en: 'Recipient', zh: '接收人' },
  sender: { en: 'Sender', zh: '发送人' },
  status: { en: 'Status', zh: '状态' },
  unread: { en: 'Unread', zh: '未读' },
  read: { en: 'Read', zh: '已读' },
  replied: { en: 'Replied', zh: '已回复' },
  noMembers: { en: 'No members found.', zh: '没有找到成员。' },
  noLogs: { en: 'No operation logs found.', zh: '没有找到操作日志。' },
  noMessages: { en: 'No messages found.', zh: '没有找到消息。' },
  messageComposer: { en: 'New notice', zh: '新建通知' },
  messageAudience: { en: 'Who should receive it?', zh: '发给谁？' },
  messageScope: { en: 'Send to', zh: '发送范围' },
  messageContent: { en: 'What should they see?', zh: '通知内容' },
  chooseGroup: { en: 'Choose group', zh: '选择小组' },
  chooseRecipient: { en: 'Choose recipient', zh: '选择成员' },
  chineseNotice: { en: 'Chinese notice', zh: '中文通知' },
  englishNotice: { en: 'English translation', zh: '英文翻译' },
  englishNoticeHint: { en: 'Optional, but useful for bilingual members.', zh: '可选；建议给双语成员保留英文版本。' },
  aiTranslate: { en: 'AI translate', zh: 'AI 翻译' },
  translateZhToEn: { en: 'Chinese to English', zh: '中译英' },
  translateEnToZh: { en: 'English to Chinese', zh: '英译中' },
  translating: { en: 'Translating...', zh: '翻译中...' },
  aiTranslationReviewHint: { en: 'AI will fill the other language as a draft. Please review before sending.', zh: 'AI 会把另一种语言补成草稿，发送前请人工确认。' },
  aiTranslationNeedsSource: { en: 'Please write a title or body in the source language first.', zh: '请先填写来源语言的标题或正文。' },
  aiTranslationComplete: { en: 'AI translation added. Please review it before sending.', zh: 'AI 翻译已填入，请确认后再发送。' },
  aiTranslationFailed: { en: 'AI translation failed. Please try again or fill it manually.', zh: 'AI 翻译失败，请重试或手动填写。' },
  messageHistory: { en: 'Sent notification records', zh: '已发送通知记录' },
  messagePreview: { en: 'Preview', zh: '预览' },
  actionType: { en: 'System tag', zh: '系统标签' },
  actionTypeHint: { en: 'For system routing and audit records. Leave as platform.message for a normal notice.', zh: '用于系统路由和审计记录。普通通知保持 platform.message 即可。' },
  advancedFields: { en: 'System options', zh: '系统选项' },
  relatedContext: { en: 'Related group/event', zh: '关联小组/活动' },
  sentAt: { en: 'Sent', zh: '发送时间' },
  readAt: { en: 'Read at', zh: '读取时间' },
  repliedAt: { en: 'Replied at', zh: '回复时间' },
  notReadYet: { en: 'Not read yet', zh: '尚未读取' },
  noReplyYet: { en: 'No reply yet', zh: '尚未回复' },
  messagePayload: { en: 'Message payload', zh: '消息数据' },
  responsePayload: { en: 'Response payload', zh: '回复数据' },
  previous: { en: 'Previous', zh: '上一页' },
  next: { en: 'Next', zh: '下一页' },
  page: { en: 'Page', zh: '页' },
  total: { en: 'Total', zh: '总数' },
  sendMessage: { en: 'Send notice', zh: '发送通知' },
  platform: { en: 'Whole platform', zh: '全平台' },
  group: { en: 'Group', zh: '小组' },
  singleMember: { en: 'Single user', zh: '单个用户' },
  titleEn: { en: 'English title', zh: '英文标题' },
  titleZh: { en: 'Chinese title', zh: '中文标题' },
  bodyEn: { en: 'English body', zh: '英文正文' },
  bodyZh: { en: 'Chinese body', zh: '中文正文' },
  unknown: { en: 'Unknown', zh: '未知' },
  registeredUsers: { en: 'Registered users', zh: '已注册用户' },
  guestUsers: { en: 'Guest records', zh: '访客记录' },
  latestActivity: { en: 'Latest activity', zh: '最近动态' },
  quickOps: { en: 'Workspace actions', zh: '工作区操作' },
  platformQueue: { en: 'Platform task queue', zh: '平台待办队列' },
  platformQueueDescription: { en: 'Start with actions that affect access, communication, and public content.', zh: '优先处理影响访问、沟通和公共内容的事项。' },
  guestReviewTask: { en: 'Review guest records', zh: '查看访客记录' },
  guestReviewHint: { en: 'Confirm whether guest records should become registered accounts.', zh: '确认访客记录是否需要转为注册账号。' },
  unreadMessagesTask: { en: 'Follow up unread messages', zh: '跟进未读消息' },
  unreadMessagesHint: { en: 'Messages may need pastoral or admin response.', zh: '消息可能需要牧养或管理回应。' },
  auditReviewTask: { en: 'Review operation log', zh: '查看操作日志' },
  auditReviewHint: { en: 'Keep sensitive platform actions auditable.', zh: '保持敏感平台操作可追溯。' },
  homeWorkflowTask: { en: 'Public home workflow', zh: '公共首页工作流' },
  homeWorkflowHint: { en: 'Keep visitor-facing content current.', zh: '保持面向访客的内容及时更新。' },
  pageReviewWorkflow: { en: 'Page publication review', zh: '页面发布审核' },
  pageReviewHint: { en: 'Promote approved group pages into global public pages.', zh: '把通过审核的小组页面提升为全站公共页面。' },
  noPlatformTasks: { en: 'No urgent platform tasks right now.', zh: '当前没有紧急平台待办。' },
} satisfies Record<string, LocalText>

const emptyPage = <T,>(pageSize = 25): AdminPagedResultDto<T> => ({ items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 })
const tabs: Array<{ section: AdminSection; path: string; icon: LucideIcon }> = [
  { section: 'overview', path: '/admin', icon: ShieldCheck },
  { section: 'users', path: '/admin/users', icon: UsersRound },
  { section: 'logs', path: '/admin/logs', icon: Activity },
  { section: 'messages', path: '/admin/messages', icon: Bell },
]
const roleTone: Record<string, string> = {
  superadmin: 'border-rose-200 bg-rose-50 text-rose-700',
  admin: 'border-amber-200 bg-amber-50 text-amber-700',
  page_reviewer: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  user: 'border-slate-200 bg-slate-50 text-slate-600',
}

const formatRole = (role: string) => role === 'superadmin' ? 'System Admin' : role === 'admin' ? 'Admin' : role === 'page_reviewer' ? 'Page Reviewer' : role === 'user' ? 'User' : role
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const readLocalized = (text: Record<string, string> | null | undefined, language: string) => !text ? '' : (language === 'zh' ? text.zh : text.en) || text.en || text.zh || ''
const parseLocalizedJson = (json: string | null, language: string) => {
  if (!json) return ''
  try {
    return readLocalized(JSON.parse(json) as Record<string, string>, language)
  } catch {
    return ''
  }
}
type JsonRecord = Record<string, unknown>
const parseJsonRecord = (json: string | null | undefined): JsonRecord | null => {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null
  } catch {
    return null
  }
}
const readJsonString = (record: JsonRecord | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}
const readJsonNumber = (record: JsonRecord | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
const readNestedLocalized = (record: JsonRecord | null, key: string, language: string) => {
  const value = record?.[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? readLocalized(value as Record<string, string>, language)
    : ''
}
const prettyJson = (json: string | null | undefined) => {
  const parsed = parseJsonRecord(json)
  return parsed ? JSON.stringify(parsed, null, 2) : json || ''
}
const compactId = (value: string | null | undefined) => value ? `${value.slice(0, 8)}...${value.slice(-4)}` : ''
const logActionLabel = (action: string, language: string) => {
  if (action === 'member.platform-role.set') return language === 'zh' ? '平台角色变更' : 'Platform role changed'
  if (action === 'notification.admin.send') return language === 'zh' ? '管理员发送通知' : 'Admin notification sent'
  return action
}
const describeAuditLog = (log: AuditLogDto, language: string) => {
  const before = parseJsonRecord(log.beforeJson)
  const after = parseJsonRecord(log.afterJson)
  const target = log.targetDisplayName || compactId(log.targetMemberId) || compactId(log.entityId) || log.entityType

  if (log.action === 'member.platform-role.set') {
    const beforeRoles = Array.isArray(before?.roles)
      ? before.roles.filter((role): role is string => typeof role === 'string')
      : []
    const afterRole = readJsonString(after, 'role') || 'user'
    return language === 'zh'
      ? `将 ${target} 的平台角色从 ${beforeRoles.map(formatRole).join(', ') || 'User'} 改为 ${formatRole(afterRole)}`
      : `Changed ${target}'s platform role from ${beforeRoles.map(formatRole).join(', ') || 'User'} to ${formatRole(afterRole)}`
  }

  if (log.action === 'notification.admin.send') {
    const scope = readJsonString(after, 'scope') || 'platform'
    const count = readJsonNumber(after, 'recipientCount')
    const title = readNestedLocalized(after, 'title', language)
    const scopeLabel = language === 'zh'
      ? scope === 'group' ? '小组' : scope === 'member' ? '单个成员' : '全平台'
      : scope === 'group' ? 'a group' : scope === 'member' ? 'one member' : 'the whole platform'
    return language === 'zh'
      ? `向${scopeLabel}发送通知${count === null ? '' : `，共 ${count} 位收件人`}${title ? `：「${title}」` : ''}`
      : `Sent a notification to ${scopeLabel}${count === null ? '' : ` (${count} recipient${count === 1 ? '' : 's'})`}${title ? `: "${title}"` : ''}`
  }

  return logActionLabel(log.action, language)
}
const getNotificationStatus = (item: AdminNotificationDto) =>
  item.repliedUtc ? 'replied' : item.readUtc ? 'read' : 'unread'
const messageStatusTone = (status: string) =>
  status === 'replied'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'read'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
const readNotificationContent = (item: AdminNotificationDto, language: string) => {
  const payload = parseJsonRecord(item.actionDataJson)
  return {
    title: readNestedLocalized(payload, 'title', language) || item.actionType,
    body: readNestedLocalized(payload, 'body', language),
    scope: readJsonString(payload, 'scope'),
  }
}
const notificationContextLabel = (item: AdminNotificationDto, language: string) => {
  const groupName = parseLocalizedJson(item.groupNameJson, language)
  const eventTitle = (language === 'zh' ? item.eventTitleZh : item.eventTitleEn) || item.eventTitleEn || item.eventTitleZh || ''
  return [groupName, eventTitle].filter(Boolean).join(' / ') || '-'
}
const sectionFromPath = (pathname: string): AdminSection => pathname.endsWith('/users') ? 'users' : pathname.endsWith('/logs') ? 'logs' : pathname.endsWith('/messages') ? 'messages' : 'overview'

const AdminView = () => {
  const t = useUiText()
  const { language, me } = useAuthStore()
  const section = sectionFromPath(useLocation().pathname)
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

  const [roles, setRoles] = useState<AdminPlatformRoleDto[]>([])
  const [groups, setGroups] = useState<AdminGroupOptionDto[]>([])
  const [globalPages, setGlobalPages] = useState<PageSummaryDto[]>([])
  const [members, setMembers] = useState(emptyPage<AdminMemberDto>())
  const [logs, setLogs] = useState(emptyPage<AuditLogDto>())
  const [messages, setMessages] = useState(emptyPage<AdminNotificationDto>())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [messageAiDirection, setMessageAiDirection] = useState<MessageTranslationDirection | null>(null)
  const [userFilters, setUserFilters] = useState({ search: '', role: '', isRegistered: '' })
  const [logFilters, setLogFilters] = useState({ search: '', action: '', entityType: '', fromUtc: '', toUtc: '' })
  const [messageFilters, setMessageFilters] = useState({ search: '', actionType: '', status: '' })
  const [sendForm, setSendForm] = useState({
    scope: 'platform' as 'platform' | 'group' | 'member',
    groupId: '',
    recipientMemberId: '',
    actionType: 'platform.message',
    titleEn: '',
    titleZh: '',
    bodyEn: '',
    bodyZh: '',
  })

  const isSuperAdmin = me?.platformRole === 'superadmin'
  const roleOptions = useMemo(() => {
    const seeded = roles.length ? roles : [
      { id: 0, code: 'user', name: { en: 'User', zh: '普通用户' }, level: 0 },
      { id: 5, code: 'page_reviewer', name: { en: 'Page Reviewer', zh: '发布审核者' }, level: 5 },
      { id: 10, code: 'admin', name: { en: 'Admin', zh: '管理员' }, level: 10 },
      { id: 100, code: 'superadmin', name: { en: 'System Admin', zh: '超级管理员' }, level: 100 },
    ]
    return seeded.slice().sort((a, b) => a.level - b.level)
  }, [roles])

  const homePage = useMemo(() => {
    const readTags = (page: PageSummaryDto) => {
      try {
        return JSON.parse(page.tagsJson || '[]') as string[]
      } catch {
        return []
      }
    }

    return globalPages.find((page) => readTags(page).includes('home')) ??
      globalPages.find((page) => {
        const title = `${page.title?.en || ''} ${page.title?.zh || ''}`.toLowerCase()
        return title.includes('home') || title.includes('homepage') || title.includes('首页') || title.includes('主页')
      }) ??
      null
  }, [globalPages])

  const loadRolesAndGroups = useCallback(async () => {
    const [nextRoles, nextGroups, nextGlobalPages] = await Promise.all([
      groupService.getAdminPlatformRoles(),
      groupService.getAdminGroups({ pageSize: 100 }),
      groupService.getGlobalPages(),
    ])
    setRoles(nextRoles)
    setGroups(nextGroups.items)
    setGlobalPages(nextGlobalPages)
  }, [])

  const loadUsers = useCallback(async (page = members.page) => {
    setLoading(true)
    setError('')
    try {
      const isRegistered = userFilters.isRegistered === '' ? null : userFilters.isRegistered === 'true'
      setMembers(await groupService.getAdminMembers({ ...userFilters, isRegistered, page, pageSize: members.pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'members'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, members.page, members.pageSize, userFilters])

  const loadLogs = useCallback(async (page = logs.page) => {
    setLoading(true)
    setError('')
    try {
      setLogs(await groupService.getAuditLogs({ ...logFilters, page, pageSize: logs.pageSize }))
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

  const refreshCurrent = useCallback(async () => {
    setMessage('')
    if (section === 'users') await loadUsers()
    else if (section === 'logs') await loadLogs()
    else if (section === 'messages') await loadMessages()
    else await Promise.all([loadUsers(1), loadLogs(1), loadMessages(1)])
    setMessage(l('refreshed'))
  }, [l, loadLogs, loadMessages, loadUsers, section])

  useEffect(() => {
    loadRolesAndGroups().catch((reason) => { formatLoadError(reason).then(setError).catch(() => setError(l('loadFailed'))) })
  }, [formatLoadError, l, loadRolesAndGroups])

  useEffect(() => {
    if (section === 'users') loadUsers(1).catch(() => undefined)
    if (section === 'logs') loadLogs(1).catch(() => undefined)
    if (section === 'messages') Promise.all([loadMessages(1), loadUsers(1)]).catch(() => undefined)
    if (section === 'overview') Promise.all([loadUsers(1), loadLogs(1), loadMessages(1)]).catch(() => undefined)
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

  const updateRole = async (member: AdminMemberDto, roleCode: string) => {
    if (roleCode === member.platformRole) return
    if (member.id === me?.id) return setError(l('cannotChangeOwnRole'))
    if (roleCode === 'superadmin') return setError(l('cannotAssignSuperAdmin'))
    setUpdatingMemberId(member.id)
    setError('')
    setMessage('')
    try {
      await groupService.setMemberPlatformRole(member.id, roleCode)
      await Promise.all([loadUsers(members.page), loadLogs(1)])
      setMessage(l('roleUpdated'))
    } catch {
      setError(l('roleUpdateFailed'))
    } finally {
      setUpdatingMemberId(null)
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
      })
      setMessage(l('messageSent', { count: result.createdCount }))
      setSendForm((current) => ({ ...current, titleEn: '', titleZh: '', bodyEn: '', bodyZh: '' }))
      await Promise.all([loadMessages(1), loadLogs(1)])
    } catch {
      setError(l('sendFailed'))
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

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-2 py-3 sm:px-4">
      <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t('admin')}</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{l(section)}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('adminDescription')}</p>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60" disabled={loading} type="button" onClick={() => refreshCurrent().catch(() => undefined)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {l('refresh')}
            </button>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto bg-white px-4 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.section === section
            return (
              <Link key={tab.section} to={tab.path} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition ${active ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {l(tab.section)}
              </Link>
            )
          })}
        </nav>
      </header>

      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p> : null}

      {section === 'overview' ? <Overview l={l} users={members} logs={logs} messages={messages} homePage={homePage} syncing={syncing} syncSermons={syncSermons} /> : null}
      {section === 'users' ? <UsersSection l={l} loading={loading} page={members} filters={userFilters} setFilters={setUserFilters} roles={roleOptions} isSuperAdmin={isSuperAdmin} updatingMemberId={updatingMemberId} apply={() => loadUsers(1)} reset={() => { setUserFilters({ search: '', role: '', isRegistered: '' }); setTimeout(() => loadUsers(1).catch(() => undefined), 0) }} goToPage={loadUsers} updateRole={updateRole} language={language} currentMemberId={me?.id || ''} /> : null}
      {section === 'logs' ? <LogsSection l={l} loading={loading} page={logs} filters={logFilters} setFilters={setLogFilters} apply={() => loadLogs(1)} goToPage={loadLogs} language={language} /> : null}
      {section === 'messages' ? <MessagesSection l={l} loading={loading} page={messages} filters={messageFilters} setFilters={setMessageFilters} apply={() => loadMessages(1)} goToPage={loadMessages} groups={groups} members={members.items} sendForm={sendForm} setSendForm={setSendForm} sendMessage={sendMessage} translateMessage={translateMessage} aiTranslating={messageAiDirection} language={language} /> : null}
    </section>
  )
}

const Overview = ({ l, users, logs, messages, homePage, syncing, syncSermons }: {
  l: LabelFn
  users: AdminPagedResultDto<AdminMemberDto>
  logs: AdminPagedResultDto<AuditLogDto>
  messages: AdminPagedResultDto<AdminNotificationDto>
  homePage: PageSummaryDto | null
  syncing: boolean
  syncSermons: () => Promise<void>
}) => {
  const registeredCount = users.items.filter((member) => member.isRegistered).length
  const guestCount = users.items.filter((member) => !member.isRegistered).length
  const unreadCount = messages.items.filter((message) => !message.readUtc).length
  const recentLogCount = logs.items.length
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard to="/admin/users" icon={UsersRound} title={l('users')} value={users.totalCount} detail={l('total')} />
          <MetricCard to="/admin/users" icon={ShieldCheck} title={l('registeredUsers')} value={registeredCount} detail={l('registered')} />
          <MetricCard to="/admin/users" icon={UsersRound} title={l('guestUsers')} value={guestCount} detail={l('guest')} />
          <MetricCard to="/admin/messages" icon={Bell} title={l('messages')} value={messages.totalCount} detail={l('unread')} />
        </div>
        <PlatformTaskQueue
          l={l}
          guestCount={guestCount}
          unreadCount={unreadCount}
          recentLogCount={recentLogCount}
          hasHomePage={Boolean(homePage)}
        />
        <Panel title={l('latestActivity')} description={l('logsDescription')} count={logs.totalCount}>
          <div className="divide-y divide-slate-100">
            {logs.items.slice(0, 5).map((log) => (
              <div key={log.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div>
                  <p className="font-bold text-slate-900">{log.action}</p>
                  <p className="text-sm text-slate-500">{log.actorDisplayName || l('unknown')} - {log.targetDisplayName || log.entityType}</p>
                </div>
                <p className="text-sm text-slate-500 sm:text-right">{formatDate(log.occurredUtc)}</p>
              </div>
            ))}
            {logs.items.length === 0 ? <Empty text={l('noLogs')} /> : null}
          </div>
        </Panel>
      </div>
      <aside className="space-y-4">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><Globe2 className="h-5 w-5" /></span>
          <h2 className="mt-5 text-lg font-black text-slate-950">{l('quickOps')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{l('homeDescription')}</p>
          <Link
            to={homePage ? '/pages/edit?scope=home' : '/pages/new?scope=home'}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
            onClick={() => {
              if (homePage) {
                activeEntityService.setPage(homePage.id)
              }
            }}
          >
            {homePage ? l('editHome') : l('createDefaultHome')} <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/admin/page-review"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-50"
          >
            {l('pageReviewWorkflow')} <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-950">{l('sync')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{l('sermonsDescription')}</p>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60" type="button" disabled={syncing} onClick={() => syncSermons().catch(() => undefined)}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? l('syncing') : l('sync')}
          </button>
        </section>
      </aside>
    </div>
  )
}

const PlatformTaskQueue = ({ l, guestCount, unreadCount, recentLogCount, hasHomePage }: {
  l: LabelFn
  guestCount: number
  unreadCount: number
  recentLogCount: number
  hasHomePage: boolean
}) => {
  const tasks = [
    {
      to: '/admin/users',
      icon: <UserCheck className="h-4 w-4" />,
      label: l('guestReviewTask'),
      hint: l('guestReviewHint'),
      count: guestCount,
      urgent: guestCount > 0,
    },
    {
      to: '/admin/messages',
      icon: <MessageSquareWarning className="h-4 w-4" />,
      label: l('unreadMessagesTask'),
      hint: l('unreadMessagesHint'),
      count: unreadCount,
      urgent: unreadCount > 0,
    },
    {
      to: '/admin/logs',
      icon: <Activity className="h-4 w-4" />,
      label: l('auditReviewTask'),
      hint: l('auditReviewHint'),
      count: recentLogCount,
      urgent: false,
    },
    {
      to: hasHomePage ? '/pages/edit?scope=home' : '/pages/new?scope=home',
      icon: <Globe2 className="h-4 w-4" />,
      label: l('homeWorkflowTask'),
      hint: l('homeWorkflowHint'),
      count: hasHomePage ? 1 : 0,
      urgent: !hasHomePage,
    },
  ]
  const urgentCount = tasks.filter((task) => task.urgent).length

  return (
    <Panel title={l('platformQueue')} description={l('platformQueueDescription')} count={urgentCount}>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {tasks.map((task) => (
          <Link
            key={task.label}
            to={task.to}
            className={[
              'flex min-h-[7rem] items-start gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md',
              task.urgent ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white hover:border-emerald-200',
            ].join(' ')}
          >
            <span className={[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              task.urgent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700',
            ].join(' ')}>
              {task.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="font-black text-slate-950">{task.label}</span>
                <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-700 shadow-sm">{task.count}</span>
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-500">{task.hint}</span>
            </span>
          </Link>
        ))}
      </div>
      {urgentCount === 0 ? (
        <div className="border-t border-slate-200 px-5 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mr-2 inline h-4 w-4 align-text-bottom" />
          {l('noPlatformTasks')}
        </div>
      ) : null}
    </Panel>
  )
}

const MetricCard = ({ to, icon: Icon, title, value, detail }: { to: string; icon: LucideIcon; title: string; value: number; detail: string }) => (
  <Link to={to} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span>
    <div className="mt-5 text-3xl font-black text-slate-950">{value}</div>
    <h2 className="mt-1 text-sm font-black text-slate-950">{title}</h2>
    <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
  </Link>
)

const UsersSection = ({ l, loading, page, filters, setFilters, roles, isSuperAdmin, updatingMemberId, apply, reset, goToPage, updateRole, language, currentMemberId }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AdminMemberDto>
  filters: { search: string; role: string; isRegistered: string }
  setFilters: Dispatch<SetStateAction<{ search: string; role: string; isRegistered: string }>>
  roles: AdminPlatformRoleDto[]
  isSuperAdmin: boolean
  updatingMemberId: string | null
  apply: () => Promise<void>
  reset: () => void
  goToPage: (page: number) => Promise<void>
  updateRole: (member: AdminMemberDto, roleCode: string) => Promise<void>
  language: string
  currentMemberId: string
}) => (
  <Panel title={l('users')} description={l('usersDescription')} count={page.totalCount}>
    <FilterBar>
      <SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} />
      <SelectInput value={filters.role} onChange={(e) => setFilters((x) => ({ ...x, role: e.target.value }))}>
        <option value="">{l('allRoles')}</option>
        {roles.map((role) => <option key={role.code} value={role.code}>{readLocalized(role.name, language) || formatRole(role.code)}</option>)}
      </SelectInput>
      <SelectInput value={filters.isRegistered} onChange={(e) => setFilters((x) => ({ ...x, isRegistered: e.target.value }))}>
        <option value="">{l('allRegistration')}</option>
        <option value="true">{l('registeredOnly')}</option>
        <option value="false">{l('guestsOnly')}</option>
      </SelectInput>
      <FilterActions l={l} apply={apply} reset={reset} />
    </FilterBar>
    {!isSuperAdmin ? <p className="m-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{l('superAdminOnly')}</p> : null}
    {loading ? <Loading text={l('loading')} /> : page.items.length ? (
      <>
        <DataTable headers={[l('member'), l('contact'), l('registration'), l('groups'), l('role')]}>
          {page.items.map((member) => {
            const isCurrentMember = Boolean(currentMemberId && member.id === currentMemberId)
            const assignableRoles = roles.filter((role) => role.code !== 'superadmin' || isCurrentMember || member.platformRole === 'superadmin')
            return (
              <tr key={member.id} className="align-top transition hover:bg-slate-50">
                <td className="max-w-[260px] px-5 py-4"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-950">{member.displayName || l('unknown')}</span>{isCurrentMember ? <Pill tone="sky">{l('you')}</Pill> : null}</div><div className="mt-1 break-all font-mono text-[11px] text-slate-400">{member.id}</div></td>
                <td className="max-w-[240px] px-5 py-4 text-slate-600"><div className="break-all">{member.email || '-'}</div><div>{member.phoneE164 || '-'}</div></td>
                <td className="px-5 py-4"><Pill tone={member.isRegistered ? 'green' : 'slate'}>{member.isRegistered ? l('registered') : l('guest')}</Pill></td>
                <td className="px-5 py-4 text-slate-600"><div>{member.approvedGroupCount} {l('approved')}</div><div>{member.pendingGroupCount} {l('pending')}</div></td>
                <td className="px-5 py-4"><div className="flex min-w-[180px] flex-col gap-2"><span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold ${roleTone[member.platformRole] || roleTone.user}`}><ShieldCheck className="mr-1 h-3.5 w-3.5" />{formatRole(member.platformRole)}</span><SelectInput value={member.platformRole} disabled={!isSuperAdmin || isCurrentMember || updatingMemberId === member.id} onChange={(e) => updateRole(member, e.target.value).catch(() => undefined)}>{assignableRoles.map((role) => <option key={role.code} value={role.code}>{readLocalized(role.name, language) || formatRole(role.code)}</option>)}</SelectInput></div></td>
              </tr>
            )
          })}
        </DataTable>
        <Pager l={l} page={page} goToPage={goToPage} />
      </>
    ) : <Empty text={l('noMembers')} />}
  </Panel>
)

const LogsSection = ({ l, loading, page, filters, setFilters, apply, goToPage, language }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AuditLogDto>
  filters: { search: string; action: string; entityType: string; fromUtc: string; toUtc: string }
  setFilters: Dispatch<SetStateAction<{ search: string; action: string; entityType: string; fromUtc: string; toUtc: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  language: string
}) => (
  <Panel title={l('logs')} description={l('logsDescription')} count={page.totalCount}>
    <FilterBar>
      <SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} />
      <TextInput placeholder={l('action')} value={filters.action} onChange={(e) => setFilters((x) => ({ ...x, action: e.target.value }))} />
      <TextInput placeholder={l('entityType')} value={filters.entityType} onChange={(e) => setFilters((x) => ({ ...x, entityType: e.target.value }))} />
      <TextInput type="date" aria-label={l('fromDate')} value={filters.fromUtc} onChange={(e) => setFilters((x) => ({ ...x, fromUtc: e.target.value }))} />
      <TextInput type="date" aria-label={l('toDate')} value={filters.toUtc} onChange={(e) => setFilters((x) => ({ ...x, toUtc: e.target.value }))} />
      <FilterActions l={l} apply={apply} reset={() => setFilters({ search: '', action: '', entityType: '', fromUtc: '', toUtc: '' })} />
    </FilterBar>
    {loading ? <Loading text={l('loading')} /> : page.items.length ? (
      <>
        <DataTable headers={[l('summary'), l('context'), l('time')]}>
          {page.items.map((log) => {
            const ids = [
              log.entityId ? `entity: ${compactId(log.entityId)}` : '',
              log.groupId ? `group: ${compactId(log.groupId)}` : '',
              log.eventId ? `event: ${compactId(log.eventId)}` : '',
              log.actorMemberId ? `actor: ${compactId(log.actorMemberId)}` : '',
              log.targetMemberId ? `target: ${compactId(log.targetMemberId)}` : '',
            ].filter(Boolean)
            return (
              <tr key={log.id} className="align-top transition hover:bg-slate-50">
                <td className="min-w-[320px] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                      {logActionLabel(log.action, language)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                      {log.entityType}
                    </span>
                  </div>
                  <p className="mt-2 font-bold leading-6 text-slate-950">{describeAuditLog(log, language)}</p>
                  <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <summary className="cursor-pointer font-bold text-slate-700">{l('details')}</summary>
                    <div className="mt-3 grid gap-3">
                      {log.beforeJson ? <JsonBlock title={l('before')} value={prettyJson(log.beforeJson)} /> : null}
                      {log.afterJson ? <JsonBlock title={l('after')} value={prettyJson(log.afterJson)} /> : null}
                      {log.metadataJson ? <JsonBlock title={l('metadata')} value={prettyJson(log.metadataJson)} /> : null}
                      {ids.length ? <p className="break-all font-mono text-[11px] leading-5 text-slate-500"><span className="font-sans font-bold text-slate-700">{l('technicalIds')}: </span>{ids.join(' · ')}</p> : null}
                    </div>
                  </details>
                </td>
                <td className="min-w-[220px] px-5 py-4 text-slate-600">
                  <div><span className="font-bold text-slate-700">{l('actor')}:</span> {log.actorDisplayName || compactId(log.actorMemberId) || l('unknown')}</div>
                  <div className="mt-1"><span className="font-bold text-slate-700">{l('target')}:</span> {log.targetDisplayName || compactId(log.targetMemberId) || compactId(log.entityId) || log.entityType}</div>
                  <div className="mt-1 text-xs text-slate-400">{log.action}</div>
                </td>
                <td className="min-w-[160px] px-5 py-4 text-slate-600">{formatDate(log.occurredUtc)}</td>
              </tr>
            )
          })}
        </DataTable>
        <Pager l={l} page={page} goToPage={goToPage} />
      </>
    ) : <Empty text={l('noLogs')} />}
  </Panel>
)

const MessagesSection = ({ l, loading, page, filters, setFilters, apply, goToPage, groups, members, sendForm, setSendForm, sendMessage, translateMessage, aiTranslating, language }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AdminNotificationDto>
  filters: { search: string; actionType: string; status: string }
  setFilters: Dispatch<SetStateAction<{ search: string; actionType: string; status: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  groups: AdminGroupOptionDto[]
  members: AdminMemberDto[]
  sendForm: { scope: 'platform' | 'group' | 'member'; groupId: string; recipientMemberId: string; actionType: string; titleEn: string; titleZh: string; bodyEn: string; bodyZh: string }
  setSendForm: Dispatch<SetStateAction<{ scope: 'platform' | 'group' | 'member'; groupId: string; recipientMemberId: string; actionType: string; titleEn: string; titleZh: string; bodyEn: string; bodyZh: string }>>
  sendMessage: () => Promise<void>
  translateMessage: (direction: MessageTranslationDirection) => Promise<void>
  aiTranslating: MessageTranslationDirection | null
  language: string
}) => {
  const canTranslateZh = Boolean(sendForm.titleZh.trim() || sendForm.bodyZh.trim())
  const canTranslateEn = Boolean(sendForm.titleEn.trim() || sendForm.bodyEn.trim())

  return (
  <div className="grid gap-4 xl:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)]">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Send className="h-4 w-4" />
        </span>
        <h2 className="text-xl font-black leading-tight text-slate-950">{l('messageComposer')}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{l('messagesDescription')}</p>
      </div>

      <div className="grid gap-4 p-5">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="text-base font-black text-slate-950">{l('messageAudience')}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              ['platform', l('platform')],
              ['group', l('group')],
              ['member', l('singleMember')],
            ] as const).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                className={[
                  'min-h-11 rounded-xl border px-2 py-2 text-sm font-bold transition',
                  sendForm.scope === scope
                    ? 'border-emerald-600 bg-emerald-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800',
                ].join(' ')}
                onClick={() => setSendForm((x) => ({ ...x, scope }))}
              >
                {label}
              </button>
            ))}
          </div>
          {sendForm.scope === 'group' ? (
            <div className="mt-3">
              <LabeledField label={l('chooseGroup')}>
              <SelectInput value={sendForm.groupId} onChange={(e) => setSendForm((x) => ({ ...x, groupId: e.target.value }))}>
                <option value="">{l('group')}</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{parseLocalizedJson(group.nameJson, language) || group.id}</option>)}
              </SelectInput>
              </LabeledField>
            </div>
          ) : null}
          {sendForm.scope === 'member' ? (
            <div className="mt-3">
              <LabeledField label={l('chooseRecipient')}>
              <SelectInput value={sendForm.recipientMemberId} onChange={(e) => setSendForm((x) => ({ ...x, recipientMemberId: e.target.value }))}>
                <option value="">{l('recipient')}</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.displayName || member.email || member.id}</option>)}
              </SelectInput>
              </LabeledField>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-black text-slate-950">{l('chineseNotice')}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{l('messageContent')}</p>
            </div>
            <AiTranslateButton
              label={l('translateZhToEn')}
              loading={aiTranslating === 'zh-en'}
              disabled={Boolean(aiTranslating) || !canTranslateZh}
              onClick={() => translateMessage('zh-en')}
            />
          </div>
          <LabeledField label={l('titleZh')}><TextInput value={sendForm.titleZh} onChange={(e) => setSendForm((x) => ({ ...x, titleZh: e.target.value }))} /></LabeledField>
          <div className="mt-3">
            <LabeledField label={l('bodyZh')}><TextAreaInput value={sendForm.bodyZh} onChange={(e) => setSendForm((x) => ({ ...x, bodyZh: e.target.value }))} /></LabeledField>
          </div>
          <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">{l('aiTranslationReviewHint')}</p>
        </section>

        <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-black text-slate-800">{l('englishNotice')}</summary>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">{l('englishNoticeHint')}</p>
            <AiTranslateButton
              label={l('translateEnToZh')}
              loading={aiTranslating === 'en-zh'}
              disabled={Boolean(aiTranslating) || !canTranslateEn}
              onClick={() => translateMessage('en-zh')}
            />
          </div>
          <div className="mt-3 grid gap-3">
            <LabeledField label={l('titleEn')}><TextInput value={sendForm.titleEn} onChange={(e) => setSendForm((x) => ({ ...x, titleEn: e.target.value }))} /></LabeledField>
            <LabeledField label={l('bodyEn')}><TextAreaInput value={sendForm.bodyEn} onChange={(e) => setSendForm((x) => ({ ...x, bodyEn: e.target.value }))} /></LabeledField>
          </div>
        </details>

        <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-black text-slate-800">{l('advancedFields')}</summary>
          <div className="mt-3 grid gap-2">
            <LabeledField label={l('actionType')} hint={l('actionTypeHint')}>
              <TextInput value={sendForm.actionType} onChange={(e) => setSendForm((x) => ({ ...x, actionType: e.target.value }))} />
            </LabeledField>
          </div>
        </details>

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">{l('messagePreview')}</p>
          <h3 className="mt-2 font-black text-slate-950">{(language === 'zh' ? sendForm.titleZh : sendForm.titleEn) || sendForm.titleEn || sendForm.titleZh || l('titleEn')}</h3>
          <p className="mt-1 line-clamp-4 text-sm leading-6 text-slate-600">{(language === 'zh' ? sendForm.bodyZh : sendForm.bodyEn) || sendForm.bodyEn || sendForm.bodyZh || l('bodyEn')}</p>
        </section>

        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800" type="button" onClick={() => sendMessage().catch(() => undefined)}>
          <Send className="h-4 w-4" />
          {l('sendMessage')}
        </button>
      </div>
    </section>
    <Panel title={l('messageHistory')} description={l('messagesDescription')} count={page.totalCount}>
      <FilterBar>
        <SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} />
        <TextInput placeholder={l('actionType')} value={filters.actionType} onChange={(e) => setFilters((x) => ({ ...x, actionType: e.target.value }))} />
        <SelectInput value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}>
          <option value="">{l('allStatus')}</option>
          <option value="unread">{l('unread')}</option>
          <option value="read">{l('read')}</option>
          <option value="replied">{l('replied')}</option>
        </SelectInput>
        <FilterActions l={l} apply={apply} reset={() => setFilters({ search: '', actionType: '', status: '' })} />
      </FilterBar>
      {loading ? <Loading text={l('loading')} /> : page.items.length ? (
        <>
          <div className="grid gap-3 p-4">
            {page.items.map((item) => <MessageRecordCard key={item.id} item={item} l={l} language={language} />)}
          </div>
          <Pager l={l} page={page} goToPage={goToPage} />
        </>
      ) : <Empty text={l('noMessages')} />}
    </Panel>
  </div>
  )
}

const AiTranslateButton = ({ label, loading, disabled, onClick }: { label: string; loading: boolean; disabled: boolean; onClick: () => Promise<void> }) => (
  <button
    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
    type="button"
    disabled={disabled}
    onClick={() => onClick().catch(() => undefined)}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Globe2 className="h-4 w-4" aria-hidden="true" />}
    {label}
  </button>
)

const MessageRecordCard = ({ item, l, language }: { item: AdminNotificationDto; l: LabelFn; language: string }) => {
  const status = getNotificationStatus(item)
  const content = readNotificationContent(item, language)
  const context = notificationContextLabel(item, language)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${messageStatusTone(status)}`}>
              {status === 'replied' ? l('replied') : status === 'read' ? l('read') : l('unread')}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
              {item.actionType}
            </span>
          </div>
          <h3 className="mt-3 text-base font-black leading-6 text-slate-950">{content.title}</h3>
          {content.body ? <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{content.body}</p> : null}
        </div>
        <div className="shrink-0 text-sm text-slate-500 md:text-right">
          <div className="font-semibold text-slate-700">{l('sentAt')}</div>
          <div>{formatDate(item.occurredUtc)}</div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="font-bold text-slate-700">{l('recipient')}</dt>
          <dd className="mt-1 break-words text-slate-600">{item.recipientDisplayName || compactId(item.recipientMemberId) || l('unknown')}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-700">{l('sender')}</dt>
          <dd className="mt-1 break-words text-slate-600">{item.createdByDisplayName || compactId(item.createdByMemberId) || l('unknown')}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-700">{l('relatedContext')}</dt>
          <dd className="mt-1 break-words text-slate-600">{context}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-700">{l('status')}</dt>
          <dd className="mt-1 text-slate-600">
            <div>{item.readUtc ? `${l('readAt')}: ${formatDate(item.readUtc)}` : l('notReadYet')}</div>
            <div>{item.repliedUtc ? `${l('repliedAt')}: ${formatDate(item.repliedUtc)}` : l('noReplyYet')}</div>
          </dd>
        </div>
      </dl>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-700">{l('details')}</summary>
        <div className="mt-3 grid gap-3">
          <JsonBlock title={l('messagePayload')} value={prettyJson(item.actionDataJson)} />
          {item.responseDataJson ? <JsonBlock title={l('responsePayload')} value={prettyJson(item.responseDataJson)} /> : null}
          <p className="break-all font-mono text-[11px] leading-5 text-slate-500">
            <span className="font-sans font-bold text-slate-700">{l('technicalIds')}: </span>
            notification: {compactId(item.id)} · recipient: {compactId(item.recipientMemberId)} · sender: {compactId(item.createdByMemberId)}
          </p>
        </div>
      </details>
    </article>
  )
}

const LabeledField = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {children}
    {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
  </label>
)

const TextAreaInput = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`}
  />
)

const JsonBlock = ({ title, value }: { title: string; value: string }) => (
  <div>
    <div className="mb-1 font-bold text-slate-700">{title}</div>
    <pre className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] leading-5 text-slate-600">
      {value}
    </pre>
  </div>
)

const Panel = ({ title, description, count, children }: { title: string; description: string; count?: number; children: ReactNode }) => (
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>{typeof count === 'number' ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">{count}</span> : null}</div>
    {children}
  </section>
)
const FilterBar = ({ children }: { children: ReactNode }) => <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />
const SearchInput = (props: InputHTMLAttributes<HTMLInputElement>) => <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput {...props} className="w-full pl-9" /></div>
const SelectInput = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400" />
const FilterActions = ({ l, apply, reset }: { l: LabelFn; apply: () => Promise<void>; reset: () => void }) => <div className="flex gap-2"><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800" type="button" onClick={() => apply().catch(() => undefined)}>{l('apply')}</button><button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-white" type="button" onClick={reset}>{l('reset')}</button></div>
const DataTable = ({ headers, children }: { headers: string[]; children: ReactNode }) => <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-white text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>
const Loading = ({ text }: { text: string }) => <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>
const Empty = ({ text }: { text: string }) => <p className="p-5 text-sm text-slate-500">{text}</p>
const Pill = ({ tone, children }: { tone: 'green' | 'slate' | 'sky'; children: ReactNode }) => {
  const classes = tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : tone === 'sky' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>
}
const Pager = <T,>({ l, page, goToPage }: { l: LabelFn; page: AdminPagedResultDto<T>; goToPage: (page: number) => Promise<void> }) => <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-500"><span>{l('total')}: {page.totalCount} / {l('page')} {page.page}/{page.totalPages || 1}</span><div className="flex gap-2"><button className="rounded-xl border border-slate-200 px-3 py-1.5 font-bold transition hover:bg-slate-50 disabled:opacity-50" disabled={page.page <= 1} type="button" onClick={() => goToPage(page.page - 1).catch(() => undefined)}>{l('previous')}</button><button className="rounded-xl border border-slate-200 px-3 py-1.5 font-bold transition hover:bg-slate-50 disabled:opacity-50" disabled={page.totalPages === 0 || page.page >= page.totalPages} type="button" onClick={() => goToPage(page.page + 1).catch(() => undefined)}>{l('next')}</button></div></div>

export default AdminView
