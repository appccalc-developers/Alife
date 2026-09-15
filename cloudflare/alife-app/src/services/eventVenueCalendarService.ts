import { http } from './http'
import type { LocalizedText } from '../types/eventComposition'
export type WeeklyVenueRule = { id: string; eventId: string | null; firstDate: string; lastDate: string | null; startMinute: number; endMinute: number; timeZone: string; requiredCapacity: number; canManage: boolean; eTag: string }
export type VenueCalendarEntry = { bookingId: string; eventId: string | null; title: LocalizedText; startUtc: string; endUtc: string; localDate: string | null; weekly: boolean; released: boolean; invalidLocalTime: boolean; canManage: boolean; eTag: string }
export type VenueCalendar = { venueId: string; timeZone: string; entries: VenueCalendarEntry[]; rules: WeeklyVenueRule[]; history: { ruleId: string; localDate: string; action: string; reason: string; actorMemberId: string; createdUtc: string }[] }
export type WeeklyVenueInput = { eventId: string; firstDate: string; lastDate: string | null; startMinute: number; endMinute: number; requiredCapacity: number; replacesRuleId: string | null; reason: string }
const path = (group: string, venue: string) => `/api/groups/${group}/event-venues/${venue}`
export const venueCalendarService = {
  get: async (group: string, venue: string, from: string, until: string) => (await http.get<VenueCalendar>(`${path(group, venue)}/calendar`, { params: { from, until } })).data,
  weekly: async (group: string, venue: string, body: WeeklyVenueInput, eTag: string, key: string) => (await http.post<string>(`${path(group, venue)}/weekly`, body, { headers: { 'If-Match': eTag, 'Idempotency-Key': key } })).data,
  exception: async (group: string, venue: string, entry: VenueCalendarEntry, released: boolean, reason: string, key: string) => (await http.post<string>(`${path(group, venue)}/weekly/${entry.bookingId}/exceptions`, { localDate: entry.localDate, released, reason }, { headers: { 'If-Match': entry.eTag, 'Idempotency-Key': key } })).data,
}
