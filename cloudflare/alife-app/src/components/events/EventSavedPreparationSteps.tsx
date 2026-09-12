import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import { ArrangementsStep, DetailsWorkspace, DetailsStep, ReviewStep } from './creation/CreationSteps'
import { ArrangementRoles, useArrangementRoles } from './EventArrangementRoles'
import { EventRosterProvider, EventRosterWorkspace } from './EventOperationsSurfaces'
import EventRamWorkspace from './EventRamWorkspace'
import { EventSurfaceRenderer } from './EventSurfaceRenderer'
import { resolveEventSurface } from './eventSurfaceRegistry'
import EventDetailsAssistant from './creation/EventDetailsAssistant'
import { eventService, invalidateGroupEventsCache } from '../../services/eventService'
import { eventCompositionService } from '../../services/eventCompositionService'
import { eventPreparationService } from '../../services/eventPreparationService'
import { eventOperationsService } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { composeCreationDraft, invalidateArrangementConfirmation, creationSeries, initialCreationDraft, validateCreationDraft } from '../../utils/eventCreationDraft'
import { omitServerControlledEventFacts } from '../../utils/eventWorkspaceState'
import { arrangementSignature, detailSignature, localPreparationDate, savedArrangementDraft, savedCreationDraft, savedTemplate, type SavedArrangements } from '../../utils/eventSavedPreparation'
import { localTimeToUtc } from '../../../../shared/eventDetails'
import type { EventArchetype, EventPlanComposeRequest, EventPlanProposal, EventPlanSnapshot, EventWorkspaceItem } from '../../types/eventComposition'
import type { GroupEventRecord, EventDto } from '../../types/event'
import type { EventOccurrence } from '../../types/eventOperations'
import type { SetupStage } from '../../utils/eventSetupFlow'

const savedSelectionSignature = (draft: ReturnType<typeof initialCreationDraft>) => arrangementSignature({ ...draft, arrangements: { slots: [], sessions: [], venues: [] } })

export default function EventSavedPreparationSteps({ eventId, groupId, eventBasePath, workspaceItems, focusModule, plan, archetypes, stage, zh, readOnly, onBusy, onDirty, onSaved, go }: {
  eventBasePath: string; workspaceItems: EventWorkspaceItem[]; focusModule: string | null
  eventId: string; groupId: string; plan: EventPlanSnapshot | null; archetypes: EventArchetype[]; stage: SetupStage; zh: boolean; readOnly: boolean
  onBusy: (value: boolean) => void; onDirty: (value: boolean) => void; onSaved: () => Promise<void>; go: (stage: SetupStage) => void
}) {
  const me = useAuthStore().me
  const viewer = me?.id
  const planRef = useRef(plan); planRef.current = plan
  const roleState = useArrangementRoles(eventId, groupId, plan?.eTag)
  const [unsavedTools, setUnsavedTools] = useState(false)
  const [savedModules, setSavedModules] = useState<Record<string, number>>({})
  const [draft, setDraft] = useState(initialCreationDraft), [record, setRecord] = useState<GroupEventRecord | null>(null)
  const [data, setData] = useState<SavedArrangements | null>(null), [occurrences, setOccurrences] = useState<EventOccurrence[]>([])
  const [detailsBase, setDetailsBase] = useState(''), [arrangementsBase, setArrangementsBase] = useState('')
  const [basePlanTag, setBasePlanTag] = useState(''), [seriesBase, setSeriesBase] = useState('')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [aiBusy, setAiBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [review, setReview] = useState<{ input: EventPlanComposeRequest; proposal: EventPlanProposal; signature: string; key: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [compositionRevision, setCompositionRevision] = useState(0)
  const [ramDirty, setRamDirty] = useState(false), [ramBusy, setRamBusy] = useState(false)
  const [toolBusy, setToolBusy] = useState<Record<string, boolean>>({})
  const anyToolBusy = Object.values(toolBusy).some(Boolean)
  const [arrangementsVisited, setArrangementsVisited] = useState(['details', 'arrangements'].includes(stage))
  useEffect(() => { if (['details', 'arrangements'].includes(stage)) setArrangementsVisited(true) }, [stage])
  const [reloadRequired, setReloadRequired] = useState(false)
  const live = useRef(true), lock = useRef(false), sequence = useRef(0), form = useRef<HTMLFieldSetElement>(null), autoSaveTimer = useRef<number | null>(null)
  const type = savedTemplate(draft, archetypes.flatMap(x => x.activityTypes).find(x => x.code === draft.activityTypeCode))
  const archetype = archetypes.find(x => x.code === draft.archetypeCode) ?? { code: '', version: 1, name: { en: 'Event', zh: '活动' }, isSeries: false, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [] }
  const detailsSignature = useMemo(() => detailSignature(draft), [draft])
  const arrangementsSignature = useMemo(() => savedSelectionSignature(draft), [draft])
  const detailsDirty = Boolean(detailsBase && detailsBase !== detailsSignature), arrangementsDirty = Boolean(arrangementsBase && arrangementsBase !== arrangementsSignature)
  const detailsValidation = useMemo(() => detailsDirty ? validateCreationDraft(draft, type, archetype, zh) : '', [detailsDirty, draft, type, archetype, zh])
  const input = useMemo((): EventPlanComposeRequest => {
    const composed = composeCreationDraft(draft, type)
    return ({ ...composed, facts: { ...composed.facts, items: omitServerControlledEventFacts([
      ...(plan?.plan.facts.items ?? []).filter(x => !composed.facts.items.some(fact => fact.code === x.code)), ...composed.facts.items]) },
    schemaVersion: plan?.plan.schemaVersion === '1.0.0' ? '1.0.0' : '1.1.0', archetypeCode: plan?.plan.archetypeCode, activityTypeCode: plan?.plan.activityTypeCode,
    basePlanVersion: plan?.planVersion, humanSelections: Object.entries(draft.moduleOverrides).map(([moduleCode, selected]) => ({ moduleCode, selected })) }) }, [draft, type, plan])
  const signature = JSON.stringify(input), current = review?.signature === signature
  const planChanged = Boolean(basePlanTag && plan?.eTag && basePlanTag !== plan.eTag)
  const canAutoSaveDetails = Boolean(record) && !readOnly && !ramDirty && !ramBusy && !anyToolBusy && !busy && !loading && !aiBusy && !planChanged && !previewing && !reloadRequired && !detailsValidation
  const canAutoSaveArrangements = stage === 'arrangements' && Boolean(record) && !readOnly && !unsavedTools && !ramDirty && !ramBusy && !anyToolBusy && !busy && !loading && !previewing && !reloadRequired && !planChanged && review !== null && Boolean(current) && !detailsDirty && !detailsValidation
  const dirty = unsavedTools || detailsDirty || arrangementsDirty || reloadRequired || ramDirty
  const seriesSignature = (value: typeof draft) => JSON.stringify([value.intervalWeeks, value.timeZone, value.startLocal, value.endLocal])
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  useEffect(() => { onBusy(busy || aiBusy || ramBusy || ramDirty || anyToolBusy); return () => onBusy(false) }, [busy, aiBusy, ramBusy, ramDirty, anyToolBusy, onBusy])
  useEffect(() => { live.current = true; return () => { live.current = false; sequence.current++ } }, [])

  useEffect(() => {
    if (autoSaveTimer.current) { window.clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
    const shouldAutoSaveDetails = (stage === 'details' || stage === 'arrangements') && detailsDirty && canAutoSaveDetails
    const shouldAutoSaveArrangements = stage === 'arrangements' && !detailsDirty && arrangementsDirty && canAutoSaveArrangements
    if (!shouldAutoSaveDetails && !shouldAutoSaveArrangements) return
    autoSaveTimer.current = window.setTimeout(() => { void (shouldAutoSaveDetails ? saveDetails() : saveArrangements()) }, 1000)
    return () => {
      if (autoSaveTimer.current) { window.clearTimeout(autoSaveTimer.current); autoSaveTimer.current = null }
    }
  }, [stage, detailsDirty, arrangementsDirty, canAutoSaveDetails, canAutoSaveArrangements, review, current, detailsSignature, arrangementsSignature])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [records, list] = await Promise.all([eventService.getGroupEvents(groupId, viewer), eventOperationsService.listOccurrences(eventId)])
      const item = records.find(x => x.id === eventId)
      if (!item) throw new Error('Event details unavailable. / 活动资料不可用。')
      const next = savedCreationDraft(item, planRef.current)
      const available = list.filter(x => x.status !== 'cancelled')
      const arrangements = available.length ? await eventPreparationService.getArrangements(eventId, available[0].id) : null
      if (!live.current) return
      if (arrangements?.series) {
        next.intervalWeeks = /(?:^|;)INTERVAL=(\d+)/i.exec(arrangements.series.recurrenceRule)?.[1] || '1'
        if (!JSON.parse(item.eventDataJson).timeZone) {
          next.timeZone = arrangements.series.timeZone
          next.startLocal = localPreparationDate(item.startDate, next.timeZone); next.endLocal = localPreparationDate(item.endDate, next.timeZone)
        }
      }
      next.arrangements = arrangements ? savedArrangementDraft(arrangements, next.timeZone) : { slots: [], sessions: [], venues: [] }
      setRecord(item); setOccurrences(available); setData(arrangements); setDraft(next)
      setDetailsBase(detailSignature(next)); setArrangementsBase(savedSelectionSignature(next)); setReview(null)
      setBasePlanTag(planRef.current?.eTag || ''); setSeriesBase(seriesSignature(next))
      setReloadRequired(false)
    } catch (reason) { if (live.current) setError(normalizeApiError(reason).message) }
    finally { if (live.current) setLoading(false) }
    // Language and template labels do not change the saved event identity.
  }, [eventId, groupId, viewer])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (stage !== 'arrangements' || loading || !focusModule || !resolveEventSurface(focusModule)) return
    const timer = window.setTimeout(() => document.getElementById(`arrangement-${focusModule}`)?.scrollIntoView({ block: 'start', behavior: 'instant' }), 100)
    return () => window.clearTimeout(timer)
  }, [stage, loading, focusModule])

  useEffect(() => {
    if (loading || planChanged || !plan || !record || !['details', 'arrangements', 'review'].includes(stage)) return
    const version = ++sequence.current
    setPreviewing(true)
    const timer = setTimeout(() => { void eventCompositionService.recompose(eventId, JSON.parse(signature), plan.eTag)
      .then(proposal => { if (live.current && version === sequence.current) { setReview({ input: JSON.parse(signature), proposal, signature, key: crypto.randomUUID() }); setError('') } })
      .catch(reason => { if (live.current && version === sequence.current) setError(normalizeApiError(reason).message) })
      .finally(() => { if (live.current && version === sequence.current) setPreviewing(false) }) }, 400)
    return () => { clearTimeout(timer); sequence.current++ }
  }, [eventId, plan?.eTag, loading, Boolean(record), signature, stage, planChanged, compositionRevision])

  const saveDetails = async () => {
    if (!record || anyToolBusy || ramDirty || ramBusy || lock.current || readOnly || planChanged || reloadRequired) return false
    const issue = validateCreationDraft(draft, type, archetype, zh)
    if (issue) { setError(issue); return false }
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const original = JSON.parse(record.eventDataJson) as EventDto
      const startDate = localTimeToUtc(draft.startLocal, draft.timeZone), endDate = localTimeToUtc(draft.endLocal, draft.timeZone)
      const required = draft.overrides.registrationMode === 'required'
      const next: EventDto = { ...original, title: draft.title, description: draft.description, locationName: draft.locationName, startDate, endDate, timeZone: draft.timeZone,
        visibility: draft.overrides.visibility, maxCapacity: required ? Number(draft.maxCapacity) : 0, contactProfileIds: record.contactProfileIds ?? original.contactProfileIds ?? [] }
      delete next.ram
      if (!required) next.registrationDeadline = startDate
      else if (!original.maxCapacity) next.registrationDeadline = new Date(Date.parse(startDate) - 86400000).toISOString()
      const seriesDetails = data?.series && seriesBase !== seriesSignature(draft) ? creationSeries(draft, { ...archetype, isSeries: true }) : null
      const result = await eventService.updateGroupEvent(eventId, next, undefined, undefined, record.updatedUtc,
        seriesDetails && data?.series ? { eTag: data.series.eTag, details: { ...seriesDetails, exceptionDates: data.series.exceptionDates, rollingOccurrenceWeeks: data.series.rollingOccurrenceWeeks } } : undefined)
      if (live.current) {
        setRecord(result); setDetailsBase(detailSignature(draft)); setSeriesBase(seriesSignature(draft))
        setNotice(zh ? '活动资料已保存。' : 'Event details saved.'); setReview(null); setCompositionRevision(value => value + 1)
        if (seriesDetails && data) { setData(await eventPreparationService.getArrangements(eventId, data.occurrenceId)); setOccurrences((await eventOperationsService.listOccurrences(eventId)).filter(x => x.status !== 'cancelled')) }
        await onSaved()
      }
      return true
    } catch (reason) { if (live.current) setError(normalizeApiError(reason).message); return false }
    finally { lock.current = false; if (live.current) setBusy(false) }
  }

  const saveArrangements = async () => {
    if (unsavedTools || anyToolBusy || ramDirty || ramBusy || lock.current || readOnly || planChanged || reloadRequired || !plan || !review || !current || previewing) return false
    if (detailsDirty) { setError(zh ? '请先保存活动资料，再确认安排。' : 'Save event details before confirming arrangements.'); return false }
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const accepted = await eventCompositionService.accept(eventId, review.proposal, review.input, plan.eTag, review.key)
      if (live.current) { setBasePlanTag(accepted.eTag); setReloadRequired(true) }
      await invalidateGroupEventsCache(groupId)
      await onSaved()
      const [next, records] = await Promise.all([
        data ? eventPreparationService.getArrangements(eventId, data.occurrenceId) : Promise.resolve(null),
        eventService.getGroupEvents(groupId, viewer),
      ])
      const freshRecord = records.find(x => x.id === eventId)
      if (!freshRecord) throw new Error('Reload event details before editing. / 请重新读取活动资料后再修改。')
      if (live.current) {
        const fresh = savedCreationDraft(freshRecord, accepted)
        fresh.timeZone = JSON.parse(freshRecord.eventDataJson).timeZone || next?.series?.timeZone || draft.timeZone
        fresh.startLocal = localPreparationDate(freshRecord.startDate, fresh.timeZone); fresh.endLocal = localPreparationDate(freshRecord.endDate, fresh.timeZone)
        const nextDraft = { ...fresh, intervalWeeks: draft.intervalWeeks,
          arrangements: next ? savedArrangementDraft(next, fresh.timeZone) : draft.arrangements }
        setRecord(freshRecord); setDraft(nextDraft); setData(next); setDetailsBase(detailSignature(nextDraft)); setSeriesBase(seriesSignature(nextDraft))
        setArrangementsBase(savedSelectionSignature(nextDraft)); setReloadRequired(false)
        setSavedModules(previous => Object.fromEntries((accepted.plan.moduleDecisions || []).map(module => [module.moduleCode, (previous[module.moduleCode] || 0) + 1])))
        setNotice(zh ? '活动安排已保存。' : 'Event arrangements saved.')
      }
      return true
    } catch (reason) { if (live.current) setError(normalizeApiError(reason).message); return false }
    finally { lock.current = false; if (live.current) setBusy(false) }
  }
  const toolSaved = async (moduleCode: string) => {
    setSavedModules(previous => ({ ...previous, [moduleCode]: (previous[moduleCode] || 0) + 1 }))
    setDraft(previous => invalidateArrangementConfirmation(previous, moduleCode))
    if (moduleCode === 'TEAM.WORK') await roleState.reload()
    // Operational editors own their rows. Refresh concurrency without replacing pending brief/fact edits.
    try {
      await invalidateGroupEventsCache(groupId)
      const [records, next] = await Promise.all([eventService.getGroupEvents(groupId, viewer), data ? eventPreparationService.getArrangements(eventId, data.occurrenceId) : Promise.resolve(null)])
      const fresh = records.find(item => item.id === eventId)
      if (!fresh) throw new Error('Reload event details before editing. / 请重新读取活动资料后再修改。')
      if (live.current) setRecord(fresh)
      if (next && live.current) {
        setData(next)
        const rows = savedArrangementDraft(next, draft.timeZone)
        setDraft(previous => ({ ...previous, arrangements: rows }))
      }
      await onSaved()
    } catch (reason) { setReloadRequired(true); setError(normalizeApiError(reason).message) }
  }
  const ramSaved = async () => {
    setSavedModules(previous => ({ ...previous, 'SAFETY.RAM': (previous['SAFETY.RAM'] || 0) + 1 }))
    setDraft(previous => invalidateArrangementConfirmation(previous, 'SAFETY.RAM'))
    const records = await eventService.getGroupEvents(groupId, viewer)
    const fresh = records.find(item => item.id === eventId)
    if (fresh && live.current) setRecord(fresh)
    await onSaved()
  }
  const changeOccurrence = async (id: string) => {
    setLoading(true); setError('')
    try { const next = await eventPreparationService.getArrangements(eventId, id); if (live.current) {
      const nextDraft = { ...draft, arrangements: savedArrangementDraft(next, draft.timeZone) }; setDraft(nextDraft); setData(next); setArrangementsBase(savedSelectionSignature(nextDraft))
    } } catch (reason) { if (live.current) setError(normalizeApiError(reason).message) }
    finally { if (live.current) setLoading(false) }
  }
  const proposal = review?.proposal ?? plan?.plan
  const rolePanel = (moduleCode?: string, summary = false) => <ArrangementRoles roles={(proposal?.roleRequirements ?? []).filter(role => moduleCode ? role.moduleCode === moduleCode && role.roleCode !== 'event.accountableOwner' : summary || role.roleCode === 'event.accountableOwner')} zh={zh} moduleLabels={Object.fromEntries((proposal?.moduleDecisions ?? []).map(item => [item.moduleCode, zh ? item.label.zh : item.label.en]))} state={roleState} eventId={eventId} readOnly={readOnly} summary={summary} onSaved={toolSaved} onBusy={value => setToolBusy(previous => ({ ...previous, roles: value }))} ownerName={record?.accountableOwnerMemberId || undefined} />
  const content = <div hidden={!['details', 'arrangements', 'review'].includes(stage)} className="space-y-4">
    {loading ? <p role="status">{zh ? '正在读取活动筹备资料……' : 'Loading event preparation…'}</p> : null}
    {error ? <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
    {planChanged ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{zh ? '活动方案已更新。未保存内容仍在此处，请重新读取并核对后再保存。' : 'The saved plan changed. Your unsaved draft is retained; reload and review before saving.'}</p> : null}
    {reloadRequired && !busy ? <p role="alert" className="text-sm text-amber-900">{zh ? '保存已成功，但最新资料未完整读取。请重新读取筹备资料后继续。' : 'Saving succeeded, but the updated data could not be fully loaded. Reload preparation to continue.'}</p> : null}
    {record ? <fieldset ref={form} disabled={busy || ramBusy || anyToolBusy || loading || aiBusy || planChanged || reloadRequired} tabIndex={-1} className="min-w-0 scroll-mt-24 space-y-4 outline-none">
      {arrangementsVisited ? <div hidden={!['details', 'arrangements'].includes(stage)}>
        {occurrences.length > 1 ? <label className="block text-sm font-semibold">{zh ? '安排场次' : 'Occurrence to arrange'}<select disabled={readOnly || arrangementsDirty || unsavedTools || ramDirty} className="mt-2 min-h-11 w-full rounded-xl border px-3" value={data?.occurrenceId || ''} onChange={e => void changeOccurrence(e.target.value)}>{occurrences.map(x => <option key={x.id} value={x.id}>{localPreparationDate(x.startUtc, draft.timeZone).replace('T', ' ')}</option>)}</select></label> : null}
        <ArrangementsStep detailsDraft={draft} detailsDirty={detailsDirty} detailsPanel={active => <fieldset disabled={readOnly} className="min-w-0"><DetailsWorkspace zh={zh} active={active && ['details', 'arrangements'].includes(stage)} form={<><DetailsStep {...{ draft, setDraft, zh, type }} archetype={{ ...archetype, isSeries: Boolean(data?.series) }} ai={null} saved />{data?.series ? <p className="py-3 text-sm">{zh ? '重复设置用于补充后续场次，已安排的场次及其资料会保留。' : 'Recurrence changes add future occurrences and preserve existing occurrences and their details.'}</p> : null}</>} assistant={visible => <EventDetailsAssistant {...{ draft, setDraft, type, zh }} isSeries={Boolean(data?.series)} active={visible} onBusy={setAiBusy} />} /></fieldset>} {...{ setDraft, zh, type, groupId, readOnly }} draft={data ? { ...draft, startLocal: localPreparationDate(data.startUtc, draft.timeZone), endLocal: localPreparationDate(data.endUtc, draft.timeZone) } : draft} saved savedModules={savedModules} onUnsavedTools={setUnsavedTools} ownerPanel={<p>{roleState.candidates.find(member => member.id === record.accountableOwnerMemberId)?.displayName || (record.accountableOwnerMemberId === me?.id ? me?.displayName : record.accountableOwnerMemberId) || (zh ? '创建者' : 'Creator')}</p>} rolePanels={Object.fromEntries((proposal?.moduleDecisions ?? []).map(item => [item.moduleCode, rolePanel(item.moduleCode)]))} focusModule={focusModule || (stage === 'details' ? 'EVENT.DETAILS' : null)} modulePanels={Object.fromEntries(workspaceItems.filter(item => !item.surfaceKey.startsWith('workspace.') && item.surfaceKey !== 'safety.ram' && resolveEventSurface(item.surfaceKey)).map(item => [item.surfaceKey.toUpperCase(), <div key={item.surfaceKey}>{item.surfaceKey !== 'service.roster' ? <EventSurfaceRenderer item={item} eventId={eventId} groupId={groupId} eventBasePath={eventBasePath} canManage={!readOnly} language={zh ? 'zh' : 'en'} setupFlow onBusyChange={value => setToolBusy(previous => previous[item.surfaceKey] === value ? previous : { ...previous, [item.surfaceKey]: value })} onSaved={() => toolSaved(item.surfaceKey.toUpperCase())} /> : null}{workspaceItems.some(x => x.surfaceKey === 'service.roster') ? <EventRosterWorkspace item={{ ...item, label: { en: 'Role shifts', zh: '岗位轮班' } }} rosterModule={item.surfaceKey.toUpperCase()} eventId={eventId} groupId={groupId} eventBasePath={eventBasePath} canManage={!readOnly} language={zh ? 'zh' : 'en'} onSaved={() => toolSaved(item.surfaceKey.toUpperCase())} onBusyChange={value => setToolBusy(previous => previous.roster === value ? previous : ({ ...previous, roster: value }))} /> : null}</div>]))} ramDirty={ramDirty} ramPanel={<><EventRamWorkspace eventId={eventId} language={zh ? 'zh' : 'en'} onDirtyChange={value => { setRamDirty(value); if (value) setDraft(previous => previous.moduleConfirmations?.['SAFETY.RAM'] ? invalidateArrangementConfirmation(previous, 'SAFETY.RAM') : previous) }} onBusyChange={setRamBusy} onSaved={ramSaved} pendingEventChanges={detailsDirty || arrangementsDirty || reloadRequired} />{workspaceItems.some(x => x.surfaceKey === 'service.roster') ? <EventRosterWorkspace item={{ ...workspaceItems.find(x => x.surfaceKey === 'service.roster')!, label: { en: 'Safety role shifts', zh: '安全岗位轮班' } }} rosterModule="SAFETY.RAM" eventId={eventId} groupId={groupId} eventBasePath={eventBasePath} canManage={!readOnly} language={zh ? 'zh' : 'en'} onSaved={() => toolSaved('SAFETY.RAM')} onBusyChange={value => setToolBusy(previous => previous.roster === value ? previous : ({ ...previous, roster: value }))} /> : null}</>} proposal={review?.proposal ?? plan?.plan ?? null} current={Boolean(current && !previewing && !readOnly)} status={<p role="status" className="text-sm text-[#66766f]">{previewing ? (zh ? '正在更新活动方案……' : 'Updating the event plan…') : null}</p>} />
      </div> : null}
      {stage === 'review' && (review?.proposal || plan?.plan) ? <ReviewStep {...{ draft, zh, type, archetype }} saved roleSummary={rolePanel(undefined, true)} proposal={review?.proposal ?? plan!.plan} /> : null}
      <fieldset disabled={readOnly || unsavedTools || ramDirty || ramBusy || anyToolBusy} className="min-w-0"><div role="group" aria-label={zh ? '筹备操作' : 'Preparation actions'} className="flex flex-wrap items-center justify-between gap-3">
        {stage === 'review' ? <AppActionButton variant="primary" disabled={dirty} onClick={() => go('approval')}>{zh ? '准备正式审批' : 'Prepare formal approval'}</AppActionButton> : null}
      </div></fieldset>
      {notice ? <p role="status" className="text-sm text-[#176b5a]">{notice}</p> : null}
    </fieldset> : null}
    {unsavedTools ? <p role="status" className="text-sm text-amber-800">{zh ? '请先保存模块内未保存的表单，再保存整体安排或离开筹备。切换方块会保留内容。' : 'Save unfinished module forms before saving all arrangements or leaving preparation. Switching tiles keeps edits.'}</p> : null}
    {ramDirty ? <p role="status" className="text-sm text-amber-800">{zh ? 'RAM 有未保存修改，请先在内嵌评估表中保存，再切换步骤或保存活动安排。收起不会丢失内容。' : 'Save the embedded RAM draft before changing steps or saving arrangements. Collapsing keeps your changes.'}</p> : null}
    <footer className="border-t border-[#18332d]/20 pt-3">
      <AppActionButton variant="ghost" onClick={() => { document.querySelector<HTMLElement>('nav[tabindex="-1"]')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }}>{zh ? '回到开头' : 'Back to top'}</AppActionButton>
    </footer>
  </div>
  return workspaceItems.some(x => x.surfaceKey === 'service.roster') ? <EventRosterProvider eventId={eventId} groupId={groupId}>{content}</EventRosterProvider> : content
}
