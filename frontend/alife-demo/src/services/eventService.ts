import type { ExtractEventFromChatResponse, EventSessionState, EventDto, GroupEventRecord } from '../types/event'
import { http, sameOriginHttp } from './http'

export const eventService = {
  extractFromChat: async (
    message: string,
    sessionId: string,
    inputMode: 'text' | 'voice' = 'text',
  ): Promise<ExtractEventFromChatResponse> => {
    const { data } = await sameOriginHttp.post<ExtractEventFromChatResponse>('/api/events/extract', {
      message,
      sessionId,
      inputMode,
    })
    return data
  },

  getSessionState: async (sessionId: string): Promise<EventSessionState> => {
    const { data } = await sameOriginHttp.get<EventSessionState>(`/api/events/session/${encodeURIComponent(sessionId)}/state`)
    return data
  },

  createSessionStream: (sessionId: string): EventSource =>
    new EventSource(`/api/events/session/${encodeURIComponent(sessionId)}/stream`),

  getGroupEvents: async (groupId: string): Promise<GroupEventRecord[]> => {
    const { data } = await http.get<GroupEventRecord[]>(`/api/groups/${groupId}/events`)
    return data
  },

  createGroupEvent: async (groupId: string, eventDto: EventDto): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { data } = await http.post<GroupEventRecord>(`/api/groups/${groupId}/events`, {
      titleEn,
      titleZh,
      startDate: eventDto.startDate,
      endDate: eventDto.endDate,
      eventDataJson: JSON.stringify(eventDto),
    })
    return data
  },

  deleteGroupEvent: async (eventId: string): Promise<void> => {
    await http.delete(`/api/events/${eventId}`)
  },
}
