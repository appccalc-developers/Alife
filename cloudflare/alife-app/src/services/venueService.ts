import type {
  EventVenueWorkspaceDto,
  SaveVenueBookingPayload,
  SaveVenuePayload,
  VenueBookingDto,
  VenueDto,
} from '../types/venue'
import { http } from './http'

export const venueService = {
  async listManagedVenues(churchGroupId: string): Promise<VenueDto[]> {
    const { data } = await http.get<VenueDto[]>(`/api/admin/venues?churchGroupId=${encodeURIComponent(churchGroupId)}`)
    return data
  },

  async saveVenue(venueId: string | null, payload: SaveVenuePayload): Promise<VenueDto> {
    const response = venueId
      ? await http.put<VenueDto>(`/api/admin/venues/${venueId}`, payload)
      : await http.post<VenueDto>('/api/admin/venues', payload)
    return response.data
  },

  async getEventWorkspace(eventId: string): Promise<EventVenueWorkspaceDto> {
    const { data } = await http.get<EventVenueWorkspaceDto>(`/api/events/${eventId}/venue-workspace`)
    return data
  },

  async saveBooking(eventId: string, bookingId: string | null, payload: SaveVenueBookingPayload): Promise<VenueBookingDto> {
    const response = bookingId
      ? await http.put<VenueBookingDto>(`/api/events/${eventId}/venue-bookings/${bookingId}`, payload)
      : await http.post<VenueBookingDto>(`/api/events/${eventId}/venue-bookings`, payload)
    return response.data
  },

  async submitBooking(eventId: string, bookingId: string): Promise<VenueBookingDto> {
    const { data } = await http.post<VenueBookingDto>(`/api/events/${eventId}/venue-bookings/${bookingId}/submit`)
    return data
  },

  async listBookingsForReview(churchGroupId?: string): Promise<VenueBookingDto[]> {
    const query = churchGroupId ? `?churchGroupId=${encodeURIComponent(churchGroupId)}` : ''
    const { data } = await http.get<VenueBookingDto[]>(`/api/admin/venue-bookings${query}`)
    return data
  },

  async reviewBooking(bookingId: string, approve: boolean, decisionNotes: string): Promise<VenueBookingDto> {
    const { data } = await http.post<VenueBookingDto>(`/api/admin/venue-bookings/${bookingId}/decision`, {
      approve,
      decisionNotes,
    })
    return data
  },
}
