import type { GenerateEventPosterPayload } from './eventPosterAiService'
import type { EventVisibility } from '../types/event'
import { http } from './http'
import { invalidateChurchLifeQueries } from './churchLifeService'
import { groupEventsQueryKey } from '../db/collections/groupCollection'
import { removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'

export type EventPosterWorkspace = {
  eventId: string; groupId: string; brief: GenerateEventPosterPayload['event']; posterImageUrl: string | null
  visibility: EventVisibility; registrationMode: string; eTag: string; canManage: boolean
}
export const eventPosterWorkspaceService = {
  get: async (eventId: string) => (await http.get<EventPosterWorkspace>(`/api/events/${eventId}/poster`)).data,
  save: async (eventId: string, posterImageUrl: string | null, eTag: string, idempotencyKey: string) => {
    const { data } = await http.put<EventPosterWorkspace>(`/api/events/${eventId}/poster`, { posterImageUrl }, { headers: { 'If-Match': eTag, 'Idempotency-Key': idempotencyKey } })
    const queryKey = groupEventsQueryKey(data.groupId)
    await removeCachedRecord(queryKey)
    await queryClient.invalidateQueries({ queryKey })
    await invalidateChurchLifeQueries()
    return data
  },
}
