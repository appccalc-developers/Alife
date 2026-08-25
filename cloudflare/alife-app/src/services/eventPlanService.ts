import type { EventPlan, EventPlanOccurrence, UpdateEventOccurrenceInput } from '../types/eventPlan'
import { http } from './http'

export const eventPlanService = {
  get: async (eventId: string): Promise<EventPlan> => {
    const { data } = await http.get<EventPlan>(`/api/events/${eventId}/plan`)
    return data
  },
  updateOccurrences: async (eventId: string, occurrences: UpdateEventOccurrenceInput[]): Promise<EventPlanOccurrence[]> => {
    const { data } = await http.put<EventPlanOccurrence[]>(`/api/events/${eventId}/occurrences`, { occurrences })
    return data
  },
}
