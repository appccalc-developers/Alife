import { http, sameOriginHttp } from './http'
import { invalidateGroupEventsCache } from './eventService'
import { queryClient } from '../db/queryClient'
import type { RamAssessment, RamDraft, RamPolicy, RamPolicyData, RamPrint, RamWorkspace } from '../types/ramGovernance'

// RAM content stays in component memory. Do not use conditionalGet, persistent query caches or localStorage.
const changed = async (record: RamAssessment) => {
  await invalidateGroupEventsCache(record.groupId)
  await queryClient.invalidateQueries({ predicate: query => query.queryKey.some(key => key === record.eventId) })
  await queryClient.invalidateQueries({ queryKey: ['notifications', 'current'] })
  return record
}
export const ramService = {
  guidance: async (eventId: string, activityType: string, category: string, language: string) => (await sameOriginHttp.post<{ explanation: string; questions: string[] }>('/api/events/ram-guidance', { eventId, activityType, category, language })).data,
  workspace: async (id: string) => (await http.get<RamWorkspace>(`/api/events/${id}/ram/workspace`, { headers: { 'Cache-Control': 'no-store' } })).data,
  version: async (id: string, version: string) => (await http.get<RamPrint>(`/api/events/${id}/ram/versions/${version}`, { headers: { 'Cache-Control': 'no-store' } })).data,
  save: async (id: string, draft: RamDraft, policyVersionId: string | null, expectedETag: string) => changed((await http.put<RamAssessment>(`/api/events/${id}/ram`, { schemaVersion: 2, ramDataJson: JSON.stringify(draft), policyVersionId, expectedETag })).data),
  action: async (id: string, action: string, expectedETag: string, revisionId: string | null, reason: string, healthSafetySigned: boolean, key: string) => changed((await http.post<RamAssessment>(
    action === 'submit' || action === 'approve' ? `/api/events/${id}/ram/${action}` : `/api/events/${id}/ram/actions/${action}`,
    { expectedETag, revisionId, reason, healthSafetySigned }, { headers: { 'Idempotency-Key': key } })).data),
  policies: async (church: string) => (await http.get<RamPolicy[]>(`/api/admin/churches/${church}/ram-policies`)).data,
  savePolicy: async (church: string, data: RamPolicyData, draftId: string | null, expectedETag: string) => (await http.put<RamPolicy>(`/api/admin/churches/${church}/ram-policies`, { data, draftId, expectedETag })).data,
  publishPolicy: async (policy: RamPolicy) => (await http.post<RamPolicy>(`/api/admin/churches/${policy.churchId}/ram-policies/${policy.id}/publish`, { expectedETag: policy.eTag, confirmEveryCell: true })).data,
}
