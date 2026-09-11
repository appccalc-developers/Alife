import AppSectionCard from '../../layout/AppSectionCard'
import type { EventActivityType, EventPlanProposal } from '../../../types/eventComposition'
import type { CreationDraft } from '../../../utils/eventCreationDraft'
import { arrangementEnabled, creationSlots } from '../../../utils/eventCreationArrangements'
import { localText } from './CreationFields'

export default function CreationArrangementSummary({ draft, type, proposal, zh }: { draft: CreationDraft; type: EventActivityType; proposal: EventPlanProposal; zh: boolean }) {
  const time = (value: string) => value.replace('T', ' ')
  const none = zh ? '未启用' : 'Not enabled'
  return <AppSectionCard title={zh ? '本次活动安排一览' : 'Arrangement summary'} subtitle={`${zh ? '活动时区：' : 'Event time zone: '}${draft.timeZone}`}>
    <div className="space-y-4 text-sm">
      <section><h3 className="font-semibold">{zh ? '岗位与轮班' : 'Roles and shifts'}</h3>{arrangementEnabled(proposal, 'SERVICE.ROSTER') ? <ul className="mt-2 space-y-2">{creationSlots(draft, type).map(slot => <li key={slot.id} className="break-words">{localText(type.presetServiceSlots.find(x => x.roleCode === slot.roleCode)?.label ?? { en: slot.roleCode, zh: slot.roleCode }, zh)} · {slot.requiredCount || '—'} {zh ? '人' : 'people'}<span className="block text-xs text-[#66766f]">{time(slot.startLocal)} — {time(slot.endLocal)}</span></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
      <section><h3 className="font-semibold">{zh ? '节目与制作' : 'Programme and production'}</h3>{arrangementEnabled(proposal, 'PROGRAM.PRODUCTION') ? <ul className="mt-2 space-y-2">{(draft.arrangements?.sessions ?? []).map(session => <li key={session.id}><strong>{localText(session.title, zh) || '—'}</strong><span className="block text-xs text-[#66766f]">{time(session.startLocal)} — {time(session.endLocal)}</span><ol className="mt-1 list-decimal space-y-1 pl-5">{session.items.map(item => <li key={item.id} className="break-words">{localText(item.title, zh) || '—'} · {zh ? `开始后 ${item.startOffsetMinutes} 分钟，时长 ${item.durationMinutes} 分钟` : `+${item.startOffsetMinutes} min, ${item.durationMinutes} min long`}</li>)}</ol></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
      <section><h3 className="font-semibold">{zh ? '场地与资源' : 'Venue and resources'}</h3>{arrangementEnabled(proposal, 'PLACE.RESOURCE') ? <ul className="mt-2 space-y-2">{(draft.arrangements?.venues ?? []).map(venue => <li key={venue.id} className="break-words">{localText(venue.name, zh) || '—'} · {venue.requiredCapacity || '—'} / {venue.capacity || '—'} {zh ? '人' : 'people'}<span className="block text-xs text-[#66766f]">{time(venue.startLocal)} — {time(venue.endLocal)}</span></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
    </div>
  </AppSectionCard>
}
