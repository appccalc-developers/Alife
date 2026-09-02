export type EventPackagePolicyAdmin = {
  id: string
  organisationId?: string | null
  version: string
  schemaVersion: string
  rules: Record<string, unknown>
  enforcementMode: 'off' | 'dryRun' | 'enforced'
  effectiveFromUtc: string
  retiredUtc?: string | null
  isPublished: boolean
  publishedByMemberId: string
  publishedUtc: string
}

export type PublishEventPackagePolicyRequest = {
  organisationId?: string | null
  version: string
  schemaVersion: string
  rules: Record<string, unknown>
  enforcementMode: EventPackagePolicyAdmin['enforcementMode']
  effectiveFromUtc: string
}

export type EventPackageRolloutReport = {
  windowDays: number
  fromUtc: string
  generatedUtc: string
  evaluatedOperationCount: number
  wouldBlockOperationCount: number
  affectedEventCount: number
  reasons: Array<{ reasonCode: string; count: number }>
}
