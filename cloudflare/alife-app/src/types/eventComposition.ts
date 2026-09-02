export type LocalizedText = { en: string; zh: string }

export type EventFactCertainty = 'unknown' | 'candidate' | 'confirmed'
export type EventFactSource = 'human' | 'aiCandidate' | 'trustedContext' | 'legacyBackfill'
export type EventModuleDecisionStatus = 'inactive' | 'recommended' | 'selected' | 'required' | 'exceptionRequested' | 'exceptionApproved'
export type EventReadinessStatus = 'notReady' | 'blocked' | 'ready' | 'complete'
export type EventSponsorshipStatus = 'notRequested' | 'pending' | 'approved' | 'rejected' | 'revoked'

export type EventFactInput = {
  code: string
  value: unknown
  certainty: EventFactCertainty
  source: EventFactSource
  confirmedByMemberId?: string | null
  confirmedUtc?: string | null
}

export type ModuleSelectionInput = {
  moduleCode: string
  selected: boolean
  reason?: string | null
}

export type EventPlanComposeRequest = {
  schemaVersion: '1.0.0' | '1.1.0'
  archetypeCode?: string | null
  activityTypeCode?: string | null
  useRecommendedWorkflow?: boolean
  facts: { items: EventFactInput[] }
  humanSelections: ModuleSelectionInput[]
  basePlanVersion?: number | null
}

export type ModuleDecision = {
  moduleCode: string
  definitionVersion: number
  label: LocalizedText
  status: EventModuleDecisionStatus
  reasonCodes: string[]
  dependencies: string[]
  dataClasses: string[]
  integrationKey: string
  surfaceKey: string
  navigationOrder: number
}

export type Readiness = {
  status: EventReadinessStatus
  blockers: LocalizedText[]
  warnings: LocalizedText[]
  checkedUtc: string
}

export type EventWorkspaceItem = {
  surfaceKey: EventSurfaceKey | string
  moduleCode?: string | null
  presentation: 'tab' | 'page' | string
  sectionKey?: string | null
  pathSegment?: string | null
  label: LocalizedText
  order: number
  readiness: EventReadinessStatus
  blockers: LocalizedText[]
  allowedActions: string[]
}

export type EventPlanDiff = {
  addedModules: string[]
  removedModules: string[]
  changedModules: string[]
  blockingRetirements: string[]
}

export type EventPlanProposal = {
  schemaVersion: string
  proposalHash: string
  baselineETag: string
  basePlanVersion?: number | null
  archetypeCode?: string | null
  archetypeVersion?: number | null
  activityTypeCode?: string | null
  activityTypeVersion?: number | null
  workflowRecommendation?: {
    code: string
    resolvedVersion?: number | null
    name?: LocalizedText | null
    status: 'selected' | 'declined' | 'unavailable'
  } | null
  facts: { version?: number | null; items: EventFactInput[]; sourceHash: string }
  moduleDecisions: ModuleDecision[]
  roleRequirements: Array<{
    requirementKey: string
    moduleCode: string
    roleCode: string
    minimum: number
    recommended: number
    maximum?: number | null
    eligibility: string[]
    separationFrom: string[]
  }>
  workflowContributions: Array<{ moduleCode: string; stepKey: string; integrationKey: string }>
  readiness: Readiness
  navigation: EventWorkspaceItem[]
  diff: EventPlanDiff
  warnings: LocalizedText[]
}

export type EventPlanSnapshot = {
  eventId: string
  planVersion: number
  acceptedByMemberId?: string | null
  acceptedUtc?: string | null
  eTag: string
  isLegacyBackfill: boolean
  plan: EventPlanProposal
  humanDecisions: Array<{ code: string; decision: string; reason?: string | null }>
}

export type EventArchetype = {
  code: string
  version: number
  name: LocalizedText
  isSeries: boolean
  occurrenceCount: number
  rollingOccurrenceWeeks?: number | null
  hasSessions: boolean
  hasZones: boolean
  requiredModules: string[]
  recommendedModules: string[]
  conditionalModules: string[]
  workflowTemplateRecommendations: string[]
  activityTypes: EventActivityType[]
}

export type EventActivityType = {
  code: string
  version: number
  archetypeCode: string
  name: LocalizedText
  description: LocalizedText
  iconKey: string
  defaults: {
    visibility: 'groupVisible' | 'churchVisible' | 'public'
    registrationMode: 'none' | 'required'
    capacityUnit: 'People'
  }
  preselectedModules: string[]
  recommendedWorkflowTemplateCode?: string | null
  presetServiceSlots: Array<{
    roleCode: string
    label: LocalizedText
    requiredCount: number
    eligibilityCode: string
  }>
}

export type EventSeriesSetup = {
  name: LocalizedText
  recurrenceRule: string
  timeZone: string
  firstStartLocal: string
  durationMinutes: number
  exceptionDates?: string[]
  rollingOccurrenceWeeks: number
}

export type EventWorkspace = {
  eventId: string
  owningGroupId: string
  title: LocalizedText
  planVersion?: number | null
  eTag: string
  readiness: Readiness
  items: EventWorkspaceItem[]
  nextSteps: LocalizedText[]
  canManage: boolean
  sponsorshipStatus: EventSponsorshipStatus
}

export const eventSurfaceKeys = [
  'workspace.overview',
  'workspace.governance',
  'team.work',
  'people.registration',
  'service.roster',
  'money.finance',
  'safety.ram',
  'safeguarding.child',
  'program.production',
  'place.resource',
  'move.stay',
  'food.hospitality',
  'festival.operations',
  'comms.followup',
] as const

export type EventSurfaceKey = typeof eventSurfaceKeys[number]
