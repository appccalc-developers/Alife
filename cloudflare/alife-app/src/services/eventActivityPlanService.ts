import { http } from './http'
import type { ActivityPlanData, ActivityPlanView } from '../types/eventActivityPlan'
import { invalidateGroupEventsCache } from './eventService'
export const eventActivityPlanService = {
  get: async (eventId: string) => (await http.get<ActivityPlanView>(`/api/events/${eventId}/activity-plan`, { headers: {'Cache-Control':'no-store'} })).data,
  save: async (eventId: string, data: ActivityPlanData, expectedETag: string, groupId: string) => {
    const result = (await http.put<ActivityPlanView>(`/api/events/${eventId}/activity-plan`, { data, expectedETag })).data
    await invalidateGroupEventsCache(groupId); return result
  },
}
