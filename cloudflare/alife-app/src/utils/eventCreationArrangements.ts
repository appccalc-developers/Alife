import { localTimeToUtc } from '../../../shared/eventDetails.ts'
import type { EventActivityType, EventPlanProposal, LocalizedText } from '../types/eventComposition'
import type { CreationDraft } from './eventCreationDraft'

export type TimedArrangement = { id: string; startLocal: string; endLocal: string }
export type CreationSlot = TimedArrangement & { roleCode: string; requiredCount: string; eligibilityCode: string }
export type CreationProgramItem = { id: string; title: LocalizedText; description: LocalizedText; startOffsetMinutes: string; durationMinutes: string }
export type CreationSession = TimedArrangement & { title: LocalizedText; items: CreationProgramItem[] }
export type CreationVenue = TimedArrangement & {
  venueId: string; venueETag: string; name: LocalizedText; address: LocalizedText; capacity: string; requiredCapacity: string
}
export type CreationArrangements = { slots?: CreationSlot[]; sessions?: CreationSession[]; venues?: CreationVenue[] }
export type EventCreationArrangementsRequest = {
  serviceSlots?: { roleCode: string; requiredCount: number; eligibilityCode: string; startOffsetMinutes: number; endOffsetMinutes: number }[]
  sessions?: { title: LocalizedText; startOffsetMinutes: number; endOffsetMinutes: number; items: { title: LocalizedText; description: LocalizedText; startOffsetMinutes: number; durationMinutes: number }[] }[]
  venueBookings?: { venueId: string | null; venueETag: string | null; newVenue: { name: LocalizedText; address: LocalizedText; capacity: number; isActive: boolean } | null; requiredCapacity: number; startOffsetMinutes: number; endOffsetMinutes: number }[]
}
export const arrangementEnabled = (proposal: EventPlanProposal, code: string) => proposal.moduleDecisions.some(item => item.moduleCode === code && item.status !== 'inactive')
export const creationSlots = (draft: CreationDraft, type: EventActivityType): CreationSlot[] => draft.arrangements?.slots ?? type.presetServiceSlots.map(slot => ({
  id: `preset-${slot.roleCode}`, roleCode: slot.roleCode, requiredCount: String(slot.requiredCount), eligibilityCode: slot.eligibilityCode,
  startLocal: draft.startLocal, endLocal: draft.endLocal,
}))
export const arrangementTiming = (draft: CreationDraft, row: TimedArrangement) => {
  const base = Date.parse(localTimeToUtc(draft.startLocal, draft.timeZone))
  return {
    startOffsetMinutes: (Date.parse(localTimeToUtc(row.startLocal, draft.timeZone)) - base) / 60000,
    endOffsetMinutes: (Date.parse(localTimeToUtc(row.endLocal, draft.timeZone)) - base) / 60000,
  }
}

export function creationArrangements(draft: CreationDraft, type: EventActivityType, proposal: EventPlanProposal): EventCreationArrangementsRequest {
  return {
    serviceSlots: arrangementEnabled(proposal, 'SERVICE.ROSTER') ? creationSlots(draft, type).map(slot => ({
      roleCode: slot.roleCode.trim(), requiredCount: Number(slot.requiredCount), eligibilityCode: slot.eligibilityCode, ...arrangementTiming(draft, slot),
    })) : [],
    sessions: arrangementEnabled(proposal, 'PROGRAM.PRODUCTION') ? (draft.arrangements?.sessions ?? []).map(session => ({
      title: session.title, ...arrangementTiming(draft, session), items: session.items.map(item => ({
        title: item.title, description: item.description, startOffsetMinutes: Number(item.startOffsetMinutes), durationMinutes: Number(item.durationMinutes),
      })),
    })) : [],
    venueBookings: arrangementEnabled(proposal, 'PLACE.RESOURCE') ? (draft.arrangements?.venues ?? []).map(venue => ({
      venueId: venue.venueId || null, venueETag: venue.venueETag || null,
      newVenue: venue.venueId ? null : { name: venue.name, address: venue.address, capacity: Number(venue.capacity), isActive: true },
      requiredCapacity: Number(venue.requiredCapacity), ...arrangementTiming(draft, venue),
    })) : [],
  }
}

const bilingual = (value: LocalizedText, limit: number) => Boolean(value.en.trim() && value.zh.trim() && value.en.length <= limit && value.zh.length <= limit)
const positive = (value: string, max: number) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max
export function validateCreationArrangements(draft: CreationDraft, type: EventActivityType, proposal: EventPlanProposal, zh: boolean): string {
  const validTime = (row: TimedArrangement) => {
    try {
      const timing = arrangementTiming(draft, row)
      return Number.isInteger(timing.startOffsetMinutes) && Number.isInteger(timing.endOffsetMinutes) && timing.startOffsetMinutes >= -10080 && timing.endOffsetMinutes <= 44640 && timing.endOffsetMinutes > timing.startOffsetMinutes
    } catch { return false }
  }
  if (arrangementEnabled(proposal, 'SERVICE.ROSTER')) {
    const slots = creationSlots(draft, type)
    if (!slots.length || slots.length > 50 || slots.some(slot => !slot.roleCode.trim() || slot.roleCode.length > 100 || !positive(slot.requiredCount, 10000) || !validTime(slot)))
      return zh ? '请展开「岗位与轮班」，填写岗位、人数及有效起止时间（最多 50 个岗位）。' : 'Open Roles and shifts and enter roles, counts and valid times (up to 50 slots).'
  }
  if (arrangementEnabled(proposal, 'PROGRAM.PRODUCTION')) {
    const sessions = draft.arrangements?.sessions ?? []
    if (!sessions.length || sessions.length > 20 || sessions.some(session => !bilingual(session.title, 240) || !validTime(session) || !session.items.length || session.items.length > 50))
      return zh ? '请展开「节目与制作」，填写双语环节名称、有效时间和至少一个节目。' : 'Open Programme and production and enter bilingual session titles, valid times and at least one programme item.'
    if (sessions.some(session => session.items.some(item => !bilingual(item.title, 240) || !/^\d+$/.test(item.startOffsetMinutes) || !positive(item.durationMinutes, 54720) || item.description.en.length > 2000 || item.description.zh.length > 2000 || Number(item.startOffsetMinutes) + Number(item.durationMinutes) > arrangementTiming(draft, session).endOffsetMinutes - arrangementTiming(draft, session).startOffsetMinutes)))
      return zh ? '请检查节目双语名称、开始分钟和时长；节目须在所属环节时间内。' : 'Check bilingual programme titles, offsets and durations. Each item must fit inside its session.'
  }
  if (arrangementEnabled(proposal, 'PLACE.RESOURCE')) {
    const venues = draft.arrangements?.venues ?? []
    if (!venues.length || venues.length > 20 || venues.some(venue => !validTime(venue) || !positive(venue.requiredCapacity, 1000000) || !positive(venue.capacity, 1000000) || Number(venue.requiredCapacity) > Number(venue.capacity) || (venue.venueId ? !venue.venueETag : !bilingual(venue.name, 240) || venue.address.en.length > 1000 || venue.address.zh.length > 1000)))
      return zh ? '请展开「场地与资源」，选择或填写场地、容量和预订时间；所需人数不可超过场地容量。' : 'Open Venue and resources and choose or enter venues, capacity and booking times. Attendance must fit the venue capacity.'
    for (let i = 0; i < venues.length; i++) for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i], b = venues[j]
      if (a.venueId && a.venueId === b.venueId) {
        const x = arrangementTiming(draft, a), y = arrangementTiming(draft, b)
        if (x.startOffsetMinutes < y.endOffsetMinutes && y.startOffsetMinutes < x.endOffsetMinutes)
          return zh ? '同一场地的预订时间不能重叠，请在活动安排中调整。' : 'Bookings for the same venue cannot overlap. Adjust them in Arrangements.'
      }
    }
  }
  return ''
}

export function validStoredArrangements(value: unknown): value is CreationArrangements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as CreationArrangements
  const strings = (row: object, keys: string[]) => keys.every(key => typeof (row as Record<string, unknown>)[key] === 'string')
  const text = (x: unknown) => Boolean(x && typeof x === 'object' && strings(x, ['en', 'zh']))
  const timed = (x: TimedArrangement) => Boolean(x && strings(x, ['id', 'startLocal', 'endLocal']))
  return (data.slots === undefined || Array.isArray(data.slots) && data.slots.length <= 50 && data.slots.every(x => timed(x) && strings(x, ['roleCode', 'requiredCount', 'eligibilityCode']))) &&
    (data.sessions === undefined || Array.isArray(data.sessions) && data.sessions.length <= 20 && data.sessions.every(x => timed(x) && text(x.title) && Array.isArray(x.items) && x.items.length <= 50 && x.items.every(i => i && strings(i, ['id', 'startOffsetMinutes', 'durationMinutes']) && text(i.title) && text(i.description)))) &&
    (data.venues === undefined || Array.isArray(data.venues) && data.venues.length <= 20 && data.venues.every(x => timed(x) && strings(x, ['venueId', 'venueETag', 'capacity', 'requiredCapacity']) && text(x.name) && text(x.address)))
}
