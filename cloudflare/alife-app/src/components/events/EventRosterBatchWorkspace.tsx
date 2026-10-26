import { eventRosterBatchWorkspaceText } from '../../i18n/eventRosterBatchWorkspace.ts'
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
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [denied, setDenied] = useState(false), [message, setMessage] = useState('')
  const revision = useRef(0), key = useRef(crypto.randomUUID())
  const initialDate = useRef(new URLSearchParams(window.location.search).get('occurrenceId'))
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const changes = Object.values(draft)
  useArrangementDraft(changes.length > 0)
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])
  const load = useCallback(async () => {
    const current = ++revision.current
    setLoading(true)
    try { const value = await api.rosterPage(eventId, page, initialDate.current); if (revision.current === current) { initialDate.current = null; setPage(value.page); setData(value); setDenied(false); setError('') } }
    catch (reason) { if (revision.current === current) { const failure = normalizeApiError(reason); setDenied(failure.status === 403); setError(failure.message) } }
    finally { if (revision.current === current) setLoading(false) }
  }, [eventId, page])
  useEffect(() => { void load(); return () => { revision.current++ } }, [load, refreshVersion])
  const date = (value: string) => new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-AU', { timeZone: data?.timeZone || 'UTC', month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  const name = (id: string) => data?.people.find(x => x.id === id)?.displayName || (id === viewer ? (zh ? eventRosterBatchWorkspaceText.me.zh : eventRosterBatchWorkspaceText.me.en) : (zh ? eventRosterBatchWorkspaceText.member.zh : eventRosterBatchWorkspaceText.member.en))
  const label = (slot: EventServiceSlot) => slot.roleLabel?.[language] || slot.roleLabel?.en || slot.roleCode
  const status = (value: string) => ({ invited: zh ? eventRosterBatchWorkspaceText.pending.zh : eventRosterBatchWorkspaceText.pending.en, confirmed: zh ? eventRosterBatchWorkspaceText.confirmed.zh : eventRosterBatchWorkspaceText.confirmed.en, declined: zh ? eventRosterBatchWorkspaceText.declined.zh : eventRosterBatchWorkspaceText.declined.en, ended: zh ? eventRosterBatchWorkspaceText.ended.zh : eventRosterBatchWorkspaceText.ended.en })[value] || value
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
    const summary = changes.map(x => `${date(x.date)} · ${x.role[language]} · ${x.before || (zh ? eventRosterBatchWorkspaceText.vacant.zh : eventRosterBatchWorkspaceText.vacant.en)} → ${x.after || (zh ? eventRosterBatchWorkspaceText.endAssignment.zh : eventRosterBatchWorkspaceText.endAssignment.en)}`).join('\n')
    if (!await requestConfirmation({ title: zh ? eventRosterBatchWorkspaceText.sendRosterInvitations.zh : eventRosterBatchWorkspaceText.sendRosterInvitations.en, description: `${summary}\n\n${zh ? eventRosterBatchWorkspaceText.saveTheEntireBatchAndSendInAppNotifications.zh : eventRosterBatchWorkspaceText.saveTheEntireBatchAndSendInAppNotifications.en}`, confirmLabel: zh ? eventRosterBatchWorkspaceText.confirmAndSend.zh : eventRosterBatchWorkspaceText.confirmAndSend.en })) return
    await execute(async () => {
      await api.rosterBatch(eventId, changes.map(x => x.change), key.current)
      setDraft({}); key.current = crypto.randomUUID(); setMessage(zh ? eventRosterBatchWorkspaceText.assignmentsSavedAndInAppNotificationsSent.zh : eventRosterBatchWorkspaceText.assignmentsSavedAndInAppNotificationsSent.en)
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
      return <select aria-label={`${label(slot)} · ${date(slot.startUtc)} · ${old ? name(old.memberId) : (zh ? eventRosterBatchWorkspaceText.selectCandidate.zh : eventRosterBatchWorkspaceText.selectCandidate.en)}`} className={field} disabled={busy || loading || !canAssign} value={selected} onChange={e => choose(slot, rowKey, e.target.value, oldId)}>
        <option value="">{zh ? eventRosterBatchWorkspaceText.chooseACandidate.zh : eventRosterBatchWorkspaceText.chooseACandidate.en}</option>
        {old ? <option value={old.memberId}>{name(old.memberId)} · {zh ? eventRosterBatchWorkspaceText.keepCurrentAssignment.zh : eventRosterBatchWorkspaceText.keepCurrentAssignment.en}</option> : null}
        {(slot.candidateMemberIds || []).filter(id => id !== old?.memberId).map(id => <option key={id} value={id}>{name(id)}</option>)}
        {old ? <option value="cancel">{zh ? eventRosterBatchWorkspaceText.endThisAssignment.zh : eventRosterBatchWorkspaceText.endThisAssignment.en}</option> : null}
      </select>
    }
    return <div className="space-y-3">
      <p className="text-xs text-[#66766f]">{zh ? eventRosterBatchWorkspaceText.personallyConfirmed.zh(slot.confirmedCount, slot.requiredCount) : eventRosterBatchWorkspaceText.personallyConfirmed.en(slot.confirmedCount, slot.requiredCount)}</p>
      {active.map(person => <div key={person.id} className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-sm">{name(person.memberId)}</span><AppBadge variant={person.status === 'confirmed' ? 'success' : 'warning'}>{status(person.status)}</AppBadge></div>
        {canAssign ? selector(`${slot.id}:${person.id}`, person.id) : null}
        {person.memberId === viewer && person.status === 'invited' ? <div className="flex flex-wrap gap-2"><AppActionButton disabled={busy} onClick={() => void execute(() => api.respondToRosterAssignment(eventId, slot.occurrenceId, person.id, true))}>{zh ? eventRosterBatchWorkspaceText.accept.zh : eventRosterBatchWorkspaceText.accept.en}</AppActionButton><AppActionButton disabled={busy} variant="danger" onClick={() => void execute(() => api.respondToRosterAssignment(eventId, slot.occurrenceId, person.id, false))}>{zh ? eventRosterBatchWorkspaceText.decline.zh : eventRosterBatchWorkspaceText.decline.en}</AppActionButton></div> : null}
      </div>)}
      {canAssign ? Array.from({ length: Math.min(100, Math.max(0, slot.requiredCount - active.length)) }, (_, index) => <div key={index}>{selector(`${slot.id}:new-${index}`)}</div>) : slot.confirmedCount < slot.requiredCount ? <p className="text-sm text-amber-800">{zh ? eventRosterBatchWorkspaceText.somePositionsStillNeedConfirmation.zh : eventRosterBatchWorkspaceText.somePositionsStillNeedConfirmation.en}</p> : null}
      {slot.assignments.some(x => x.status === 'declined' || x.status === 'ended') ? <details className="text-xs text-[#66766f]"><summary>{zh ? eventRosterBatchWorkspaceText.assignmentHistory.zh : eventRosterBatchWorkspaceText.assignmentHistory.en}</summary>{slot.assignments.filter(x => x.status === 'declined' || x.status === 'ended').map(x => <p key={x.id}>{name(x.memberId)} · {status(x.status)}</p>)}</details> : null}
      {data?.canManage && !slot.canAssign ? <p className="text-xs text-[#66766f]">{zh ? eventRosterBatchWorkspaceText.thisPositionRemainsSubjectToApprovalFreezingOrSpecialist.zh : eventRosterBatchWorkspaceText.thisPositionRemainsSubjectToApprovalFreezingOrSpecialist.en}</p> : null}
    </div>
  }
  if (!data && loading) return <p role="status" className="text-sm">{zh ? eventRosterBatchWorkspaceText.checkingRosterResponsibility.zh : eventRosterBatchWorkspaceText.checkingRosterResponsibility.en}</p>
  if (denied) return null
  if (!data && error) return <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><AppActionButton onClick={() => void load()}>{zh ? eventRosterBatchWorkspaceText.retry.zh : eventRosterBatchWorkspaceText.retry.en}</AppActionButton></div>
  if (!data?.canManage) return null
  return <EventToolSection title={zh ? eventRosterBatchWorkspaceText.scheduleAcrossDates.zh : eventRosterBatchWorkspaceText.scheduleAcrossDates.en} summary={changes.length ? (zh ? eventRosterBatchWorkspaceText.changesToSend.zh(changes.length) : eventRosterBatchWorkspaceText.changesToSend.en(changes.length)) : (zh ? eventRosterBatchWorkspaceText.nextFourDates.zh : eventRosterBatchWorkspaceText.nextFourDates.en)}>
    <div className="space-y-4">
      <p className="text-sm text-[#66766f]">{zh ? eventRosterBatchWorkspaceText.selectFromEachPositionSCandidateGroupReviewYour.zh : eventRosterBatchWorkspaceText.selectFromEachPositionSCandidateGroupReviewYour.en}</p>
      {error ? <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}{changes.length ? <p>{zh ? eventRosterBatchWorkspaceText.yourUnsentDraftIsRetainedRefreshToReviewCurrent.zh : eventRosterBatchWorkspaceText.yourUnsentDraftIsRetainedRefreshToReviewCurrent.en}</p> : null}<AppActionButton disabled={busy} onClick={() => void load()}>{zh ? eventRosterBatchWorkspaceText.refreshState.zh : eventRosterBatchWorkspaceText.refreshState.en}</AppActionButton></div> : null}
      {message ? <p role="status" className="text-sm text-emerald-800">{message}</p> : null}
      <div className="grid gap-3 tablet:grid-cols-2"><label className="grid gap-1 text-sm">{zh ? eventRosterBatchWorkspaceText.position.zh : eventRosterBatchWorkspaceText.position.en}<select className={field} value={role} onChange={e => setRole(e.target.value)}><option value="">{zh ? eventRosterBatchWorkspaceText.allPositions.zh : eventRosterBatchWorkspaceText.allPositions.en}</option>{roles.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label><label className="grid gap-1 text-sm">{zh ? eventRosterBatchWorkspaceText.response.zh : eventRosterBatchWorkspaceText.response.en}<select className={field} value={response} onChange={e => setResponse(e.target.value)}><option value="all">{zh ? eventRosterBatchWorkspaceText.allResponses.zh : eventRosterBatchWorkspaceText.allResponses.en}</option><option value="vacant">{zh ? eventRosterBatchWorkspaceText.notFullyConfirmed.zh : eventRosterBatchWorkspaceText.notFullyConfirmed.en}</option>{['invited', 'confirmed', 'declined'].map(x => <option key={x} value={x}>{status(x)}</option>)}</select></label></div>
      {loading ? <p role="status" className="text-sm">{zh ? eventRosterBatchWorkspaceText.loadingDates.zh : eventRosterBatchWorkspaceText.loadingDates.en}</p> : null}
      <div className="hidden desktop:block"><table className="w-full table-fixed border-collapse text-left"><thead><tr className="border-b text-sm"><th className="w-1/4 p-3">{zh ? eventRosterBatchWorkspaceText.dateAndTime.zh : eventRosterBatchWorkspaceText.dateAndTime.en}</th><th className="w-1/4 p-3">{zh ? eventRosterBatchWorkspaceText.position.zh : eventRosterBatchWorkspaceText.position.en}</th><th className="p-3">{zh ? eventRosterBatchWorkspaceText.assignmentsAndResponses.zh : eventRosterBatchWorkspaceText.assignmentsAndResponses.en}</th></tr></thead><tbody>{data?.occurrences.flatMap(occurrence => occurrence.roster.slots.filter(matches).map(slot => <tr key={slot.id} className="border-b align-top"><td className="p-3 text-sm">{date(slot.startUtc)} – {date(slot.endUtc)}<p className="text-xs text-[#66766f]">{data.timeZone}</p></td><th className="p-3 font-medium">{label(slot)}</th><td className="p-3">{renderSlot(slot)}</td></tr>))}</tbody></table></div>
      <div className="space-y-5 desktop:hidden">{data?.occurrences.map(occurrence => <section key={occurrence.id} className="min-w-0 space-y-3"><h3 className="font-semibold">{date(occurrence.startUtc)} <span className="text-xs font-normal">{data.timeZone}</span></h3>{occurrence.roster.slots.filter(matches).map(slot => <div key={slot.id} className="min-w-0 rounded-xl border border-[#176b5a]/20 p-3"><h4 className="mb-2 font-medium">{label(slot)}</h4><p className="mb-2 text-xs text-[#66766f]">{date(slot.startUtc)} – {date(slot.endUtc)}</p>{renderSlot(slot)}</div>)}</section>)}</div>
      {data && !slots.some(matches) ? <p className="text-sm text-[#66766f]">{zh ? eventRosterBatchWorkspaceText.noPositionsMatchTheseFiltersOnThisPage.zh : eventRosterBatchWorkspaceText.noPositionsMatchTheseFiltersOnThisPage.en}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><AppActionButton disabled={page === 1 || busy || loading} onClick={() => setPage(x => x - 1)}>{zh ? eventRosterBatchWorkspaceText.previous.zh : eventRosterBatchWorkspaceText.previous.en}</AppActionButton><span className="text-sm">{zh ? eventRosterBatchWorkspaceText.page.zh(page) : eventRosterBatchWorkspaceText.page.en(page)}</span><AppActionButton disabled={busy || loading || !data || page * 4 >= data.total} onClick={() => setPage(x => x + 1)}>{zh ? eventRosterBatchWorkspaceText.next.zh : eventRosterBatchWorkspaceText.next.en}</AppActionButton></div>
      {changes.length ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3"><h3 className="font-semibold">{zh ? eventRosterBatchWorkspaceText.changesToSendLabel.zh : eventRosterBatchWorkspaceText.changesToSendLabel.en}</h3>{Object.entries(draft).map(([id, x]) => <div key={id} className="flex flex-wrap items-start justify-between gap-2 text-sm"><span>{date(x.date)} · {x.role[language]} · {x.before || (zh ? eventRosterBatchWorkspaceText.vacant.zh : eventRosterBatchWorkspaceText.vacant.en)} → {x.after || (zh ? eventRosterBatchWorkspaceText.endAssignment.zh : eventRosterBatchWorkspaceText.endAssignment.en)}</span><button type="button" className="min-h-11 underline" disabled={busy} onClick={() => { key.current = crypto.randomUUID(); setDraft(old => { const next = { ...old }; delete next[id]; return next }) }}>{zh ? eventRosterBatchWorkspaceText.undoThisChange.zh : eventRosterBatchWorkspaceText.undoThisChange.en}</button></div>)}<AppActionButton variant="primary" disabled={busy} onClick={() => void send()}>{zh ? eventRosterBatchWorkspaceText.sendRosterInvitations.zh : eventRosterBatchWorkspaceText.sendRosterInvitations.en}</AppActionButton></div> : null}
      {data?.canManage && data.isRecurring ? <details className="space-y-3 border-t pt-3"><summary className="cursor-pointer font-semibold">{zh ? eventRosterBatchWorkspaceText.defaultPositionsForRecurringDates.zh : eventRosterBatchWorkspaceText.defaultPositionsForRecurringDates.en}</summary><p className="text-sm">{data.defaultsVersion ? (zh ? eventRosterBatchWorkspaceText.defaultRequirementsVPositionsOnlyNoAssignees.zh(data.defaultsVersion) : eventRosterBatchWorkspaceText.defaultRequirementsVPositionsOnlyNoAssignees.en(data.defaultsVersion)) : (zh ? eventRosterBatchWorkspaceText.chooseADateExplicitlyToEstablishDefaultPositionsFor.zh : eventRosterBatchWorkspaceText.chooseADateExplicitlyToEstablishDefaultPositionsFor.en)}</p>{data.canConfigure ? data.occurrences.map(x => <AppActionButton key={x.id} disabled={busy || changes.length > 0 || x.roster.slots.length === 0} onClick={() => void (async () => { if (await requestConfirmation({ title: zh ? eventRosterBatchWorkspaceText.adoptDefaultPositions.zh : eventRosterBatchWorkspaceText.adoptDefaultPositions.en, description: zh ? eventRosterBatchWorkspaceText.adoptThePositionsCountsRelativeTimesAndEligibilityRules.zh(date(x.startUtc)) : eventRosterBatchWorkspaceText.adoptThePositionsCountsRelativeTimesAndEligibilityRules.en(date(x.startUtc)) })) await execute(() => api.adoptRosterDefaults(eventId, x.id, x.roster.eTag, data.defaultsETag)) })()}>{zh ? eventRosterBatchWorkspaceText.use.zh(date(x.startUtc)) : eventRosterBatchWorkspaceText.use.en(date(x.startUtc))}</AppActionButton>) : null}<AppActionButton disabled={busy || changes.length > 0 || !data.defaultsVersion} onClick={() => void execute(() => api.extendRoster(eventId, data.defaultsETag))}>{zh ? eventRosterBatchWorkspaceText.addMissingDatesAndEmptyPositionsFor12Weeks.zh : eventRosterBatchWorkspaceText.addMissingDatesAndEmptyPositionsFor12Weeks.en}</AppActionButton></details> : null}
    </div>{confirmationModal}
  </EventToolSection>
}
