import { http } from './http'
import type { EventPackagePolicyAdmin, EventPackageRolloutReport, PublishEventPackagePolicyRequest } from '../types/eventPackagePolicyAdmin'

export const eventPackagePolicyAdminService = {
  list: async (organisationId?: string): Promise<EventPackagePolicyAdmin[]> => {
    const { data } = await http.get<EventPackagePolicyAdmin[]>('/api/admin/event-package-policies', {
      params: organisationId ? { organisationId } : undefined,
    })
    return data
  },
  publish: async (request: PublishEventPackagePolicyRequest): Promise<EventPackagePolicyAdmin> => {
    const { data } = await http.post<EventPackagePolicyAdmin>('/api/admin/event-package-policies/publish', request, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },
  rolloutReport: async (windowDays = 30): Promise<EventPackageRolloutReport> => {
    const { data } = await http.get<EventPackageRolloutReport>('/api/admin/event-package-policies/rollout-report', {
      params: { windowDays },
    })
    return data
  },
}
