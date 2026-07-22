import type { ExtractEventFromChatResponse, EventSessionState, EventDto, EventRamAssessmentRecord, EventRamDraft, GroupEventRecord } from '../types/event'
import type { AiSessionAppContext } from '../types/aiSession'
import { groupEventsQueryKey } from '../db/collections/groupCollection'
import { conditionalGet, removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { AiContentContext } from '../utils/aiContentContext'
import { http } from './http'
import { createAiSessionService } from './aiSessionService'

const eventSessionService = createAiSessionService<EventDto, EventDto['legacySummary']>('/api/events/session')

const invalidateGroupEventsCache = async (groupId: string) => {
  const queryKey = groupEventsQueryKey(groupId)
  await removeCachedRecord(queryKey)
  await queryClient.invalidateQueries({ queryKey })
}

const closeEventSession = async (sessionId?: string) => {
  if (!sessionId) {
    return
  }

  try {
    await eventSessionService.close(sessionId)
  } catch (error) {
    console.warn('Failed to close event planning session after API success.', error)
  }
}

const createPersistencePayload = (eventDto: EventDto) => {
  const { ram, ...publicEventData } = eventDto
  return {
    eventDataJson: JSON.stringify(publicEventData),
    ramDataJson: JSON.stringify(ram),
  }
}

export const eventService = {
  extractFromChat: async (
    message: string,
    sessionId: string,
    inputMode: 'text' | 'voice' = 'text',
    appContext?: AiSessionAppContext,
  ): Promise<ExtractEventFromChatResponse> => {
    const response = await eventSessionService.sendMessage(sessionId, message, { inputMode, appContext })
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

  closeSession: async (sessionId: string): Promise<void> => {
    await eventSessionService.close(sessionId)
  },

  getGroupEvents: async (groupId: string): Promise<GroupEventRecord[]> => {
    return conditionalGet<GroupEventRecord[]>({
      queryKey: groupEventsQueryKey(groupId),
      path: `/api/groups/${groupId}/events`,
    })
  },

  createGroupEvent: async (
    groupId: string,
    eventDto: EventDto,
    sessionId?: string,
    aiContext?: AiContentContext,
  ): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { eventDataJson, ramDataJson } = createPersistencePayload(eventDto)
    const { data } = await http.post<GroupEventRecord>(`/api/groups/${groupId}/events`, {
      titleEn,
      titleZh,
      startDate: eventDto.startDate,
      endDate: eventDto.endDate,
      eventDataJson,
      ramDataJson,
      contactProfileIds: eventDto.contactProfileIds ?? [],
      missionStatements: aiContext?.missionStatements ?? [],
      eventContext: aiContext?.eventContext ?? { eventDataJson, eventData: eventDto },
    })
    try {
      await invalidateGroupEventsCache(groupId)
    } finally {
      await closeEventSession(sessionId)
    }
    return data
  },

  updateGroupEvent: async (
    eventId: string,
    eventDto: EventDto,
    sessionId?: string,
    aiContext?: AiContentContext,
  ): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { eventDataJson, ramDataJson } = createPersistencePayload(eventDto)
    const { data } = await http.put<GroupEventRecord>(`/api/events/${eventId}`, {
      titleEn,
      titleZh,
      startDate: eventDto.startDate,
      endDate: eventDto.endDate,
      eventDataJson,
      ramDataJson,
      contactProfileIds: eventDto.contactProfileIds ?? [],
      missionStatements: aiContext?.missionStatements ?? [],
      eventContext: aiContext?.eventContext ?? { eventDataJson, eventData: eventDto },
    })
    try {
      await invalidateGroupEventsCache(data.groupId)
    } finally {
      await closeEventSession(sessionId)
    }
    return data
  },

  deleteGroupEvent: async (eventId: string, groupId?: string): Promise<void> => {
    await http.delete(`/api/events/${eventId}`)
    if (groupId) {
      await invalidateGroupEventsCache(groupId)
    }
  },

  getEventRam: async (eventId: string): Promise<EventRamAssessmentRecord> => {
    const { data } = await http.get<EventRamAssessmentRecord>(`/api/events/${eventId}/ram`)
    return data
  },

  saveEventRam: async (eventId: string, ram: EventRamDraft): Promise<EventRamAssessmentRecord> => {
    const { data } = await http.put<EventRamAssessmentRecord>(`/api/events/${eventId}/ram`, {
      ramDataJson: JSON.stringify(ram),
    })
    await invalidateGroupEventsCache(data.groupId)
    return data
  },

  submitEventRam: async (eventId: string): Promise<EventRamAssessmentRecord> => {
    const { data } = await http.post<EventRamAssessmentRecord>(`/api/events/${eventId}/ram/submit`, {})
    await invalidateGroupEventsCache(data.groupId)
    return data
  },

  approveEventRam: async (eventId: string): Promise<EventRamAssessmentRecord> => {
    const { data } = await http.post<EventRamAssessmentRecord>(`/api/events/${eventId}/ram/approve`, {})
    await invalidateGroupEventsCache(data.groupId)
    return data
  },
}
