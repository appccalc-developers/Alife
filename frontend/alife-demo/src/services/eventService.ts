import type { ExtractEventFromChatResponse } from '../types/event'
import { http } from './http'

export const eventService = {
  extractFromChat: async (message: string): Promise<ExtractEventFromChatResponse> => {
    const { data } = await http.post<ExtractEventFromChatResponse>('/api/events/extract', { message })
    return data
  },
}
