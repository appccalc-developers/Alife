import { queryClient } from '../db/queryClient'
import type { EventFinanceEntry, EventFinanceReconciliation, EventFinanceWorkspace, ReconcileEventFinance, SaveEventFinanceEntry, UpdateEventFinanceSettings } from '../types/eventFinance'
import { http } from './http'

export const eventFinanceService = {
  getWorkspace: async (eventId: string): Promise<EventFinanceWorkspace> => {
    const { data } = await http.get<EventFinanceWorkspace>(`/api/events/${eventId}/finance`)
    return data
  },
  updateSettings: async (eventId: string, payload: UpdateEventFinanceSettings): Promise<void> => {
    await http.put(`/api/events/${eventId}/finance`, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventFinance', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventPlan', eventId] }),
    ])
  },
  saveEntry: async (eventId: string, payload: SaveEventFinanceEntry, entryId?: string | null): Promise<EventFinanceEntry> => {
    const path = `/api/events/${eventId}/finance/entries${entryId ? `/${entryId}` : ''}`
    const { data } = entryId
      ? await http.put<EventFinanceEntry>(path, payload)
      : await http.post<EventFinanceEntry>(path, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventFinance', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventClosure', eventId] }),
    ])
    return data
  },
  deleteEntry: async (eventId: string, entryId: string): Promise<void> => {
    await http.delete(`/api/events/${eventId}/finance/entries/${entryId}`)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventFinance', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventClosure', eventId] }),
    ])
  },
  reconcile: async (eventId: string, payload: ReconcileEventFinance): Promise<EventFinanceReconciliation> => {
    const { data } = await http.put<EventFinanceReconciliation>(`/api/events/${eventId}/finance/reconciliation`, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['eventFinance', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventClosure', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventPlan', eventId] }),
    ])
    return data
  },
}
