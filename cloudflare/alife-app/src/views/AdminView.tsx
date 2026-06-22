import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, SetStateAction } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Activity, Bell, ChevronRight, Globe2, Loader2, RefreshCw, Search, Send, ShieldCheck, UsersRound } from 'lucide-react'
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
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import { activeEntityService } from '../services/activeEntityService'
import type { PageSummaryDto } from '../types'

type AdminSection = 'overview' | 'users' | 'logs' | 'messages'
type LocalText = { en: string; zh: string }
type LabelFn = (key: keyof typeof labels, values?: Record<string, string | number>) => string

const labels = {
  overview: { en: 'Platform workspace', zh: '平台工作台' },
  users: { en: 'Platform users', zh: '全平台用户' },
  logs: { en: 'Operation logs', zh: '操作日志' },
  messages: { en: 'Messages', zh: '消息管理' },
  usersDescription: { en: 'Manage accounts, registration state, and platform roles.', zh: '管理账号、注册状态和平台角色。' },
  logsDescription: { en: 'Review platform-level administrative actions.', zh: '查看平台级管理操作记录。' },
  messagesDescription: { en: 'Send and review notification messages.', zh: '发送并查看通知消息。' },
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
  actor: { en: 'Actor', zh: '操作者' },
  target: { en: 'Target', zh: '对象' },
  entityType: { en: 'Entity type', zh: '对象类型' },
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
  previous: { en: 'Previous', zh: '上一页' },
  next: { en: 'Next', zh: '下一页' },
  page: { en: 'Page', zh: '页' },
  total: { en: 'Total', zh: '总数' },
  sendMessage: { en: 'Send message', zh: '发送消息' },
  platform: { en: 'Whole platform', zh: '全平台' },
  group: { en: 'Group', zh: '小组' },
  singleMember: { en: 'Single user', zh: '单个用户' },
  titleEn: { en: 'Title EN', zh: '英文标题' },
  titleZh: { en: 'Title ZH', zh: '中文标题' },
  bodyEn: { en: 'Body EN', zh: '英文内容' },
  bodyZh: { en: 'Body ZH', zh: '中文内容' },
  unknown: { en: 'Unknown', zh: '未知' },
  registeredUsers: { en: 'Registered users', zh: '已注册用户' },
  guestUsers: { en: 'Guest records', zh: '访客记录' },
  latestActivity: { en: 'Latest activity', zh: '最近动态' },
  quickOps: { en: 'Workspace actions', zh: '工作区操作' },
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
  user: 'border-slate-200 bg-slate-50 text-slate-600',
}

const formatRole = (role: string) => role === 'superadmin' ? 'System Admin' : role === 'admin' ? 'Admin' : role === 'user' ? 'User' : role
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
      {section === 'logs' ? <LogsSection l={l} loading={loading} page={logs} filters={logFilters} setFilters={setLogFilters} apply={() => loadLogs(1)} goToPage={loadLogs} /> : null}
      {section === 'messages' ? <MessagesSection l={l} loading={loading} page={messages} filters={messageFilters} setFilters={setMessageFilters} apply={() => loadMessages(1)} goToPage={loadMessages} groups={groups} members={members.items} sendForm={sendForm} setSendForm={setSendForm} sendMessage={sendMessage} language={language} /> : null}
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
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard to="/admin/users" icon={UsersRound} title={l('users')} value={users.totalCount} detail={l('total')} />
          <MetricCard to="/admin/users" icon={ShieldCheck} title={l('registeredUsers')} value={registeredCount} detail={l('registered')} />
          <MetricCard to="/admin/users" icon={UsersRound} title={l('guestUsers')} value={guestCount} detail={l('guest')} />
          <MetricCard to="/admin/messages" icon={Bell} title={l('messages')} value={messages.totalCount} detail={l('unread')} />
        </div>
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

const LogsSection = ({ l, loading, page, filters, setFilters, apply, goToPage }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AuditLogDto>
  filters: { search: string; action: string; entityType: string; fromUtc: string; toUtc: string }
  setFilters: Dispatch<SetStateAction<{ search: string; action: string; entityType: string; fromUtc: string; toUtc: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
}) => (
  <Panel title={l('logs')} description={l('logsDescription')} count={page.totalCount}>
    <FilterBar>
      <SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} />
      <TextInput placeholder={l('action')} value={filters.action} onChange={(e) => setFilters((x) => ({ ...x, action: e.target.value }))} />
      <TextInput placeholder={l('entityType')} value={filters.entityType} onChange={(e) => setFilters((x) => ({ ...x, entityType: e.target.value }))} />
      <FilterActions l={l} apply={apply} reset={() => setFilters({ search: '', action: '', entityType: '', fromUtc: '', toUtc: '' })} />
    </FilterBar>
    {loading ? <Loading text={l('loading')} /> : page.items.length ? <><DataTable headers={[l('action'), l('actor'), l('target'), l('time')]}>{page.items.map((log) => <tr key={log.id}><td className="px-5 py-4 font-bold text-slate-950">{log.action}</td><td className="px-5 py-4 text-slate-600">{log.actorDisplayName || l('unknown')}</td><td className="px-5 py-4 text-slate-600">{log.targetDisplayName || log.entityType}</td><td className="px-5 py-4 text-slate-600">{formatDate(log.occurredUtc)}</td></tr>)}</DataTable><Pager l={l} page={page} goToPage={goToPage} /></> : <Empty text={l('noLogs')} />}
  </Panel>
)

const MessagesSection = ({ l, loading, page, filters, setFilters, apply, goToPage, groups, members, sendForm, setSendForm, sendMessage, language }: {
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
  language: string
}) => (
  <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{l('sendMessage')}</h2>
      <div className="mt-4 grid gap-3">
        <SelectInput value={sendForm.scope} onChange={(e) => setSendForm((x) => ({ ...x, scope: e.target.value as 'platform' | 'group' | 'member' }))}><option value="platform">{l('platform')}</option><option value="group">{l('group')}</option><option value="member">{l('singleMember')}</option></SelectInput>
        {sendForm.scope === 'group' ? <SelectInput value={sendForm.groupId} onChange={(e) => setSendForm((x) => ({ ...x, groupId: e.target.value }))}><option value="">{l('group')}</option>{groups.map((group) => <option key={group.id} value={group.id}>{parseLocalizedJson(group.nameJson, language) || group.id}</option>)}</SelectInput> : null}
        {sendForm.scope === 'member' ? <SelectInput value={sendForm.recipientMemberId} onChange={(e) => setSendForm((x) => ({ ...x, recipientMemberId: e.target.value }))}><option value="">{l('recipient')}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName || member.email || member.id}</option>)}</SelectInput> : null}
        <TextInput placeholder={l('action')} value={sendForm.actionType} onChange={(e) => setSendForm((x) => ({ ...x, actionType: e.target.value }))} />
        <TextInput placeholder={l('titleEn')} value={sendForm.titleEn} onChange={(e) => setSendForm((x) => ({ ...x, titleEn: e.target.value }))} />
        <TextInput placeholder={l('titleZh')} value={sendForm.titleZh} onChange={(e) => setSendForm((x) => ({ ...x, titleZh: e.target.value }))} />
        <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder={l('bodyEn')} value={sendForm.bodyEn} onChange={(e) => setSendForm((x) => ({ ...x, bodyEn: e.target.value }))} />
        <textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder={l('bodyZh')} value={sendForm.bodyZh} onChange={(e) => setSendForm((x) => ({ ...x, bodyZh: e.target.value }))} />
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800" type="button" onClick={() => sendMessage().catch(() => undefined)}><Send className="h-4 w-4" />{l('sendMessage')}</button>
      </div>
    </section>
    <Panel title={l('messages')} description={l('messagesDescription')} count={page.totalCount}>
      <FilterBar><SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} /><TextInput placeholder={l('action')} value={filters.actionType} onChange={(e) => setFilters((x) => ({ ...x, actionType: e.target.value }))} /><SelectInput value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="">{l('allStatus')}</option><option value="unread">{l('unread')}</option><option value="read">{l('read')}</option><option value="replied">{l('replied')}</option></SelectInput><FilterActions l={l} apply={apply} reset={() => setFilters({ search: '', actionType: '', status: '' })} /></FilterBar>
      {loading ? <Loading text={l('loading')} /> : page.items.length ? <><DataTable headers={[l('action'), l('recipient'), l('sender'), 'Group/Event', l('status'), l('time')]}>{page.items.map((item) => { const status = item.repliedUtc ? l('replied') : item.readUtc ? l('read') : l('unread'); return <tr key={item.id} className="align-top"><td className="px-5 py-4 font-bold text-slate-950">{item.actionType}</td><td className="px-5 py-4 text-slate-600">{item.recipientDisplayName || l('unknown')}</td><td className="px-5 py-4 text-slate-600">{item.createdByDisplayName || l('unknown')}</td><td className="px-5 py-4 text-slate-600">{parseLocalizedJson(item.groupNameJson, language) || '-'}<div className="text-xs text-slate-400">{(language === 'zh' ? item.eventTitleZh : item.eventTitleEn) || '-'}</div></td><td className="px-5 py-4 text-slate-600">{status}</td><td className="px-5 py-4 text-slate-600">{formatDate(item.occurredUtc)}</td></tr> })}</DataTable><Pager l={l} page={page} goToPage={goToPage} /></> : <Empty text={l('noMessages')} />}
    </Panel>
  </div>
)

const Panel = ({ title, description, count, children }: { title: string; description: string; count?: number; children: ReactNode }) => (
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>{typeof count === 'number' ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">{count}</span> : null}</div>
    {children}
  </section>
)
const FilterBar = ({ children }: { children: ReactNode }) => <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />
const SearchInput = (props: InputHTMLAttributes<HTMLInputElement>) => <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput {...props} className="w-full pl-9" /></div>
const SelectInput = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400" />
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
