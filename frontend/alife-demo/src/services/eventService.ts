import type { ExtractEventFromChatResponse, EventSessionState } from '../types/event'
import { http } from './http'

export const eventService = {
  extractFromChat: async (
    message: string,
    sessionId: string,
    inputMode: 'text' | 'voice' = 'text',
  ): Promise<ExtractEventFromChatResponse> => {
    const { data } = await http.post<ExtractEventFromChatResponse>('/api/events/extract', {
      message,
      sessionId,
      inputMode,
    })
    return data
  },

  getSessionState: async (sessionId: string): Promise<EventSessionState> => {
    const { data } = await http.get<EventSessionState>(`/api/events/session/${encodeURIComponent(sessionId)}/state`)
    return data
  },

  createSessionStream: (sessionId: string): EventSource =>
    new EventSource(`/api/events/session/${encodeURIComponent(sessionId)}/stream`),
}
