import { groupEventsQueryKey } from '../db/collections/groupCollection'
import { removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { EventSeries, EventSeriesGenerationResult, SaveEventSeries } from '../types/eventSeries'
import { invalidateChurchLifeQueries } from './churchLifeService'
import { http } from './http'

const seriesKey = (groupId: string) => ['eventSeries', groupId] as const

export const eventSeriesService = {
  list: async (groupId: string): Promise<EventSeries[]> => {
    const { data } = await http.get<EventSeries[]>(`/api/groups/${groupId}/event-series`)
    return data
  },
  save: async (groupId: string, seriesId: string | null, payload: SaveEventSeries): Promise<EventSeries> => {
    const path = seriesId
      ? `/api/groups/${groupId}/event-series/${seriesId}`
      : `/api/groups/${groupId}/event-series`
    const { data } = seriesId
      ? await http.put<EventSeries>(path, payload)
      : await http.post<EventSeries>(path, payload)
    await queryClient.invalidateQueries({ queryKey: seriesKey(groupId) })
    return data
  },
  generate: async (groupId: string, seriesId: string, horizonWeeks?: number): Promise<EventSeriesGenerationResult> => {
    const { data } = await http.post<EventSeriesGenerationResult>(`/api/event-series/${seriesId}/generate`, {
      horizonWeeks,
    })
    await queryClient.invalidateQueries({ queryKey: seriesKey(groupId) })
    const eventsKey = groupEventsQueryKey(groupId)
    await removeCachedRecord(eventsKey)
    await queryClient.invalidateQueries({ queryKey: eventsKey })
    await invalidateChurchLifeQueries()
    return data
  },
  key: seriesKey,
}
