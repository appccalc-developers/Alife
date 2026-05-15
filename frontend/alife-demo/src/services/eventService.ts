import type { ExtractEventFromChatResponse, EventSessionState } from '../types/event'
import { sameOriginHttp } from './http'

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
}
