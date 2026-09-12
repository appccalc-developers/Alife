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
const blankText = () => ({ en: '', zh: '' })
const rowClass = 'space-y-3 rounded-xl border border-[#2f4b42]/15 bg-white p-3'
function Times({ row, zh, onChange }: { row: TimedArrangement; zh: boolean; onChange: (row: TimedArrangement) => void }) {
  return <>{(['startLocal', 'endLocal'] as const).map(key => <Field key={key} label={key === 'startLocal' ? (zh ? '开始时间' : 'Start time') : (zh ? '结束时间' : 'End time')}><input className={creationInput} type="datetime-local" value={row[key]} onChange={e => onChange({ ...row, [key]: e.target.value })} /></Field>)}</>
}
function useArrangementChange(setDraft: Props['setDraft'], moduleCode?: string) {
  return <K extends keyof CreationArrangements>(key: K, value: CreationArrangements[K]) => setDraft(current => invalidateArrangementConfirmation({ ...current, arrangements: { ...current.arrangements, [key]: value } }, key === 'slots' ? (moduleCode || 'SERVICE.ROSTER') : key === 'sessions' ? 'PROGRAM.PRODUCTION' : 'PLACE.RESOURCE'))
}
export function CreationRosterEditor({ draft, setDraft, zh, type, moduleCode = 'SERVICE.ROSTER', activeModules }: Props & { moduleCode?: string; activeModules?: string[] }) {
  const slots = creationSlots(draft, type), change = useArrangementChange(setDraft, moduleCode)
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? '在这里确定岗位、人数和轮班时间。岗位需求不会自动指派成员或确认资格。' : 'Set roles, counts and shift times here. Slot demand does not assign members or confirm eligibility.'}</p>
    {slots.filter(slot => { const target = defaultRosterModule(slot.roleCode); return !activeModules || (activeModules.includes(target) ? target : 'SERVICE.ROSTER') === moduleCode }).map((slot, index) => {
      const preset = type.presetServiceSlots.find(x => x.roleCode === slot.roleCode)
      const update = (next: typeof slot) => change('slots', slots.map(x => x.id === slot.id ? next : x))
      return <fieldset key={slot.id} className={rowClass}><legend className="px-1 text-sm font-semibold">{preset ? localText(preset.label, zh) : slot.roleCode || (zh ? `岗位 ${index + 1}` : `Role ${index + 1}`)}</legend>
        <div className="grid gap-3 md:grid-cols-2"><Field label={zh ? '岗位' : 'Role'}><select className={creationInput} value={preset ? slot.roleCode : ''} onChange={e => { const next = type.presetServiceSlots.find(x => x.roleCode === e.target.value); update({ ...slot, roleCode: next?.roleCode ?? '', eligibilityCode: next?.eligibilityCode ?? 'acceptedEventTeamMember' }) }}>
          {type.presetServiceSlots.map(item => <option key={item.roleCode} value={item.roleCode}>{localText(item.label, zh)}</option>)}<option value="">{zh ? '自定义岗位' : 'Custom role'}</option>
        </select></Field>{!preset ? <Field label={zh ? '岗位名称' : 'Role name'}><input className={creationInput} maxLength={100} value={slot.roleCode} onChange={e => update({ ...slot, roleCode: e.target.value })} /></Field> : null}
        <Field label={zh ? '所需人数' : 'People needed'}><input className={creationInput} type="number" min={1} max={10000} step={1} value={slot.requiredCount} onChange={e => update({ ...slot, requiredCount: e.target.value })} /></Field>
        <Times row={slot} zh={zh} onChange={next => update({ ...slot, ...next })} /></div>
        <p className="text-xs text-[#66766f]">{zh ? '适任要求：' : 'Eligibility: '}{slot.eligibilityCode === 'approvedGroupMember' ? (zh ? '已获准的小组成员' : 'Approved group member') : slot.eligibilityCode === 'acceptedEventTeamMember' ? (zh ? '已接受邀请的活动团队成员' : 'Accepted event team member') : (zh ? '已接受指定职责的成员' : 'Member with the specified accepted role')}</p>
        <AppActionButton variant="ghost" onClick={() => change('slots', slots.filter(x => x.id !== slot.id))}>{zh ? '移除此岗位' : 'Remove this slot'}</AppActionButton>
      </fieldset>
    })}
    {moduleCode === 'SERVICE.ROSTER' && !slots.length ? <p className="text-sm">{zh ? '尚未安排岗位，请添加至少一个岗位。' : 'No roles yet. Add at least one slot.'}</p> : null}
    {moduleCode === 'SERVICE.ROSTER' ? <AppActionButton disabled={slots.length >= 50} onClick={() => change('slots', [...slots, { id: crypto.randomUUID(), roleCode: '', requiredCount: '1', eligibilityCode: 'acceptedEventTeamMember', startLocal: draft.startLocal, endLocal: draft.endLocal }])}>{zh ? '添加岗位／轮班' : 'Add role / shift'}</AppActionButton> : null}
  </div>
}

export function CreationProgrammeEditor({ draft, setDraft, zh }: Props) {
  const sessions = draft.arrangements?.sessions ?? [], change = useArrangementChange(setDraft)
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? '安排每个环节及其中的节目。时间使用活动时区；节目分钟从所属环节开始计算。' : 'Plan sessions and their programme items. Times use the event time zone; item minutes start from the session’s beginning.'}</p>
    {sessions.map((session, index) => {
      const update = (next: typeof session) => change('sessions', sessions.map(x => x.id === session.id ? next : x))
      return <details key={session.id} open className={rowClass}><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{localText(session.title, zh) || (zh ? `环节 ${index + 1}` : `Session ${index + 1}`)} · {session.items.length} {zh ? '个节目' : 'items'}</summary>
        <div className="grid gap-3 md:grid-cols-2"><BilingualField label={zh ? '环节名称' : 'Session title'} value={session.title} onChange={title => update({ ...session, title })} /><Times row={session} zh={zh} onChange={next => update({ ...session, ...next })} /></div>
        {session.items.map((item, itemIndex) => {
          const updateItem = (next: typeof item) => update({ ...session, items: session.items.map(x => x.id === item.id ? next : x) })
          const move = (direction: number) => { const items = [...session.items]; [items[itemIndex], items[itemIndex + direction]] = [items[itemIndex + direction], items[itemIndex]]; update({ ...session, items }) }
          return <fieldset key={item.id} className="space-y-3 rounded-xl bg-[#f5f2eb] p-3"><legend className="text-sm font-semibold">{zh ? `节目 ${itemIndex + 1}` : `Item ${itemIndex + 1}`}</legend><div className="grid gap-3 md:grid-cols-2">
            <BilingualField label={zh ? '节目名称' : 'Programme title'} value={item.title} onChange={title => updateItem({ ...item, title })} />
            <Field label={zh ? '环节开始后（分钟）' : 'Minutes after session starts'}><input className={creationInput} type="number" min={0} step={1} value={item.startOffsetMinutes} onChange={e => updateItem({ ...item, startOffsetMinutes: e.target.value })} /></Field>
            <Field label={zh ? '时长（分钟）' : 'Duration (minutes)'}><input className={creationInput} type="number" min={1} step={1} value={item.durationMinutes} onChange={e => updateItem({ ...item, durationMinutes: e.target.value })} /></Field>
            <BilingualField multiline label={zh ? '节目说明' : 'Programme notes'} value={item.description} onChange={description => updateItem({ ...item, description })} /></div>
            <div className="flex flex-wrap gap-2"><AppActionButton variant="ghost" disabled={itemIndex === 0} onClick={() => move(-1)}>{zh ? '上移' : 'Move up'}</AppActionButton><AppActionButton variant="ghost" disabled={itemIndex === session.items.length - 1} onClick={() => move(1)}>{zh ? '下移' : 'Move down'}</AppActionButton><AppActionButton variant="ghost" onClick={() => update({ ...session, items: session.items.filter(x => x.id !== item.id) })}>{zh ? '移除此节目' : 'Remove this item'}</AppActionButton></div>
          </fieldset>
        })}
        <div className="flex flex-wrap gap-2"><AppActionButton disabled={session.items.length >= 50} onClick={() => update({ ...session, items: [...session.items, { id: crypto.randomUUID(), title: blankText(), description: blankText(), startOffsetMinutes: String(session.items.reduce((end, x) => Math.max(end, Number(x.startOffsetMinutes) + Number(x.durationMinutes)), 0)), durationMinutes: '10' }] })}>{zh ? '添加节目' : 'Add programme item'}</AppActionButton><AppActionButton variant="ghost" onClick={() => change('sessions', sessions.filter(x => x.id !== session.id))}>{zh ? '移除此环节' : 'Remove this session'}</AppActionButton></div>
      </details>
    })}
    {!sessions.length ? <p className="text-sm">{zh ? '尚未安排节目，请先添加一个环节。' : 'No programme yet. Add a session to begin.'}</p> : null}
    <AppActionButton disabled={sessions.length >= 20} onClick={() => change('sessions', [...sessions, { id: crypto.randomUUID(), title: sessions.length ? blankText() : { ...draft.title }, startLocal: draft.startLocal, endLocal: draft.endLocal, items: [] }])}>{zh ? '添加环节' : 'Add session'}</AppActionButton>
  </div>
}

export function CreationVenueEditor({ draft, setDraft, zh, groupId }: Props) {
  const venues = draft.arrangements?.venues ?? [], change = useArrangementChange(setDraft)
  const [catalogue, setCatalogue] = useState<EventVenue[]>([]), [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true; setState('loading'); setError('')
    eventVenueService.listCatalogue(groupId).then(data => {
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
  return <div className="space-y-3"><p className="text-sm text-[#66766f]">{zh ? '选择现有场地或填写新场地、容量和预订时间。确认保存时统一预订并检查冲突。' : 'Choose existing venues or enter new venues, capacities and booking times. Reservations and conflict checks run when you confirm saving.'}</p>
    <div className="flex flex-wrap items-center gap-2"><AppActionButton disabled={state === 'loading'} onClick={() => setAttempt(x => x + 1)}>{zh ? '刷新场地列表' : 'Refresh venues'}</AppActionButton>{state === 'loading' ? <p role="status" className="text-sm">{zh ? '正在读取场地……' : 'Loading venues…'}</p> : state === 'error' ? <p role="alert" className="text-sm text-rose-800">{error}</p> : !catalogue.length ? <p className="text-sm text-[#66766f]">{zh ? '暂无可用场地，可在下方填写新场地。' : 'No venues available. You can enter a new venue below.'}</p> : null}</div>
    {venues.map((venue, index) => {
      const update = (next: typeof venue) => change('venues', venues.map(x => x.id === venue.id ? next : x))
      return <fieldset key={venue.id} className={rowClass}><legend className="px-1 text-sm font-semibold">{localText(venue.name, zh) || (zh ? `场地 ${index + 1}` : `Venue ${index + 1}`)}</legend>
        <div className="grid gap-3 md:grid-cols-2"><Field label={zh ? '选择场地' : 'Choose venue'}><select className={creationInput} value={venue.venueId} onChange={e => {
          const item = catalogue.find(x => x.id === e.target.value)
          update(item ? { ...venue, venueId: item.id, venueETag: item.eTag, name: item.name, address: item.address, capacity: String(item.capacity) } : { ...venue, venueId: '', venueETag: '', name: blankText(), address: blankText(), capacity: '' })
        }}><option value="">{zh ? '填写新场地' : 'Enter a new venue'}</option>{venue.venueId && !catalogue.some(x => x.id === venue.venueId) ? <option value={venue.venueId}>{zh ? '原场地待重新核对' : 'Previous venue needs review'}</option> : null}{catalogue.map(item => <option key={item.id} value={item.id}>{localText(item.name, zh)} · {item.capacity} {zh ? '人' : 'people'}</option>)}</select></Field>
          {!venue.venueId ? <><BilingualField label={zh ? '场地名称' : 'Venue name'} value={venue.name} onChange={name => update({ ...venue, name })} /><BilingualField label={zh ? '场地地址' : 'Venue address'} value={venue.address} onChange={address => update({ ...venue, address })} /></> : <p className="self-center text-sm text-[#66766f]">{localText(venue.address, zh)}</p>}
          <Field label={zh ? '场地容量' : 'Venue capacity'}><input className={creationInput} type="number" min={1} max={1000000} step={1} disabled={Boolean(venue.venueId)} value={venue.capacity} onChange={e => update({ ...venue, capacity: e.target.value })} /></Field>
          <Field label={zh ? '所需人数' : 'Expected attendance'}><input className={creationInput} type="number" min={1} max={1000000} step={1} value={venue.requiredCapacity} onChange={e => update({ ...venue, requiredCapacity: e.target.value })} /></Field>
          <Times row={venue} zh={zh} onChange={next => update({ ...venue, ...next })} />
        </div>{Number(venue.requiredCapacity) > Number(venue.capacity) && venue.capacity ? <p role="alert" className="text-sm text-rose-800">{zh ? '所需人数超过场地容量，请调整场地或人数。' : 'Attendance exceeds venue capacity. Adjust the venue or attendance.'}</p> : null}
        <AppActionButton variant="ghost" onClick={() => change('venues', venues.filter(x => x.id !== venue.id))}>{zh ? '移除此场地安排' : 'Remove this booking'}</AppActionButton>
      </fieldset>
    })}
    <AppActionButton disabled={venues.length >= 20} onClick={() => change('venues', [...venues, { id: crypto.randomUUID(), venueId: '', venueETag: '', name: blankText(), address: blankText(), capacity: '', requiredCapacity: draft.maxCapacity || '1', startLocal: draft.startLocal, endLocal: draft.endLocal }])}>{zh ? '添加场地安排' : 'Add venue booking'}</AppActionButton>
  </div>
}
