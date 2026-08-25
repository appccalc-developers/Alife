import type { EventProgrammeItem, EventProgrammeWorkspace, SaveEventProgrammeItemPayload } from '../types/eventProgramme'
import { http } from './http'

export const eventProgrammeService = {
  get: async (eventId: string) =>
    (await http.get<EventProgrammeWorkspace>(`/api/events/${eventId}/programme`)).data,
  saveItem: async (eventId: string, itemId: string | null, payload: SaveEventProgrammeItemPayload) =>
    (await (itemId
      ? http.put<EventProgrammeItem>(`/api/events/${eventId}/programme/items/${itemId}`, payload)
      : http.post<EventProgrammeItem>(`/api/events/${eventId}/programme/items`, payload))).data,
}
