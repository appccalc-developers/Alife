import type { EventPreparationTask, EventPreparationTaskStatus, EventPreparationTaskWorkspace, SaveEventPreparationTaskPayload } from '../types/eventPreparationTask'
import { http } from './http'

export const eventPreparationTaskService = {
  getWorkspace: async (eventId: string) =>
    (await http.get<EventPreparationTaskWorkspace>(`/api/events/${eventId}/preparation-tasks`)).data,
  getMine: async (eventId: string) =>
    (await http.get<EventPreparationTask[]>(`/api/events/${eventId}/my-preparation-tasks`)).data,
  save: async (eventId: string, taskId: string | null, payload: SaveEventPreparationTaskPayload) =>
    (taskId
      ? await http.put<EventPreparationTask>(`/api/events/${eventId}/preparation-tasks/${taskId}`, payload)
      : await http.post<EventPreparationTask>(`/api/events/${eventId}/preparation-tasks`, payload)).data,
  updateStatus: async (eventId: string, taskId: string, status: EventPreparationTaskStatus) =>
    (await http.put<EventPreparationTask>(`/api/events/${eventId}/preparation-tasks/${taskId}/status`, { status })).data,
}
