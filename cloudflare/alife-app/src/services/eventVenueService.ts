import { http } from './http'
import type { EventVenue, EventVenueWorkspace, ReserveEventVenueRequest, SaveEventVenueRequest } from '../types/eventVenue'

const mutationHeaders = (eTag?: string) => ({
  headers: {
    ...(eTag ? { 'If-Match': eTag } : {}),
    'Idempotency-Key': crypto.randomUUID(),
  },
})

export const eventVenueService = {
  getWorkspace: async (eventId: string) =>
    (await http.get<EventVenueWorkspace>(`/api/events/${eventId}/venue-reservations`)).data,
  createVenue: async (groupId: string, request: SaveEventVenueRequest) =>
    (await http.post<EventVenue>(`/api/groups/${groupId}/venues`, request, mutationHeaders())).data,
  updateVenue: async (groupId: string, venueId: string, eTag: string, request: SaveEventVenueRequest) =>
    (await http.put<EventVenue>(`/api/groups/${groupId}/venues/${venueId}`, request, { headers: { 'If-Match': eTag } })).data,
  reserve: async (eventId: string, venueETag: string, request: ReserveEventVenueRequest) =>
    (await http.post<EventVenueWorkspace>(`/api/events/${eventId}/venue-reservations`, request, mutationHeaders(venueETag))).data,
  release: async (eventId: string, reservationId: string, reservationETag: string) =>
    (await http.post<EventVenueWorkspace>(`/api/events/${eventId}/venue-reservations/${reservationId}/release`, null, mutationHeaders(reservationETag))).data,
}
