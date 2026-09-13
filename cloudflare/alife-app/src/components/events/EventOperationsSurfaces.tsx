import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import { groupService, type MemberSummaryDto } from '../../services/groupService'
import { RosterCandidateGroup } from './RosterCandidateGroup'
import { eventOperationsService } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import useConfirmation from '../../hooks/useConfirmation'
import type { EventRosterGroup, EventOccurrence, EventProgramme, EventRoster, EventTask, EventTaskStatus, EventTeamWorkspace } from '../../types/eventOperations'
import {
  formatLocalOccurrenceTime,
  formatLocalTime,
  fromTwelveHourTimeParts,
  groupEventTasks,
  localTimeValue,
  occurrenceLocalTimeToUtc,
  toTwelveHourTimeParts,
  type TwelveHourTimeParts,
} from '../../utils/eventOperationsState'
import AppActionButton from '../layout/AppActionButton'
import EventProgrammePrintView from './EventProgrammePrintView'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import NativeSectionCard from '../layout/AppSectionCard'
import { EventToolSection as AppSectionCard, useArrangementDraft } from './ArrangementTileDeck'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

type AsyncState = 'loading' | 'ready' | 'empty' | 'error' | 'permission-denied' | 'conflict'
const fieldClass = 'min-h-11 min-w-0 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 text-sm text-[#18332d] outline-none focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'
const labelClass = 'grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#66766f]'
const localize = (value: { en: string; zh: string }, language: 'en' | 'zh') => value[language] || value.en || value.zh
const fromLocalInput = (value: string) => new Date(value).toISOString()

const resolveState = (error: unknown): AsyncState => {
  const value = normalizeApiError(error)
  if (value.status === 403) return 'permission-denied'
  if (value.status === 409 || value.status === 412) return 'conflict'
  return 'error'
}

const SurfaceState = ({ state, language, error, onRetry }: { state: AsyncState; language: 'en' | 'zh'; error: string; onRetry: () => void }) => {
  if (state === 'loading') return <p className="text-sm text-[#66766f]" role="status">{language === 'zh' ? '載入中…' : 'Loading…'}</p>
  if (state === 'permission-denied') return <AppEmptyState title={language === 'zh' ? '沒有權限' : 'Access required'} description={language === 'zh' ? '此資料僅對已接受的活動團隊或本人開放。' : 'This data is limited to accepted event-team members or the affected member.'} />
  if (state === 'error' || state === 'conflict') return <AppEmptyState title={state === 'conflict' ? (language === 'zh' ? '資料已變更' : 'Data changed') : (language === 'zh' ? '無法載入' : 'Unable to load')} description={error} actionLabel={language === 'zh' ? '重新載入' : 'Reload'} onAction={onRetry} />
  return null
}

export const EventTeamPanel = ({ eventId, groupId, language, item, onBusyChange, onSaved, setupFlow }: EventSurfaceProps) => {
  const currentMemberId = useAuthStore().me?.id
  const [data, setData] = useState<EventTeamWorkspace | null>(null)
  const [candidates, setCandidates] = useState<MemberSummaryDto[]>([])
  const [state, setState] = useState<AsyncState>('loading')
  const [error, setError] = useState('')
  const [inviteeId, setInviteeId] = useState('')
  const [roleMemberId, setRoleMemberId] = useState('')
  const [roleRequirementKey, setRoleRequirementKey] = useState('')
  const [taskTitleEn, setTaskTitleEn] = useState('')
  const [taskTitleZh, setTaskTitleZh] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [isRestricted, setIsRestricted] = useState(false)
  const [busy, setBusy] = useState(false)

  useArrangementDraft(Boolean(inviteeId || roleMemberId || taskTitleEn || taskTitleZh || taskDue || assigneeId || requiresApproval || isRestricted))
  const load = useCallback(async () => {
    setState('loading'); setError('')
    try {
      const next = await eventOperationsService.getTeam(eventId)
      setData(next); setState(next.members.length || next.tasks.length || next.roles.length ? 'ready' : 'empty')
      if (next.canManage) {
        const memberships = await groupService.getGroupMemberships(groupId)
        setCandidates(memberships.filter((membership) => membership.status === 'approved').map((membership) => ({ id: membership.memberId, displayName: membership.displayName ?? null })))
      }
    } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) }
  }, [eventId, groupId])

  useEffect(() => { void load() }, [load])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])

  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await action(); await load(); await onSaved?.() } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) } finally { setBusy(false) }
  }

  const createTask = (event: FormEvent) => {
    event.preventDefault()
    if (!taskTitleEn.trim() || !taskTitleZh.trim()) return
    void mutate(async () => {
      await eventOperationsService.createTask(eventId, { title: { en: taskTitleEn.trim(), zh: taskTitleZh.trim() }, description: { en: '', zh: '' }, assignedMemberId: assigneeId || null, dueUtc: taskDue ? fromLocalInput(taskDue) : null, isRequired: true, requiresApproval, isRestricted })
      setTaskTitleEn(''); setTaskTitleZh(''); setTaskDue(''); setAssigneeId(''); setRequiresApproval(false); setIsRestricted(false)
    })
  }

  const taskColumns: Array<{ status: EventTaskStatus; en: string; zh: string }> = [
    { status: 'todo', en: 'To do', zh: '待辦' }, { status: 'inProgress', en: 'In progress', zh: '進行中' },
    { status: 'blocked', en: 'Blocked', zh: '受阻' }, { status: 'done', en: 'Done', zh: '完成' },
    { status: 'cancelled', en: 'Cancelled', zh: '已取消' },
  ]
  const groupedTasks = groupEventTasks(data?.tasks ?? [])

  return (
    <div className="space-y-4">
      <AppSectionCard title={language === 'zh' ? '协作成员与历史分工' : 'Collaborators and historical assignments'} subtitle={language === 'zh' ? '这里只保留跨模块的协调任务；岗位人选及轮班在对应模块中安排。' : 'Keep cross-module coordination tasks here. Role candidates and shifts belong to their modules.'} action={<AppBadge variant={item.readiness === 'ready' ? 'success' : 'warning'}>{item.readiness}</AppBadge>}>
        <SurfaceState state={state} language={language} error={error} onRetry={() => void load()} />
        {data ? <div className="space-y-6">
          {data.readinessBlockers.length ? <ul className="space-y-2" aria-label={language === 'zh' ? '準備度阻塞' : 'Readiness blockers'}>{data.readinessBlockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(blocker, language)}</li>)}</ul> : null}
          <details><summary className="cursor-pointer font-semibold text-[#176b5a]">{language === 'zh' ? '协作成员与历史分工' : 'Collaborators and historical assignments'}</summary><section aria-labelledby="event-team-heading">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="event-team-heading" className="font-black text-[#18332d]">{setupFlow ? (language === 'zh' ? '团队成员' : 'Team members') : (language === 'zh' ? '團隊與角色' : 'Team & roles')}</h3></div>
            <div className="mt-3 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
              {data.members.map((member) => <article key={member.id} className="rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4"><p className="font-bold text-[#18332d]">{member.displayName || member.memberId}</p><AppBadge variant={member.status === 'accepted' ? 'success' : member.status === 'declined' ? 'danger' : 'warning'}>{member.status}</AppBadge>{member.memberId === currentMemberId && member.status === 'invited' ? <div className="mt-3 flex gap-2"><AppActionButton size="sm" variant="primary" disabled={busy} onClick={() => void mutate(() => eventOperationsService.respondToTeamInvite(eventId, member.id, true))}>{language === 'zh' ? '接受' : 'Accept'}</AppActionButton><AppActionButton size="sm" disabled={busy} onClick={() => void mutate(() => eventOperationsService.respondToTeamInvite(eventId, member.id, false))}>{language === 'zh' ? '拒絕' : 'Decline'}</AppActionButton></div> : null}</article>)}
              {!setupFlow && data.roles.map((role) => <article key={role.id} className="rounded-2xl border border-[#2f4b42]/10 bg-white p-4"><p className="text-xs font-bold text-[#66766f]">{role.roleRequirementKey}</p><p className="mt-1 text-sm text-[#40554e]">{candidates.find((member) => member.id === role.memberId)?.displayName || role.memberId}</p><AppBadge variant={role.status === 'accepted' ? 'success' : role.status === 'declined' ? 'danger' : 'warning'}>{role.status}</AppBadge>{role.memberId === currentMemberId && role.status === 'invited' ? <div className="mt-3 flex gap-2"><AppActionButton size="sm" variant="primary" disabled={busy} onClick={() => void mutate(() => eventOperationsService.respondToRoleInvitation(eventId, role.id, true))}>{language === 'zh' ? '接受角色' : 'Accept role'}</AppActionButton><AppActionButton size="sm" disabled={busy} onClick={() => void mutate(() => eventOperationsService.respondToRoleInvitation(eventId, role.id, false))}>{language === 'zh' ? '拒絕' : 'Decline'}</AppActionButton></div> : null}</article>)}
            </div>
            {data.canManage ? <form className="mt-4 flex flex-col gap-2 tablet:flex-row" onSubmit={(event) => { event.preventDefault(); if (inviteeId) void mutate(() => eventOperationsService.inviteTeamMember(eventId, inviteeId)) }}><label className="sr-only" htmlFor="event-team-invitee">{language === 'zh' ? '邀請成員' : 'Invite member'}</label><select id="event-team-invitee" value={inviteeId} onChange={(event) => setInviteeId(event.target.value)} className={fieldClass}><option value="">{language === 'zh' ? '選擇小組成員' : 'Select group member'}</option>{candidates.filter((candidate) => !data.members.some((member) => member.memberId === candidate.id && member.status !== 'ended')).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName || candidate.id}</option>)}</select><AppActionButton type="submit" variant="primary" disabled={busy || !inviteeId}>{language === 'zh' ? '發出邀請' : 'Send invitation'}</AppActionButton></form> : null}
            {!setupFlow && data.canManage && data.roleRequirements.length ? <form className="mt-3 grid gap-2 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); if (roleMemberId && roleRequirementKey) void mutate(() => eventOperationsService.createRoleInvitation(eventId, roleRequirementKey, roleMemberId)) }}><label className={labelClass}>{language === 'zh' ? '角色要求' : 'Role requirement'}<select className={fieldClass} value={roleRequirementKey} onChange={(event) => setRoleRequirementKey(event.target.value)}><option value="">{language === 'zh' ? '選擇角色' : 'Select role'}</option>{data.roleRequirements.filter(role => role.roleCode !== 'event.accountableOwner').map((role) => <option key={role.requirementKey} value={role.requirementKey}>{role.roleCode} · min {role.minimum}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '受邀人' : 'Invitee'}<select className={fieldClass} value={roleMemberId} onChange={(event) => setRoleMemberId(event.target.value)}><option value="">{language === 'zh' ? '選擇合資格小組成員' : 'Select eligible group member'}</option>{candidates.map((member) => <option key={member.id} value={member.id}>{member.displayName || member.id}</option>)}</select></label><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy || !roleMemberId || !roleRequirementKey}>{language === 'zh' ? '邀請角色' : 'Invite role'}</AppActionButton></form> : null}
          </section></details>
        </div> : null}
      </AppSectionCard>

      {data ? <AppSectionCard title={language === 'zh' ? '任務與準備度' : 'Tasks & readiness'} subtitle={language === 'zh' ? '桌面按狀態分組；窄屏自然排列為單欄清單。' : 'Grouped by state on desktop and presented as a single list on narrow screens.'}>
        {data.canManage ? <form className="mb-5 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4" onSubmit={createTask}><label className={labelClass}>{language === 'zh' ? '英文標題' : 'English title'}<input className={fieldClass} value={taskTitleEn} onChange={(event) => setTaskTitleEn(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '中文標題' : 'Chinese title'}<input className={fieldClass} value={taskTitleZh} onChange={(event) => setTaskTitleZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '負責人' : 'Assignee'}<select className={fieldClass} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">{language === 'zh' ? '未指派' : 'Unassigned'}</option>{data.members.filter((member) => member.status === 'accepted').map((member) => <option key={member.id} value={member.memberId}>{member.displayName || member.memberId}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '期限' : 'Due'}<input type="datetime-local" className={fieldClass} value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label><label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[#40554e]"><input type="checkbox" checked={requiresApproval} onChange={(event) => setRequiresApproval(event.target.checked)} />{language === 'zh' ? '需要批准' : 'Requires approval'}</label><label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[#40554e]"><input type="checkbox" checked={isRestricted} onChange={(event) => setIsRestricted(event.target.checked)} />{language === 'zh' ? '限制任務' : 'Restricted task'}</label><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy}>{language === 'zh' ? '新增任務' : 'Add task'}</AppActionButton></form> : null}
        {data.tasks.length ? <div className="grid gap-3 desktop:grid-cols-4">{taskColumns.map((column) => <section key={column.status} className="rounded-2xl bg-[#eef4ef] p-3"><h3 className="mb-3 text-sm font-black text-[#18332d]">{language === 'zh' ? column.zh : column.en} <span className="text-[#66766f]">{groupedTasks[column.status].length}</span></h3><div className="space-y-3">{groupedTasks[column.status].map((task) => <TaskCard key={task.id} task={task} tasks={data.tasks} canManage={data.canManage} language={language} busy={busy} onStatus={(status) => void mutate(() => eventOperationsService.updateTask(eventId, task, status))} onDependency={(dependsOnTaskId) => void mutate(() => eventOperationsService.addTaskDependency(eventId, task.id, dependsOnTaskId))} onBlock={(reason) => void mutate(() => eventOperationsService.addTaskBlocker(eventId, task.id, reason))} onResolve={(blockerId, resolution) => void mutate(() => eventOperationsService.resolveTaskBlocker(eventId, task.id, blockerId, resolution))} />)}</div></section>)}</div> : <AppEmptyState title={language === 'zh' ? '尚無任務' : 'No tasks yet'} description={language === 'zh' ? '新增必要任務後，準備度會反映阻塞與逾期狀態。' : 'Required tasks feed blockers and overdue status into readiness.'} />}
      </AppSectionCard> : null}
    </div>
  )
}

const TaskCard = ({ task, tasks, canManage, language, busy, onStatus, onDependency, onBlock, onResolve }: { task: EventTask; tasks: EventTask[]; canManage: boolean; language: 'en' | 'zh'; busy: boolean; onStatus: (status: EventTaskStatus) => void; onDependency: (dependsOnTaskId: string) => void; onBlock: (reason: string) => void; onResolve: (blockerId: string, resolution: string) => void }) => {
  const [reason, setReason] = useState('')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})
  const [dependencyId, setDependencyId] = useState('')
  const existingDependencies = new Set(task.dependencies.map((dependency) => dependency.dependsOnEventTaskId))
  const dependencyCandidates = tasks.filter((candidate) => candidate.id !== task.id && !existingDependencies.has(candidate.id) && candidate.status !== 'cancelled')
  const availableStatuses: EventTaskStatus[] = canManage ? ['todo', 'inProgress', 'blocked', 'done', 'cancelled'] : ['todo', 'inProgress', 'blocked', 'done']
  return <article className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="font-bold text-[#18332d]">{localize(task.title, language)}</p>{task.isRequired ? <AppBadge variant="warning">{language === 'zh' ? '必要' : 'Required'}</AppBadge> : null}</div>{task.dueUtc ? <time className="mt-2 block text-xs text-[#66766f]">{new Date(task.dueUtc).toLocaleString()}</time> : null}{task.requiresApproval ? <p className="mt-1 text-xs font-bold text-amber-800">{language === 'zh' ? '需完成批准' : 'Approval required'}</p> : null}<select className={`${fieldClass} mt-3`} value={task.status} disabled={busy} onChange={(event) => onStatus(event.target.value as EventTaskStatus)}>{availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>{task.dependencies.length ? <ul className="mt-2 space-y-1 text-xs text-[#66766f]">{task.dependencies.map((dependency) => <li key={dependency.id}>{language === 'zh' ? '依賴：' : 'Depends on: '}{localize(tasks.find((candidate) => candidate.id === dependency.dependsOnEventTaskId)?.title ?? { en: dependency.dependsOnEventTaskId, zh: dependency.dependsOnEventTaskId }, language)}</li>)}</ul> : null}{canManage && dependencyCandidates.length ? <div className="mt-2 flex gap-2"><select aria-label={language === 'zh' ? '依賴任務' : 'Dependency task'} className={fieldClass} value={dependencyId} onChange={(event) => setDependencyId(event.target.value)}><option value="">{language === 'zh' ? '新增依賴' : 'Add dependency'}</option>{dependencyCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{localize(candidate.title, language)}</option>)}</select><AppActionButton size="sm" disabled={busy || !dependencyId} onClick={() => { onDependency(dependencyId); setDependencyId('') }}>{language === 'zh' ? '加入' : 'Add'}</AppActionButton></div> : null}{task.blockers.filter((blocker) => !blocker.resolvedUtc).map((blocker) => { const resolution = resolutions[blocker.id] ?? ''; return <div key={blocker.id} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2"><p className="text-xs text-amber-950">{blocker.reason}</p><div className="mt-2 flex gap-2"><input className={fieldClass} value={resolution} onChange={(event) => setResolutions((current) => ({ ...current, [blocker.id]: event.target.value }))} placeholder={language === 'zh' ? '解除說明' : 'Resolution'} /><AppActionButton size="sm" disabled={busy || !resolution.trim()} onClick={() => { onResolve(blocker.id, resolution.trim()); setResolutions((current) => ({ ...current, [blocker.id]: '' })) }}>{language === 'zh' ? '解除' : 'Resolve'}</AppActionButton></div></div> })}{task.status !== 'done' ? <div className="mt-2 flex gap-2"><input className={fieldClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={language === 'zh' ? '阻塞原因' : 'Blocker reason'} /><AppActionButton size="sm" disabled={busy || !reason.trim()} onClick={() => { onBlock(reason.trim()); setReason('') }}>{language === 'zh' ? '阻塞' : 'Block'}</AppActionButton></div> : null}</article>
}

const OccurrencePicker = ({ eventId, language, value, onChange }: { eventId: string; language: 'en' | 'zh'; value: string; onChange: (id: string, occurrence?: EventOccurrence) => void }) => {
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([])
  useEffect(() => {
    void eventOperationsService.listOccurrences(eventId).then((values) => {
      setOccurrences(values)
      const selected = values.find((occurrence) => occurrence.id === value) ?? values[0]
      if (selected) onChange(selected.id, selected)
    })
  }, [eventId, onChange])
  const selectOccurrence = (id: string) => onChange(id, occurrences.find((occurrence) => occurrence.id === id))
  return <label className={labelClass}>{language === 'zh' ? '場次（本地時間）' : 'Occurrence (local time)'}<select className={fieldClass} value={value} onChange={(event) => selectOccurrence(event.target.value)}><option value="">{language === 'zh' ? '選擇場次' : 'Select occurrence'}</option>{occurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{formatLocalOccurrenceTime(occurrence.startUtc, language)}</option>)}</select></label>
}

export const EventProgrammePanel = ({ eventId, language, item, onBusyChange, onSaved }: EventSurfaceProps) => {
  const [printData, setPrintData] = useState<EventProgramme | null>(null)
  const [occurrenceId, setOccurrenceId] = useState('')
  const [data, setData] = useState<EventProgramme | null>(null)
  const [state, setState] = useState<AsyncState>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleEn, setTitleEn] = useState('')
  const [titleZh, setTitleZh] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  useArrangementDraft(Boolean(titleEn || titleZh))
  const stableSetOccurrence = useCallback((id: string) => setOccurrenceId(id), [])
  const load = useCallback(async () => { if (!occurrenceId) return; setState('loading'); try { const next = await eventOperationsService.getProgramme(eventId, occurrenceId); setData(next); setState(next.sessions.length ? 'ready' : 'empty') } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) } }, [eventId, occurrenceId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  const create = async (event: FormEvent) => { event.preventDefault(); if (!data) return; setBusy(true); try { const next = await eventOperationsService.createSession(eventId, occurrenceId, data.eTag, { title: { en: titleEn, zh: titleZh }, startUtc: fromLocalInput(start), endUtc: fromLocalInput(end), placeJson: '{}', status: 'draft' }); setData(next); setState('ready'); setTitleEn(''); setTitleZh(''); await onSaved?.() } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  return <div className="space-y-4 print:space-y-2">{printData ? <EventProgrammePrintView programme={printData} zh={language === 'zh'} onClose={() => setPrintData(null)} /> : null}<AppSectionCard title={localize(item.label, language)} subtitle={language === 'zh' ? '先選擇場次；Series 的既有場次不會被預設值回寫。' : 'Select an occurrence first; materialized occurrences are not overwritten by series defaults.'} action={<div className="flex gap-2"><AppBadge variant={item.readiness === 'ready' ? 'success' : 'warning'}>{item.readiness}</AppBadge><AppActionButton size="sm" disabled={!data || busy} onClick={() => { if (data) setPrintData(data) }}>{language === 'zh' ? '列印流程表' : 'Print run sheet'}</AppActionButton></div>}><OccurrencePicker eventId={eventId} language={language} value={occurrenceId} onChange={stableSetOccurrence} />{occurrenceId ? <div className="mt-4"><SurfaceState state={state} language={language} error={error} onRetry={() => void load()} /></div> : null}</AppSectionCard>{data?.canManage ? <AppSectionCard title={language === 'zh' ? '新增 Session' : 'Add session'}><form className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-5" onSubmit={(event) => void create(event)}><label className={labelClass}>English<input className={fieldClass} value={titleEn} onChange={(event) => setTitleEn(event.target.value)} required /></label><label className={labelClass}>中文<input className={fieldClass} value={titleZh} onChange={(event) => setTitleZh(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '開始' : 'Start'}<input type="datetime-local" className={fieldClass} value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '結束' : 'End'}<input type="datetime-local" className={fieldClass} value={end} onChange={(event) => setEnd(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" variant="primary" disabled={busy}>{language === 'zh' ? '新增' : 'Add'}</AppActionButton></form></AppSectionCard> : null}{data?.sessions.length ? <AppSectionCard title={language === 'zh' ? '节目环节' : 'Programme sessions'} summary={`${data.sessions.length}`}>{data.sessions.map((session) => <SessionCard key={session.id} data={data} session={session} language={language} busy={busy} onBusy={setBusy} onData={async value => { setData(value); await onSaved?.() }} onFailure={(reason) => { setState(resolveState(reason)); setError(normalizeApiError(reason).message) }} />)}</AppSectionCard> : null}{data && !data.sessions.length ? <AppEmptyState title={language === 'zh' ? '尚無 Session' : 'No sessions yet'} description={language === 'zh' ? '建立第一個 Session 以開始編排流程表。' : 'Create the first session to begin the run sheet.'} /> : null}</div>
}

const SessionCard = ({ data, session, language, busy, onBusy, onData, onFailure }: { data: EventProgramme; session: EventProgramme['sessions'][number]; language: 'en' | 'zh'; busy: boolean; onBusy: (value: boolean) => void; onData: (value: EventProgramme) => void | Promise<void>; onFailure: (error: unknown) => void }) => {
  const [titleEn, setTitleEn] = useState(''); const [titleZh, setTitleZh] = useState(''); const [duration, setDuration] = useState(10)
  const [sessionTitleEn, setSessionTitleEn] = useState(session.title.en); const [sessionTitleZh, setSessionTitleZh] = useState(session.title.zh); const [sessionStatus, setSessionStatus] = useState(session.status)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  useArrangementDraft(Boolean(titleEn || titleZh || sessionTitleEn !== session.title.en || sessionTitleZh !== session.title.zh || sessionStatus !== session.status))
  const addItem = async (event: FormEvent) => { event.preventDefault(); onBusy(true); try { await onData(await eventOperationsService.createProgramItem(data.eventId, data.occurrenceId, session.id, data.eTag, { title: { en: titleEn, zh: titleZh }, description: { en: '', zh: '' }, startOffsetMinutes: session.items.reduce((total, item) => Math.max(total, item.startOffsetMinutes + item.durationMinutes), 0), durationMinutes: duration })); setTitleEn(''); setTitleZh('') } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  const move = async (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= session.items.length) return; const ids = session.items.map((item) => item.id); [ids[index], ids[target]] = [ids[target], ids[index]]; onBusy(true); try { await onData(await eventOperationsService.reorderProgramItems(data.eventId, data.occurrenceId, session.id, data.eTag, ids)) } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  const saveSession = async (event: FormEvent) => { event.preventDefault(); onBusy(true); try { await onData(await eventOperationsService.updateSession(data.eventId, data.occurrenceId, session.id, data.eTag, { title: { en: sessionTitleEn, zh: sessionTitleZh }, startUtc: session.startUtc, endUtc: session.endUtc, placeJson: session.placeJson, leadMemberId: session.leadMemberId, status: sessionStatus })) } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  const deleteSession = async () => { if (!await requestConfirmation({ title: language === 'zh' ? '刪除 Session？' : 'Delete session?', description: language === 'zh' ? '只有未連結崗位的 Session 可以刪除。' : 'Only sessions without linked service slots can be deleted.', tone: 'danger' })) return; onBusy(true); try { await onData(await eventOperationsService.deleteSession(data.eventId, data.occurrenceId, session.id, data.eTag)) } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  return <><NativeSectionCard title={localize(session.title, language)} subtitle={`${new Date(session.startUtc).toLocaleString()} – ${new Date(session.endUtc).toLocaleTimeString()} · ${session.status}`}>{data.canManage ? <form className="mb-4 grid gap-2 tablet:grid-cols-[1fr_1fr_9rem_auto_auto] print:hidden" onSubmit={(event) => void saveSession(event)}><input aria-label="Session English title" className={fieldClass} value={sessionTitleEn} onChange={(event) => setSessionTitleEn(event.target.value)} required /><input aria-label="Session Chinese title" className={fieldClass} value={sessionTitleZh} onChange={(event) => setSessionTitleZh(event.target.value)} required /><select aria-label="Session status" className={fieldClass} value={sessionStatus} onChange={(event) => setSessionStatus(event.target.value as typeof sessionStatus)}><option value="draft">draft</option><option value="confirmed">confirmed</option><option value="cancelled">cancelled</option></select><AppActionButton type="submit" disabled={busy}>{language === 'zh' ? '儲存' : 'Save'}</AppActionButton><AppActionButton variant="danger" disabled={busy} onClick={() => void deleteSession()}>{language === 'zh' ? '刪除' : 'Delete'}</AppActionButton></form> : null}<ol className="divide-y divide-[#2f4b42]/10">{session.items.map((item, index) => <ProgrammeItemRow key={item.id} data={data} item={item} index={index} itemCount={session.items.length} language={language} busy={busy} onMove={(delta) => void move(index, delta)} onBusy={onBusy} onData={onData} onFailure={onFailure} />)}</ol>{data.canManage ? <form className="mt-4 grid gap-3 tablet:grid-cols-[1fr_1fr_7rem_auto] print:hidden" onSubmit={(event) => void addItem(event)}><input aria-label="English title" className={fieldClass} value={titleEn} onChange={(event) => setTitleEn(event.target.value)} placeholder="English title" required /><input aria-label="中文標題" className={fieldClass} value={titleZh} onChange={(event) => setTitleZh(event.target.value)} placeholder="中文標題" required /><input aria-label="Duration" type="number" min="1" className={fieldClass} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /><AppActionButton type="submit" variant="primary" disabled={busy}>{language === 'zh' ? '新增項目' : 'Add item'}</AppActionButton></form> : null}</NativeSectionCard>{confirmationModal}</>
}

const ProgrammeItemRow = ({ data, item, index, itemCount, language, busy, onMove, onBusy, onData, onFailure }: { data: EventProgramme; item: EventProgramme['sessions'][number]['items'][number]; index: number; itemCount: number; language: 'en' | 'zh'; busy: boolean; onMove: (delta: number) => void; onBusy: (value: boolean) => void; onData: (value: EventProgramme) => void | Promise<void>; onFailure: (error: unknown) => void }) => {
  const [editing, setEditing] = useState(false); const [titleEn, setTitleEn] = useState(item.title.en); const [titleZh, setTitleZh] = useState(item.title.zh); const [duration, setDuration] = useState(item.durationMinutes)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const save = async () => { onBusy(true); try { await onData(await eventOperationsService.updateProgramItem(data.eventId, data.occurrenceId, item.id, data.eTag, { title: { en: titleEn, zh: titleZh }, description: item.description, startOffsetMinutes: item.startOffsetMinutes, durationMinutes: duration, ownerMemberId: item.ownerMemberId })); setEditing(false) } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  const remove = async () => { if (!await requestConfirmation({ title: language === 'zh' ? '刪除流程項目？' : 'Delete programme item?', description: language === 'zh' ? '已連結崗位時必須先解除連結。' : 'Linked service slots must be removed first.', tone: 'danger' })) return; onBusy(true); try { await onData(await eventOperationsService.deleteProgramItem(data.eventId, data.occurrenceId, item.id, data.eTag)) } catch (reason) { onFailure(reason) } finally { onBusy(false) } }
  return <><li className="grid gap-2 py-3 tablet:grid-cols-[5rem_1fr_auto]"><span className="font-mono text-sm text-[#66766f]">+{item.startOffsetMinutes}m</span>{editing ? <div className="grid gap-2 tablet:grid-cols-3"><input className={fieldClass} value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /><input className={fieldClass} value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /><input className={fieldClass} type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></div> : <div><p className="font-bold text-[#18332d]">{localize(item.title, language)}</p><p className="text-xs text-[#66766f]">{item.durationMinutes} min</p></div>}{data.canManage ? <div className="flex flex-wrap gap-1 print:hidden"><AppActionButton size="sm" disabled={busy || index === 0} onClick={() => onMove(-1)}>↑</AppActionButton><AppActionButton size="sm" disabled={busy || index === itemCount - 1} onClick={() => onMove(1)}>↓</AppActionButton>{editing ? <AppActionButton size="sm" variant="primary" disabled={busy} onClick={() => void save()}>{language === 'zh' ? '儲存' : 'Save'}</AppActionButton> : <AppActionButton size="sm" disabled={busy} onClick={() => setEditing(true)}>{language === 'zh' ? '編輯' : 'Edit'}</AppActionButton>}<AppActionButton size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>{language === 'zh' ? '刪除' : 'Delete'}</AppActionButton></div> : null}</li>{confirmationModal}</>
}

const RosterTimeField = ({ label, value, language, className = '', onChange }: { label: string; value: string; language: 'en' | 'zh'; className?: string; onChange: (value: string) => void }) => {
  const parts = toTwelveHourTimeParts(value)
  const update = (patch: Partial<TwelveHourTimeParts>) => onChange(fromTwelveHourTimeParts({ ...parts, ...patch }))
  return <fieldset className={`min-w-0 ${className}`}><legend className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#66766f]">{label}</legend><div className="inline-grid max-w-full grid-cols-[3.25rem_auto_3.25rem_4.5rem] items-center gap-1"><select required aria-label={`${label} ${language === 'zh' ? '小時' : 'hour'}`} className={`${fieldClass} min-w-0 px-2`} value={parts.hour} onChange={(event) => update({ hour: event.target.value })}><option value="">--</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select><span aria-hidden="true" className="font-black text-[#66766f]">:</span><select aria-label={`${label} ${language === 'zh' ? '分鐘' : 'minute'}`} className={`${fieldClass} min-w-0 px-2`} value={parts.minute} onChange={(event) => update({ minute: event.target.value })}>{Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select><select aria-label={`${label} ${language === 'zh' ? '時段' : 'period'}`} className={`${fieldClass} min-w-0 px-2`} value={parts.period} onChange={(event) => update({ period: event.target.value as 'AM' | 'PM' })}><option value="AM">AM</option><option value="PM">PM</option></select></div></fieldset>
}

const RosterContext = createContext<ReturnType<typeof useRosterStore> | null>(null)
function useRosterStore(eventId: string, groupId: string) {
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([]), [occurrenceId, setOccurrenceId] = useState('')
  const [data, setData] = useState<EventRoster | null>(null), [team, setTeam] = useState<EventTeamWorkspace | null>(null)
  const [programme, setProgramme] = useState<EventProgramme | null>(null), [groups, setGroups] = useState<EventRosterGroup[]>([])
  const [candidates, setCandidates] = useState<MemberSummaryDto[]>([])
  const [state, setState] = useState<AsyncState>('loading'), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const loadRevision = useRef(0)
  useEffect(() => { let live = true; void eventOperationsService.listOccurrences(eventId).then(list => { if (live) { setOccurrences(list); setOccurrenceId(list[0]?.id || '') } }).catch(reason => { if (live) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) } }); return () => { live = false } }, [eventId])
  const load = useCallback(async () => {
    if (!occurrenceId) return
    const revision = ++loadRevision.current
    setState('loading'); setError('')
    try {
    const next = await eventOperationsService.getRoster(eventId, occurrenceId)
    const [nextTeam, memberships, nextProgramme, nextGroups] = await Promise.all([
      eventOperationsService.getTeam(eventId).catch(() => null),
      next.canManage ? groupService.getGroupMemberships(groupId) : Promise.resolve([]),
      eventOperationsService.getProgramme(eventId, occurrenceId).catch(() => null),
      next.canManage ? eventOperationsService.getRosterGroups(eventId) : Promise.resolve([]),
    ])
    if (revision !== loadRevision.current) return
    setData(next); setTeam(nextTeam); setProgramme(nextProgramme); setGroups(nextGroups)
    setCandidates(memberships.filter(x => x.status === 'approved').map(x => ({ id: x.memberId, displayName: x.displayName ?? null })))
    setState(next.slots.length ? 'ready' : 'empty')
    } catch (reason) {
      if (revision !== loadRevision.current) return
      setState(resolveState(reason)); setError(normalizeApiError(reason).message)
      throw reason
    }
  }, [eventId, groupId, occurrenceId])
  useEffect(() => { void load().catch(() => {}); return () => { loadRevision.current += 1 } }, [load])
  return { occurrences, occurrenceId, setOccurrenceId, data, setData, team, programme, groups, candidates, state, setState, error, setError, busy, setBusy, load }
}
function RosterProviderState({ eventId, groupId, children }: { eventId: string; groupId: string; children: ReactNode }) {
  const store = useRosterStore(eventId, groupId)
  return <RosterContext.Provider value={store}>{children}</RosterContext.Provider>
}
export function EventRosterProvider(props: { eventId: string; groupId: string; children: ReactNode }) {
  const viewer = useAuthStore().me?.id
  return <RosterProviderState key={`${props.eventId}:${viewer || ''}`} {...props} />
}
export const EventRosterWorkspace = (props: EventSurfaceProps & { rosterModule?: string }) => {
  const store = useContext(RosterContext)
  return store ? <RosterWorkspaceContent {...props} store={store} /> : <EventRosterProvider eventId={props.eventId} groupId={props.groupId}><EventRosterWorkspace {...props} /></EventRosterProvider>
}
const RosterWorkspaceContent = ({ eventId, language, item, onBusyChange, onSaved, rosterModule, store }: EventSurfaceProps & { rosterModule?: string; store: ReturnType<typeof useRosterStore> }) => {
  const currentMemberId = useAuthStore().me?.id
  const { occurrences, occurrenceId, setOccurrenceId, data: allData, setData, team, programme, groups, candidates, state, setState, error, setError, busy, setBusy, load } = store
  const data = allData ? { ...allData, slots: allData.slots.filter(slot => !rosterModule || (slot.moduleCode || 'SERVICE.ROSTER') === rosterModule), readinessBlockers: rosterModule ? [] : allData.readinessBlockers } : null
  const selectedOccurrence = occurrences.find(x => x.id === occurrenceId)
  const [roleCode, setRoleCode] = useState(''), [requiredCount, setRequiredCount] = useState(1), [start, setStart] = useState(''), [end, setEnd] = useState(''), [programItemId, setProgramItemId] = useState('')
  useArrangementDraft(Boolean(roleCode || requiredCount !== 1 || programItemId))
  useEffect(() => { if (selectedOccurrence) { setStart(localTimeValue(selectedOccurrence.startUtc)); setEnd(localTimeValue(selectedOccurrence.endUtc)) } }, [selectedOccurrence])
  useEffect(() => { onBusyChange?.(busy) }, [busy, onBusyChange])
  const mutate = async (action: () => Promise<EventRoster>) => { setBusy(true); setError(''); try { setData(await action()); await load(); setState('ready'); await onSaved?.() } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  const saveGroup = async (request: Omit<EventRosterGroup, 'eTag'>, eTag: string) => { setBusy(true); setError(''); try { await eventOperationsService.saveRosterGroup(eventId, request, eTag); await load(); await onSaved?.() } catch (reason) { setState(resolveState(reason)); setError(normalizeApiError(reason).message); throw reason } finally { setBusy(false) } }
  const selectedProgrammeItem = programme?.sessions.flatMap((session) => session.items.map((programmeItem) => ({ session, programmeItem }))).find((value) => value.programmeItem.id === programItemId)
  const create = (event: FormEvent) => { event.preventDefault(); if (!data || !selectedOccurrence) return; void mutate(async () => { if (!groups.some(g => g.roleCode === roleCode)) await eventOperationsService.saveRosterGroup(eventId, { roleCode, moduleCode: rosterModule || 'SERVICE.ROSTER', memberIds: [] }, '"new"'); const fresh = await eventOperationsService.getRoster(eventId, occurrenceId); const result = await eventOperationsService.createSlot(eventId, occurrenceId, fresh.eTag, { sessionId: selectedProgrammeItem?.session.id ?? null, programItemId: selectedProgrammeItem?.programmeItem.id ?? null, roleCode, requiredCount, startUtc: occurrenceLocalTimeToUtc(selectedOccurrence.startUtc, start), endUtc: occurrenceLocalTimeToUtc(selectedOccurrence.endUtc, end), eligibilityCode: 'approvedGroupMember' }); setRoleCode(''); setProgramItemId(''); await load(); return result }) }
  const content = <div className="space-y-4"><AppSectionCard title={localize(item.label, language)} subtitle={language === 'zh' ? '先建立岗位候选组，再从组内安排班次；轮流顺序由负责人决定。' : 'Create a candidate group for each role, then assign shifts from that group. Rotation is a human decision.'} action={<AppBadge variant={item.readiness === 'ready' ? 'success' : 'warning'}>{item.readiness}</AppBadge>}><label className={labelClass}>{language === 'zh' ? '排班场次' : 'Occurrence'}<select className={fieldClass} value={occurrenceId} disabled={busy} onChange={e => setOccurrenceId(e.target.value)}>{occurrences.map(x => <option key={x.id} value={x.id}>{formatLocalOccurrenceTime(x.startUtc, language)}</option>)}</select></label>{occurrenceId ? <div className="mt-4"><SurfaceState state={state} language={language} error={error} onRetry={() => void load()} /></div> : null}</AppSectionCard>{data?.readinessBlockers.length ? <AppSectionCard title={language === 'zh' ? '準備度缺口' : 'Readiness gaps'}><ul className="space-y-2">{data.readinessBlockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(blocker, language)}</li>)}</ul></AppSectionCard> : null}{data?.canManage ? <details className="rounded-xl border border-[#176b5a]/15 p-3"><summary className="cursor-pointer font-semibold">{language === 'zh' ? '添加岗位／轮班' : 'Add role / shift'}</summary><AppSectionCard title={language === 'zh' ? '新增崗位' : 'Add service slot'} subtitle={language === 'zh' ? '開始與結束以所選場次（單次活動即活動本身）的起止時間初始化，格式為「時 : 分 AM/PM」。' : 'Start and end inherit the selected occurrence (the event itself for one-off events) in compact hour : minute AM/PM format.'}><form className="grid min-w-0 gap-3 tablet:grid-cols-2 desktop:grid-cols-12" onSubmit={create}><label className={`${labelClass} min-w-0 desktop:col-span-4`}>{language === 'zh' ? '角色代碼' : 'Role code'}<input className={fieldClass} value={roleCode} onChange={(event) => setRoleCode(event.target.value)} required /></label><label className={`${labelClass} min-w-0 desktop:col-span-6`}>{language === 'zh' ? '節目項目（可選）' : 'Programme item (optional)'}<select className={fieldClass} value={programItemId} onChange={(event) => setProgramItemId(event.target.value)}><option value="">{language === 'zh' ? '整個場次' : 'Occurrence-wide'}</option>{programme?.sessions.flatMap((session) => session.items.map((programmeItem) => <option key={programmeItem.id} value={programmeItem.id}>{localize(session.title, language)} · {localize(programmeItem.title, language)}</option>))}</select></label><label className={`${labelClass} w-24 max-w-full desktop:col-span-2`}>{language === 'zh' ? '人數' : 'People'}<input type="number" min="1" className={`${fieldClass} w-24 max-w-full`} value={requiredCount} onChange={(event) => setRequiredCount(Number(event.target.value))} required /></label><RosterTimeField className="desktop:col-span-4" label={language === 'zh' ? '開始' : 'Start'} language={language} value={start} onChange={setStart} /><RosterTimeField className="desktop:col-span-4" label={language === 'zh' ? '結束' : 'End'} language={language} value={end} onChange={setEnd} /><div className="flex items-end desktop:col-span-4"><AppActionButton type="submit" variant="primary" disabled={busy || !selectedOccurrence || !start || !end}>{language === 'zh' ? '新增' : 'Add'}</AppActionButton></div></form></AppSectionCard></details> : null}{data?.slots.map((slot) => <RosterSlot key={slot.id} data={data} slot={slot} team={team} candidates={candidates} currentMemberId={currentMemberId} language={language} busy={busy} onMutate={mutate} group={groups.find(g => g.roleCode === slot.roleCode)} onSaveGroup={saveGroup} />)}{data && !data.slots.length ? <AppEmptyState title={language === 'zh' ? '尚無崗位' : 'No service slots'} description={language === 'zh' ? '定義第一個崗位後，準備度會顯示已確認／所需人數。' : 'Define the first slot to track confirmed versus required people.'} /> : null}</div>
  return rosterModule ? <AppSectionCard title={language === 'zh' ? '岗位轮班' : 'Role shifts'} summary={`${data?.slots.length || 0}`}>{content}</AppSectionCard> : content
}

const RosterSlot = ({ data, slot, team, candidates, currentMemberId, language, busy, onMutate, group, onSaveGroup }: { group?: EventRosterGroup; onSaveGroup: (request: Omit<EventRosterGroup, 'eTag'>, eTag: string) => Promise<void>; data: EventRoster; slot: EventRoster['slots'][number]; team: EventTeamWorkspace | null; candidates: MemberSummaryDto[]; currentMemberId?: string; language: 'en' | 'zh'; busy: boolean; onMutate: (action: () => Promise<EventRoster>) => Promise<void> }) => {
  const [assignee, setAssignee] = useState('')
  const [replacesAssignmentId, setReplacesAssignmentId] = useState<string | undefined>()
  const [editing, setEditing] = useState(false); const [roleCode] = useState(slot.roleCode); const [requiredCount, setRequiredCount] = useState(slot.requiredCount)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  useArrangementDraft(editing && requiredCount !== slot.requiredCount)
  const myAssignment = slot.assignments.find((assignment) => assignment.memberId === currentMemberId && assignment.status === 'invited')
  const eligibleMemberIds = slot.eligibilityCode === 'approvedGroupMember'
    ? new Set(candidates.map((candidate) => candidate.id))
    : slot.eligibilityCode === 'acceptedEventTeamMember'
      ? new Set(team?.members.filter((member) => member.status === 'accepted').map((member) => member.memberId) ?? [])
      : new Set(team?.roles.filter((role) => role.status === 'accepted' && role.roleRequirementKey.endsWith(`:${slot.eligibilityCode.replace('acceptedRole:', '')}`)).map((role) => role.memberId) ?? [])
  const eligibleCandidates = (slot.candidateMemberIds || []).map(id => candidates.find(c => c.id === id)).filter((candidate): candidate is MemberSummaryDto => Boolean(candidate && eligibleMemberIds.has(candidate.id)))
  const remove = async () => { if (!await requestConfirmation({ title: language === 'zh' ? '刪除崗位？' : 'Delete service slot?', description: language === 'zh' ? '必須先結束所有有效排班。' : 'All active assignments must be ended first.', tone: 'danger' })) return; await onMutate(() => eventOperationsService.deleteSlot(data.eventId, data.occurrenceId, slot.id, data.eTag)) }
  return <><AppSectionCard title={localize(slot.roleLabel ?? { en: slot.roleCode, zh: slot.roleCode }, language)} subtitle={`${slot.roleCode} · ${formatLocalOccurrenceTime(slot.startUtc, language)} – ${formatLocalTime(slot.endUtc, language)}`} action={<AppBadge variant={slot.confirmedCount >= slot.requiredCount ? 'success' : 'warning'}>{slot.confirmedCount}/{slot.requiredCount}</AppBadge>}>{data.canManage ? <div className="mb-4 flex flex-wrap gap-2">{editing ? <><input aria-label={language === 'zh' ? '岗位' : 'Role'} className={fieldClass} value={roleCode} readOnly /><input className={`${fieldClass} max-w-28`} type="number" min="1" value={requiredCount} onChange={(event) => setRequiredCount(Number(event.target.value))} /><AppActionButton variant="primary" disabled={busy} onClick={() => void onMutate(() => eventOperationsService.updateSlot(data.eventId, data.occurrenceId, slot.id, data.eTag, { sessionId: slot.sessionId, programItemId: slot.programItemId, zoneId: slot.zoneId, roleCode, startUtc: slot.startUtc, endUtc: slot.endUtc, requiredCount, eligibilityCode: slot.eligibilityCode })).then(() => setEditing(false))}>{language === 'zh' ? '儲存' : 'Save'}</AppActionButton></> : <AppActionButton disabled={busy} onClick={() => setEditing(true)}>{language === 'zh' ? '編輯崗位' : 'Edit slot'}</AppActionButton>}<AppActionButton variant="danger" disabled={busy} onClick={() => void remove()}>{language === 'zh' ? '刪除' : 'Delete'}</AppActionButton></div> : null}{data.canManage ? <RosterCandidateGroup roleCode={slot.roleCode} moduleCode={slot.moduleCode || 'SERVICE.ROSTER'} group={group} candidates={candidates} language={language} busy={busy} onSave={onSaveGroup} /> : null}<div className="grid gap-4 tablet:grid-cols-2"><label className={labelClass}>{language === 'zh' ? '我的可用性'  : 'My availability'}<select className={fieldClass} value={slot.myAvailability ?? 'unknown'} disabled={busy || !slot.isRosterCandidate} onChange={(event) => void onMutate(() => eventOperationsService.setAvailability(data.eventId, data.occurrenceId, slot.id, event.target.value as 'unknown' | 'available' | 'unavailable' | 'preferNot'))}><option value="unknown">unknown</option><option value="available">available</option><option value="preferNot">preferNot</option><option value="unavailable">unavailable</option></select></label>{myAssignment ? <div className="flex items-end gap-2"><AppActionButton variant="primary" disabled={busy} onClick={() => void onMutate(() => eventOperationsService.respondToRosterAssignment(data.eventId, data.occurrenceId, myAssignment.id, true))}>{language === 'zh' ? '確認崗位' : 'Confirm'}</AppActionButton><AppActionButton disabled={busy} onClick={() => void onMutate(() => eventOperationsService.respondToRosterAssignment(data.eventId, data.occurrenceId, myAssignment.id, false))}>{language === 'zh' ? '婉拒' : 'Decline'}</AppActionButton></div> : null}</div>{slot.assignments.length ? <ul className="mt-4 space-y-2">{slot.assignments.map((assignment) => <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#eef4ef] px-3 py-2 text-sm"><span>{candidates.find((candidate) => candidate.id === assignment.memberId)?.displayName || team?.members.find((member) => member.memberId === assignment.memberId)?.displayName || assignment.memberId}</span><div className="flex items-center gap-2"><AppBadge variant={assignment.status === 'confirmed' ? 'success' : assignment.status === 'declined' ? 'danger' : 'warning'}>{assignment.status}</AppBadge>{data.canManage && assignment.status !== 'ended' ? <AppActionButton size="sm" onClick={() => setReplacesAssignmentId(assignment.id)}>{language === 'zh' ? '替補' : 'Replace'}</AppActionButton> : null}</div></li>)}</ul> : null}{data.canManage ? <div className="mt-4 flex flex-col gap-2 tablet:flex-row"><select className={fieldClass} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">{replacesAssignmentId ? (language === 'zh' ? '選擇替補成員' : 'Select substitute') : (language === 'zh' ? '選擇合資格成員' : 'Select eligible member')}</option>{eligibleCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName || candidate.id}</option>)}</select><AppActionButton variant="primary" disabled={busy || !assignee} onClick={() => void onMutate(() => eventOperationsService.assignRosterMember(data.eventId, data.occurrenceId, slot.id, data.eTag, assignee, replacesAssignmentId)).then(() => { setAssignee(''); setReplacesAssignmentId(undefined) })}>{replacesAssignmentId ? (language === 'zh' ? '確認替補' : 'Confirm substitute') : (language === 'zh' ? '指派' : 'Assign')}</AppActionButton>{replacesAssignmentId ? <AppActionButton onClick={() => setReplacesAssignmentId(undefined)}>{language === 'zh' ? '取消替補' : 'Cancel replacement'}</AppActionButton> : null}</div> : null}</AppSectionCard>{confirmationModal}</>
}
