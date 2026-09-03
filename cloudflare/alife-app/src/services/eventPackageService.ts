import type { EventLifecycle, EventPackage, EventPackageActorCapabilities, EventPackageConditionResult, EventPackageDecisionRequest, EventPackageDiff, EventPackagePage, EventPackageScopeType, EventPackageStatus } from '../types/eventPackage'
import { http } from './http'

export const eventPackageService = {
  listPage: async (eventId: string, query: {
    page?: number
    pageSize?: number
    status?: EventPackageStatus
    scopeType?: EventPackageScopeType
    scopeId?: string
    sort?: 'versionDesc' | 'versionAsc' | 'generatedDesc' | 'generatedAsc'
  } = {}): Promise<EventPackagePage> => {
    const { data } = await http.get<EventPackagePage>(`/api/events/${eventId}/packages`, {
      params: { page: 1, pageSize: 10, sort: 'versionDesc', ...query },
    })
    return data
  },

  getCurrent: async (eventId: string, scopeType: EventPackageScopeType = 'event', scopeId?: string): Promise<EventPackage | null> => {
    try {
      const { data } = await http.get<EventPackage>(`/api/events/${eventId}/packages/current`, {
        params: { scopeType, ...(scopeId ? { scopeId } : {}) },
      })
      return data
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return null
      throw error
    }
  },

  diff: async (eventId: string, fromPackageId: string, toPackageId: string): Promise<EventPackageDiff> => {
    const { data } = await http.get<EventPackageDiff>(`/api/events/${eventId}/packages/${fromPackageId}/diff/${toPackageId}`)
    return data
  },

  getCapabilities: async (eventId: string, packageId: string): Promise<EventPackageActorCapabilities> => {
    const { data } = await http.get<EventPackageActorCapabilities>(`/api/events/${eventId}/packages/${packageId}/capabilities`)
    return data
  },

  generate: async (eventId: string, planETag: string,
    scopeType: EventPackageScopeType = 'event', scopeId?: string): Promise<EventPackage> => {
    const { data } = await http.post<EventPackage>(`/api/events/${eventId}/packages/generate`, {
      scopeType,
      scopeId: scopeId ?? null,
      packageSchemaVersion: '1.0',
    }, {
      headers: { 'If-Match': planETag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  submit: async (eventId: string, packageId: string, eTag: string): Promise<EventPackage> => {
    const { data } = await http.post<EventPackage>(`/api/events/${eventId}/packages/${packageId}/submit`, null, {
      headers: { 'If-Match': eTag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  withdraw: async (eventId: string, packageId: string, eTag: string): Promise<EventPackage> => {
    const { data } = await http.post<EventPackage>(`/api/events/${eventId}/packages/${packageId}/withdraw`, null, {
      headers: { 'If-Match': eTag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  decide: async (eventId: string, packageId: string, eTag: string, request: EventPackageDecisionRequest): Promise<EventPackage> => {
    const { data } = await http.post<EventPackage>(`/api/events/${eventId}/packages/${packageId}/decisions`, request, {
      headers: { 'If-Match': eTag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  getLifecycle: async (eventId: string, occurrenceId?: string): Promise<EventLifecycle> => {
    const { data } = await http.get<EventLifecycle>(`/api/events/${eventId}/lifecycle-gates`, {
      params: occurrenceId ? { occurrenceId } : undefined,
    })
    return data
  },

  publish: async (eventId: string, lifecycleETag: string, eventPackage: EventPackage): Promise<EventLifecycle> => {
    const { data } = await http.post<EventLifecycle>(`/api/events/${eventId}/publish`, {
      packageId: eventPackage.id,
      packageETag: eventPackage.eTag,
      eventETag: lifecycleETag,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
    return data
  },

  unpublish: async (eventId: string, lifecycleETag: string, reason: { en: string; zh: string }): Promise<EventLifecycle> => {
    const { data } = await http.post<EventLifecycle>(`/api/events/${eventId}/unpublish`, {
      reason,
      eventETag: lifecycleETag,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
    return data
  },

  revokeDecision: async (eventId: string, eventPackage: EventPackage, decisionId: string, reason: { en: string; zh: string }): Promise<EventPackage> => {
    const { data } = await http.post<EventPackage>(`/api/events/${eventId}/packages/${eventPackage.id}/decisions/${decisionId}/revoke`, { reason }, {
      headers: { 'If-Match': eventPackage.eTag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  satisfyCondition: async (eventId: string, packageId: string, conditionId: string, conditionETag: string, evidenceReference: string): Promise<EventPackageConditionResult> => {
    const { data } = await http.post<EventPackageConditionResult>(`/api/events/${eventId}/packages/${packageId}/conditions/${conditionId}/satisfy`, { evidenceReference }, {
      headers: { 'If-Match': conditionETag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  verifyCondition: async (eventId: string, packageId: string, conditionId: string, conditionETag: string, verified: boolean, reason: { en: string; zh: string }): Promise<EventPackageConditionResult> => {
    const { data } = await http.post<EventPackageConditionResult>(`/api/events/${eventId}/packages/${packageId}/conditions/${conditionId}/verify`, { verified, reason }, {
      headers: { 'If-Match': conditionETag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  waiveCondition: async (eventId: string, packageId: string, conditionId: string, conditionETag: string, reason: { en: string; zh: string }): Promise<EventPackageConditionResult> => {
    const { data } = await http.post<EventPackageConditionResult>(`/api/events/${eventId}/packages/${packageId}/conditions/${conditionId}/waive`, { reason }, {
      headers: { 'If-Match': conditionETag, 'Idempotency-Key': crypto.randomUUID() },
    })
    return data
  },

  openRegistration: async (eventId: string, lifecycle: EventLifecycle, eventPackage: EventPackage): Promise<EventLifecycle> => {
    const { data } = await http.post<EventLifecycle>(`/api/events/${eventId}/registration/open`, {
      packageId: eventPackage.id,
      packageETag: eventPackage.eTag,
      registrationETag: lifecycle.registrationETag,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
    return data
  },

  closeRegistration: async (eventId: string, lifecycle: EventLifecycle, reason: { en: string; zh: string }): Promise<EventLifecycle> => {
    const { data } = await http.post<EventLifecycle>(`/api/events/${eventId}/registration/close`, {
      reason,
      registrationETag: lifecycle.registrationETag,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
    return data
  },

  confirmExecution: async (eventId: string, lifecycle: EventLifecycle, eventPackage: EventPackage): Promise<EventLifecycle> => {
    const { data } = await http.post<EventLifecycle>(`/api/events/${eventId}/execution/confirm`, {
      scopeType: eventPackage.scopeType,
      scopeId: eventPackage.scopeId ?? null,
      packageId: eventPackage.id,
      packageETag: eventPackage.eTag,
      executionETag: lifecycle.executionETag,
    }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
    return data
  },
}
