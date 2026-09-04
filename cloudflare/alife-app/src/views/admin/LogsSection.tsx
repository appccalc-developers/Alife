import type { Dispatch, SetStateAction } from 'react'
import type { AuditLogDto, AdminPagedResultDto } from '../../services/groupService'
import { DataTable, Empty, FilterActions, FilterBar, JsonBlock, Loading, Panel, Pager, SearchInput, TextInput } from './AdminUi'
import type { LabelFn } from './AdminUi'
import { compactId, formatDate, prettyJson } from './adminUtils'

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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const obj = value as Record<string, string>
  return (language === 'zh' ? obj.zh : obj.en) || obj.en || obj.zh || ''
}
const formatRole = (role: string) => role === 'superadmin' ? 'System Admin' : role === 'admin' ? 'Admin' : role === 'user' ? 'User' : role

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
    const afterRoles = Array.isArray(after?.roles)
      ? after.roles.filter((role): role is string => typeof role === 'string')
      : []
    const afterRole = afterRoles.length ? afterRoles.map(formatRole).join(', ') : readJsonString(after, 'role') || 'user'
    const afterRoleLabel = formatRole(afterRole)
    return language === 'zh'
      ? `将 ${target} 的平台角色从 ${beforeRoles.map(formatRole).join(', ') || 'User'} 改为 ${formatRole(afterRole)}`
      : `Changed ${target}'s platform role from ${beforeRoles.map(formatRole).join(', ') || 'User'} to ${afterRoleLabel}`
  }

  if (log.action === 'notification.admin.send') {
    const scope = readJsonString(after, 'scope') || 'platform'
    const count = readJsonNumber(after, 'recipientCount')
    const title = readNestedLocalized(after, 'title', language)
    const scopeLabel = language === 'zh'
      ? scope === 'group' ? '小组' : scope === 'member' ? '单个成员' : scope === 'role' ? '指定角色' : '全平台'
      : scope === 'group' ? 'a group' : scope === 'member' ? 'one member' : scope === 'role' ? 'selected roles' : 'the whole platform'
    return language === 'zh'
      ? `向${scopeLabel}发送通知${count === null ? '' : `，共 ${count} 位收件人`}${title ? `：「${title}」` : ''}`
      : `Sent a notification to ${scopeLabel}${count === null ? '' : ` (${count} recipient${count === 1 ? '' : 's'})`}${title ? `: "${title}"` : ''}`
  }

  return logActionLabel(log.action, language)
}

export const LogsSection = ({ l, loading, page, filters, setFilters, apply, goToPage, language, connected = false }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AuditLogDto>
  filters: { search: string; action: string; entityType: string; fromUtc: string; toUtc: string }
  setFilters: Dispatch<SetStateAction<{ search: string; action: string; entityType: string; fromUtc: string; toUtc: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  language: string
  connected?: boolean
}) => (
  <Panel title={l('logs')} description={l('logsDescription')} count={page.totalCount} connected={connected}>
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
