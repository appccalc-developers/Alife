import { http } from './http'
import { invalidateGroupEventsCache } from './eventService'
import type { LocalizedText } from '../types/eventComposition'

export type EventPreparationState = {
  eventId: string; isFrozen: boolean; isApproved: boolean; canManage: boolean; canEdit: boolean; approvedPackageId: string | null
  reopenRequest: { id: string; eventPackageId: string; requestedByMemberId: string; reason: LocalizedText; requestedUtc: string
    status: 'pending' | 'approved' | 'rejected'; reviewedByMemberId: string | null; reviewedUtc: string | null
    reviewReason: LocalizedText | null; eTag: string; canReview: boolean } | null
}
export const eventPreparationService = {
  getArrangements: async (eventId: string, occurrenceId?: string) => (await http.get<import('../utils/eventSavedPreparation').SavedArrangements>(`/api/events/${eventId}/preparation/arrangements`, { params: { occurrenceId } })).data,
  get: async (eventId: string) => (await http.get<EventPreparationState>(`/api/events/${eventId}/preparation`)).data,
  requestReopen: async (eventId: string, reason: LocalizedText, key: string) =>
    (await http.post<EventPreparationState>(`/api/events/${eventId}/preparation/reopen-requests`, { reason }, { headers: { 'Idempotency-Key': key } })).data,
  reviewReopen: async (eventId: string, groupId: string, request: NonNullable<EventPreparationState['reopenRequest']>, approve: boolean, reason: LocalizedText, key: string) => {
    const { data } = await http.post<EventPreparationState>(`/api/events/${eventId}/preparation/reopen-requests/${request.id}/review`, { approve, reason }, { headers: { 'If-Match': request.eTag, 'Idempotency-Key': key } })
    if (approve) await invalidateGroupEventsCache(groupId)
    return data
  },
}
