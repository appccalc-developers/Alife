import type { EventModuleSuggestionKey, EventModuleSuggestionResponse } from '../types/eventModuleSuggestion'
import { http } from './http'

export const eventModuleSuggestionService = {
  generate: async (eventId: string, module: EventModuleSuggestionKey, guidance = '') =>
    (await http.post<EventModuleSuggestionResponse>('/api/ai/event-module-suggestions', {
      eventId,
      module,
      guidance,
    })).data,
}
