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

  getGlobalEvents: async (): Promise<GroupEventRecord[]> => {
    const { data } = await http.get<GroupEventRecord[]>('/api/events')
    return data
  },

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

  updateGroupEvent: async (eventId: string, eventDto: EventDto): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { data } = await http.put<GroupEventRecord>(`/api/events/${eventId}`, {
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

  enrollEvent: async (
    payload: {
      groupId: string
      eventId: string
      name?: string
      consent?: boolean
    },
    files: File[] = [],
  ): Promise<{
    status: 'needs_input' | 'completed'
    nextField?: 'name' | 'consent' | 'paymentFiles'
    prompt?: string
    message?: string
  }> => {
    const formData = new FormData()
    formData.set('groupId', payload.groupId)
    formData.set('eventId', payload.eventId)

    if (payload.name) {
      formData.set('name', payload.name)
    }

    if (typeof payload.consent === 'boolean') {
      formData.set('consent', payload.consent ? 'true' : 'false')
    }

    files.forEach((file) => formData.append('paymentFiles', file))
    const { data } = await sameOriginHttp.post('/api/event/enroll', formData)
    return data
  },
}
