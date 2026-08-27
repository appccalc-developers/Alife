import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Clock3, LockKeyhole, Search, ShieldCheck } from 'lucide-react'
import useConfirmation from '../../hooks/useConfirmation'
import { eventSafeguardingService } from '../../services/eventSafeguardingService'
import { normalizeApiError } from '../../services/http'
import type {
  EventChildCollector,
  EventSafeguardingChild,
  EventSafeguardingMyChild,
  EventSafeguardingMyContext,
  EventSafeguardingWorkspace as WorkspaceData,
} from '../../types/eventSafeguarding'
import {
  filterSafeguardingChildren,
  resolveSafeguardingLoadFailure,
  resolveSafeguardingMutationFailure,
  safeguardingChildState,
  safeguardingReadinessItems,
} from '../../utils/eventSafeguardingState'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import type { EventSurfaceProps } from './EventSurfaceRenderer'

type Language = 'en' | 'zh'
type LoadState = 'loading' | 'ready' | 'self' | 'error' | 'permission-denied'
type MutationState = 'idle' | 'saving' | 'success' | 'stale' | 'conflict' | 'error'
type Mutate = (action: () => Promise<WorkspaceData>, success: string) => Promise<void>

const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-[#2f4b42]/15 bg-white px-3 py-2 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15'
const labelClass = 'grid min-w-0 gap-1.5 text-xs font-bold text-[#40554e]'
const localize = (value: { en: string; zh: string }, language: Language) => value[language] || value.en || value.zh
const formatDateTime = (value: string, language: Language) => new Date(value).toLocaleString(language === 'zh' ? 'zh-TW' : 'en-NZ', { dateStyle: 'medium', timeStyle: 'short' })

export const EventSafeguardingWorkspace = ({ eventId, language }: EventSurfaceProps) => {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [mutationState, setMutationState] = useState<MutationState>('idle')
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [selfData, setSelfData] = useState<EventSafeguardingMyContext | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async (occurrenceId?: string | null) => {
    setLoadState('loading'); setError('')
    try {
      setData(await eventSafeguardingService.getWorkspace(eventId, occurrenceId)); setSelfData(null); setLoadState('ready')
    } catch (workspaceError) {
      const normalized = normalizeApiError(workspaceError)
      if (normalized.status === 403) {
        try {
          setSelfData(await eventSafeguardingService.getMyContext(eventId)); setData(null); setLoadState('self'); return
        } catch (selfError) {
          const selfFailure = normalizeApiError(selfError)
          setError(selfFailure.message); setLoadState(resolveSafeguardingLoadFailure(selfFailure.status)); return
        }
      }
      setError(normalized.message); setLoadState(resolveSafeguardingLoadFailure(normalized.status))
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const mutate: Mutate = async (action, message) => {
    setMutationState('saving'); setError(''); setSuccess('')
    try {
      setData(await action()); setMutationState('success'); setSuccess(message)
    } catch (caught) {
      const failure = normalizeApiError(caught)
      setError(failure.message); setMutationState(resolveSafeguardingMutationFailure(failure.status))
    }
  }

  if (loadState === 'loading') return <AppSectionCard title={language === 'zh' ? '儿童保护签到' : 'Child safeguarding check-in'}><p role="status" className="text-sm text-[#66766f]">{language === 'zh' ? '正在载入受限儿童保护资料…' : 'Loading restricted safeguarding data…'}</p></AppSectionCard>
  if (loadState === 'permission-denied') return <AppEmptyState title={language === 'zh' ? '需要儿童保护职责权限' : 'Safeguarding duty access required'} description={language === 'zh' ? '普通活动团队成员不会自动获得儿童资料。请由活动治理流程指派并接受儿童保护负责人或签到同工角色。' : 'Ordinary event-team membership does not grant child-record access. An accepted safeguarding lead or check-in duty role is required.'} />
  if (loadState === 'error' || (!data && loadState !== 'self')) return <AppEmptyState title={language === 'zh' ? '无法载入儿童保护工作区' : 'Safeguarding workspace unavailable'} description={error || (language === 'zh' ? '请稍后重试。' : 'Try again shortly.')} actionLabel={language === 'zh' ? '重试' : 'Retry'} onAction={() => void load()} />
  if (loadState === 'self' && selfData) return <MySafeguardingContext eventId={eventId} data={selfData} setData={setSelfData} language={language} />
  if (!data) return null

  const busy = mutationState === 'saving'
  return <div className="min-w-0 space-y-5">
    <section className="overflow-hidden rounded-[1.45rem] border border-[#176b5a]/15 bg-[linear-gradient(135deg,#0d4f43_0%,#176b5a_70%,#347b68_100%)] p-5 text-white shadow-[0_18px_48px_rgba(13,79,67,0.2)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#d8eee6]">SAFEGUARDING.CHILD · roleRestricted</p><h2 className="mt-2 break-words text-xl font-black sm:text-2xl">{language === 'zh' ? '儿童同意、签到与安全交接' : 'Child consent, check-in & safe collection'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#e3f0eb]">{language === 'zh' ? '只显示当前职责所需资料。儿童保护记录不会进入公开／教会投影、共享缓存、日志内容或 AI 提示。' : 'Only duty-required details are shown. Safeguarding records never enter public/church projections, shared caches, log content or AI prompts.'}</p></div><AppBadge variant={data.readiness.blockers.length ? 'warning' : 'success'}>{data.accessMode === 'lead' ? (language === 'zh' ? '儿童保护负责人' : 'Safeguarding lead') : (language === 'zh' ? '签到职责' : 'Check-in duty')}</AppBadge></div>
    </section>

    {error ? <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${mutationState === 'stale' || mutationState === 'conflict' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-rose-200 bg-rose-50 text-rose-900'}`}><p className="min-w-0 flex-1">{mutationState === 'stale' ? (language === 'zh' ? '资料已被其他工作人员修改。' : 'This record changed elsewhere. ') : ''}{error}</p>{mutationState === 'stale' || mutationState === 'conflict' ? <AppActionButton size="sm" onClick={() => void load(data.selectedOccurrenceId)}>{language === 'zh' ? '重新载入' : 'Reload'}</AppActionButton> : null}</div> : null}
    {success ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}

    <ReadinessPanel data={data} language={language} />
    {data.accessMode === 'lead' ? <LeadSetupPanel data={data} language={language} busy={busy} mutate={mutate} /> : null}
    <EventDayPanel data={data} language={language} busy={busy} mutate={mutate} onOccurrence={(id) => void load(id)} />
    {data.accessMode === 'lead' ? <AuditPanel data={data} language={language} /> : null}
  </div>
}

const ReadinessPanel = ({ data, language }: { data: WorkspaceData; language: Language }) => <AppSectionCard title={language === 'zh' ? '儿童保护准备度' : 'Safeguarding readiness'} subtitle={language === 'zh' ? '要求来自选定的版本化政策；系统不会补猜未知值、比例、年龄或资格。' : 'Requirements come from the selected versioned policy. Unknown values, ratios, ages and eligibility are never inferred.'} action={<AppBadge variant={data.readiness.blockers.length ? 'warning' : 'success'}>{data.readiness.blockers.length ? `${data.readiness.blockers.length}` : '✓'}</AppBadge>}>
  <div className="grid gap-3 tablet:grid-cols-3">{safeguardingReadinessItems(data.readiness).map((item) => <div key={item.code} className={`rounded-xl border px-3 py-3 ${item.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words text-xs font-black text-[#18332d]">{item.code}</span></div><p className="mt-1 text-xs text-[#66766f]">{item.ready ? (language === 'zh' ? '已满足' : 'Satisfied') : (language === 'zh' ? '待处理' : 'Pending')}</p></div>)}</div>
  {data.readiness.blockers.length ? <ul className="mt-4 space-y-2" aria-label={language === 'zh' ? '准备度阻塞项' : 'Readiness blockers'}>{data.readiness.blockers.map((blocker, index) => <li key={`${blocker.en}-${index}`} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{localize(blocker, language)}</span></li>)}</ul> : null}
</AppSectionCard>

const LeadSetupPanel = ({ data, language, busy, mutate }: { data: WorkspaceData; language: Language; busy: boolean; mutate: Mutate }) => {
  const [policyId, setPolicyId] = useState(data.selectedPolicy?.id ?? data.availablePolicies[0]?.id ?? '')
  const availableEnrollment = data.enrollmentOptions.find((item) => !data.children.some((child) => child.enrollmentId === item.enrollmentId))
  const [enrollmentId, setEnrollmentId] = useState(availableEnrollment?.enrollmentId ?? '')
  const [photoUrl, setPhotoUrl] = useState('')
  useEffect(() => { setPolicyId(data.selectedPolicy?.id ?? data.availablePolicies[0]?.id ?? '') }, [data.selectedPolicy, data.availablePolicies])
  useEffect(() => { if (!data.enrollmentOptions.some((x) => x.enrollmentId === enrollmentId && !data.children.some((child) => child.enrollmentId === x.enrollmentId))) setEnrollmentId(availableEnrollment?.enrollmentId ?? '') }, [availableEnrollment?.enrollmentId, data.children, data.enrollmentOptions, enrollmentId])
  return <AppSectionCard title={language === 'zh' ? '政策与儿童报名' : 'Policy & child registration'} subtitle={language === 'zh' ? '这里只选择已发布政策并把既有 EventEnrollment 明确标记为儿童报名；不会从年龄或报名 JSON 推断。' : 'Select only a published policy and explicitly link an existing EventEnrollment. Age and enrollment JSON are never used to infer child status.'} action={<AppBadge variant="info">lead</AppBadge>}>
    <div className="grid min-w-0 gap-4 desktop:grid-cols-2"><form className="rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventSafeguardingService.configurePolicy(data.eventId, policyId, data.configurationETag), language === 'zh' ? '政策版本已选择。' : 'Policy version selected.') }}><label className={labelClass}>{language === 'zh' ? '已发布政策版本' : 'Published policy version'}<select className={fieldClass} value={policyId} onChange={(event) => setPolicyId(event.target.value)} required><option value="">{language === 'zh' ? '选择政策' : 'Choose policy'}</option>{data.availablePolicies.map((policy) => <option key={policy.id} value={policy.id}>{localize(policy.name, language)} · v{policy.version}{policy.requirementsRecognized ? '' : ' · !'}</option>)}</select></label><AppActionButton className="mt-3" type="submit" variant="primary" disabled={busy || !policyId || policyId === data.selectedPolicy?.id}>{language === 'zh' ? '采用此政策版本' : 'Use this policy version'}</AppActionButton>{!data.availablePolicies.length ? <p className="mt-3 text-sm text-amber-800">{language === 'zh' ? '没有适用的已发布政策；准备度会保持阻塞。' : 'No applicable published policy exists; readiness remains blocked.'}</p> : null}</form>
      <form className="rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-4" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventSafeguardingService.registerChild(data.eventId, enrollmentId, photoUrl), language === 'zh' ? '儿童报名已加入。' : 'Child registration added.') }}><label className={labelClass}>{language === 'zh' ? '既有报名' : 'Existing enrollment'}<select className={fieldClass} value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} required><option value="">{language === 'zh' ? '选择报名' : 'Choose enrollment'}</option>{data.enrollmentOptions.filter((item) => !data.children.some((child) => child.enrollmentId === item.enrollmentId)).map((item) => <option key={item.enrollmentId} value={item.enrollmentId}>{item.displayName}</option>)}</select></label><label className={`${labelClass} mt-3`}>{language === 'zh' ? '活动用照片 URL（可选）' : 'Event-use photo URL (optional)'}<input className={fieldClass} type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} /></label><AppActionButton className="mt-3" type="submit" variant="primary" disabled={busy || !enrollmentId || !data.selectedPolicy}>{language === 'zh' ? '建立儿童保护记录' : 'Create safeguarding record'}</AppActionButton></form></div>
  </AppSectionCard>
}

const EventDayPanel = ({ data, language, busy, mutate, onOccurrence }: { data: WorkspaceData; language: Language; busy: boolean; mutate: Mutate; onOccurrence: (id: string) => void }) => {
  const [query, setQuery] = useState('')
  const children = useMemo(() => filterSafeguardingChildren(data.children, query), [data.children, query])
  return <AppSectionCard title={language === 'zh' ? '场次签到与交接' : 'Occurrence check-in & collection'} subtitle={language === 'zh' ? '快速查找儿童，核对同意与授权接领状态，再执行签到或签出。' : 'Find a child quickly, verify consent and collection authority, then check in or check out.'} action={<AppBadge variant="info">{children.length}/{data.children.length}</AppBadge>}>
    <div className="grid gap-3 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><label className={labelClass}>{language === 'zh' ? '场次' : 'Occurrence'}<select className={fieldClass} value={data.selectedOccurrenceId ?? ''} onChange={(event) => onOccurrence(event.target.value)} disabled={data.accessMode !== 'lead'}>{data.occurrences.filter((x) => x.status !== 'cancelled').map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{formatDateTime(occurrence.startUtc, language)}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '快速查找儿童' : 'Quick child lookup'}<span className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#66766f]" aria-hidden="true" /><input className={`${fieldClass} pl-10`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === 'zh' ? '输入姓名' : 'Type a name'} /></span></label></div>
    <div className="mt-5 space-y-4">{children.map((child) => <ChildDutyCard key={child.id} child={child} data={data} language={language} busy={busy} mutate={mutate} />)}{!children.length ? <AppEmptyState title={query ? (language === 'zh' ? '没有符合的儿童' : 'No matching child') : (language === 'zh' ? '尚无儿童保护记录' : 'No child safeguarding records')} description={query ? (language === 'zh' ? '检查拼写或清除搜索。' : 'Check the spelling or clear the search.') : (language === 'zh' ? '负责人需从既有报名明确建立儿童记录。' : 'A safeguarding lead must explicitly link an existing enrollment.')} /> : null}</div>
  </AppSectionCard>
}

const ChildDutyCard = ({ child, data, language, busy, mutate }: { child: EventSafeguardingChild; data: WorkspaceData; language: Language; busy: boolean; mutate: Mutate }) => {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [collectorId, setCollectorId] = useState(child.authorisedCollectors[0]?.id ?? '')
  const [guardianId, setGuardianId] = useState('')
  const [relationship, setRelationship] = useState('')
  const state = safeguardingChildState(child)
  const canCheckIn = data.selectedOccurrenceId && child.consentCurrent && child.authorisedCollectionComplete
  const attendanceLabel = state === 'present' ? (language === 'zh' ? '已签到／在场' : 'Checked in / present') : state === 'checked-out' ? (language === 'zh' ? '已签出' : 'Checked out') : (language === 'zh' ? '未签到' : 'Not checked in')
  const doCheckOut = async () => {
    if (!data.selectedOccurrenceId || !child.attendance || !collectorId) return
    const collector = child.authorisedCollectors.find((item) => item.id === collectorId)
    const confirmed = await requestConfirmation({ title: language === 'zh' ? '确认儿童交接？' : 'Confirm child collection?', description: language === 'zh' ? `请当面核实接领人是「${collector?.displayName ?? ''}」。确认后将写入不可覆写的操作审计。` : `Verify in person that the collector is “${collector?.displayName ?? ''}”. Confirmation writes an append-only operational audit record.`, confirmLabel: language === 'zh' ? '已核实并签出' : 'Verified — check out', tone: 'danger' })
    if (confirmed) await mutate(() => eventSafeguardingService.checkOut(data.eventId, data.selectedOccurrenceId!, child.id, child.attendance!.eTag, collectorId), language === 'zh' ? '儿童已安全签出。' : 'Child checked out safely.')
  }
  return <><article className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${state === 'present' ? 'border-emerald-300 bg-emerald-50/60' : state === 'checked-out' ? 'border-slate-200 bg-slate-50' : 'border-[#176b5a]/15 bg-white'}`}><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#e3f0eb]">{child.photoUrl ? <img className="h-full w-full object-cover" src={child.photoUrl} referrerPolicy="no-referrer" alt={language === 'zh' ? `${child.displayName} 的辨识照片` : `Identification photo for ${child.displayName}`} /> : <div className="grid h-full place-items-center text-xl font-black text-[#176b5a]">{child.displayName.slice(0, 1)}</div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="break-words text-lg font-black text-[#18332d]">{child.displayName}</h3><p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#40554e]"><Clock3 className="h-4 w-4" aria-hidden="true" />{attendanceLabel}</p></div><div className="flex flex-wrap gap-2"><AppBadge variant={child.consentCurrent ? 'success' : 'warning'}>{language === 'zh' ? '监护同意' : 'Consent'} {child.consentCurrent ? '✓' : '—'}</AppBadge><AppBadge variant={child.authorisedCollectionComplete ? 'success' : 'warning'}>{language === 'zh' ? '授权接领' : 'Collection'} {child.authorisedCollectionComplete ? '✓' : '—'}</AppBadge></div></div><div className="mt-3 rounded-xl border border-[#e37b63]/20 bg-[#fff8f5] p-3"><p className="flex items-center gap-2 text-xs font-black text-[#18332d]"><LockKeyhole className="h-4 w-4 text-[#e37b63]" aria-hidden="true" />{language === 'zh' ? '当前授权接领人' : 'Currently authorised collectors'}</p>{child.authorisedCollectors.length ? <ul className="mt-2 flex flex-wrap gap-2">{child.authorisedCollectors.map((collector) => <li key={collector.id} className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-[#40554e]">{collector.displayName} · {collector.relationshipLabel}</li>)}</ul> : <p className="mt-2 text-sm text-amber-900">{language === 'zh' ? '资料不完整；禁止签出。' : 'Incomplete; check-out is blocked.'}</p>}</div><div className="mt-4 flex flex-wrap items-end gap-3">{state === 'not-checked-in' ? <AppActionButton variant="primary" disabled={busy || !canCheckIn} onClick={() => void mutate(() => eventSafeguardingService.checkIn(data.eventId, data.selectedOccurrenceId!, child.id, child.eTag), language === 'zh' ? '儿童已签到。' : 'Child checked in.')}>{language === 'zh' ? '签到' : 'Check in'}</AppActionButton> : null}{state === 'present' ? <><label className={`${labelClass} min-w-[12rem] flex-1`}>{language === 'zh' ? '核实接领人' : 'Verified collector'}<select className={fieldClass} value={collectorId} onChange={(event) => setCollectorId(event.target.value)}><option value="">{language === 'zh' ? '选择授权接领人' : 'Choose authorised collector'}</option>{child.authorisedCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.displayName} · {collector.relationshipLabel}</option>)}</select></label><AppActionButton variant="danger" disabled={busy || !collectorId} onClick={() => void doCheckOut()}>{language === 'zh' ? '核实并签出' : 'Verify & check out'}</AppActionButton></> : null}</div>
        {data.accessMode === 'lead' ? <div className="mt-4 border-t border-[#2f4b42]/10 pt-4"><p className="text-xs font-black uppercase tracking-wide text-[#66766f]">{language === 'zh' ? '监护关系（由监护人本人确认）' : 'Guardian relationship — confirmed by guardian'}</p><div className="mt-2 flex flex-wrap gap-2">{child.guardians.map((guardian) => <span key={guardian.id} className="rounded-lg border border-[#2f4b42]/10 bg-[#fbfcf8] px-2.5 py-1.5 text-sm text-[#40554e]">{guardian.guardianDisplayName} · {guardian.relationshipLabel} · {guardian.status}</span>)}</div><form className="mt-3 grid gap-2 tablet:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void mutate(() => eventSafeguardingService.addGuardian(data.eventId, child.id, child.eTag, guardianId, relationship), language === 'zh' ? '监护关系邀请已建立。' : 'Guardian relationship invitation created.') }}><label className={labelClass}>{language === 'zh' ? '监护人成员' : 'Guardian member'}<select className={fieldClass} value={guardianId} onChange={(event) => setGuardianId(event.target.value)} required><option value="">{language === 'zh' ? '选择成员' : 'Choose member'}</option>{data.memberOptions.filter((member) => member.memberId !== child.childMemberId).map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}</select></label><label className={labelClass}>{language === 'zh' ? '关系称谓' : 'Relationship label'}<input className={fieldClass} value={relationship} onChange={(event) => setRelationship(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" size="sm" disabled={busy || !guardianId || !relationship.trim()}>{language === 'zh' ? '邀请确认' : 'Invite to confirm'}</AppActionButton></form></div> : null}
      </div></div></article>{confirmationModal}</>
}

const AuditPanel = ({ data, language }: { data: WorkspaceData; language: Language }) => <AppSectionCard title={language === 'zh' ? '敏感操作审计' : 'Sensitive operational audit'} subtitle={language === 'zh' ? '只记录动作、不可推断识别码、执行者与时间；不写入姓名、健康资料、联络资料或证件内容。' : 'Records only action, opaque identifiers, actor and time—never names, health/contact data or document contents.'} action={<AppBadge variant="neutral">append-only</AppBadge>}>{data.audit.length ? <ol className="space-y-2">{data.audit.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 py-2 text-sm"><span className="break-all font-bold text-[#18332d]">{entry.action}</span><time className="text-[#66766f]">{formatDateTime(entry.occurredUtc, language)}</time></li>)}</ol> : <AppEmptyState title={language === 'zh' ? '尚无操作审计' : 'No operational audit yet'} description={language === 'zh' ? '敏感操作完成后会在这里留下不可覆写记录。' : 'Sensitive actions create immutable records here.'} />}</AppSectionCard>

const MySafeguardingContext = ({ eventId, data, setData, language }: { eventId: string; data: EventSafeguardingMyContext; setData: (value: EventSafeguardingMyContext) => void; language: Language }) => {
  const [error, setError] = useState('')
  const mutate = async (action: () => Promise<EventSafeguardingMyContext>) => { setError(''); try { setData(await action()) } catch (caught) { setError(normalizeApiError(caught).message) } }
  return <div className="min-w-0 space-y-5"><section className="rounded-[1.45rem] border border-[#176b5a]/15 bg-[#0d4f43] p-5 text-white sm:p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#d8eee6]">SAFEGUARDING.CHILD · userSpecific</p><h2 className="mt-2 text-xl font-black">{language === 'zh' ? '我的监护与儿童状态' : 'My guardian & child context'}</h2><p className="mt-2 text-sm text-[#e3f0eb]">{language === 'zh' ? '这里只显示与你明确关联的儿童，以及你本人授权的接领资料。' : 'Only explicitly related children and collection authority you recorded are shown.'}</p></section>{error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p> : null}{data.children.map((child) => <GuardianChildCard key={child.childRegistrationId} eventId={eventId} child={child} language={language} mutate={mutate} />)}</div>
}

const GuardianChildCard = ({ eventId, child, language, mutate }: { eventId: string; child: EventSafeguardingMyChild; language: Language; mutate: (action: () => Promise<EventSafeguardingMyContext>) => Promise<void> }) => {
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [collectorName, setCollectorName] = useState('')
  const [relationship, setRelationship] = useState('')
  const recordConsent = async (decision: 'granted' | 'withdrawn') => {
    if (!child.guardianRelationshipId || !child.guardianETag) return
    if (decision === 'withdrawn') {
      const confirmed = await requestConfirmation({ title: language === 'zh' ? '撤回参与同意？' : 'Withdraw participation consent?', description: language === 'zh' ? '撤回后，儿童准备度与后续签到会立即受阻；既有审计仍会保留。' : 'This immediately blocks child readiness and future check-in; existing audit remains.', confirmLabel: language === 'zh' ? '撤回同意' : 'Withdraw consent', tone: 'danger' })
      if (!confirmed) return
    }
    await mutate(() => eventSafeguardingService.recordConsent(eventId, child.guardianRelationshipId!, child.guardianETag!, decision))
  }
  const revoke = async (collector: EventChildCollector) => {
    const confirmed = await requestConfirmation({ title: language === 'zh' ? '撤销接领授权？' : 'Revoke collection authority?', description: language === 'zh' ? `「${collector.displayName}」将不能再接领此儿童。` : `${collector.displayName} will no longer be authorised to collect this child.`, confirmLabel: language === 'zh' ? '撤销授权' : 'Revoke authority', tone: 'danger' })
    if (confirmed) await mutate(() => eventSafeguardingService.revokeCollector(eventId, collector.id, collector.eTag))
  }
  return <><AppSectionCard title={child.displayName} action={<AppBadge variant={child.consentCurrent ? 'success' : 'warning'}>{child.isGuardian ? (language === 'zh' ? '监护人' : 'Guardian') : (language === 'zh' ? '参与者' : 'Participant')}</AppBadge>}><div className="flex flex-wrap gap-2">{child.attendance.map((attendance) => <span key={attendance.id} className="rounded-lg bg-[#e3f0eb] px-2.5 py-1.5 text-sm font-bold text-[#18332d]">{attendance.state} · {formatDateTime(attendance.checkedInUtc, language)}</span>)}</div>{child.isGuardian ? <div className="mt-4 space-y-4">{child.guardianStatus === 'pending' && child.guardianRelationshipId && child.guardianETag ? <AppActionButton variant="primary" onClick={() => void mutate(() => eventSafeguardingService.confirmGuardian(eventId, child.guardianRelationshipId!, child.guardianETag!))}>{language === 'zh' ? '确认监护关系' : 'Confirm guardian relationship'}</AppActionButton> : null}{child.guardianStatus === 'confirmed' ? <><div className="flex flex-wrap gap-2"><AppActionButton disabled={child.consentCurrent} onClick={() => void recordConsent('granted')}>{language === 'zh' ? '同意参与' : 'Grant participation consent'}</AppActionButton><AppActionButton variant="danger" disabled={!child.consentCurrent} onClick={() => void recordConsent('withdrawn')}>{language === 'zh' ? '撤回同意' : 'Withdraw consent'}</AppActionButton></div><div className="rounded-2xl border border-[#e37b63]/20 bg-[#fff8f5] p-4"><h3 className="font-black text-[#18332d]">{language === 'zh' ? '我授权的接领人' : 'Collectors I authorised'}</h3><div className="mt-3 space-y-2">{child.authorisedCollectors.map((collector) => <div key={collector.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2"><span className="text-sm font-bold text-[#40554e]">{collector.displayName} · {collector.relationshipLabel} · {collector.isActive ? (language === 'zh' ? '有效' : 'active') : (language === 'zh' ? '已撤销' : 'revoked')}</span>{collector.isActive ? <AppActionButton size="sm" variant="danger" onClick={() => void revoke(collector)}>{language === 'zh' ? '撤销' : 'Revoke'}</AppActionButton> : null}</div>)}</div><form className="mt-3 grid gap-2 tablet:grid-cols-[1fr_1fr_auto]" onSubmit={(event: FormEvent) => { event.preventDefault(); void mutate(() => eventSafeguardingService.addCollector(eventId, child.childRegistrationId, collectorName, relationship)) }}><label className={labelClass}>{language === 'zh' ? '接领人姓名' : 'Collector name'}<input className={fieldClass} value={collectorName} onChange={(event) => setCollectorName(event.target.value)} required /></label><label className={labelClass}>{language === 'zh' ? '关系称谓' : 'Relationship label'}<input className={fieldClass} value={relationship} onChange={(event) => setRelationship(event.target.value)} required /></label><AppActionButton className="self-end" type="submit" disabled={!collectorName.trim() || !relationship.trim()}>{language === 'zh' ? '授权' : 'Authorise'}</AppActionButton></form></div></> : null}</div> : null}</AppSectionCard>{confirmationModal}</>
}

export const EventSafeguardingWorkspaceSurface = (props: EventSurfaceProps) => <EventSafeguardingWorkspace {...props} />
