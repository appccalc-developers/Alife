import type { ExtractEventFromChatResponse, EventSessionState, EventDto, GroupEventRecord } from '../types/event'
import { http } from './http'
import { createAiSessionService } from './aiSessionService'

const eventSessionService = createAiSessionService<EventDto, EventDto['legacySummary']>('/api/events/session')

export const eventService = {
  extractFromChat: async (
    message: string,
    sessionId: string,
    inputMode: 'text' | 'voice' = 'text',
  ): Promise<ExtractEventFromChatResponse> => {
    const response = await eventSessionService.sendMessage(sessionId, message, inputMode)
    return {
      responseMode: response.responseMode,
      sessionId: response.sessionId,
      markdown: response.markdown,
      result: response.result,
      context: response.context ?? null,
      legacySummary: response.context ?? null,
    }
  },

  getSessionState: async (sessionId: string): Promise<EventSessionState> => {
    const state = await eventSessionService.getState(sessionId)
    return {
      sessionId: state.sessionId,
      eventDraft: state.draft,
      legacySummary: state.context ?? null,
      chatHistory: state.chatHistory,
      updatedAt: state.updatedAt,
    }
  },

  createSessionStream: (sessionId: string): EventSource =>
    eventSessionService.createStream(sessionId),

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
}
