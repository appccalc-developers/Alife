import { http } from './http'
import type { AppNotification } from '../types/notification'
import { normalizeCurrentTasks } from '../utils/currentTasks'

export const notificationService = {
  getCurrentTasks: async (): Promise<AppNotification[]> => {
    const { data } = await http.get<unknown>('/api/notifications/current')
    return normalizeCurrentTasks(data)
  },

  openNotification: async (id: string): Promise<void> => {
    await http.post(`/api/notifications/${encodeURIComponent(id)}/read`)
  },
}
