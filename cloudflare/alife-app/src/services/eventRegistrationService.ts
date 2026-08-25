import type { EventRegistrationWorkspace, UpdateEventRegistrationSettings } from '../types/eventRegistration'
import { queryClient } from '../db/queryClient'
import { http } from './http'

export const eventRegistrationService = {
  getWorkspace: async (eventId: string): Promise<EventRegistrationWorkspace> => {
    const { data } = await http.get<EventRegistrationWorkspace>(`/api/events/${eventId}/registration`)
    return data
  },

  updateSettings: async (eventId: string, payload: UpdateEventRegistrationSettings): Promise<void> => {
    await http.put(`/api/events/${eventId}/registration`, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventRegistration', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventPlan', eventId] }),
    ])
  },
}
