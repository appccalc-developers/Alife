import type { Dispatch, SetStateAction } from 'react'
import { Globe2, Loader2, Send } from 'lucide-react'
import type { AdminGroupOptionDto, AdminMemberDto, AdminNotificationDto, AdminPagedResultDto, AdminPlatformRoleDto } from '../../services/groupService'
import { Empty, FilterActions, FilterBar, JsonBlock, LabeledField, Loading, Panel, Pager, SearchInput, SelectInput, TextAreaInput, TextInput } from './AdminUi'
import type { LabelFn } from './AdminUi'
import { compactId, formatDate, formatRole, parseLocalizedJson, prettyJson, readLocalized } from './adminUtils'

type MessageTranslationDirection = 'zh-en' | 'en-zh'

const getNotificationStatus = (item: AdminNotificationDto) =>
  item.repliedUtc ? 'replied' : item.readUtc ? 'read' : 'unread'

const messageStatusTone = (status: string) =>
  status === 'replied'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'read'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

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
const readNestedLocalized = (record: JsonRecord | null, key: string, language: string) => {
  const value = record?.[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? readLocalized(value as Record<string, string>, language)
    : ''
}
const readJsonString = (record: JsonRecord | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}
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

export const MessagesSection = ({ l, loading, page, filters, setFilters, apply, goToPage, groups, roles, members, sendForm, setSendForm, sendMessage, translateMessage, aiTranslating, language }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<AdminNotificationDto>
  filters: { search: string; actionType: string; status: string }
  setFilters: Dispatch<SetStateAction<{ search: string; actionType: string; status: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  groups: AdminGroupOptionDto[]
  roles: AdminPlatformRoleDto[]
  members: AdminMemberDto[]
  sendForm: { scope: 'platform' | 'group' | 'member' | 'role'; groupId: string; recipientMemberId: string; roleCodes: string[]; actionType: string; titleEn: string; titleZh: string; bodyEn: string; bodyZh: string }
  setSendForm: Dispatch<SetStateAction<{ scope: 'platform' | 'group' | 'member' | 'role'; groupId: string; recipientMemberId: string; roleCodes: string[]; actionType: string; titleEn: string; titleZh: string; bodyEn: string; bodyZh: string }>>
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
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['platform', l('platform')],
                ['group', l('group')],
                ['role', l('platformRoleAudience')],
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
            {sendForm.scope === 'role' ? (
              <div className="mt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">{l('chooseRoles')}</div>
                <div className="grid gap-2">
                  {roles.filter((role) => role.code !== 'superadmin' && role.code !== 'user').map((role) => {
                    const checked = sendForm.roleCodes.includes(role.code)
                    return (
                      <label key={role.code} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm transition ${checked ? 'border-emerald-200 text-slate-950' : 'border-slate-200 text-slate-600 hover:border-emerald-200'}`}>
                        <span className="font-bold">{readLocalized(role.name, language) || formatRole(role.code)}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                          checked={checked}
                          onChange={(event) => setSendForm((current) => ({
                            ...current,
                            roleCodes: event.target.checked
                              ? Array.from(new Set([...current.roleCodes, role.code]))
                              : current.roleCodes.filter((code) => code !== role.code),
                          }))}
                        />
                      </label>
                    )
                  })}
                </div>
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
              <AiTranslateButton label={l('translateZhToEn')} loading={aiTranslating === 'zh-en'} disabled={Boolean(aiTranslating) || !canTranslateZh} onClick={() => translateMessage('zh-en')} />
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
              <AiTranslateButton label={l('translateEnToZh')} loading={aiTranslating === 'en-zh'} disabled={Boolean(aiTranslating) || !canTranslateEn} onClick={() => translateMessage('en-zh')} />
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
