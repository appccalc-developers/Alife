import { http } from './http'
import type {
  EventSafeguardingMyContext,
  EventSafeguardingWorkspace,
  GuardianConsentDecision,
} from '../types/eventSafeguarding'

const mutationHeaders = (eTag?: string) => ({
  headers: {
    ...(eTag ? { 'If-Match': eTag } : {}),
    'Idempotency-Key': crypto.randomUUID(),
  },
})

export const eventSafeguardingService = {
  getWorkspace: async (eventId: string, occurrenceId?: string | null) =>
    (await http.get<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding`, { params: occurrenceId ? { occurrenceId } : undefined })).data,
  getMyContext: async (eventId: string) =>
    (await http.get<EventSafeguardingMyContext>(`/api/events/${eventId}/safeguarding/me`)).data,
  configurePolicy: async (eventId: string, policyVersionId: string, eTag: string) =>
    (await http.post<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding/configuration`, { policyVersionId }, mutationHeaders(eTag))).data,
  registerChild: async (eventId: string, enrollmentId: string, photoUrl?: string) =>
    (await http.post<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding/children`, { enrollmentId, photoUrl: photoUrl || null }, mutationHeaders())).data,
  addGuardian: async (eventId: string, childId: string, eTag: string, guardianMemberId: string, relationshipLabel: string) =>
    (await http.post<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding/children/${childId}/guardians`, { guardianMemberId, relationshipLabel }, mutationHeaders(eTag))).data,
  confirmGuardian: async (eventId: string, relationshipId: string, eTag: string) =>
    (await http.post<EventSafeguardingMyContext>(`/api/events/${eventId}/safeguarding/guardian-relationships/${relationshipId}/confirm`, null, mutationHeaders(eTag))).data,
  recordConsent: async (eventId: string, relationshipId: string, eTag: string, decision: GuardianConsentDecision) =>
    (await http.post<EventSafeguardingMyContext>(`/api/events/${eventId}/safeguarding/guardian-relationships/${relationshipId}/consent`, { decision }, mutationHeaders(eTag))).data,
  addCollector: async (eventId: string, childId: string, displayName: string, relationshipLabel: string) =>
    (await http.post<EventSafeguardingMyContext>(`/api/events/${eventId}/safeguarding/children/${childId}/collectors`, { displayName, relationshipLabel }, mutationHeaders())).data,
  revokeCollector: async (eventId: string, collectorId: string, eTag: string) =>
    (await http.post<EventSafeguardingMyContext>(`/api/events/${eventId}/safeguarding/collectors/${collectorId}/revoke`, null, mutationHeaders(eTag))).data,
  checkIn: async (eventId: string, occurrenceId: string, childId: string, eTag: string) =>
    (await http.post<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding/occurrences/${occurrenceId}/children/${childId}/check-in`, null, mutationHeaders(eTag))).data,
  checkOut: async (eventId: string, occurrenceId: string, childId: string, attendanceETag: string, collectorId: string) =>
    (await http.post<EventSafeguardingWorkspace>(`/api/events/${eventId}/safeguarding/occurrences/${occurrenceId}/children/${childId}/check-out`, { collectorId }, mutationHeaders(attendanceETag))).data,
}
