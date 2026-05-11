import type { EventDto } from '../types/event'
import { http } from './http'

export const eventService = {
  extractFromChat: async (message: string): Promise<EventDto> => {
    const { data } = await http.post<EventDto>('/api/events/extract', { message })
    return data
  },
}
