import { http } from './http'
import type { ActivityActionRequest, ActivityOperationsWorkspace, ActivityProjectRules, ActivityPrivateData, ActivitySelectionChange, ActivitySelectionPreview, ActivitySpaceRequest } from '../types/eventActivityOperations'

const path = (eventId: string) => `/api/events/${eventId}/activity-operations`
const fresh = { headers: { 'Cache-Control': 'no-store' } }
const etag = (value: string) => ({ headers: { 'If-Match': value } })
const actionHeaders = (value: string) => ({ headers: { 'If-Match': value, 'Idempotency-Key': crypto.randomUUID() } })

export const newActivityETag = '"activity-new"'
export const eventActivityOperationsService = {
  get: async (eventId: string) => (await http.get<ActivityOperationsWorkspace>(path(eventId), fresh)).data,
  policy: async (eventId: string, activityId: string, rules: ActivityProjectRules, expected: string) =>
    (await http.put<ActivityOperationsWorkspace>(`${path(eventId)}/projects/${encodeURIComponent(activityId)}/policy`, rules, etag(expected))).data,
  offer: async (eventId: string, activityId: string, occurrenceId: string, startUtc: string, endUtc: string, expected: string) =>
    (await http.put<ActivityOperationsWorkspace>(`${path(eventId)}/projects/${encodeURIComponent(activityId)}/offers`, { occurrenceId, startUtc, endUtc }, etag(expected))).data,
  feeAction: async (eventId: string, activityId: string, operation: 'submit' | 'approve' | 'return', expected: string, request: ActivityActionRequest = {}) =>
    (await http.post<ActivityOperationsWorkspace>(`${path(eventId)}/projects/${encodeURIComponent(activityId)}/fees/${operation}`, request, actionHeaders(expected))).data,
  offerAction: async (eventId: string, offerId: string, operation: 'open' | 'close' | 'cancel', expected: string, request: ActivityActionRequest = {}) =>
    (await http.post<ActivityOperationsWorkspace>(`${path(eventId)}/offers/${offerId}/${operation}`, request, actionHeaders(expected))).data,
  space: async (eventId: string, offerId: string, request: ActivitySpaceRequest, expected: string) =>
    (await http.put<ActivityOperationsWorkspace>(`${path(eventId)}/offers/${offerId}/space`, request, actionHeaders(expected))).data,
  preview: async (eventId: string, change: ActivitySelectionChange) =>
    (await http.post<ActivitySelectionPreview>(`${path(eventId)}/selection/preview`, change, fresh)).data,
  apply: async (eventId: string, change: ActivitySelectionChange, previewToken: string) =>
    (await http.post<ActivityOperationsWorkspace>(`${path(eventId)}/selection/apply`, { change, previewToken }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data,
  participationAction: async (eventId: string, participationId: string, operation: 'consent' | 'verify-consent' | 'verify-eligibility' | 'complete' | 'cancel' | 'payment' | 'refund', expected: string, request: ActivityActionRequest = {}) =>
    (await http.post<ActivityOperationsWorkspace>(`${path(eventId)}/participations/${participationId}/${operation}`, request, actionHeaders(expected))).data,
  privateData: async (eventId: string, participantId: string) =>
    (await http.get<ActivityPrivateData>(`${path(eventId)}/participants/${participantId}/private-data`, fresh)).data,
  savePrivateData: async (eventId: string, participantId: string, birthDate: string, expected: string) =>
    (await http.put<ActivityPrivateData>(`${path(eventId)}/participants/${participantId}/private-data`, { birthDate }, etag(expected))).data,
}
