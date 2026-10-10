import { creationArrangementEditorsText } from '../../../i18n/creationArrangementEditors.ts'
import { defaultRosterModule } from '../../../utils/eventRosterRoles'
import { invalidateArrangementConfirmation } from '../../../utils/eventCreationDraft'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import AppActionButton from '../../layout/AppActionButton'
import type { EventActivityType } from '../../../types/eventComposition'
import type { EventVenue } from '../../../types/eventVenue'
import { eventVenueService } from '../../../services/eventVenueService'
import { normalizeApiError } from '../../../services/http'
import type { CreationDraft } from '../../../utils/eventCreationDraft'
import { creationSlots, type CreationArrangements, type TimedArrangement } from '../../../utils/eventCreationArrangements'
import { BilingualField, Field, creationInput, localText } from './CreationFields'

type Props = { draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; zh: boolean; type: EventActivityType; groupId: string }
export const creationRosterModule = (roleCode: string, activeModules?: string[]) => {
  const target = defaultRosterModule(roleCode)
  return !activeModules || activeModules.includes(target) ? target : 'SERVICE.ROSTER'
}
const blankText = () => ({ en: '', zh: '' })
const rowClass = 'space-y-3 rounded-xl border border-[#2f4b42]/15 bg-white p-3'
function Times({ row, zh, onChange }: { row: TimedArrangement; zh: boolean; onChange: (row: TimedArrangement) => void }) {
  return <>{(['startLocal', 'endLocal'] as const).map(key => <Field key={key} label={key === 'startLocal' ? (zh ? creationArrangementEditorsText.startTime.zh : creationArrangementEditorsText.startTime.en) : (zh ? creationArrangementEditorsText.endTime.zh : creationArrangementEditorsText.endTime.en)}><input className={creationInput} type="datetime-local" value={row[key]} onChange={e => onChange({ ...row, [key]: e.target.value })} /></Field>)}</>
}
function useArrangementChange(setDraft: Props['setDraft'], moduleCode?: string) {
  return <K extends keyof CreationArrangements>(key: K, value: CreationArrangements[K]) => setDraft(current => invalidateArrangementConfirmation({ ...current, arrangements: { ...current.arrangements, [key]: value } }, key === 'slots' ? (moduleCode || 'SERVICE.ROSTER') : key === 'sessions' ? 'PROGRAM.PRODUCTION' : 'PLACE.RESOURCE'))
}
export function CreationRosterEditor({ draft, setDraft, zh, type, moduleCode = 'SERVICE.ROSTER', activeModules }: Props & { moduleCode?: string; activeModules?: string[] }) {
  const slots = creationSlots(draft, type), change = useArrangementChange(setDraft, moduleCode)
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? creationArrangementEditorsText.setRolesCountsAndShiftTimesHereSlotDemand.zh : creationArrangementEditorsText.setRolesCountsAndShiftTimesHereSlotDemand.en}</p>
    {slots.filter(slot => !activeModules || moduleCode === 'SERVICE.ROSTER' || creationRosterModule(slot.roleCode, activeModules) === moduleCode).map((slot, index) => {
      const preset = type.presetServiceSlots.find(x => x.roleCode === slot.roleCode)
      const update = (next: typeof slot) => change('slots', slots.map(x => x.id === slot.id ? next : x))
      return <fieldset key={slot.id} className={rowClass}><legend className="px-1 text-sm font-semibold">{preset ? localText(preset.label, zh) : slot.roleCode || (zh ? creationArrangementEditorsText.role.zh(index + 1) : creationArrangementEditorsText.role.en(index + 1))}</legend>
        <div className="grid gap-3 md:grid-cols-2"><Field label={zh ? creationArrangementEditorsText.roleLabel.zh : creationArrangementEditorsText.roleLabel.en}><select className={creationInput} value={preset ? slot.roleCode : ''} onChange={e => { const next = type.presetServiceSlots.find(x => x.roleCode === e.target.value); update({ ...slot, roleCode: next?.roleCode ?? '', eligibilityCode: next?.eligibilityCode ?? 'acceptedEventTeamMember' }) }}>
          {type.presetServiceSlots.map(item => <option key={item.roleCode} value={item.roleCode}>{localText(item.label, zh)}</option>)}<option value="">{zh ? creationArrangementEditorsText.customRole.zh : creationArrangementEditorsText.customRole.en}</option>
        </select></Field>{!preset ? <Field label={zh ? creationArrangementEditorsText.roleName.zh : creationArrangementEditorsText.roleName.en}><input className={creationInput} maxLength={100} value={slot.roleCode} onChange={e => update({ ...slot, roleCode: e.target.value })} /></Field> : null}
        <Field label={zh ? creationArrangementEditorsText.peopleNeeded.zh : creationArrangementEditorsText.peopleNeeded.en}><input className={creationInput} type="number" min={1} max={10000} step={1} value={slot.requiredCount} onChange={e => update({ ...slot, requiredCount: e.target.value })} /></Field>
        <Times row={slot} zh={zh} onChange={next => update({ ...slot, ...next })} /></div>
        <p className="text-xs text-[#66766f]">{zh ? creationArrangementEditorsText.eligibility.zh : creationArrangementEditorsText.eligibility.en}{slot.eligibilityCode === 'approvedGroupMember' ? (zh ? creationArrangementEditorsText.approvedGroupMember.zh : creationArrangementEditorsText.approvedGroupMember.en) : slot.eligibilityCode === 'acceptedEventTeamMember' ? (zh ? creationArrangementEditorsText.acceptedEventTeamMember.zh : creationArrangementEditorsText.acceptedEventTeamMember.en) : (zh ? creationArrangementEditorsText.memberWithTheSpecifiedAcceptedRole.zh : creationArrangementEditorsText.memberWithTheSpecifiedAcceptedRole.en)}</p>
        <AppActionButton variant="ghost" onClick={() => change('slots', slots.filter(x => x.id !== slot.id))}>{zh ? creationArrangementEditorsText.removeThisSlot.zh : creationArrangementEditorsText.removeThisSlot.en}</AppActionButton>
      </fieldset>
    })}
    {moduleCode === 'SERVICE.ROSTER' && !slots.length ? <p className="text-sm">{zh ? creationArrangementEditorsText.noRolesYetAddAtLeastOneSlot.zh : creationArrangementEditorsText.noRolesYetAddAtLeastOneSlot.en}</p> : null}
    {moduleCode === 'SERVICE.ROSTER' ? <AppActionButton disabled={slots.length >= 50} onClick={() => change('slots', [...slots, { id: crypto.randomUUID(), roleCode: '', requiredCount: '1', eligibilityCode: 'acceptedEventTeamMember', startLocal: draft.startLocal, endLocal: draft.endLocal }])}>{zh ? creationArrangementEditorsText.addRoleShift.zh : creationArrangementEditorsText.addRoleShift.en}</AppActionButton> : null}
  </div>
}

export function CreationProgrammeEditor({ draft, setDraft, zh }: Props) {
  const sessions = draft.arrangements?.sessions ?? [], change = useArrangementChange(setDraft)
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? creationArrangementEditorsText.planSessionsAndTheirProgrammeItemsTimesUseThe.zh : creationArrangementEditorsText.planSessionsAndTheirProgrammeItemsTimesUseThe.en}</p>
    {sessions.map((session, index) => {
      const update = (next: typeof session) => change('sessions', sessions.map(x => x.id === session.id ? next : x))
      return <details key={session.id} open className={rowClass}><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{localText(session.title, zh) || (zh ? creationArrangementEditorsText.session.zh(index + 1) : creationArrangementEditorsText.session.en(index + 1))} · {session.items.length} {zh ? creationArrangementEditorsText.items.zh : creationArrangementEditorsText.items.en}</summary>
        <div className="grid gap-3 md:grid-cols-2"><BilingualField label={zh ? creationArrangementEditorsText.sessionTitle.zh : creationArrangementEditorsText.sessionTitle.en} value={session.title} onChange={title => update({ ...session, title })} /><Times row={session} zh={zh} onChange={next => update({ ...session, ...next })} /></div>
        {session.items.map((item, itemIndex) => {
          const updateItem = (next: typeof item) => update({ ...session, items: session.items.map(x => x.id === item.id ? next : x) })
          const move = (direction: number) => { const items = [...session.items]; [items[itemIndex], items[itemIndex + direction]] = [items[itemIndex + direction], items[itemIndex]]; update({ ...session, items }) }
          return <fieldset key={item.id} className="space-y-3 rounded-xl bg-[#f5f2eb] p-3"><legend className="text-sm font-semibold">{zh ? creationArrangementEditorsText.item.zh(itemIndex + 1) : creationArrangementEditorsText.item.en(itemIndex + 1)}</legend><div className="grid gap-3 md:grid-cols-2">
            <BilingualField label={zh ? creationArrangementEditorsText.programmeTitle.zh : creationArrangementEditorsText.programmeTitle.en} value={item.title} onChange={title => updateItem({ ...item, title })} />
            <Field label={zh ? creationArrangementEditorsText.minutesAfterSessionStarts.zh : creationArrangementEditorsText.minutesAfterSessionStarts.en}><input className={creationInput} type="number" min={0} step={1} value={item.startOffsetMinutes} onChange={e => updateItem({ ...item, startOffsetMinutes: e.target.value })} /></Field>
            <Field label={zh ? creationArrangementEditorsText.durationMinutes.zh : creationArrangementEditorsText.durationMinutes.en}><input className={creationInput} type="number" min={1} step={1} value={item.durationMinutes} onChange={e => updateItem({ ...item, durationMinutes: e.target.value })} /></Field>
            <BilingualField multiline label={zh ? creationArrangementEditorsText.programmeNotes.zh : creationArrangementEditorsText.programmeNotes.en} value={item.description} onChange={description => updateItem({ ...item, description })} /></div>
            <div className="flex flex-wrap gap-2"><AppActionButton variant="ghost" disabled={itemIndex === 0} onClick={() => move(-1)}>{zh ? creationArrangementEditorsText.moveUp.zh : creationArrangementEditorsText.moveUp.en}</AppActionButton><AppActionButton variant="ghost" disabled={itemIndex === session.items.length - 1} onClick={() => move(1)}>{zh ? creationArrangementEditorsText.moveDown.zh : creationArrangementEditorsText.moveDown.en}</AppActionButton><AppActionButton variant="ghost" onClick={() => update({ ...session, items: session.items.filter(x => x.id !== item.id) })}>{zh ? creationArrangementEditorsText.removeThisItem.zh : creationArrangementEditorsText.removeThisItem.en}</AppActionButton></div>
          </fieldset>
        })}
        <div className="flex flex-wrap gap-2"><AppActionButton disabled={session.items.length >= 50} onClick={() => update({ ...session, items: [...session.items, { id: crypto.randomUUID(), title: blankText(), description: blankText(), startOffsetMinutes: String(session.items.reduce((end, x) => Math.max(end, Number(x.startOffsetMinutes) + Number(x.durationMinutes)), 0)), durationMinutes: '10' }] })}>{zh ? creationArrangementEditorsText.addProgrammeItem.zh : creationArrangementEditorsText.addProgrammeItem.en}</AppActionButton><AppActionButton variant="ghost" onClick={() => change('sessions', sessions.filter(x => x.id !== session.id))}>{zh ? creationArrangementEditorsText.removeThisSession.zh : creationArrangementEditorsText.removeThisSession.en}</AppActionButton></div>
      </details>
    })}
    {!sessions.length ? <p className="text-sm">{zh ? creationArrangementEditorsText.noProgrammeYetAddASessionToBegin.zh : creationArrangementEditorsText.noProgrammeYetAddASessionToBegin.en}</p> : null}
    <AppActionButton disabled={sessions.length >= 20} onClick={() => change('sessions', [...sessions, { id: crypto.randomUUID(), title: sessions.length ? blankText() : { ...draft.title }, startLocal: draft.startLocal, endLocal: draft.endLocal, items: [] }])}>{zh ? creationArrangementEditorsText.addSession.zh : creationArrangementEditorsText.addSession.en}</AppActionButton>
  </div>
}

export function CreationVenueEditor({ draft, setDraft, zh, groupId }: Props) {
  const venues = draft.arrangements?.venues ?? [], change = useArrangementChange(setDraft)
  const [catalogue, setCatalogue] = useState<EventVenue[]>([]), [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true; setState('loading'); setError('')
    eventVenueService.listReservableCatalogue(groupId).then(data => {
      if (!alive) return
      setCatalogue(data.venues.filter(x => x.isActive)); setState('ready')
      setDraft(current => !current.arrangements?.venues?.some(x => x.venueId) ? current : ({ ...current, arrangements: { ...current.arrangements, venues: current.arrangements.venues.map(row => {
        if (!row.venueId) return row
        const item = data.venues.find(x => x.id === row.venueId && x.isActive)
        return item ? { ...row, venueETag: item.eTag, name: item.name, address: item.address, capacity: String(item.capacity) } : { ...row, venueETag: '' }
      }) } }))
    }).catch(reason => { if (alive) { setState('error'); setError(normalizeApiError(reason).message) } })
    return () => { alive = false }
  }, [groupId, attempt, setDraft])
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? creationArrangementEditorsText.chooseExistingVenuesOrEnterNewVenuesCapacitiesAnd.zh : creationArrangementEditorsText.chooseExistingVenuesOrEnterNewVenuesCapacitiesAnd.en}</p>
    <div className="flex flex-wrap items-center gap-2"><AppActionButton disabled={state === 'loading'} onClick={() => setAttempt(x => x + 1)}>{zh ? creationArrangementEditorsText.refreshVenues.zh : creationArrangementEditorsText.refreshVenues.en}</AppActionButton>{state === 'loading' ? <p role="status" className="text-sm">{zh ? creationArrangementEditorsText.loadingVenues.zh : creationArrangementEditorsText.loadingVenues.en}</p> : state === 'error' ? <p role="alert" className="text-sm text-rose-800">{error}</p> : !catalogue.length ? <p className="text-sm text-[#66766f]">{zh ? creationArrangementEditorsText.noVenuesAvailableYouCanEnterANewVenue.zh : creationArrangementEditorsText.noVenuesAvailableYouCanEnterANewVenue.en}</p> : null}</div>
    {venues.map((venue, index) => {
      const update = (next: typeof venue) => change('venues', venues.map(x => x.id === venue.id ? next : x))
      return <fieldset key={venue.id} className={rowClass}><legend className="px-1 text-sm font-semibold">{localText(venue.name, zh) || (zh ? creationArrangementEditorsText.venue.zh(index + 1) : creationArrangementEditorsText.venue.en(index + 1))}</legend>
        <div className="grid gap-3 md:grid-cols-2"><Field label={zh ? creationArrangementEditorsText.chooseVenue.zh : creationArrangementEditorsText.chooseVenue.en}><select className={creationInput} value={venue.venueId} onChange={e => {
          const item = catalogue.find(x => x.id === e.target.value)
          update(item ? { ...venue, venueId: item.id, venueETag: item.eTag, name: item.name, address: item.address, capacity: String(item.capacity) } : { ...venue, venueId: '', venueETag: '', name: blankText(), address: blankText(), capacity: '' })
        }}><option value="">{zh ? creationArrangementEditorsText.enterANewVenue.zh : creationArrangementEditorsText.enterANewVenue.en}</option>{venue.venueId && !catalogue.some(x => x.id === venue.venueId) ? <option value={venue.venueId}>{zh ? creationArrangementEditorsText.previousVenueNeedsReview.zh : creationArrangementEditorsText.previousVenueNeedsReview.en}</option> : null}{catalogue.map(item => <option key={item.id} value={item.id}>{localText(item.name, zh)} · {item.capacity} {zh ? creationArrangementEditorsText.people.zh : creationArrangementEditorsText.people.en}{item.managingGroupId !== groupId ? zh ? creationArrangementEditorsText.churchShared.zh : creationArrangementEditorsText.churchShared.en : ''}</option>)}</select></Field>
          {!venue.venueId ? <><BilingualField label={zh ? creationArrangementEditorsText.venueName.zh : creationArrangementEditorsText.venueName.en} value={venue.name} onChange={name => update({ ...venue, name })} /><BilingualField label={zh ? creationArrangementEditorsText.venueAddress.zh : creationArrangementEditorsText.venueAddress.en} value={venue.address} onChange={address => update({ ...venue, address })} /></> : <p className="self-center text-sm text-[#66766f]">{localText(venue.address, zh)}</p>}
          <Field label={zh ? creationArrangementEditorsText.venueCapacity.zh : creationArrangementEditorsText.venueCapacity.en}><input className={creationInput} type="number" min={1} max={1000000} step={1} disabled={Boolean(venue.venueId)} value={venue.capacity} onChange={e => update({ ...venue, capacity: e.target.value })} /></Field>
          <Field label={zh ? creationArrangementEditorsText.expectedAttendance.zh : creationArrangementEditorsText.expectedAttendance.en}><input className={creationInput} type="number" min={1} max={1000000} step={1} value={venue.requiredCapacity} onChange={e => update({ ...venue, requiredCapacity: e.target.value })} /></Field>
          <Times row={venue} zh={zh} onChange={next => update({ ...venue, ...next })} />
        </div>{Number(venue.requiredCapacity) > Number(venue.capacity) && venue.capacity ? <p role="alert" className="text-sm text-rose-800">{zh ? creationArrangementEditorsText.attendanceExceedsVenueCapacityAdjustTheVenueOrAttendance.zh : creationArrangementEditorsText.attendanceExceedsVenueCapacityAdjustTheVenueOrAttendance.en}</p> : null}
        <AppActionButton variant="ghost" onClick={() => change('venues', venues.filter(x => x.id !== venue.id))}>{zh ? creationArrangementEditorsText.removeThisBooking.zh : creationArrangementEditorsText.removeThisBooking.en}</AppActionButton>
      </fieldset>
    })}
    <AppActionButton disabled={venues.length >= 20} onClick={() => change('venues', [...venues, { id: crypto.randomUUID(), venueId: '', venueETag: '', name: blankText(), address: blankText(), capacity: '', requiredCapacity: draft.maxCapacity || '1', startLocal: draft.startLocal, endLocal: draft.endLocal }])}>{zh ? creationArrangementEditorsText.addVenueBooking.zh : creationArrangementEditorsText.addVenueBooking.en}</AppActionButton>
  </div>
}
