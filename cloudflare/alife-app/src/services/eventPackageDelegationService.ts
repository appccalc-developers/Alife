import { http } from './http'
import type { EventPackageApprovalDelegation } from '../types/eventPackage'

export const eventPackageDelegationService = {
  list: async (organisationId: string): Promise<EventPackageApprovalDelegation[]> =>
    (await http.get<EventPackageApprovalDelegation[]>('/api/event-package-delegations', { params: { organisationId } })).data,
  grantForEvent: async (organisationId: string, eventId: string, delegatedToMemberId: string,
    startsUtc: string, expiresUtc: string): Promise<EventPackageApprovalDelegation> =>
    (await http.post<EventPackageApprovalDelegation>('/api/event-package-delegations', {
      organisationId, scopeType: 'event', scopeId: eventId, permissionCode: 'event.package.decide',
      delegatedToMemberId, startsUtc, expiresUtc,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data,
  revoke: async (delegation: EventPackageApprovalDelegation, reason: { en: string; zh: string }): Promise<EventPackageApprovalDelegation> =>
    (await http.post<EventPackageApprovalDelegation>(`/api/event-package-delegations/${delegation.id}/revoke`, { reason }, {
      headers: { 'If-Match': delegation.eTag, 'Idempotency-Key': crypto.randomUUID() },
    })).data,
}
