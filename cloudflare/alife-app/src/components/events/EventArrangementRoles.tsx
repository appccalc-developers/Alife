import { eventArrangementRolesText } from '../../i18n/eventArrangementRoles.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { eventOperationsService } from '../../services/eventOperationsService'
import { groupService, type MemberSummaryDto } from '../../services/groupService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { EventPlanProposal } from '../../types/eventComposition'
import type { EventTeamWorkspace } from '../../types/eventOperations'
import AppActionButton from '../layout/AppActionButton'
import { Check, Clock3, UserPlus, UserRound, X } from 'lucide-react'

export type ArrangementRole = EventPlanProposal['roleRequirements'][number]
const labels: Record<string, [string, string]> = {
  'event.lead': [eventArrangementRolesText.onSiteEventLead.en, eventArrangementRolesText.onSiteEventLead.zh],
  'event.accountableOwner': [eventArrangementRolesText.eventAccountableOwner.en, eventArrangementRolesText.eventAccountableOwner.zh],
  'registration.manager': [eventArrangementRolesText.registrationManager.en, eventArrangementRolesText.registrationManager.zh],
  'roster.coordinator': [eventArrangementRolesText.rosterCoordinator.en, eventArrangementRolesText.rosterCoordinator.zh],
  'ram.author': [eventArrangementRolesText.ramAuthor.en, eventArrangementRolesText.ramAuthor.zh], 'ram.approver': [eventArrangementRolesText.ramApprover.en, eventArrangementRolesText.ramApprover.zh],
  'finance.owner': [eventArrangementRolesText.financeOwner.en, eventArrangementRolesText.financeOwner.zh], 'finance.approver': [eventArrangementRolesText.financeApprover.en, eventArrangementRolesText.financeApprover.zh],
  'safeguarding.lead': [eventArrangementRolesText.safeguardingLead.en, eventArrangementRolesText.safeguardingLead.zh], 'check-in.worker': [eventArrangementRolesText.checkInWorker.en, eventArrangementRolesText.checkInWorker.zh],
  'programme.lead': [eventArrangementRolesText.programmeLead.en, eventArrangementRolesText.programmeLead.zh], 'resource.coordinator': [eventArrangementRolesText.resourceCoordinator.en, eventArrangementRolesText.resourceCoordinator.zh],
  'travel.coordinator': [eventArrangementRolesText.travelCoordinator.en, eventArrangementRolesText.travelCoordinator.zh], 'hospitality.lead': [eventArrangementRolesText.hospitalityLead.en, eventArrangementRolesText.hospitalityLead.zh],
  'operations.commander': [eventArrangementRolesText.operationsCommander.en, eventArrangementRolesText.operationsCommander.zh], 'comms.owner': [eventArrangementRolesText.communicationsOwner.en, eventArrangementRolesText.communicationsOwner.zh],
}
export const arrangementRoleLabel = (code: string, zh: boolean) => labels[code]?.[zh ? 1 : 0] ?? code
export const roleStatusLabel = (status: string, zh: boolean) => ({ unassigned: zh ? eventArrangementRolesText.unassigned.zh : eventArrangementRolesText.unassigned.en, invited: zh ? eventArrangementRolesText.awaitingAcceptance.zh : eventArrangementRolesText.awaitingAcceptance.en, accepted: zh ? eventArrangementRolesText.accepted.zh : eventArrangementRolesText.accepted.en, declined: zh ? eventArrangementRolesText.declined.zh : eventArrangementRolesText.declined.en, ended: zh ? eventArrangementRolesText.ended.zh : eventArrangementRolesText.ended.en }[status] ?? status)

export function useArrangementRoles(eventId: string, groupId: string, revision?: string) {
  const [data, setData] = useState<EventTeamWorkspace | null>(null), [candidates, setCandidates] = useState<MemberSummaryDto[]>([])
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const version = ++sequence.current
    setLoading(true); setError(''); setData(null); setCandidates([])
    try {
      const team = await eventOperationsService.getTeam(eventId)
      const members = team.canManage ? (await groupService.getGroupMemberships(groupId)).filter(x => x.status === 'approved').map(x => ({ id: x.memberId, displayName: x.displayName ?? null })) : []
      if (sequence.current === version) { setData(team); setCandidates(members) }
    } catch (reason) { if (sequence.current === version) setError(normalizeApiError(reason).message) }
    finally { if (sequence.current === version) setLoading(false) }
  }, [eventId, groupId])
  useEffect(() => { void reload(); return () => { sequence.current++ } }, [reload, revision])
  return { data, candidates, error, loading, reload }
}
export type ArrangementRoleState = ReturnType<typeof useArrangementRoles>
export function ArrangementRoles({ roles, zh, state, eventId, onSaved, onBusy, readOnly = false, summary = false, compact = false, ownerName, moduleLabels }: {
  compact?: boolean; moduleLabels?: Record<string, string>; roles: ArrangementRole[]; zh: boolean; state?: ArrangementRoleState; eventId?: string; onSaved?: (moduleCode: string) => Promise<void>; onBusy?: (value: boolean) => void; readOnly?: boolean; summary?: boolean; ownerName?: string
}) {
  const currentMember = useAuthStore().me
  const currentMemberId = currentMember?.id
  const ownerDisplay = ownerName ? state?.candidates.find(x => x.id === ownerName)?.displayName || (ownerName === currentMemberId ? currentMember?.displayName : ownerName) : !eventId ? currentMember?.displayName : undefined
  const [invitees, setInvitees] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const mutate = async (role: ArrangementRole, action: () => Promise<unknown>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); onBusy?.(true); setError('')
    try { await action(); await state?.reload(); await onSaved?.(role.moduleCode); setInvitees(previous => ({ ...previous, [role.requirementKey]: '' })) }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { lock.current = false; setBusy(false); onBusy?.(false) }
  }
  if (!roles.length) return null
  return <div className={compact ? "space-y-2" : "space-y-3"} data-arrangement-roles>
    {state?.loading ? <p role="status">{zh ? eventArrangementRolesText.loadingRoleAssignments.zh : eventArrangementRolesText.loadingRoleAssignments.en}</p> : null}
    {state?.error ? <p role="alert">{state.error} <button type="button" onClick={() => void state.reload()}>{zh ? eventArrangementRolesText.retry.zh : eventArrangementRolesText.retry.en}</button></p> : null}
    {error ? <p role="alert" className="text-rose-800">{error}</p> : null}
    {roles.map(role => {
      const assignments = state?.data?.roles.filter(x => x.roleRequirementKey === role.requirementKey && x.status !== 'ended') ?? []
      const active = state?.data?.roleRequirements.some(x => x.requirementKey === role.requirementKey)
      const filled = assignments.filter(x => x.status === 'accepted').length
      return <section key={role.requirementKey} aria-label={arrangementRoleLabel(role.roleCode, zh)} className={compact ? "min-w-0 border-t border-violet-200/60 py-2 first:border-t-0" : "min-w-0 rounded-xl border border-[#176b5a]/15 bg-white p-3"}>
        {summary && role.roleCode !== 'event.accountableOwner' && moduleLabels?.[role.moduleCode] ? <p className="mb-1 text-xs text-[#66766f]">{moduleLabels[role.moduleCode]}</p> : null}<h4 className={compact ? 'flex items-center gap-1.5 text-sm font-semibold' : 'font-semibold'}><UserRound size={compact ? 14 : 16} aria-hidden="true" /><span>{arrangementRoleLabel(role.roleCode, zh)}</span>{compact ? <span className="ml-auto text-xs font-normal text-[#66766f]" title={zh ? eventArrangementRolesText.acceptedMinimum.zh : eventArrangementRolesText.acceptedMinimum.en}>{filled}/{role.minimum}</span> : null}</h4>
        {!compact && (role.roleCode === 'event.accountableOwner' ? <p className="mt-1 text-sm text-[#66766f]">{zh ? eventArrangementRolesText.theCreatorOwnsTheEventPlanOwnershipCannotBe.zh : eventArrangementRolesText.theCreatorOwnsTheEventPlanOwnershipCannotBe.en}</p> : <p className="mt-1 text-xs text-[#66766f]">{zh ? eventArrangementRolesText.acceptingThisDutyDoesNotGrantEventPlanEditing.zh : eventArrangementRolesText.acceptingThisDutyDoesNotGrantEventPlanEditing.en}</p>)}
        {!compact ? <p className="mt-1 text-xs text-[#66766f]">{zh ? eventArrangementRolesText.minimum.zh(role.minimum, state ? eventArrangementRolesText.label.zh(filled) : eventArrangementRolesText.label.en()) : eventArrangementRolesText.minimum.en(role.minimum, state ? `· ${filled} accepted` : '')}</p> : null}
        {assignments.map(assignment => <div key={assignment.id} className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}><span className="break-all">{state?.candidates.find(x => x.id === assignment.memberId)?.displayName || state?.data?.members.find(x => x.memberId === assignment.memberId)?.displayName || assignment.memberId}</span><span className="inline-flex items-center gap-1 text-[#66766f]" title={roleStatusLabel(assignment.status, zh)}>{compact ? (assignment.status === 'accepted' ? <Check size={14} aria-hidden="true" /> : assignment.status === 'invited' ? <Clock3 size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />) : null}<span className={compact ? 'sr-only' : undefined}>{roleStatusLabel(assignment.status, zh)}</span></span>{role.roleCode !== 'event.accountableOwner' && !summary && !readOnly && assignment.memberId === currentMemberId && assignment.status === 'invited' && eventId ? <><AppActionButton size="sm" aria-label={zh ? eventArrangementRolesText.acceptRole.zh : eventArrangementRolesText.acceptRole.en} disabled={busy} onClick={() => void mutate(role, () => eventOperationsService.respondToRoleInvitation(eventId, assignment.id, true))}>{compact ? <Check size={14} aria-hidden="true" /> : (zh ? eventArrangementRolesText.acceptRole.zh : eventArrangementRolesText.acceptRole.en)}</AppActionButton><AppActionButton size="sm" aria-label={zh ? eventArrangementRolesText.declineRole.zh : eventArrangementRolesText.declineRole.en} disabled={busy} onClick={() => void mutate(role, () => eventOperationsService.respondToRoleInvitation(eventId, assignment.id, false))}>{compact ? <X size={14} aria-hidden="true" /> : (zh ? eventArrangementRolesText.declineRole.zh : eventArrangementRolesText.declineRole.en)}</AppActionButton></> : null}</div>)}
        {!assignments.length && !state?.loading && !state?.error ? <p className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-amber-800`}>{role.roleCode === 'event.accountableOwner' && ownerDisplay ? ownerDisplay : zh ? eventArrangementRolesText.unassignedLabel.zh : eventArrangementRolesText.unassignedLabel.en}</p> : null}
        {role.roleCode !== 'event.accountableOwner' && !summary && !readOnly && state?.data?.canManage && active && eventId ? <div className={`flex min-w-0 flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-3'}`}><label className="min-w-0 flex-1 text-xs"><span className={compact ? 'sr-only' : undefined}>{compact ? `${arrangementRoleLabel(role.roleCode, zh)} · ${zh ? eventArrangementRolesText.selectMember.zh : eventArrangementRolesText.selectMember.en}` : (zh ? eventArrangementRolesText.inviteAMemberForThisRole.zh : eventArrangementRolesText.inviteAMemberForThisRole.en)}</span><select className={`mt-1 min-h-11 w-full min-w-0 rounded-xl border bg-white px-2 text-sm ${compact ? 'min-h-9' : ''}`} value={invitees[role.requirementKey] || ''} onChange={event => setInvitees(previous => ({ ...previous, [role.requirementKey]: event.target.value }))}><option value="">{zh ? eventArrangementRolesText.selectMember.zh : eventArrangementRolesText.selectMember.en}</option>{state.candidates.filter(candidate => !assignments.some(x => x.memberId === candidate.id && ['invited', 'accepted'].includes(x.status))).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.displayName || candidate.id}</option>)}</select></label><AppActionButton size={compact ? 'sm' : undefined} aria-label={zh ? eventArrangementRolesText.invite.zh : eventArrangementRolesText.invite.en} className="self-end" disabled={busy || !invitees[role.requirementKey]} onClick={() => void mutate(role, () => eventOperationsService.createRoleInvitation(eventId, role.requirementKey, invitees[role.requirementKey]))}>{compact ? <UserPlus size={14} aria-hidden="true" /> : (zh ? eventArrangementRolesText.invite.zh : eventArrangementRolesText.invite.en)}</AppActionButton></div> : null}
        {!compact && !summary && !active && role.roleCode !== 'event.accountableOwner' ? <p className="mt-2 text-xs text-[#66766f]">{zh ? eventArrangementRolesText.createTheEventOrSaveModuleChoicesToInvite.zh : eventArrangementRolesText.createTheEventOrSaveModuleChoicesToInvite.en}</p> : null}
      </section>
    })}
  </div>
}
