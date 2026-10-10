import { creationArrangementSummaryText } from '../../../i18n/creationArrangementSummary.ts'
import AppSectionCard from '../../layout/AppSectionCard'
import type { EventActivityType, EventPlanProposal } from '../../../types/eventComposition'
import type { CreationDraft } from '../../../utils/eventCreationDraft'
import { arrangementEnabled, creationSlots } from '../../../utils/eventCreationArrangements'
import { localText } from './CreationFields'

export default function CreationArrangementSummary({ draft, type, proposal, zh }: { draft: CreationDraft; type: EventActivityType; proposal: EventPlanProposal; zh: boolean }) {
  const time = (value: string) => value.replace('T', ' ')
  const none = zh ? creationArrangementSummaryText.notEnabled.zh : creationArrangementSummaryText.notEnabled.en
  return <AppSectionCard title={zh ? creationArrangementSummaryText.arrangementSummary.zh : creationArrangementSummaryText.arrangementSummary.en} subtitle={`${zh ? creationArrangementSummaryText.eventTimeZone.zh : creationArrangementSummaryText.eventTimeZone.en}${draft.timeZone}`}>
    <div className="space-y-4 text-sm">
      <section><h3 className="font-semibold">{zh ? creationArrangementSummaryText.rolesAndShifts.zh : creationArrangementSummaryText.rolesAndShifts.en}</h3>{arrangementEnabled(proposal, 'SERVICE.ROSTER') ? <ul className="mt-2 space-y-2">{creationSlots(draft, type).map(slot => <li key={slot.id} className="break-words">{localText(type.presetServiceSlots.find(x => x.roleCode === slot.roleCode)?.label ?? { en: slot.roleCode, zh: slot.roleCode }, zh)} · {slot.requiredCount || '—'} {zh ? creationArrangementSummaryText.people.zh : creationArrangementSummaryText.people.en}<span className="block text-xs text-[#66766f]">{time(slot.startLocal)} — {time(slot.endLocal)}</span></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
      <section><h3 className="font-semibold">{zh ? creationArrangementSummaryText.programmeAndProduction.zh : creationArrangementSummaryText.programmeAndProduction.en}</h3>{arrangementEnabled(proposal, 'PROGRAM.PRODUCTION') ? <ul className="mt-2 space-y-2">{(draft.arrangements?.sessions ?? []).map(session => <li key={session.id}><strong>{localText(session.title, zh) || '—'}</strong><span className="block text-xs text-[#66766f]">{time(session.startLocal)} — {time(session.endLocal)}</span><ol className="mt-1 list-decimal space-y-1 pl-5">{session.items.map(item => <li key={item.id} className="break-words">{localText(item.title, zh) || '—'} · {zh ? creationArrangementSummaryText.minMinLong.zh(item.startOffsetMinutes, item.durationMinutes) : creationArrangementSummaryText.minMinLong.en(item.startOffsetMinutes, item.durationMinutes)}</li>)}</ol></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
      <section><h3 className="font-semibold">{zh ? creationArrangementSummaryText.venueAndResources.zh : creationArrangementSummaryText.venueAndResources.en}</h3>{arrangementEnabled(proposal, 'PLACE.RESOURCE') ? <ul className="mt-2 space-y-2">{(draft.arrangements?.venues ?? []).map(venue => <li key={venue.id} className="break-words">{localText(venue.name, zh) || '—'} · {venue.requiredCapacity || '—'} / {venue.capacity || '—'} {zh ? creationArrangementSummaryText.people.zh : creationArrangementSummaryText.people.en}<span className="block text-xs text-[#66766f]">{time(venue.startLocal)} — {time(venue.endLocal)}</span></li>)}</ul> : <p className="mt-1 text-[#66766f]">{none}</p>}</section>
    </div>
  </AppSectionCard>
}
