import type {
  EventArchetype,
  EventPlanComposeRequest,
  EventPlanProposal,
  EventPlanSnapshot,
  EventWorkspace,
} from '../types/eventComposition'
import { http } from './http'

export const eventCompositionService = {
  listArchetypes: async (groupId?: string): Promise<EventArchetype[]> => {
    const { data } = await http.get<EventArchetype[]>('/api/event-archetypes', {
      params: groupId ? { groupId } : undefined,
    })
    return data
  },

  compose: async (groupId: string, request: EventPlanComposeRequest): Promise<EventPlanProposal> => {
    const { data } = await http.post<EventPlanProposal>(`/api/groups/${groupId}/event-plans/compose`, request)
    return data
  },

  getPlan: async (eventId: string): Promise<EventPlanSnapshot | null> => {
    try {
      const { data } = await http.get<EventPlanSnapshot>(`/api/events/${eventId}/plan`)
      return data
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
        return null
      }
      throw error
    }
  },

  recompose: async (
    eventId: string,
    request: EventPlanComposeRequest,
    eTag: string,
  ): Promise<EventPlanProposal> => {
    const { data } = await http.post<EventPlanProposal>(`/api/events/${eventId}/plan/recompose`, request, {
      headers: { 'If-Match': eTag },
    })
    return data
  },

  accept: async (
    eventId: string,
    proposal: EventPlanProposal,
    composition: EventPlanComposeRequest,
    eTag: string,
    idempotencyKey: string,
  ): Promise<EventPlanSnapshot> => {
    const { data } = await http.post<EventPlanSnapshot>(`/api/events/${eventId}/plan/accept`, {
      proposalHash: proposal.proposalHash,
      humanDecisions: [],
      composition,
    }, {
      headers: { 'If-Match': eTag, 'Idempotency-Key': idempotencyKey },
    })
    return data
  },

  getWorkspace: async (eventId: string): Promise<EventWorkspace> => {
    const { data } = await http.get<EventWorkspace>(`/api/events/${eventId}/workspace`)
    return data
  },
}
