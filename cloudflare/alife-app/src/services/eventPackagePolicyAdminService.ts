import { http } from './http'
import type { EventPackagePolicyAdmin, EventPackageRolloutReport, PublishEventPackagePolicyRequest, PolicyEditorDefaults, PolicyImpact } from '../types/eventPackagePolicyAdmin'

export const eventPackagePolicyAdminService = {
  defaults: async (): Promise<PolicyEditorDefaults> => (await http.get<PolicyEditorDefaults>('/api/admin/event-package-policies/defaults')).data,
  preview: async (request: PublishEventPackagePolicyRequest): Promise<PolicyImpact> => (await http.post<PolicyImpact>('/api/admin/event-package-policies/preview', request)).data,
  list: async (organisationId?: string): Promise<EventPackagePolicyAdmin[]> => {
    const { data } = await http.get<EventPackagePolicyAdmin[]>('/api/admin/event-package-policies', {
      params: organisationId ? { organisationId } : undefined,
    })
    return data
  },
  publish: async (request: PublishEventPackagePolicyRequest, idempotencyKey: string): Promise<EventPackagePolicyAdmin> => {
    const { data } = await http.post<EventPackagePolicyAdmin>('/api/admin/event-package-policies/publish', request, {
      headers: { 'Idempotency-Key': idempotencyKey },
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
