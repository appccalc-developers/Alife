import { initialCreationDraft, creationFacts, type CreationDraft } from './eventCreationDraft.ts'
import type { EventDto, GroupEventRecord } from '../types/event'
import type { EventActivityType, EventPlanSnapshot, EventSeriesSetup } from '../types/eventComposition'
import type { EventCreationArrangementsRequest } from './eventCreationArrangements'
import type { CreationArrangements } from './eventCreationArrangements'

export type SavedArrangementRow<T> = { id: string | null; details: T }
export type SavedPreparationSeries = { id: string; eTag: string; recurrenceRule: string; timeZone: string; exceptionDates: string[]; rollingOccurrenceWeeks: number; eventIds: string[] }
export type PreparationSeriesUpdate = { eTag: string; details: EventSeriesSetup }
export type SavedArrangements = {
  occurrenceId: string; startUtc: string; endUtc: string; eTag: string
  series?: SavedPreparationSeries | null
  serviceSlots: SavedArrangementRow<NonNullable<EventCreationArrangementsRequest['serviceSlots']>[number]>[]
  sessions: (SavedArrangementRow<NonNullable<EventCreationArrangementsRequest['sessions']>[number]> & { itemIds: (string | null)[] })[]
  venueBookings: (SavedArrangementRow<NonNullable<EventCreationArrangementsRequest['venueBookings']>[number]> & { venue?: { name: { en: string; zh: string }; address?: { en: string; zh: string }; capacity: number; isActive?: boolean } | null })[]
}
export type SavePreparationArrangements = { occurrenceId: string; eTag: string } & Partial<Pick<SavedArrangements, 'serviceSlots' | 'sessions' | 'venueBookings'>>

export const localPreparationDate = (date: string, timeZone: string) => {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(date)).map(x => [x.type, x.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}
export function savedCreationDraft(record: GroupEventRecord, plan: EventPlanSnapshot | null): CreationDraft {
  const data = JSON.parse(record.eventDataJson) as EventDto, draft = initialCreationDraft()
  const timeZone = data.timeZone || draft.timeZone
  return { ...draft, timeZone, archetypeCode: plan?.plan.archetypeCode || '', activityTypeCode: plan?.plan.activityTypeCode || '',
    title: { en: record.titleEn, zh: record.titleZh }, description: data.description ?? { en: '', zh: '' }, locationName: data.locationName ?? { en: '', zh: '' },
    startLocal: localPreparationDate(record.startDate, timeZone), endLocal: localPreparationDate(record.endDate, timeZone), maxCapacity: String(data.maxCapacity || ''),
    overrides: { visibility: record.visibility || data.visibility || 'groupVisible', registrationMode: data.maxCapacity > 0 ? 'required' : 'none', useRecommendedWorkflow: plan?.plan.workflowRecommendation?.status === 'selected' },
    moduleOverrides: Object.fromEntries((plan?.plan.moduleDecisions ?? []).map(x => [x.moduleCode, ['required', 'selected', 'recommended'].includes(x.status)])),
    factValues: Object.fromEntries(creationFacts.map(([code]) => { const fact = plan?.plan.facts.items.find(x => x.code === code); return [code, fact?.certainty === 'confirmed' && typeof fact.value === 'boolean' ? (fact.value ? 'yes' : 'no') : 'unknown'] })),
    aiCandidateFacts: Object.fromEntries((plan?.plan.facts.items ?? []).filter(x => x.certainty === 'candidate' && typeof x.value === 'boolean').map(x => [x.code, x.value as boolean])),
    detailSources: { title: 'human', description: 'human', locationName: 'human', startLocal: 'human', endLocal: 'human', timeZone: 'human', intervalWeeks: 'human', visibility: 'human', registrationMode: 'human', maxCapacity: 'human' },
  }
}
export function savedTemplate(draft: CreationDraft, template?: EventActivityType): EventActivityType {
  return template ?? { code: draft.activityTypeCode, archetypeCode: draft.archetypeCode, version: 1,
    name: { en: draft.activityTypeCode || 'Existing event', zh: draft.activityTypeCode || '已有活动' }, description: { en: '', zh: '' }, iconKey: 'event',
    defaults: { visibility: draft.overrides.visibility || 'groupVisible', registrationMode: draft.overrides.registrationMode || 'none', capacityUnit: 'People' }, preselectedModules: [], presetServiceSlots: [] }
}
export function savedArrangementDraft(data: SavedArrangements, timeZone: string): CreationArrangements {
  const time = (offset: number) => localPreparationDate(new Date(Date.parse(data.startUtc) + offset * 60000).toISOString(), timeZone)
  return {
    slots: data.serviceSlots.map(row => ({ id: row.id!, roleCode: row.details.roleCode, requiredCount: String(row.details.requiredCount), eligibilityCode: row.details.eligibilityCode, startLocal: time(row.details.startOffsetMinutes), endLocal: time(row.details.endOffsetMinutes) })),
    sessions: data.sessions.map(row => ({ id: row.id!, title: row.details.title, startLocal: time(row.details.startOffsetMinutes), endLocal: time(row.details.endOffsetMinutes),
      items: row.details.items.map((item, i) => ({ id: row.itemIds[i]!, title: item.title, description: item.description ?? { en: '', zh: '' }, startOffsetMinutes: String(item.startOffsetMinutes), durationMinutes: String(item.durationMinutes) })) })),
    venues: data.venueBookings.map(row => ({ id: row.id!, venueId: row.details.venueId || '', venueETag: row.details.venueETag || '', name: row.venue?.name ?? { en: '', zh: '' }, address: row.venue?.address ?? { en: '', zh: '' }, capacity: row.venue ? String(row.venue.capacity) : '', requiredCapacity: String(row.details.requiredCapacity), startLocal: time(row.details.startOffsetMinutes), endLocal: time(row.details.endOffsetMinutes) })),
  }
}
export const detailSignature = (draft: CreationDraft) => JSON.stringify([draft.title, draft.description, draft.locationName, draft.startLocal, draft.endLocal, draft.timeZone, draft.intervalWeeks, draft.maxCapacity, draft.overrides.visibility, draft.overrides.registrationMode])
export const arrangementSignature = (draft: CreationDraft) => JSON.stringify([draft.factValues, draft.moduleOverrides, draft.aiCandidateFacts, draft.overrides.useRecommendedWorkflow, draft.arrangements && { ...draft.arrangements, venues: draft.arrangements.venues?.map(({ venueETag: _tag, capacity: _capacity, name: _name, address: _address, ...row }) => ({ ...row, ...(row.venueId ? {} : { capacity: _capacity, name: _name, address: _address }) })) }])
