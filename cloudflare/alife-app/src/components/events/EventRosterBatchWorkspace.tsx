import { useCallback, useEffect, useRef, useState } from 'react'
import { eventOperationsService as api } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import useConfirmation from '../../hooks/useConfirmation'
import type { EventRosterBatchChange, EventRosterPage, EventServiceSlot } from '../../types/eventOperations'
import { EventToolSection, useArrangementDraft } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'

type DraftChange = { change: EventRosterBatchChange; date: string; role: { en: string; zh: string }; before: string; after: string }
const field = 'min-h-11 w-full min-w-0 rounded-lg border border-[#176b5a]/25 bg-white px-2 text-sm'

export default function EventRosterBatchWorkspace({ eventId, language, moduleCode, onSaved, onBusyChange, refreshVersion }: {
  eventId: string; language: 'en' | 'zh'; moduleCode?: string; onSaved?: () => Promise<void> | void; onBusyChange?: (busy: boolean) => void; refreshVersion?: string
}) {
  const viewer = useAuthStore().me?.id
  return <BatchWorkspace key={`${eventId}:${viewer}`} eventId={eventId} language={language} moduleCode={moduleCode} onSaved={onSaved} onBusyChange={onBusyChange} viewer={viewer} refreshVersion={refreshVersion} />
}

function BatchWorkspace({ eventId, language, moduleCode, onSaved, onBusyChange, viewer, refreshVersion }: {
  eventId: string; language: 'en' | 'zh'; moduleCode?: string; onSaved?: () => Promise<void> | void; onBusyChange?: (busy: boolean) => void; viewer?: string; refreshVersion?: string
}) {
  const zh = language === 'zh'
  const [page, setPage] = useState(1), [data, setData] = useState<EventRosterPage | null>(null)
  const [draft, setDraft] = useState<Record<string, DraftChange>>({}), [role, setRole] = useState(''), [response, setResponse] = useState('all')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const revision = useRef(0), key = useRef(crypto.randomUUID())
  const initialDate = useRef(new URLSearchParams(window.location.search).get('occurrenceId'))
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const changes = Object.values(draft)
  useArrangementDraft(changes.length > 0)
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  const load = useCallback(async () => {
    const current = ++revision.current
    setLoading(true)
    try { const value = await api.rosterPage(eventId, page, initialDate.current); if (revision.current === current) { initialDate.current = null; setPage(value.page); setData(value); setError('') } }
    catch (reason) { if (revision.current === current) setError(normalizeApiError(reason).message) }
    finally { if (revision.current === current) setLoading(false) }
  }, [eventId, page])
  useEffect(() => { void load(); return () => { revision.current++ } }, [load, refreshVersion])
  const date = (value: string) => new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-AU', { timeZone: data?.timeZone || 'UTC', month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  const name = (id: string) => data?.people.find(x => x.id === id)?.displayName || (id === viewer ? (zh ? '我' : 'Me') : (zh ? '成员' : 'Member'))
  const label = (slot: EventServiceSlot) => slot.roleLabel?.[language] || slot.roleLabel?.en || slot.roleCode
  const status = (value: string) => ({ invited: zh ? '待确认' : 'Pending', confirmed: zh ? '已确认' : 'Confirmed', declined: zh ? '已拒绝' : 'Declined', ended: zh ? '已结束' : 'Ended' })[value] || value
  const choose = (slot: EventServiceSlot, rowKey: string, value: string, oldId?: string) => {
    if (!data) return
    const occurrence = data.occurrences.find(x => x.id === slot.occurrenceId), group = data.groups.find(x => x.roleCode === slot.roleCode)
    if (!occurrence || !group) return
    const old = slot.assignments.find(x => x.id === oldId)
    key.current = crypto.randomUUID(); setMessage('')
    setDraft(previous => {
      const next = { ...previous }
      if (!value || value === old?.memberId) delete next[rowKey]
      else next[rowKey] = { change: { occurrenceId: slot.occurrenceId, slotId: slot.id, occurrenceETag: occurrence.roster.eTag, candidateGroupETag: group.eTag,
        memberId: value === 'cancel' ? null : value, replacesAssignmentId: oldId }, date: slot.startUtc,
        role: slot.roleLabel || { en: slot.roleCode, zh: slot.roleCode }, before: old ? name(old.memberId) : '', after: value === 'cancel' ? '' : name(value) }
      return next
    })
  }
  const execute = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setMessage('')
    try { await action(); await load(); await onSaved?.() }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusy(false) }
  }
  const send = async () => {
    if (!changes.length || busy) return
    const summary = changes.map(x => `${date(x.date)} · ${x.role[language]} · ${x.before || (zh ? '空缺' : 'Vacant')} → ${x.after || (zh ? '结束安排' : 'End assignment')}`).join('\n')
    if (!await requestConfirmation({ title: zh ? '发出排班邀请' : 'Send roster invitations', description: `${summary}\n\n${zh ? '确认后整批保存，并发送站内通知。新人选需要本人确认。' : 'Save the entire batch and send in-app notifications. New assignees must personally confirm.'}`, confirmLabel: zh ? '确认并发出' : 'Confirm and send' })) return
    await execute(async () => {
      await api.rosterBatch(eventId, changes.map(x => x.change), key.current)
      setDraft({}); key.current = crypto.randomUUID(); setMessage(zh ? '排班已保存，站内通知已发出。' : 'Assignments saved and in-app notifications sent.')
    })
  }
  const slots = data?.occurrences.flatMap(x => x.roster.slots).filter(x => !moduleCode || x.moduleCode === moduleCode) || []
  const roles = [...new Map(slots.map(x => [x.roleCode, label(x)])).entries()]
  const matches = (slot: EventServiceSlot) => (!moduleCode || slot.moduleCode === moduleCode) && (!role || slot.roleCode === role) &&
    (response === 'all' || response === 'vacant' && slot.confirmedCount < slot.requiredCount || slot.assignments.some(x => x.status === response))
  const renderSlot = (slot: EventServiceSlot) => {
    const active = slot.assignments.filter(x => x.status === 'invited' || x.status === 'confirmed')
    const canAssign = data?.canManage && slot.canAssign
    const selector = (rowKey: string, oldId?: string) => {
      const old = active.find(x => x.id === oldId), change = draft[rowKey]
      const selected = change ? change.change.memberId || 'cancel' : old?.memberId || ''
      return <select aria-label={`${label(slot)} · ${date(slot.startUtc)} · ${old ? name(old.memberId) : (zh ? '选择人选' : 'Select candidate')}`} className={field} disabled={busy || loading || !canAssign} value={selected} onChange={e => choose(slot, rowKey, e.target.value, oldId)}>
        <option value="">{zh ? '选择候选人' : 'Choose a candidate'}</option>
        {old ? <option value={old.memberId}>{name(old.memberId)} · {zh ? '保留当前安排' : 'Keep current assignment'}</option> : null}
        {(slot.candidateMemberIds || []).filter(id => id !== old?.memberId).map(id => <option key={id} value={id}>{name(id)}</option>)}
        {old ? <option value="cancel">{zh ? '结束此安排' : 'End this assignment'}</option> : null}
      </select>
    }
    return <div className="space-y-3">
      <p className="text-xs text-[#66766f]">{zh ? `本人已确认 ${slot.confirmedCount}/${slot.requiredCount}` : `Personally confirmed ${slot.confirmedCount}/${slot.requiredCount}`}</p>
      {active.map(person => <div key={person.id} className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-sm">{name(person.memberId)}</span><AppBadge variant={person.status === 'confirmed' ? 'success' : 'warning'}>{status(person.status)}</AppBadge></div>
        {canAssign ? selector(`${slot.id}:${person.id}`, person.id) : null}
        {person.memberId === viewer && person.status === 'invited' ? <div className="flex flex-wrap gap-2"><AppActionButton disabled={busy} onClick={() => void execute(() => api.respondToRosterAssignment(eventId, slot.occurrenceId, person.id, true))}>{zh ? '接受排班' : 'Accept'}</AppActionButton><AppActionButton disabled={busy} variant="danger" onClick={() => void execute(() => api.respondToRosterAssignment(eventId, slot.occurrenceId, person.id, false))}>{zh ? '拒绝' : 'Decline'}</AppActionButton></div> : null}
      </div>)}
      {canAssign ? Array.from({ length: Math.min(100, Math.max(0, slot.requiredCount - active.length)) }, (_, index) => <div key={index}>{selector(`${slot.id}:new-${index}`)}</div>) : slot.confirmedCount < slot.requiredCount ? <p className="text-sm text-amber-800">{zh ? '尚有未确认的岗位。' : 'Some positions still need confirmation.'}</p> : null}
      {slot.assignments.some(x => x.status === 'declined' || x.status === 'ended') ? <details className="text-xs text-[#66766f]"><summary>{zh ? '历史安排' : 'Assignment history'}</summary>{slot.assignments.filter(x => x.status === 'declined' || x.status === 'ended').map(x => <p key={x.id}>{name(x.memberId)} · {status(x.status)}</p>)}</details> : null}
      {data?.canManage && !slot.canAssign ? <p className="text-xs text-[#66766f]">{zh ? '此岗位沿用审批冻结或关键岗位复查规则。修改前需重开筹备。' : 'This position remains subject to approval freezing or specialist review. Reopen preparation before changing it.'}</p> : null}
    </div>
  }
  return <EventToolSection title={zh ? '多场次手工排班' : 'Schedule across dates'} summary={changes.length ? (zh ? `${changes.length} 项待发出` : `${changes.length} changes to send`) : (zh ? '未来四个场次' : 'Next four dates')}>
    <div className="space-y-4">
      <p className="text-sm text-[#66766f]">{zh ? '从各岗位候选组选择人选，检查待发送安排后统一发出。待确认和已确认都占用岗位人数。' : 'Select from each position’s candidate group, review your changes, then send together. Pending and confirmed invitations both reserve a position.'}</p>
      {error ? <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}{changes.length ? <p>{zh ? '待发送草稿已保留。刷新查看最新状态后，请重新选择有冲突的安排。' : 'Your unsent draft is retained. Refresh to review current state, then reselect conflicting assignments.'}</p> : null}<AppActionButton disabled={busy} onClick={() => void load()}>{zh ? '刷新状态' : 'Refresh state'}</AppActionButton></div> : null}
      {message ? <p role="status" className="text-sm text-emerald-800">{message}</p> : null}
      <div className="grid gap-3 tablet:grid-cols-2"><label className="grid gap-1 text-sm">{zh ? '岗位' : 'Position'}<select className={field} value={role} onChange={e => setRole(e.target.value)}><option value="">{zh ? '所有岗位' : 'All positions'}</option>{roles.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label className="grid gap-1 text-sm">{zh ? '回应状态' : 'Response'}<select className={field} value={response} onChange={e => setResponse(e.target.value)}><option value="all">{zh ? '所有状态' : 'All responses'}</option><option value="vacant">{zh ? '尚未确认齐全' : 'Not fully confirmed'}</option>{['invited', 'confirmed', 'declined'].map(x => <option key={x} value={x}>{status(x)}</option>)}</select></label></div>
      {loading ? <p role="status" className="text-sm">{zh ? '正在读取排班…' : 'Loading dates…'}</p> : null}
      <div className="hidden desktop:block"><table className="w-full table-fixed border-collapse text-left"><thead><tr className="border-b text-sm"><th className="w-1/4 p-3">{zh ? '日期与时间' : 'Date and time'}</th><th className="w-1/4 p-3">{zh ? '岗位' : 'Position'}</th><th className="p-3">{zh ? '安排与回应' : 'Assignments and responses'}</th></tr></thead><tbody>{data?.occurrences.flatMap(occurrence => occurrence.roster.slots.filter(matches).map(slot => <tr key={slot.id} className="border-b align-top"><td className="p-3 text-sm">{date(slot.startUtc)} – {date(slot.endUtc)}<p className="text-xs text-[#66766f]">{data.timeZone}</p></td><th className="p-3 font-medium">{label(slot)}</th><td className="p-3">{renderSlot(slot)}</td></tr>))}</tbody></table></div>
      <div className="space-y-5 desktop:hidden">{data?.occurrences.map(occurrence => <section key={occurrence.id} className="min-w-0 space-y-3"><h3 className="font-semibold">{date(occurrence.startUtc)} <span className="text-xs font-normal">{data.timeZone}</span></h3>{occurrence.roster.slots.filter(matches).map(slot => <div key={slot.id} className="min-w-0 rounded-xl border border-[#176b5a]/20 p-3"><h4 className="mb-2 font-medium">{label(slot)}</h4><p className="mb-2 text-xs text-[#66766f]">{date(slot.startUtc)} – {date(slot.endUtc)}</p>{renderSlot(slot)}</div>)}</section>)}</div>
      {data && !slots.some(matches) ? <p className="text-sm text-[#66766f]">{zh ? '本页没有符合筛选条件的岗位。' : 'No positions match these filters on this page.'}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><AppActionButton disabled={page === 1 || busy || loading} onClick={() => setPage(x => x - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton><span className="text-sm">{zh ? `第 ${page} 页` : `Page ${page}`}</span><AppActionButton disabled={busy || loading || !data || page * 4 >= data.total} onClick={() => setPage(x => x + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton></div>
      {changes.length ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3"><h3 className="font-semibold">{zh ? '待发送安排' : 'Changes to send'}</h3>{Object.entries(draft).map(([id, x]) => <div key={id} className="flex flex-wrap items-start justify-between gap-2 text-sm"><span>{date(x.date)} · {x.role[language]} · {x.before || (zh ? '空缺' : 'Vacant')} → {x.after || (zh ? '结束安排' : 'End assignment')}</span><button type="button" className="min-h-11 underline" disabled={busy} onClick={() => { key.current = crypto.randomUUID(); setDraft(old => { const next = { ...old }; delete next[id]; return next }) }}>{zh ? '撤销此项' : 'Undo this change'}</button></div>)}<AppActionButton variant="primary" disabled={busy} onClick={() => void send()}>{zh ? '发出排班邀请' : 'Send roster invitations'}</AppActionButton></div> : null}
      {data?.canManage && data.isRecurring ? <details className="space-y-3 border-t pt-3"><summary className="cursor-pointer font-semibold">{zh ? '重复活动的默认岗位' : 'Default positions for recurring dates'}</summary><p className="text-sm">{data.defaultsVersion ? (zh ? `当前默认岗位：第 ${data.defaultsVersion} 版。只包含岗位要求，不包含人选。` : `Default requirements v${data.defaultsVersion}. Positions only; no assignees.`) : (zh ? '请明确选择一个场次建立默认岗位。不会自动推断旧活动。' : 'Choose a date explicitly to establish default positions for this event.')}</p>{data.canConfigure ? data.occurrences.map(x => <AppActionButton key={x.id} disabled={busy || changes.length > 0 || x.roster.slots.length === 0} onClick={() => void (async () => { if (await requestConfirmation({ title: zh ? '建立默认岗位' : 'Adopt default positions', description: zh ? `采用 ${date(x.startUtc)} 的岗位、人数、相对时间和资格规则。所有人选及回应记录均不复制。` : `Adopt the positions, counts, relative times and eligibility rules from ${date(x.startUtc)}. Assignees and responses are excluded.` })) await execute(() => api.adoptRosterDefaults(eventId, x.id, x.roster.eTag, data.defaultsETag)) })()}>{zh ? `采用 ${date(x.startUtc)}` : `Use ${date(x.startUtc)}`}</AppActionButton>) : null}<AppActionButton disabled={busy || changes.length > 0 || !data.defaultsVersion} onClick={() => void execute(() => api.extendRoster(eventId, data.defaultsETag))}>{zh ? '补充未来 12 周场次与空岗位' : 'Add missing dates and empty positions for 12 weeks'}</AppActionButton></details> : null}
    </div>{confirmationModal}
  </EventToolSection>
}
