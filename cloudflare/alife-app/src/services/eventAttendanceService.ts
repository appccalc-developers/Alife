import { queryClient } from '../db/queryClient'
import type { EventAttendanceRecord, EventAttendanceWorkspace, SaveEventAttendanceRecord } from '../types/eventAttendance'
import { http } from './http'

export const eventAttendanceService = {
  getWorkspace: async (eventId: string): Promise<EventAttendanceWorkspace> => {
    const { data } = await http.get<EventAttendanceWorkspace>(`/api/events/${eventId}/attendance`)
    return data
  },
  saveRecord: async (eventId: string, payload: SaveEventAttendanceRecord): Promise<EventAttendanceRecord> => {
    const { data } = await http.put<EventAttendanceRecord>(`/api/events/${eventId}/attendance/records`, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventAttendance', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventClosure', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventPlan', eventId] }),
    ])
    return data
  },
}
