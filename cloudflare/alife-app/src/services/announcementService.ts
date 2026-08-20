import { http } from './http'
import type { AnnouncementDto, SaveAnnouncementPayload } from '../types/announcement'
import { invalidateChurchLifeQueries } from './churchLifeService'

export const announcementService = {
  listActive: async (groupId: string) => {
    const { data } = await http.get<AnnouncementDto[]>(`/api/groups/${encodeURIComponent(groupId)}/announcements`)
    return data
  },
  listManaged: async (groupId: string) => {
    const { data } = await http.get<AnnouncementDto[]>(`/api/groups/${encodeURIComponent(groupId)}/announcements/manage`)
    return data
  },
  create: async (payload: SaveAnnouncementPayload) => {
    const { data } = await http.post<AnnouncementDto>(`/api/groups/${encodeURIComponent(payload.groupId)}/announcements`, payload)
    await invalidateChurchLifeQueries()
    return data
  },
  update: async (id: string, payload: SaveAnnouncementPayload) => {
    const { data } = await http.put<AnnouncementDto>(`/api/announcements/${encodeURIComponent(id)}`, payload)
    await invalidateChurchLifeQueries()
    return data
  },
  delete: async (id: string) => {
    await http.delete(`/api/announcements/${encodeURIComponent(id)}`)
    await invalidateChurchLifeQueries()
  },
}
