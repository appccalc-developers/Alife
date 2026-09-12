import { useCallback, useEffect, useRef, useState } from 'react'
import { eventOperationsService } from '../../services/eventOperationsService'
import { groupService, type MemberSummaryDto } from '../../services/groupService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { EventPlanProposal } from '../../types/eventComposition'
import type { EventTeamWorkspace } from '../../types/eventOperations'
import AppActionButton from '../layout/AppActionButton'

export type ArrangementRole = EventPlanProposal['roleRequirements'][number]
const labels: Record<string, [string, string]> = {
  'event.lead': ['On-site event lead', '现场活动领队'],
  'event.accountableOwner': ['Event accountable owner', '活动总负责人'],
  'registration.manager': ['Registration manager', '报名负责人'],
  'roster.coordinator': ['Roster coordinator', '同工排班协调人'],
  'ram.author': ['RAM author', 'RAM 填表人'], 'ram.approver': ['RAM approver', 'RAM 审核人'],
  'finance.owner': ['Finance owner', '财务负责人'], 'finance.approver': ['Finance approver', '财务审核人'],
  'safeguarding.lead': ['Safeguarding lead', '儿童保护负责人'], 'check-in.worker': ['Check-in worker', '儿童签到同工'],
  'programme.lead': ['Programme lead', '节目负责人'], 'resource.coordinator': ['Resource coordinator', '场地资源协调人'],
  'travel.coordinator': ['Travel coordinator', '交通住宿协调人'], 'hospitality.lead': ['Hospitality lead', '餐饮接待负责人'],
  'operations.commander': ['Operations commander', '现场统筹负责人'], 'comms.owner': ['Communications owner', '沟通跟进负责人'],
}
export const arrangementRoleLabel = (code: string, zh: boolean) => labels[code]?.[zh ? 1 : 0] ?? code
export const roleStatusLabel = (status: string, zh: boolean) => ({ invited: zh ? '待本人接受' : 'Awaiting acceptance', accepted: zh ? '已接受' : 'Accepted', declined: zh ? '已拒绝' : 'Declined', ended: zh ? '已结束' : 'Ended' }[status] ?? status)

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
export function ArrangementRoles({ roles, zh, state, eventId, onSaved, onBusy, readOnly = false, summary = false, ownerName, moduleLabels }: {
  moduleLabels?: Record<string, string>; roles: ArrangementRole[]; zh: boolean; state?: ArrangementRoleState; eventId?: string; onSaved?: (moduleCode: string) => Promise<void>; onBusy?: (value: boolean) => void; readOnly?: boolean; summary?: boolean; ownerName?: string
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
  return <div className="space-y-3" data-arrangement-roles>
    {state?.loading ? <p role="status">{zh ? '正在读取角色分工…' : 'Loading role assignments…'}</p> : null}
    {state?.error ? <p role="alert">{state.error} <button type="button" onClick={() => void state.reload()}>{zh ? '重试' : 'Retry'}</button></p> : null}
    {error ? <p role="alert" className="text-rose-800">{error}</p> : null}
    {roles.map(role => {
      const assignments = state?.data?.roles.filter(x => x.roleRequirementKey === role.requirementKey && x.status !== 'ended') ?? []
      const active = state?.data?.roleRequirements.some(x => x.requirementKey === role.requirementKey)
      const filled = assignments.filter(x => x.status === 'accepted').length
      return <section key={role.requirementKey} aria-label={arrangementRoleLabel(role.roleCode, zh)} className="min-w-0 rounded-xl border border-[#176b5a]/15 bg-white p-3">
        {summary && role.roleCode !== 'event.accountableOwner' && moduleLabels?.[role.moduleCode] ? <p className="mb-1 text-xs text-[#66766f]">{moduleLabels[role.moduleCode]}</p> : null}<h4 className="font-semibold">{arrangementRoleLabel(role.roleCode, zh)}</h4>
        {role.roleCode === 'event.accountableOwner' ? <p className="mt-1 text-sm text-[#66766f]">{zh ? '创建者固定负责活动计划；此处不能转交。' : 'The creator owns the event plan. Ownership cannot be transferred here.'}</p> : <p className="mt-1 text-xs text-[#66766f]">{zh ? '接受此职责不会获得活动计划编辑权。' : 'Accepting this duty does not grant event-plan editing access.'}</p>}
        <p className="mt-1 text-xs text-[#66766f]">{zh ? `至少 ${role.minimum} 人 ${state ? `· 已接受 ${filled} 人` : ''}` : `Minimum ${role.minimum} ${state ? `· ${filled} accepted` : ''}`}</p>
        {assignments.map(assignment => <div key={assignment.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="break-all">{state?.candidates.find(x => x.id === assignment.memberId)?.displayName || state?.data?.members.find(x => x.memberId === assignment.memberId)?.displayName || assignment.memberId}</span><span className="text-[#66766f]">{roleStatusLabel(assignment.status, zh)}</span>{role.roleCode !== 'event.accountableOwner' && !summary && !readOnly && assignment.memberId === currentMemberId && assignment.status === 'invited' && eventId ? <><AppActionButton size="sm" disabled={busy} onClick={() => void mutate(role, () => eventOperationsService.respondToRoleInvitation(eventId, assignment.id, true))}>{zh ? '接受角色' : 'Accept role'}</AppActionButton><AppActionButton size="sm" disabled={busy} onClick={() => void mutate(role, () => eventOperationsService.respondToRoleInvitation(eventId, assignment.id, false))}>{zh ? '拒绝' : 'Decline'}</AppActionButton></> : null}</div>)}
        {!assignments.length && !state?.loading && !state?.error ? <p className="mt-2 text-sm text-amber-800">{role.roleCode === 'event.accountableOwner' && ownerDisplay ? ownerDisplay : zh ? '待分配' : 'Unassigned'}</p> : null}
        {role.roleCode !== 'event.accountableOwner' && !summary && !readOnly && state?.data?.canManage && active && eventId ? <div className="mt-3 flex min-w-0 flex-wrap gap-2"><label className="min-w-0 flex-1 text-xs">{zh ? '邀请成员承担此角色' : 'Invite a member for this role'}<select className="mt-1 min-h-11 w-full min-w-0 rounded-xl border bg-white px-2 text-sm" value={invitees[role.requirementKey] || ''} onChange={event => setInvitees(previous => ({ ...previous, [role.requirementKey]: event.target.value }))}><option value="">{zh ? '选择成员' : 'Select member'}</option>{state.candidates.filter(candidate => !assignments.some(x => x.memberId === candidate.id && ['invited', 'accepted'].includes(x.status))).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.displayName || candidate.id}</option>)}</select></label><AppActionButton className="self-end" disabled={busy || !invitees[role.requirementKey]} onClick={() => void mutate(role, () => eventOperationsService.createRoleInvitation(eventId, role.requirementKey, invitees[role.requirementKey]))}>{zh ? '邀请' : 'Invite'}</AppActionButton></div> : null}
        {!summary && !active && role.roleCode !== 'event.accountableOwner' ? <p className="mt-2 text-xs text-[#66766f]">{zh ? '创建活动或保存模块选择后，可在此邀请负责人，由本人接受。' : 'Create the event or save module choices to invite someone here for personal acceptance.'}</p> : null}
      </section>
    })}
  </div>
}
