import { ramSourceSummaryText } from '../../i18n/ramSourceSummary.ts'
import { Link } from 'react-router-dom'
import type { RamDraft } from '../../types/ramGovernance'
import { displayRamText as text } from '../../types/ramGovernance'
import { EventToolSection } from './ArrangementTileDeck'

export default function RamSourceSummary({draft,zh,eventId}:{draft:RamDraft;zh:boolean;eventId?:string}) {
  const absent=zh?ramSourceSummaryText.notProvided.zh:ramSourceSummaryText.notProvided.en
  return <EventToolSection title={zh?ramSourceSummaryText.activitySourceInformation.zh:ramSourceSummaryText.activitySourceInformation.en} summary={`${draft.activities.length} ${zh?ramSourceSummaryText.activities.zh:ramSourceSummaryText.activities.en} · ${draft.participantCount??absent} ${zh?ramSourceSummaryText.people.zh:ramSourceSummaryText.people.en}`}>
    <div data-ram-field="ram.activities" className="space-y-2 text-sm">
      {!draft.activities.length?<p>{zh?ramSourceSummaryText.defineActivitiesInTasksAndHandoffs.zh:ramSourceSummaryText.defineActivitiesInTasksAndHandoffs.en}</p>:draft.activities.map(a=><details key={a.id} className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">{text(a.name,zh)||absent}</summary><p className="whitespace-pre-wrap">{text(a.conditions,zh)||absent}</p><details><summary>{zh?ramSourceSummaryText.expand.zh:ramSourceSummaryText.expand.en}</summary><p>{text(a.name,!zh)||absent}</p><p>{text(a.conditions,!zh)||absent}</p></details></details>)}
      <p data-ram-field="ram.participants">{zh?ramSourceSummaryText.expectedParticipants.zh:ramSourceSummaryText.expectedParticipants.en}{draft.participantCount??absent}</p>
      <p>{[draft.isOuting?(zh?ramSourceSummaryText.outdoorOffSite.zh:ramSourceSummaryText.outdoorOffSite.en):'',draft.isOvernight?(zh?ramSourceSummaryText.overnight.zh:ramSourceSummaryText.overnight.en):'',draft.isHighRisk?(zh?ramSourceSummaryText.knownHighRisk.zh:ramSourceSummaryText.knownHighRisk.en):''].filter(Boolean).join(' · ')|| (zh?ramSourceSummaryText.noSpecialConditionsMarked.zh:ramSourceSummaryText.noSpecialConditionsMarked.en)}</p>
      {(['weatherConfirmation','transport','accommodation'] as const).map((key,i)=><details key={key} data-ram-field={key==='weatherConfirmation'?'ram.weather':`ram.${key}`}><summary>{(zh?[...ramSourceSummaryText.localizedCopy.zh]:[...ramSourceSummaryText.localizedCopy.en])[i]}</summary><p className="whitespace-pre-wrap">{text(draft[key],zh)||absent}</p><details><summary>{zh?ramSourceSummaryText.expand2.zh:ramSourceSummaryText.expand2.en}</summary><p>{text(draft[key],!zh)||absent}</p></details></details>)}
      {eventId?<Link className="inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/workspace?flow=setup&stage=arrangements&module=team.work`}>{zh?ramSourceSummaryText.editSourcesInTasksAndHandoffs.zh:ramSourceSummaryText.editSourcesInTasksAndHandoffs.en}</Link>:<p>{zh?ramSourceSummaryText.editInTasksAndHandoffsSaveWithEventCreation.zh:ramSourceSummaryText.editInTasksAndHandoffsSaveWithEventCreation.en}</p>}
    </div>
  </EventToolSection>
}
