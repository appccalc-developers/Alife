import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell, CalendarRange, ChevronRight, Church, ContactRound, Handshake, Loader2, Network, RefreshCw, Settings2, ShieldCheck, UserCog, UsersRound } from 'lucide-react'
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
import GroupManageView from './GroupManageView'
import type { GroupDto } from '../types'
import { localizeText } from '../utils/localizedText'
import { normalizeChurchManagementSection, type ChurchManagementSection } from '../app/routing/churchManagementAccess'

type AdminSection = 'overview' | 'users' | 'roles' | 'logs' | 'messages' | 'visitRequests' | 'files'
type ChurchHubSectionConfig = { key: ChurchManagementSection; label: string; description: string; icon: LucideIcon }
type ChurchManagementAreaConfig = { key: string; label: string; description: string; icon: LucideIcon; to: string }
type MessageTranslationDirection = 'zh-en' | 'en-zh'
type LocalText = { en: string; zh: string }
type LabelFn = (key: string, values?: Record<string, string | number>) => string

const labels: Record<string, LocalText> = {
  overview: { en: 'Church Management', zh: '教会管理' },
  users: { en: 'Member management', zh: '成员管理' },
  roles: { en: 'Role management', zh: '角色管理' },
  logs: { en: 'Operation logs', zh: '操作日志' },
  messages: { en: 'Notices', zh: '通知管理' },
  visitRequests: { en: 'Visitor care', zh: '访客接待' },
  files: { en: 'Platform files', zh: '平台文件管理' },
  usersDescription: { en: 'Manage church membership, account state, management roles, and group participation.', zh: '集中管理教会成员资格、账号状态、管理角色和所在小组。' },
  rolesDescription: { en: 'Create roles, delete unused custom roles, and control which features each role can use.', zh: '创建角色、删除未使用的自定义角色，并控制每个角色可用的功能。' },
  logsDescription: { en: 'Review platform-level administrative actions.', zh: '查看平台级管理操作记录。' },
  messagesDescription: { en: 'Send notices to members and check whether they were read or replied to.', zh: '向成员发送通知，并查看是否已读或已回复。' },
  visitRequestsDescription: { en: 'Review visit interest from the public home page and track follow-up status.', zh: '查看首页收集的参观联系请求，并跟踪接待跟进状态。' },
  filesDescription: { en: 'Review registered uploads across the platform by visibility, purpose, and related record.', zh: '按可见范围、用途和关联对象查看全平台已登记上传文件。' },
  memberVisitorCareLink: { en: 'Open visitor care records', zh: '查看访客接待记录' },
  sermonsDescription: { en: 'Run a manual sync from connected sermon sources.', zh: '从已连接来源手动同步讲道。' },
  homeDescription: { en: 'Review group page submissions before they become public.', zh: '审核小组提交的页面，确认后再对外发布。' },
  createDefaultHome: { en: 'Review submitted pages', zh: '审核提交页面' },
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
  memberUpdated: { en: 'Member profile updated.', zh: '成员资料已更新。' },
  membershipUpdated: { en: 'Church membership updated.', zh: '教会成员资格已更新。' },
  rolePermissionsUpdated: { en: 'Role permissions updated.', zh: '角色权限已更新。' },
  roleCreated: { en: 'Role created.', zh: '角色已创建。' },
  roleDeleted: { en: 'Role deleted.', zh: '角色已删除。' },
  messageSent: { en: 'Message sent to {count} recipient(s).', zh: '消息已发送给 {count} 位接收人。' },
  visitRequestUpdated: { en: 'Visitor request updated.', zh: '访客接待状态已更新。' },
  actionSucceeded: { en: 'Action completed', zh: '操作已完成' },
  actionFailed: { en: 'Action failed', zh: '操作失败' },
  loadFailed: { en: 'Unable to load admin data.', zh: '无法加载管理数据。' },
  networkHint: { en: 'The API did not respond. Check that the backend host and Vite proxy are running.', zh: 'API 没有响应，请确认后端服务和 Vite 代理正在运行。' },
  roleUpdateFailed: { en: 'Unable to update this role.', zh: '无法更新这个角色。' },
  memberUpdateFailed: { en: 'Unable to update this member.', zh: '无法更新该成员资料。' },
  membershipUpdateFailed: { en: 'Unable to update church membership.', zh: '无法更新教会成员资格。' },
  rolePermissionsUpdateFailed: { en: 'Unable to update role permissions.', zh: '无法更新角色权限。' },
  roleCreateFailed: { en: 'Unable to create this role.', zh: '无法创建这个角色。' },
  roleDeleteFailed: { en: 'Unable to delete this role.', zh: '无法删除这个角色。' },
  sendFailed: { en: 'Unable to send this message.', zh: '无法发送这条消息。' },
  visitRequestUpdateFailed: { en: 'Unable to update this visitor request.', zh: '无法更新这条访客接待请求。' },
  superAdminOnly: { en: 'Only a super admin can change platform roles.', zh: '只有超级管理员可以修改平台角色。' },
  rolePermissions: { en: 'Role permissions', zh: '角色功能权限' },
  rolePermissionsDescription: { en: 'Choose which admin workspace features each platform role can use.', zh: '选择每个后台角色可以使用的功能。' },
  expandRolePermissions: { en: 'Expand role permissions summary', zh: '展开角色功能权限概览' },
  collapseRolePermissions: { en: 'Collapse role permissions summary', zh: '收起角色功能权限概览' },
  superAdminAlwaysAll: { en: 'System Admin always has every permission.', zh: '系统管理员始终拥有全部权限。' },
  superAdminHidden: { en: 'System Admin is hidden here because it is immutable and always has full access.', zh: '超级管理员在此处隐藏，因为它不可修改且始终拥有全部权限。' },
  roleCatalog: { en: 'Managed roles', zh: '可管理角色' },
  roleCatalogDescription: { en: 'Tune permissions for visible roles. System Admin is protected outside this list.', zh: '调整可见角色的权限。超级管理员在列表外受到保护。' },
  customRole: { en: 'Custom role', zh: '自定义角色' },
  enabledPermissions: { en: 'Enabled permissions', zh: '已启用权限' },
  managedRoleCount: { en: 'Managed roles', zh: '可管理角色' },
  roleList: { en: 'Role list', zh: '角色列表' },
  roleListDescription: { en: 'Search and select one role to edit. This layout stays usable when the role list grows.', zh: '搜索并选择一个角色进行编辑。角色变多时，这个布局仍然容易使用。' },
  searchRoles: { en: 'Search roles', zh: '搜索角色' },
  permissionModelHint: { en: 'These are platform-wide permissions. Church and group workspace management is controlled separately by leader and co-leader roles.', zh: '这里列出的是平台级权限。教会和小组工作区的管理权限由负责人和协同负责人角色单独控制。' },
  selectedRole: { en: 'Selected role', zh: '当前角色' },
  noRolesMatch: { en: 'No roles match this search.', zh: '没有匹配的角色。' },
  newRole: { en: 'New role', zh: '新角色' },
  roleCode: { en: 'Role code', zh: '角色代码' },
  roleCodeHint: { en: 'Use lowercase letters, numbers, dots, underscores, or hyphens.', zh: '使用小写字母、数字、点、下划线或短横线。' },
  roleCodeRequired: { en: 'Role code is required.', zh: '请填写角色代码。' },
  roleCodeFormatError: { en: 'Start with a letter. Use 2-50 lowercase letters, numbers, dots, underscores, or hyphens.', zh: '必须以字母开头，2-50 个字符，仅可使用小写字母、数字、点、下划线或短横线。' },
  roleCodeReserved: { en: 'This is a built-in role code. Choose a custom code.', zh: '这是内置角色代码，请换一个自定义代码。' },
  roleCodeDuplicate: { en: 'This role code already exists.', zh: '这个角色代码已存在。' },
  roleCodeValid: { en: 'Looks good. Example style: event.manager or sermon_editor.', zh: '格式正确。示例：event.manager 或 sermon_editor。' },
  roleNamesRequired: { en: 'English and Chinese role names are required.', zh: '英文和中文名称都需要填写。' },
  roleNameEn: { en: 'English name', zh: '英文名称' },
  roleNameZh: { en: 'Chinese name', zh: '中文名称' },
  createRole: { en: 'Create role', zh: '创建角色' },
  addRole: { en: 'Add role', zh: '添加角色' },
  cancel: { en: 'Cancel', zh: '取消' },
  closeDialog: { en: 'Close dialog', zh: '关闭弹窗' },
  initialPermissions: { en: 'Initial permissions', zh: '初始权限' },
  deleteRole: { en: 'Delete role', zh: '删除角色' },
  assignedMembers: { en: 'Assigned members', zh: '已分配成员' },
  builtInRole: { en: 'Built-in role', zh: '内置角色' },
  member: { en: 'Member', zh: '成员' },
  accountDetails: { en: 'Account details', zh: '账号详情' },
  editMember: { en: 'Edit member', zh: '修改资料' },
  editMemberDescription: { en: 'Update this member’s basic account information.', zh: '修改该成员的基本账号资料。' },
  displayName: { en: 'Display name', zh: '显示名称' },
  email: { en: 'Email', zh: '邮箱' },
  phone: { en: 'Phone', zh: '手机号' },
  phoneE164Hint: { en: 'Choose a region and enter the local number. A leading zero is accepted.', zh: '选择地区后输入本地号码，可以保留开头的 0。' },
  saveChanges: { en: 'Save changes', zh: '保存修改' },
  saving: { en: 'Saving...', zh: '保存中...' },
  createdAt: { en: 'Created at', zh: '创建时间' },
  updatedAt: { en: 'Last updated', zh: '最后更新' },
  roleAssignment: { en: 'Role assignment', zh: '角色分配' },
  selectMemberHint: { en: 'Select a member from the directory to manage roles.', zh: '从成员目录中选择一位成员来管理角色。' },
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
  noVisitRequests: { en: 'No visitor contact requests found.', zh: '没有找到访客联系请求。' },
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
  pageSize: { en: 'Per page', zh: '每页' },
  total: { en: 'Total', zh: '总数' },
  sendMessage: { en: 'Send notice', zh: '发送通知' },
  platform: { en: 'Whole platform', zh: '全平台' },
  group: { en: 'Group', zh: '小组' },
  platformRoleAudience: { en: 'Role', zh: '角色' },
  chooseRoles: { en: 'Choose roles', zh: '选择角色' },
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
  noPlatformTasks: { en: 'No urgent platform tasks right now.', zh: '当前没有紧急平台待办。' },
  visitorName: { en: 'Visitor', zh: '访客' },
  submittedAt: { en: 'Submitted', zh: '提交时间' },
  sourcePage: { en: 'Source page', zh: '来源页面' },
  handledBy: { en: 'Handled by', zh: '处理人' },
  contactAgain: { en: 'Mark follow-up', zh: '标记待跟进' },
  markContacted: { en: 'Mark contacted', zh: '标记已联系' },
  newVisitRequest: { en: 'New request', zh: '新请求' },
  followUp: { en: 'Follow-up', zh: '待跟进' },
  contacted: { en: 'Contacted', zh: '已联系' },
} satisfies Record<string, LocalText>

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

const AdminView = () => {
  const t = useUiText()
  const { language, me, hasAdminPermission, canManageGroup } = useAuthStore()
  const section = sectionFromPath(useLocation().pathname)
  const [searchParams] = useSearchParams()
  const churchHubSection = normalizeChurchManagementSection(searchParams.get('church'))
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
    titleEn: '',
    titleZh: '',
    bodyEn: '',
    bodyZh: '',
  })
  const [roleForm, setRoleForm] = useState({
    code: '',
    nameEn: '',
    nameZh: '',
    permissionCodes: [] as string[],
  })

  const isSuperAdmin = me?.platformRole === 'superadmin'
  const roleOptions = useMemo(() => {
    const seeded = roles.length ? roles : [
      { id: 0, code: 'user', name: { en: 'User', zh: '普通用户' }, level: 0, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
      { id: 10, code: 'admin', name: { en: 'Admin', zh: '管理员' }, level: 10, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
      { id: 100, code: 'superadmin', name: { en: 'System Admin', zh: '系统管理员' }, level: 100, permissions: [], availablePermissions: [], canEditPermissions: false, isSystem: true, canDelete: false, assignedMemberCount: 0 },
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
      const tasks: Promise<unknown>[] = [loadChurch()]
      if (hasAdminPermission('admin.members.view')) tasks.push(loadUsers(1))
      if (hasAdminPermission('admin.messages.manage')) tasks.push(loadMessages(1))
      await Promise.all(tasks)
    }
    setMessage(l('refreshed'))
  }, [hasAdminPermission, l, loadChurch, loadLogs, loadMessages, loadUsers, loadVisitRequests, logs.page, section])

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
      const tasks: Promise<unknown>[] = [loadChurch()]
      if (hasAdminPermission('admin.members.view')) tasks.push(loadUsers(1))
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
    if (!church) throw new Error(language === 'zh' ? '找不到教会资料。' : 'Church data is unavailable.')
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
      setRoleForm({ code: '', nameEn: '', nameZh: '', permissionCodes: [] })
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
      setSendForm((current) => ({ ...current, titleEn: '', titleZh: '', bodyEn: '', bodyZh: '' }))
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

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-2 py-3 sm:px-4">
      {section === 'messages' ? <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{t('admin')}</p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{l(section)}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('adminDescription')}</p>
            </div>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} type="button" onClick={() => refreshCurrent().catch(() => undefined)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {l('refresh')}
            </button>
          </div>
        </div>
      </header> : null}

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
        <ChurchManagementHub
          activeSection={churchHubSection}
          church={church}
          canManageChurch={Boolean(church && canManageGroup(church.id))}
          users={members}
          messages={messages}
          syncing={syncing}
          loading={loading}
          syncSermons={syncSermons}
          refresh={refreshCurrent}
          language={language}
        />
      ) : null}
      {section === 'users' ? <MembersSection roles={roleOptions} groups={groups} isSuperAdmin={isSuperAdmin} canAssignPlatformRoles={hasAdminPermission('admin.members.assignPlatformRoles')} canManageMemberProfiles={hasAdminPermission('admin.members.manageProfiles')} canManageMembership={Boolean(church && canManageGroup(church.id))} updatingMemberId={updatingMemberId} updatingMemberProfileId={updatingMemberProfileId} updatingMembershipId={updatingMembershipId} updateMemberRoles={updateMemberRoles} updateMemberProfile={updateMemberProfile} updateMembership={updateChurchMembership} language={language} currentMemberId={me?.id || ''} /> : null}
      {section === 'roles' ? <RolesSection l={l} roles={roleOptions} roleForm={roleForm} setRoleForm={setRoleForm} creatingRole={creatingRole} deletingRoleId={deletingRoleId} updatingRolePermissionId={updatingRolePermissionId} roleCodeValidation={roleCodeValidation} roleCodeFeedback={roleCodeFeedback} canSubmitCreateRole={canSubmitCreateRole} createRole={createRole} deleteRole={deleteRole} updateRolePermissions={updateRolePermissions} refresh={refreshCurrent} loading={loading} language={language} /> : null}
      {section === 'logs' ? <LogsSection l={l} loading={loading} page={logs} filters={logFilters} setFilters={setLogFilters} apply={() => loadLogs(1, 25)} goToPage={(page) => loadLogs(page, 25)} language={language} /> : null}
      {section === 'messages' ? <MessagesSection l={l} loading={loading} page={messages} filters={messageFilters} setFilters={setMessageFilters} apply={() => loadMessages(1)} goToPage={loadMessages} groups={groups} roles={roleOptions} members={members.items} sendForm={sendForm} setSendForm={setSendForm} sendMessage={sendMessage} translateMessage={translateMessage} aiTranslating={messageAiDirection} language={language} /> : null}
      {section === 'visitRequests' ? <VisitRequestsSection l={l} loading={loading} page={visitRequests} filters={visitRequestFilters} setFilters={setVisitRequestFilters} apply={() => loadVisitRequests(1)} goToPage={loadVisitRequests} updateStatus={updateVisitRequestStatus} updatingId={updatingVisitRequestId} language={language} /> : null}
      {section === 'files' ? <PlatformFilesSection l={l} language={language} groups={groups} /> : null}
    </section>
  )
}

const ChurchManagementHub = ({
  activeSection,
  church,
  canManageChurch,
  users,
  messages,
  syncing,
  loading,
  syncSermons,
  refresh,
  language,
}: {
  activeSection: ChurchManagementSection
  church: GroupDto | null
  canManageChurch: boolean
  users: AdminPagedResultDto<AdminMemberDto>
  messages: AdminPagedResultDto<AdminNotificationDto>
  syncing: boolean
  loading: boolean
  syncSermons: () => Promise<void>
  refresh: () => Promise<void>
  language: string
}) => {
  const auth = useAuthStore()
  const [workspaceRefreshRequest, setWorkspaceRefreshRequest] = useState(0)
  const isChinese = language === 'zh'
  const churchName = localizeText(church?.name, language) || (isChinese ? '教会' : 'Church')
  const managementSections: ChurchHubSectionConfig[] = [
    { key: 'group', label: isChinese ? '资料与设置' : 'Profile & settings', description: isChinese ? '教会身份、介绍与访问规则' : 'Identity, description, and access rules', icon: Settings2 },
    { key: 'members', label: isChinese ? '成员管理' : 'Member management', description: isChinese ? '成员资格、账号、职能与所在小组' : 'Membership, accounts, duties, and groups', icon: UsersRound },
    { key: 'contacts', label: isChinese ? '联系人' : 'Contacts', description: isChinese ? '公开联系人与留言入口' : 'Public contacts and inquiry entry points', icon: ContactRound },
    { key: 'subgroups', label: isChinese ? '组织架构' : 'Organization', description: isChinese ? '事工、小组与负责人结构' : 'Ministries, groups, and leadership structure', icon: Network },
  ]
  const churchWorkspaceSections = managementSections.filter((section) => section.key !== 'members')
  const dashboardAreas: ChurchManagementAreaConfig[] = [
    ...(auth.hasAdminPermission('admin.members.view')
      ? [{ key: 'members', label: isChinese ? '成员管理' : 'Member management', description: isChinese ? '成员资格、账号、管理职能与所在小组' : 'Membership, accounts, management duties, and groups', icon: UsersRound, to: '/admin/users' }]
      : canManageChurch
        ? [{ key: 'members', label: isChinese ? '成员管理' : 'Member management', description: isChinese ? '审批教会成员资格与成员状态' : 'Review church membership and member status', icon: UsersRound, to: '/admin?church=members' }]
        : []),
    ...(canManageChurch ? churchWorkspaceSections.map((section) => ({ ...section, to: `/admin?church=${section.key}` })) : []),
    ...(auth.hasAdminPermission('admin.roles.managePermissions') ? [{ key: 'roles', label: isChinese ? '角色管理' : 'Role management', description: isChinese ? '后台角色、权限范围与功能访问' : 'Admin roles, permissions, and feature access', icon: UserCog, to: '/admin/roles' }] : []),
    ...(auth.hasAdminPermission('admin.messages.manage') ? [{ key: 'notices', label: isChinese ? '通知管理' : 'Notification management', description: isChinese ? '发送通知并查看阅读与回复状态' : 'Send notifications and review read and reply status', icon: Bell, to: '/admin/messages' }] : []),
    ...(auth.hasAdminPermission('admin.visitRequests.receive') ? [{ key: 'visitors', label: isChinese ? '访客接待' : 'Visitor care', description: isChinese ? '处理参观联系请求和跟进状态' : 'Handle visit requests and follow-up status', icon: Handshake, to: '/admin/visit-requests' }] : []),
    ...(auth.hasAdminPermission('admin.events.manageTemplates') ? [{ key: 'event-templates', label: isChinese ? '活动模板' : 'Event templates', description: isChinese ? '管理四个固定活动分类下的创建模板' : 'Manage creation templates within the four fixed event categories', icon: CalendarRange, to: '/admin/event-templates' }] : []),
    ...(auth.hasAdminPermission('admin.events.managePackagePolicies') ? [{ key: 'event-package-policies', label: isChinese ? '活动方案政策' : 'Event Package policies', description: isChinese ? '管理审批等级、有效期、委派和渐进启用' : 'Manage approval tiers, validity, delegation, and rollout', icon: ShieldCheck, to: '/admin/event-package-policies' }] : []),
  ]
  const canAccessDashboard = dashboardAreas.length > 0
  const refreshWorkspace = async () => {
    setWorkspaceRefreshRequest((current) => current + 1)
    await refresh()
  }

  if (activeSection === 'dashboard') {
    if (!church) return <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 text-sm text-[#60716a]">{isChinese ? '正在加载教会管理…' : 'Loading church management…'}</section>
    if (!canAccessDashboard) return <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">{isChinese ? '你没有进入教会管理的权限。' : 'You do not have access to church management.'}</section>
    return <ChurchManagementDashboard churchName={churchName} sections={dashboardAreas} users={users} messages={messages} syncing={syncing} loading={loading} syncSermons={syncSermons} refresh={refresh} language={language} />
  }

  const activeConfig = managementSections.find((item) => item.key === activeSection) ?? managementSections[0]
  if (!church) return <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 text-sm text-[#60716a]">{isChinese ? '正在加载教会管理资料…' : 'Loading church management data…'}</section>
  if (!canManageChurch) return <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">{isChinese ? '你没有修改教会资料的权限。' : 'You do not have permission to modify church data.'}</section>

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/admin?church=dashboard" className="inline-flex items-center gap-1 text-xs font-black text-[#176b5a] transition hover:text-[#0f4f42]"><ChevronRight className="h-3.5 w-3.5 rotate-180" />{isChinese ? '返回教会管理' : 'Back to church management'}</Link>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{activeConfig.label}</h1>
          <p className="mt-1 text-sm text-[#687770]">{activeConfig.description}</p>
        </div>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#d7e3dd] bg-white px-4 text-sm font-black text-[#176b5a] transition hover:bg-[#edf5f1] disabled:opacity-60 sm:self-auto" disabled={loading} type="button" onClick={() => refreshWorkspace().catch(() => undefined)}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />{isChinese ? '刷新' : 'Refresh'}
        </button>
      </header>
      <GroupManageView embeddedWorkspace explicitGroupId={church.id} workspaceBasePath="/admin" sectionParamName="church" integrated refreshRequest={workspaceRefreshRequest} subgroupDetailBasePath={auth.isAdmin ? '/admin/groups' : undefined} />
    </div>
  )
}

const ChurchManagementDashboard = ({ churchName, sections, users, messages, syncing, loading, syncSermons, refresh, language }: {
  churchName: string
  sections: ChurchManagementAreaConfig[]
  users: AdminPagedResultDto<AdminMemberDto>
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
  const showMemberMetric = auth.hasAdminPermission('admin.members.view')
  const showMessageMetric = auth.hasAdminPermission('admin.messages.manage')
  const showSermonSync = auth.hasAdminPermission('admin.sermons.sync')

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#254b42] bg-white shadow-[0_24px_70px_rgba(14,47,40,0.16)]">
      <header className="relative isolate overflow-hidden bg-[#0e3029] px-6 py-6 text-white sm:px-8 sm:py-7">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#e29a66]/22 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#f6d3b5]"><Church className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">{isChinese ? '教会管理' : 'Church management'}</p>
              <h1 className="mt-1.5 truncate text-3xl font-black tracking-[-0.045em]">{churchName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{isChinese ? '成员、组织、通知与教会资料集中管理。' : 'Manage people, organization, notices, and church information in one place.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 self-start lg:self-auto">
            {showMemberMetric ? <div><p className="text-2xl font-black tabular-nums">{users.totalCount}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{isChinese ? '成员' : 'Members'}</p></div> : null}
            {showMessageMetric ? <div className={showMemberMetric ? 'border-l border-white/12 pl-5' : ''}><p className="text-2xl font-black tabular-nums">{unreadCount}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{isChinese ? '未读通知' : 'Unread'}</p></div> : null}
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-60" type="button" disabled={loading} onClick={() => refresh().catch(() => undefined)} aria-label={isChinese ? '刷新教会管理' : 'Refresh church management'}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      <div className={showSermonSync ? 'grid xl:grid-cols-[minmax(0,1fr)_19rem]' : 'grid'}>
        <div className="min-w-0">
          <div className="px-6 pb-3 pt-5 sm:px-8"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#176b5a]">{isChinese ? '管理功能' : 'Management areas'}</p><h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#18332d]">{isChinese ? '选择要处理的内容' : 'Choose what to manage'}</h2></div>
          <div className="grid border-t border-[#e3e8e5] md:grid-cols-2">
          {sections.map((section, index) => {
            const Icon = section.icon
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
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7b8882]">{isChinese ? '快捷操作' : 'Quick actions'}</p>
          <div className="mt-3 divide-y divide-[#dfe5e1] border-y border-[#dfe5e1]">
            <button type="button" disabled={syncing} onClick={() => syncSermons().catch(() => undefined)} className="group flex w-full items-center gap-3 py-4 text-left text-[#31544b] transition hover:text-[#176b5a] disabled:opacity-60">{syncing ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <RefreshCw className="h-5 w-5 shrink-0" />}<span className="min-w-0 flex-1"><span className="block text-sm font-black">{syncing ? (isChinese ? '正在同步…' : 'Syncing…') : (isChinese ? '同步讲道' : 'Sync sermons')}</span><span className="mt-0.5 block text-xs font-semibold text-[#7a8782]">{isChinese ? '更新讲道来源' : 'Refresh sermon sources'}</span></span><ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
          </div>
          <p className="mt-5 text-xs font-semibold leading-5 text-[#7a8782]">{isChinese ? `共 ${sections.length} 个管理功能，所有入口集中在当前页面。` : `${sections.length} management areas, all available from this page.`}</p>
        </aside> : null}
      </div>
    </section>
  )
}


export default AdminView
