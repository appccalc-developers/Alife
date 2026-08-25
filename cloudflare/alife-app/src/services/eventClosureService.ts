import type { EventClosureWorkspace, GenerateEventClosureDraftResponse, UpdateEventClosurePayload } from '../types/eventClosure'
import { http } from './http'

export const eventClosureService = {
  getWorkspace: async (eventId: string) =>
    (await http.get<EventClosureWorkspace>(`/api/events/${eventId}/closure`)).data,
  update: async (eventId: string, payload: UpdateEventClosurePayload) =>
    (await http.put<EventClosureWorkspace['report']>(`/api/events/${eventId}/closure`, payload)).data,
  generateAiDraft: async (eventId: string) =>
    (await http.post<GenerateEventClosureDraftResponse>('/api/ai/event-closure', { eventId })).data,
}
