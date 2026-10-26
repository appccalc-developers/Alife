import { useEffect, useState, type FormEvent } from 'react'
import type { PlannedActivity } from '../../types/eventActivityPlan'
import type { EventOccurrence } from '../../types/eventOperations'
import type { ProjectModuleConfiguration, ProjectModuleConfigurationWorkspace, ProjectModuleDetails, ProjectModuleKind } from '../../types/eventActivityModuleConfigurations'
import { eventActivityModuleConfigurationText as copy } from '../../i18n/eventActivityModuleConfigurations'
import { BilingualField, creationInput } from './creation/CreationFields'
import { localPreparationDate } from '../../utils/eventSavedPreparation'
import { localTimeToUtc } from '../../../../shared/eventDetails'
import { eventOperationsService } from '../../services/eventOperationsService'
import { eventTravelService } from '../../services/eventTravelService'
import { useArrangementDraft } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'

const empty = { en: '', zh: '' }
const trigger: Record<ProjectModuleKind, string> = { meal: 'foodService', travel: 'organizedTransport', stay: 'organizedStay', programme: 'programmeProduction', roster: 'serviceTeam' }
const kinds: ProjectModuleKind[] = ['meal', 'travel', 'stay', 'programme', 'roster']
const display = (value: { en: string; zh: string }, language: 'en' | 'zh') => value[language] || value.en || value.zh
const blank = (kind: ProjectModuleKind, occurrenceId: string | null): ProjectModuleDetails => {
  if (kind === 'meal') return { occurrenceId, meal: { serviceMethod: { ...empty }, preparationPlace: { ...empty }, dietaryHandling: { ...empty }, foodSafetyPlan: { ...empty } } }
  if (kind === 'travel') return { occurrenceId, travel: { origin: { ...empty }, destination: { ...empty }, timetable: { ...empty }, journeyId: null } }
  if (kind === 'stay') return { occurrenceId, stay: { site: { ...empty }, checkInUtc: null, checkOutUtc: null, roomingPlan: { ...empty } } }
  if (kind === 'programme') return { occurrenceId, programme: { programItemIds: [], productionNotes: { ...empty } } }
  return { occurrenceId, roster: { serviceSlotIds: [], staffingNotes: { ...empty } } }
}

export default function EventActivityModuleConfigurations({ eventId, activity, workspace, occurrences, timeZone, language, planDirty, busy, onSave }: { eventId: string; activity: PlannedActivity; workspace: ProjectModuleConfigurationWorkspace | null; occurrences: EventOccurrence[]; timeZone: string; language: 'en' | 'zh'; planDirty: boolean; busy: boolean; onSave: (kind: ProjectModuleKind, details: ProjectModuleDetails, eTag: string) => Promise<void> }) {
  const rows = workspace?.items.filter(row => row.activityId === activity.id) ?? []
  const shown = kinds.filter(kind => activity.answers?.[trigger[kind]]?.value === 'yes' || rows.some(row => row.kind === kind))
  if (!shown.length) return null
  return <details className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3" data-project-module-configurations={activity.id}><summary className="min-h-11 cursor-pointer py-2 font-bold text-[#18332d]">{copy.title[language]} · {shown.length}</summary>
    <div className="space-y-3 pt-2">{shown.map(kind => <KindEditor key={kind} eventId={eventId} activity={activity} kind={kind} rows={rows} occurrences={occurrences} timeZone={timeZone} language={language} canEdit={workspace?.canEditKinds.includes(kind) === true && activity.answers?.[trigger[kind]]?.value === 'yes' && !planDirty && !busy} active={activity.answers?.[trigger[kind]]?.value === 'yes'} onSave={onSave}/>)}</div>
  </details>
}

function KindEditor({ eventId, activity, kind, rows, occurrences, timeZone, language, canEdit, active, onSave }: { eventId: string; activity: PlannedActivity; kind: ProjectModuleKind; rows: ProjectModuleConfiguration[]; occurrences: EventOccurrence[]; timeZone: string; language: 'en' | 'zh'; canEdit: boolean; active: boolean; onSave: (kind: ProjectModuleKind, details: ProjectModuleDetails, eTag: string) => Promise<void> }) {
  const [scope, setScope] = useState(activity.occurrenceId ?? '')
  const [opened, setOpened] = useState(false)
  const row = rows.find(item => item.kind === kind && (item.occurrenceId ?? '') === scope)
  return <details className="rounded-lg border border-indigo-200 bg-white p-3" onToggle={e => setOpened(e.currentTarget.open)}><summary className="min-h-10 cursor-pointer py-2 font-semibold">{copy[kind][language]}{row ? ' · ✓' : ''}</summary>
    {!active ? <p className="mb-2 text-xs text-amber-900">{copy.inactive[language]}</p> : null}
    <label className="mb-3 grid gap-1 text-sm font-semibold text-[#40554e]">{copy.occurrenceScope[language]}<select className={creationInput} value={scope} onChange={e => setScope(e.target.value)}><option value="">{copy.eventScope[language]}</option>{occurrences.filter(o => !activity.occurrenceId || activity.occurrenceId === o.id).map(o => <option key={o.id} value={o.id}>{new Date(o.startUtc).toLocaleString(language, { timeZone })}</option>)}</select></label>
    <ConfigurationForm key={`${kind}:${scope}:${row?.eTag ?? 'new'}`} eventId={eventId} kind={kind} row={row} scope={scope} occurrenceIds={occurrences.map(o => o.id)} opened={opened} timeZone={timeZone} language={language} canEdit={canEdit} onSave={onSave}/>
  </details>
}

function ConfigurationForm({ eventId, kind, row, scope, occurrenceIds, opened, timeZone, language, canEdit, onSave }: { eventId: string; kind: ProjectModuleKind; row?: ProjectModuleConfiguration; scope: string; occurrenceIds: string[]; opened: boolean; timeZone: string; language: 'en' | 'zh'; canEdit: boolean; onSave: (kind: ProjectModuleKind, details: ProjectModuleDetails, eTag: string) => Promise<void> }) {
  const baseline = row?.details ?? blank(kind, scope || null)
  const [draft, setDraft] = useState<ProjectModuleDetails>(baseline)
  const [refs, setRefs] = useState<Array<{ id: string; name: string }>>([])
  const [refsLoading, setRefsLoading] = useState(false), [refsError, setRefsError] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  useArrangementDraft(canEdit && dirty)
  useEffect(() => {
    if (!opened || !['travel', 'programme', 'roster'].includes(kind)) return
    let live = true
    setRefsLoading(true); setRefsError(false)
    const scopes = scope ? [scope] : occurrenceIds
    const request = kind === 'travel' ? eventTravelService.getWorkspace(eventId).then(data => data.journeys.filter(j => !scope || j.eventOccurrenceId === scope).map(j => ({ id: j.id, name: display(j.name, language) }))) :
      kind === 'programme' ? Promise.all(scopes.map(id => eventOperationsService.getProgramme(eventId, id))).then(data => data.flatMap(page => page.sessions.flatMap(s => s.items.map(i => ({ id: i.id, name: display(i.title, language) }))))) :
        Promise.all(scopes.map(id => eventOperationsService.getRoster(eventId, id))).then(data => data.flatMap(page => page.slots.map(s => ({ id: s.id, name: s.roleLabel ? display(s.roleLabel, language) : s.roleCode }))))
    void request.then(items => { if (live) setRefs(items) }).catch(() => { if (live) { setRefs([]); setRefsError(true) } }).finally(() => { if (live) setRefsLoading(false) })
    return () => { live = false }
  }, [eventId, kind, scope, occurrenceIds.join('|'), language, opened])
  const save = (event: FormEvent) => { event.preventDefault(); if (canEdit) void onSave(kind, draft, row?.eTag ?? '"project-config-new"') }
  const changeMeal = (field: keyof NonNullable<ProjectModuleDetails['meal']>, value: { en: string; zh: string }) => setDraft(p => ({ ...p, meal: { ...p.meal!, [field]: value } }))
  const changeTravel = (field: keyof NonNullable<ProjectModuleDetails['travel']>, value: { en: string; zh: string }) => setDraft(p => ({ ...p, travel: { ...p.travel!, [field]: value } }))
  const changeStay = (field: keyof NonNullable<ProjectModuleDetails['stay']>, value: { en: string; zh: string }) => setDraft(p => ({ ...p, stay: { ...p.stay!, [field]: value } }))
  const toggleId = (field: 'programItemIds' | 'serviceSlotIds', id: string, checked: boolean) => setDraft(p => field === 'programItemIds' ? { ...p, programme: { ...p.programme!, programItemIds: checked ? [...p.programme!.programItemIds, id] : p.programme!.programItemIds.filter(x => x !== id) } } : { ...p, roster: { ...p.roster!, serviceSlotIds: checked ? [...p.roster!.serviceSlotIds, id] : p.roster!.serviceSlotIds.filter(x => x !== id) } })
  return <form className="space-y-3" onSubmit={save}><fieldset disabled={!canEdit} className="grid gap-3 md:grid-cols-2">
    {kind === 'meal' && draft.meal ? <>{(['serviceMethod', 'preparationPlace', 'dietaryHandling', 'foodSafetyPlan'] as const).map(field => <BilingualField key={field} primaryLanguage={language} label={copy[field][language]} value={draft.meal![field]} onChange={value => changeMeal(field, value)} multiline maxLength={4000}/>)}</> : null}
    {kind === 'travel' && draft.travel ? <>{(['origin', 'destination', 'timetable'] as const).map(field => <BilingualField key={field} primaryLanguage={language} label={copy[field][language]} value={draft.travel![field]} onChange={value => changeTravel(field, value)} multiline maxLength={4000}/>)}<label className="grid gap-1 text-sm font-semibold text-[#40554e]">{copy.journey[language]}<select className={creationInput} value={draft.travel.journeyId ?? ''} onChange={e => setDraft(p => ({ ...p, travel: { ...p.travel!, journeyId: e.target.value || null } }))}><option value="">{copy.noJourney[language]}</option>{refs.map(ref => <option value={ref.id} key={ref.id}>{ref.name}</option>)}</select></label></> : null}
    {kind === 'stay' && draft.stay ? <><BilingualField primaryLanguage={language} label={copy.site[language]} value={draft.stay.site} onChange={value => changeStay('site', value)} multiline maxLength={4000}/><label className="grid gap-1 text-sm font-semibold text-[#40554e]">{copy.checkIn[language]}<input className={creationInput} type="datetime-local" value={draft.stay.checkInUtc ? localPreparationDate(draft.stay.checkInUtc, timeZone) : ''} onChange={e => setDraft(p => ({ ...p, stay: { ...p.stay!, checkInUtc: e.target.value ? localTimeToUtc(e.target.value, timeZone) : null } }))}/></label><label className="grid gap-1 text-sm font-semibold text-[#40554e]">{copy.checkOut[language]}<input className={creationInput} type="datetime-local" value={draft.stay.checkOutUtc ? localPreparationDate(draft.stay.checkOutUtc, timeZone) : ''} onChange={e => setDraft(p => ({ ...p, stay: { ...p.stay!, checkOutUtc: e.target.value ? localTimeToUtc(e.target.value, timeZone) : null } }))}/></label><BilingualField primaryLanguage={language} label={copy.roomingPlan[language]} value={draft.stay.roomingPlan} onChange={value => changeStay('roomingPlan', value)} multiline maxLength={4000}/></> : null}
    {kind === 'programme' && draft.programme ? <><BilingualField primaryLanguage={language} label={copy.productionNotes[language]} value={draft.programme.productionNotes} onChange={value => setDraft(p => ({ ...p, programme: { ...p.programme!, productionNotes: value } }))} multiline maxLength={4000}/><fieldset className="md:col-span-2"><legend className="text-sm font-semibold">{copy.programItems[language]}</legend>{refs.length ? refs.map(ref => <label key={ref.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.programme!.programItemIds.includes(ref.id)} onChange={e => toggleId('programItemIds', ref.id, e.target.checked)}/>{ref.name}</label>) : <p className="text-xs text-[#66766f]">{copy.noReferences[language]}</p>}</fieldset></> : null}
    {kind === 'roster' && draft.roster ? <><BilingualField primaryLanguage={language} label={copy.staffingNotes[language]} value={draft.roster.staffingNotes} onChange={value => setDraft(p => ({ ...p, roster: { ...p.roster!, staffingNotes: value } }))} multiline maxLength={4000}/><fieldset className="md:col-span-2"><legend className="text-sm font-semibold">{copy.serviceSlots[language]}</legend>{refs.length ? refs.map(ref => <label key={ref.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.roster!.serviceSlotIds.includes(ref.id)} onChange={e => toggleId('serviceSlotIds', ref.id, e.target.checked)}/>{ref.name}</label>) : <p className="text-xs text-[#66766f]">{copy.noReferences[language]}</p>}</fieldset></> : null}
    {refsLoading ? <p role="status" className="text-xs text-[#66766f]">{copy.loadingReferences[language]}</p> : refsError ? <p role="alert" className="text-xs text-rose-700">{copy.referenceError[language]}</p> : null}
    {canEdit ? <AppActionButton type="submit" variant="primary" className="justify-self-start" disabled={!dirty && !!row}>{copy.save[language]}</AppActionButton> : <p className="text-xs text-[#66766f]">{copy.noPermission[language]}</p>}
  </fieldset></form>
}
