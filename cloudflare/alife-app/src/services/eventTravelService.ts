import { http } from './http'
import type {
  CreateEventTravelJourneyRequest,
  EventTravelMyJourneys,
  EventTravelWorkspace,
  SaveEventTravelDriverRequest,
  SaveEventTravelPickupStopRequest,
  SaveEventTravelVehicleRequest,
  UpdateEventTravelJourneyRequest,
} from '../types/eventTravel'

const mutationHeaders = (eTag?: string) => ({
  headers: {
    ...(eTag ? { 'If-Match': eTag } : {}),
    'Idempotency-Key': crypto.randomUUID(),
  },
})

export const eventTravelService = {
  getWorkspace: async (eventId: string) =>
    (await http.get<EventTravelWorkspace>(`/api/events/${eventId}/travel`)).data,
  getMyJourneys: async (eventId: string) =>
    (await http.get<EventTravelMyJourneys>(`/api/events/${eventId}/travel/me`)).data,
  createDriver: async (eventId: string, request: SaveEventTravelDriverRequest) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/drivers`, request, mutationHeaders())).data,
  updateDriver: async (eventId: string, driverId: string, eTag: string, request: SaveEventTravelDriverRequest) =>
    (await http.put<EventTravelWorkspace>(`/api/events/${eventId}/travel/drivers/${driverId}`, request, { headers: { 'If-Match': eTag } })).data,
  createVehicle: async (eventId: string, request: SaveEventTravelVehicleRequest) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/vehicles`, request, mutationHeaders())).data,
  updateVehicle: async (eventId: string, vehicleId: string, eTag: string, request: SaveEventTravelVehicleRequest) =>
    (await http.put<EventTravelWorkspace>(`/api/events/${eventId}/travel/vehicles/${vehicleId}`, request, { headers: { 'If-Match': eTag } })).data,
  createJourney: async (eventId: string, request: CreateEventTravelJourneyRequest) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys`, request, mutationHeaders())).data,
  updateJourney: async (eventId: string, journeyId: string, eTag: string, request: UpdateEventTravelJourneyRequest) =>
    (await http.put<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys/${journeyId}`, request, { headers: { 'If-Match': eTag } })).data,
  addStop: async (eventId: string, journeyId: string, eTag: string, request: SaveEventTravelPickupStopRequest) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys/${journeyId}/pickup-stops`, request, mutationHeaders(eTag))).data,
  updateStop: async (eventId: string, journeyId: string, stopId: string, eTag: string, request: SaveEventTravelPickupStopRequest) =>
    (await http.put<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys/${journeyId}/pickup-stops/${stopId}`, request, { headers: { 'If-Match': eTag } })).data,
  assignPassenger: async (eventId: string, journeyId: string, eTag: string, memberId: string, pickupStopId: string) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys/${journeyId}/passengers`, { memberId, pickupStopId }, mutationHeaders(eTag))).data,
  removePassenger: async (eventId: string, journeyId: string, assignmentId: string, eTag: string) =>
    (await http.post<EventTravelWorkspace>(`/api/events/${eventId}/travel/journeys/${journeyId}/passengers/${assignmentId}/remove`, null, mutationHeaders(eTag))).data,
}
