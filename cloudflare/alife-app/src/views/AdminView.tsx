import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell, ChevronRight, Church, ContactRound, FileText, GalleryHorizontal, Handshake, Loader2, Network, Pencil, RefreshCw, Settings2, ShieldCheck, UserCog, UsersRound, X } from 'lucide-react'
import {
  groupService,
  type AdminGroupOptionDto,
  type AdminMemberDto,
  type AdminNotificationDto,
  type AdminPagedResultDto,
  type AdminPlatformRoleDto,
  type AuditLogDto,
  type VisitContactRequestDto,
  type VisitContactRequestStatus,
} from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { aiTranslationService } from '../services/aiTranslationService'
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import type { MissingTranslatableField } from '../utils/bilingualValidation'
import { Panel, FilterBar, SearchInput, SelectInput, FilterActions, Loading, Empty, Pill, Pager } from './admin/AdminUi'
import { VisitRequestsSection } from './admin/VisitRequestsSection'
import { MessagesSection } from './admin/MessagesSection'
import { RolesSection } from './admin/RolesSection'
import { LogsSection } from './admin/LogsSection'
import { PlatformFilesSection } from './admin/FilesSection'
import { formatDate, formatRole, readLocalized } from './admin/adminUtils'
import RegionalPhoneInput from '../components/forms/RegionalPhoneInput'
import { isValidPhoneNumber } from '../utils/phoneNumber'
import GroupManageView from './GroupManageView'
import type { GroupDto } from '../types'
import { localizeText } from '../utils/localizedText'

type AdminSection = 'overview' | 'users' | 'roles' | 'logs' | 'messages' | 'visitRequests' | 'files'
type ChurchHubSection = 'dashboard' | 'group' | 'members' | 'contacts' | 'subgroups' | 'albums' | 'pages'
type ChurchHubSectionConfig = { key: ChurchHubSection; label: string; description: string; icon: LucideIcon }
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
  usersDescription: { en: 'Manage accounts, registration state, and platform roles.', zh: '管理账号、注册状态和平台角色。' },
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
  rolePermissionsUpdateFailed: { en: 'Unable to update role permissions.', zh: '无法更新角色权限。' },
  roleCreateFailed: { en: 'Unable to create this role.', zh: '无法创建这个角色。' },
  roleDeleteFailed: { en: 'Unable to delete this role.', zh: '无法删除这个角色。' },
  sendFailed: { en: 'Unable to send this message.', zh: '无法发送这条消息。' },
  visitRequestUpdateFailed: { en: 'Unable to update this visitor request.', zh: '无法更新这条访客接待请求。' },
  superAdminOnly: { en: 'Only a super admin can change platform roles.', zh: '只有超级管理员可以修改平台角色。' },
  rolePermissions: { en: 'Role permissions', zh: '角色功能权限' },
  rolePermissionsDescription: { en: 'Choose which admin workspace features each platform role can use.', zh: '选择每个后台角色可以使用的功能。' },
  superAdminAlwaysAll: { en: 'System Admin always has every permission.', zh: '系统管理员始终拥有全部权限。' },
  superAdminHidden: { en: 'System Admin is hidden here because it is immutable and always has full access.', zh: '超级管理员在此处隐藏，因为它不可修改且始终拥有全部权限。' },
  roleCatalog: { en: 'Managed roles', zh: '可管理角色' },
  roleCatalogDescription: { en: 'Tune permissions for visible roles. System Admin is protected outside this list.', zh: '调整可见角色的权限。超级管理员在列表外受到保护。' },
  customRole: { en: 'Custom role', zh: '自定义角色' },
  enabledPermissions: { en: 'Enabled permissions', zh: '已启用权限' },
  managedRoleCount: { en: 'Managed roles', zh: '可管理角色' },
  roleList: { en: 'Role list', zh: '角色列表' },
  roleListDescription: { en: 'Search and select one role to edit. This layout stays usable when the role list grows.', zh: '搜索并选择一个角色进行编辑。角色变多时，这个布局仍然容易使用。' },
  permissionModelHint: { en: 'Permissions are built-in platform features. Create a role first, then choose which features that role can use.', zh: '权限来自系统内置功能清单。先创建角色，再勾选这个角色可以使用的功能。' },
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
const roleTone: Record<string, string> = {
  superadmin: 'border-rose-200 bg-rose-50 text-rose-700',
  admin: 'border-amber-200 bg-amber-50 text-amber-700',
  user: 'border-slate-200 bg-slate-50 text-slate-600',
}
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
const churchHubSectionKeys = new Set<ChurchHubSection>(['dashboard', 'group', 'members', 'contacts', 'subgroups', 'albums', 'pages'])
const readChurchHubSection = (value: string | null): ChurchHubSection => churchHubSectionKeys.has(value as ChurchHubSection) ? value as ChurchHubSection : 'dashboard'

const AdminView = () => {
  const t = useUiText()
  const { language, me, hasAdminPermission, canManageGroup } = useAuthStore()
  const section = sectionFromPath(useLocation().pathname)
  const [searchParams] = useSearchParams()
  const churchHubSection = readChurchHubSection(searchParams.get('church'))
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
  const [updatingRolePermissionId, setUpdatingRolePermissionId] = useState<number | null>(null)
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null)
  const [creatingRole, setCreatingRole] = useState(false)
  const [messageAiDirection, setMessageAiDirection] = useState<MessageTranslationDirection | null>(null)
  const [userFilters, setUserFilters] = useState({ search: '', role: '', isRegistered: '' })
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
      const isRegistered = userFilters.isRegistered === '' ? null : userFilters.isRegistered === 'true'
      setMembers(await groupService.getAdminMembers({ ...userFilters, isRegistered, page, pageSize }))
    } catch (reason) {
      setError(await formatLoadError(reason, 'members'))
    } finally {
      setLoading(false)
    }
  }, [formatLoadError, members.page, section, userFilters])

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
    if (section === 'users') await loadUsers()
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
    if (section === 'users') loadUsers(1).catch(() => undefined)
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
    if (member.id === me?.id) return setError(l('cannotChangeOwnRole'))
    if (roleCode === 'superadmin') return setError(l('cannotAssignSuperAdmin'))
    const currentRoles = member.platformRoles.filter((role) => role !== 'user')
    const roleCodes = enabled
      ? Array.from(new Set([...currentRoles, roleCode]))
      : currentRoles.filter((role) => role !== roleCode)
    if (currentRoles.length === roleCodes.length && currentRoles.every((role) => roleCodes.includes(role))) return
    setUpdatingMemberId(member.id)
    setError('')
    setMessage('')
    try {
      await groupService.setMemberPlatformRoles(member.id, roleCodes)
      setMessage(l('roleUpdated'))
      await runQuietly(loadUsers(members.page), loadLogs(1, section === 'overview' ? overviewActivityPageSize : 25))
    } catch (reason) {
      setError(formatActionError(reason, l('roleUpdateFailed')))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const updateMemberProfile = async (memberId: string, payload: { displayName: string; email: string | null; phoneE164: string | null }) => {
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
      {section !== 'overview' ? <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
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
      {section === 'users' ? <UsersSection l={l} loading={loading} page={members} filters={userFilters} setFilters={setUserFilters} roles={roleOptions} isSuperAdmin={isSuperAdmin} canManageMemberProfiles={hasAdminPermission('admin.members.manageProfiles')} updatingMemberId={updatingMemberId} updatingMemberProfileId={updatingMemberProfileId} apply={() => loadUsers(1)} reset={() => { setUserFilters({ search: '', role: '', isRegistered: '' }); setTimeout(() => loadUsers(1).catch(() => undefined), 0) }} goToPage={loadUsers} updateMemberRoles={updateMemberRoles} updateMemberProfile={updateMemberProfile} language={language} currentMemberId={me?.id || ''} /> : null}
      {section === 'roles' ? <RolesSection l={l} roles={roleOptions} roleForm={roleForm} setRoleForm={setRoleForm} creatingRole={creatingRole} deletingRoleId={deletingRoleId} updatingRolePermissionId={updatingRolePermissionId} roleCodeValidation={roleCodeValidation} roleCodeFeedback={roleCodeFeedback} canSubmitCreateRole={canSubmitCreateRole} createRole={createRole} deleteRole={deleteRole} updateRolePermissions={updateRolePermissions} language={language} /> : null}
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
  activeSection: ChurchHubSection
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
  const isChinese = language === 'zh'
  const churchName = localizeText(church?.name, language) || (isChinese ? '教会' : 'Church')
  const managementSections: ChurchHubSectionConfig[] = [
    { key: 'group', label: isChinese ? '资料与设置' : 'Profile & settings', description: isChinese ? '教会身份、介绍与访问规则' : 'Identity, description, and access rules', icon: Settings2 },
    { key: 'members', label: isChinese ? '教会成员' : 'Church members', description: isChinese ? '审批、角色与成员状态' : 'Approvals, roles, and member status', icon: UsersRound },
    { key: 'contacts', label: isChinese ? '联系人' : 'Contacts', description: isChinese ? '公开联系人与留言入口' : 'Public contacts and inquiry entry points', icon: ContactRound },
    { key: 'subgroups', label: isChinese ? '组织架构' : 'Organization', description: isChinese ? '事工、小组与负责人结构' : 'Ministries, groups, and leadership structure', icon: Network },
    { key: 'albums', label: isChinese ? '教会相册' : 'Church albums', description: isChinese ? '图片资产、相册和展示内容' : 'Image assets, albums, and presentation', icon: GalleryHorizontal },
    { key: 'pages', label: isChinese ? '页面内容' : 'Page content', description: isChinese ? '教会页面、公开范围与发布' : 'Church pages, visibility, and publishing', icon: FileText },
  ]
  const dashboardAreas: ChurchManagementAreaConfig[] = [
    ...(canManageChurch ? managementSections.map((section) => ({ ...section, to: `/admin?church=${section.key}` })) : []),
    ...(auth.hasAdminPermission('admin.members.view') ? [{ key: 'accounts', label: isChinese ? '账号管理' : 'Account management', description: isChinese ? '账号状态、成员资料与平台角色' : 'Account state, member profiles, and platform roles', icon: UsersRound, to: '/admin/users' }] : []),
    ...(auth.hasAdminPermission('admin.roles.managePermissions') ? [{ key: 'roles', label: isChinese ? '角色管理' : 'Role management', description: isChinese ? '后台角色、权限范围与功能访问' : 'Admin roles, permissions, and feature access', icon: UserCog, to: '/admin/roles' }] : []),
    ...(auth.hasAdminPermission('admin.messages.manage') ? [{ key: 'notices', label: isChinese ? '通知管理' : 'Notification management', description: isChinese ? '发送通知并查看阅读与回复状态' : 'Send notifications and review read and reply status', icon: Bell, to: '/admin/messages' }] : []),
    ...(auth.hasAdminPermission('admin.visitRequests.receive') ? [{ key: 'visitors', label: isChinese ? '访客接待' : 'Visitor care', description: isChinese ? '处理参观联系请求和跟进状态' : 'Handle visit requests and follow-up status', icon: Handshake, to: '/admin/visit-requests' }] : []),
  ]
  const canAccessDashboard = dashboardAreas.length > 0

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
        <button className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#d7e3dd] bg-white px-4 text-sm font-black text-[#176b5a] transition hover:bg-[#edf5f1] disabled:opacity-60 sm:self-auto" disabled={loading} type="button" onClick={() => refresh().catch(() => undefined)}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />{isChinese ? '刷新' : 'Refresh'}
        </button>
      </header>
      <GroupManageView embeddedWorkspace explicitGroupId={church.id} workspaceBasePath="/admin" sectionParamName="church" integrated />
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
  const showSermonSync = auth.isAdmin

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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{isChinese ? '成员、组织、内容与教会资料集中管理。' : 'Manage people, organization, content, and church information in one place.'}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 self-start lg:self-auto">
            {showMemberMetric ? <div><p className="text-2xl font-black tabular-nums">{users.totalCount}</p><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{isChinese ? '账号' : 'Accounts'}</p></div> : null}
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

const UsersSection = ({ l, loading, page, filters, setFilters, roles, isSuperAdmin, canManageMemberProfiles, updatingMemberId, updatingMemberProfileId, apply, reset, goToPage, updateMemberRoles, updateMemberProfile, language, currentMemberId }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AdminMemberDto>
  filters: { search: string; role: string; isRegistered: string }
  setFilters: Dispatch<SetStateAction<{ search: string; role: string; isRegistered: string }>>
  roles: AdminPlatformRoleDto[]
  isSuperAdmin: boolean
  canManageMemberProfiles: boolean
  updatingMemberId: string | null
  updatingMemberProfileId: string | null
  apply: () => Promise<void>
  reset: () => void
  goToPage: (page: number) => Promise<void>
  updateMemberRoles: (member: AdminMemberDto, roleCode: string, enabled: boolean) => Promise<void>
  updateMemberProfile: (memberId: string, payload: { displayName: string; email: string | null; phoneE164: string | null }) => Promise<AdminMemberDto>
  language: string
  currentMemberId: string
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [editTarget, setEditTarget] = useState<AdminMemberDto | null>(null)
  const [editForm, setEditForm] = useState({ displayName: '', email: '', phoneE164: '' })
  const [editError, setEditError] = useState('')
  const selectedMember = page.items.find((member) => member.id === selectedMemberId) ?? page.items[0] ?? null
  const editing = Boolean(editTarget && updatingMemberProfileId === editTarget.id)

  const openEditDialog = (member: AdminMemberDto) => {
    setEditTarget(member)
    setEditForm({
      displayName: member.displayName || '',
      email: member.email || '',
      phoneE164: member.phoneE164 || '',
    })
    setEditError('')
  }

  const closeEditDialog = () => {
    if (editing) return
    setEditTarget(null)
    setEditError('')
  }

  const submitMemberProfile = async () => {
    if (!editTarget || editing) return
    const displayName = editForm.displayName.trim()
    if (!displayName) {
      setEditError(`${l('displayName')}: ${language === 'zh' ? '必填' : 'Required'}`)
      return
    }
    if (!isValidPhoneNumber(editForm.phoneE164)) {
      setEditError(language === 'zh' ? '请检查电话号码和所选地区。' : 'Check the phone number and selected region.')
      return
    }

    setEditError('')
    try {
      await updateMemberProfile(editTarget.id, {
        displayName,
        email: editForm.email.trim() || null,
        phoneE164: editForm.phoneE164.trim() || null,
      })
      setEditTarget(null)
    } catch (reason) {
      setEditError(normalizeApiError(reason).message)
    }
  }

  useEffect(() => {
    if (page.items.length && !selectedMember) {
      setSelectedMemberId(page.items[0].id)
    }
  }, [page.items, selectedMember])

  const renderRolePills = (member: AdminMemberDto) => {
    const activeRoleCodes = member.platformRoles.filter((role) => role !== 'user')
    const displayRoleCodes = activeRoleCodes.length ? activeRoleCodes : ['user']
    return displayRoleCodes.map((roleCode) => {
      const roleLabel = readLocalized(roles.find((role) => role.code === roleCode)?.name, language) || formatRole(roleCode)
      return (
        <span key={roleCode} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${roleTone[roleCode] || roleTone.admin}`}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          {roleLabel}
        </span>
      )
    })
  }

  const getCompactRoleText = (member: AdminMemberDto) => {
    const activeRoleCodes = member.platformRoles.filter((role) => role !== 'user')
    const displayRoleCodes = activeRoleCodes.length ? activeRoleCodes : ['user']
    return displayRoleCodes.map((roleCode) => readLocalized(roles.find((role) => role.code === roleCode)?.name, language) || formatRole(roleCode)).join(' / ')
  }

  return (
    <>
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
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium leading-6 text-slate-600">{l('guestReviewHint')}</p>
        <Link
          to="/admin/visit-requests"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          {l('memberVisitorCareLink')}
        </Link>
      </div>
      {!isSuperAdmin ? <p className="m-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{l('superAdminOnly')}</p> : null}
      {loading ? <Loading text={l('loading')} /> : page.items.length ? (
        <>
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h3 className="text-sm font-black text-slate-950">{l('member')}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">{page.totalCount} {l('total')}</p>
              </div>
              <div className="max-h-[68vh] overflow-y-auto p-2">
                {page.items.map((member) => {
                  const selected = selectedMember?.id === member.id
                  const displayName = member.displayName || l('unknown')
                  const initials = displayName.trim().slice(0, 2).toUpperCase()
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`flex w-full gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-emerald-200 bg-emerald-50/80 shadow-sm' : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${selected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{initials}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-black text-slate-950">{displayName}</span>
                          {member.id === currentMemberId ? <Pill tone="sky">{l('you')}</Pill> : null}
                        </span>
                        <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{member.email || member.phoneE164 || '-'}</span>
                        <span className="mt-1 block truncate text-[11px] font-bold text-emerald-700">{getCompactRoleText(member)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {selectedMember ? (
                <>
                  <div className="border-b border-slate-100 bg-gradient-to-r from-white via-emerald-50/70 to-white p-5">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-base font-black text-white shadow-sm ring-1 ring-emerald-200">
                          {(selectedMember.displayName || l('unknown')).trim().slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xl font-black text-slate-950">{selectedMember.displayName || l('unknown')}</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedMember.id === currentMemberId ? <Pill tone="sky">{l('you')}</Pill> : null}
                              {renderRolePills(selectedMember)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canManageMemberProfiles ? (
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                              onClick={() => openEditDialog(selectedMember)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              {l('editMember')}
                            </button>
                          ) : null}
                          <Pill tone={selectedMember.isRegistered ? 'green' : 'slate'}>{selectedMember.isRegistered ? l('registered') : l('guest')}</Pill>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white bg-white/80 p-3 shadow-sm">
                          <div className="text-xs font-black uppercase text-slate-400">{l('contact')}</div>
                          <div className="mt-2 break-all text-sm font-bold text-slate-800">{selectedMember.email || '-'}</div>
                          <div className="mt-1 break-all text-xs font-semibold text-slate-500">{selectedMember.phoneE164 || '-'}</div>
                        </div>
                        <div className="rounded-2xl border border-white bg-white/80 p-3 shadow-sm">
                          <div className="text-xs font-black uppercase text-slate-400">{l('groups')}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{selectedMember.approvedGroupCount} {l('approved')}</span>
                            <span className="rounded-xl bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{selectedMember.pendingGroupCount} {l('pending')}</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white bg-white/80 p-3 shadow-sm">
                          <div className="text-xs font-black uppercase text-slate-400">{l('registration')}</div>
                          <div className="mt-2 text-sm font-black text-slate-900">{selectedMember.isRegistered ? l('registered') : l('guest')}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">{selectedMember.platformRoles.filter((role) => role !== 'user').length || 1} {l('role')}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <h4 className="text-sm font-black text-slate-950">{l('accountDetails')}</h4>
                      <dl className="mt-4 grid gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-400">{l('createdAt')}</dt>
                          <dd className="mt-1 text-sm font-bold text-slate-800">{formatDate(selectedMember.createdUtc)}</dd>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-400">{l('updatedAt')}</dt>
                          <dd className="mt-1 text-sm font-bold text-slate-800">{formatDate(selectedMember.updatedUtc)}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-black text-slate-950">{l('roleAssignment')}</h4>
                      <div className="mt-3 grid gap-2">
                        {roles.filter((role) => role.code !== 'user' && role.code !== 'superadmin').map((role) => {
                          const checked = selectedMember.platformRoles.includes(role.code)
                          const protectedPlatformRole = role.code === 'admin' || role.code === 'superadmin'
                          const disabled = selectedMember.id === currentMemberId || updatingMemberId === selectedMember.id || (!isSuperAdmin && protectedPlatformRole)
                          return (
                            <label key={role.code} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${checked ? 'border-emerald-200 bg-emerald-50/80 text-slate-950' : 'border-slate-200 bg-white text-slate-600'} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-emerald-200'}`}>
                              <span>
                                <span className="block font-bold">{readLocalized(role.name, language) || formatRole(role.code)}</span>
                                <span className="block font-mono text-[11px] text-slate-400">{role.code}</span>
                              </span>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                                checked={checked}
                                disabled={disabled}
                                onChange={(event) => updateMemberRoles(selectedMember, role.code, event.target.checked).catch(() => undefined)}
                              />
                            </label>
                          )
                        })}
                      </div>
                      {updatingMemberId === selectedMember.id ? <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />{l('loading')}</p> : null}
                    </section>
                  </div>
                </>
              ) : <Empty text={l('selectMemberHint')} />}
            </section>
          </div>
          <Pager l={l} page={page} goToPage={goToPage} />
        </>
      ) : <Empty text={l('noMembers')} />}
    </Panel>

    {editTarget ? (
      <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/50 px-4 pb-24 pt-6 backdrop-blur-sm sm:items-center sm:justify-center sm:py-6" role="presentation">
        <button type="button" className="absolute inset-0" aria-label={l('closeDialog')} disabled={editing} onClick={closeEditDialog} />
        <section className="relative z-10 flex max-h-[calc(100dvh-7.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]" role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 sm:px-6">
            <div>
              <h2 id="edit-member-title" className="text-lg font-black text-slate-950">{l('editMember')}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{l('editMemberDescription')}</p>
            </div>
            <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" aria-label={l('closeDialog')} disabled={editing} onClick={closeEditDialog}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <form className="space-y-4 overflow-y-auto p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); submitMemberProfile().catch(() => undefined) }}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{l('displayName')}</span>
              <input
                autoFocus
                required
                maxLength={150}
                value={editForm.displayName}
                onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{l('email')}</span>
              <input
                type="email"
                maxLength={200}
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <RegionalPhoneInput
              value={editForm.phoneE164}
              onChange={(phoneE164) => setEditForm((current) => ({ ...current, phoneE164 }))}
              language={language === 'zh' ? 'zh' : 'en'}
              label={l('phone')}
              hint={l('phoneE164Hint')}
            />

            {editError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{editError}</p> : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" disabled={editing} onClick={closeEditDialog}>{l('cancel')}</button>
              <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={editing || !editForm.displayName.trim()}>
                {editing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editing ? l('saving') : l('saveChanges')}
              </button>
            </div>
          </form>
        </section>
      </div>
    ) : null}
    </>
  )
}


export default AdminView
