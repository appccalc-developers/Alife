export type EventPlanStatus = 'draft' | 'active' | 'ready' | 'completed' | 'cancelled'
export type EventModuleStatus = 'notConfigured' | 'configuring' | 'ready' | 'blocked' | 'completed'
export type EventReadinessStatus = 'pending' | 'satisfied' | 'blocked' | 'waived'
export type EventDecisionStatus = 'requested' | 'approved' | 'rejected' | 'returned' | 'cancelled'

export type EventPlanText = { en: string; zh: string }

export type EventPlanOccurrence = {
  id: string
  key: string
  name: EventPlanText
  startUtc: string
  endUtc: string
  timeZoneId: string
  sortOrder: number
}

export type EventPlanModule = {
  id: string
  key: string
  version: number
  isRequired: boolean
  status: EventModuleStatus
}

export type EventReadinessGate = {
  id: string
  moduleInstanceId?: string | null
  key: string
  name: EventPlanText
  isRequired: boolean
  status: EventReadinessStatus
  explanationJson: string
}

export type EventPlanDecision = {
  id: string
  moduleInstanceId?: string | null
  key: string
  status: EventDecisionStatus
  requestedByMemberId: string
  requestedByDisplayName?: string | null
  decidedByMemberId?: string | null
  decidedByDisplayName?: string | null
  decisionNotes: string
  requestedUtc: string
  decidedUtc?: string | null
}

export type EventPlanApprovalItem = {
  key: string
  referenceId?: string | null
  moduleInstanceId?: string | null
  subject: EventPlanText
  status: 'notStarted' | 'draft' | 'requested' | 'approved' | 'returned' | 'rejected' | 'cancelled'
  requestedByMemberId?: string | null
  requestedByDisplayName?: string | null
  decidedByMemberId?: string | null
  decidedByDisplayName?: string | null
  decisionNotes: string
  requestedUtc?: string | null
  decidedUtc?: string | null
}

export type EventPlanMilestoneCheck = {
  key: string
  name: EventPlanText
  status: 'pending' | 'satisfied' | 'blocked' | 'notApplicable'
  moduleKey?: string | null
}

export type EventPlanMilestone = {
  key: 'announce' | 'register' | 'run' | 'close'
  name: EventPlanText
  status: 'pending' | 'ready' | 'blocked' | 'notApplicable'
  checks: EventPlanMilestoneCheck[]
}

export type EventPlanPreparationTaskItem = {
  id: string
  moduleKey: string
  title: EventPlanText
  assignedMemberId?: string | null
  assignedDisplayName?: string | null
  dueUtc?: string | null
  status: 'todo' | 'inProgress' | 'completed' | 'cancelled'
  isBlocked: boolean
}

export type EventPlanPreparationTaskSummary = {
  requiredCount: number
  completedCount: number
  unassignedCount: number
  missingDueDateCount: number
  dueAfterEventCount: number
  overdueCount: number
  blockedCount: number
  nextTasks: EventPlanPreparationTaskItem[]
}

export type EventPlanRegistrationSummary = {
  maxCapacity: number
  capacityUnit: 'People' | 'Families'
  enrollmentCount: number
  reservedUnits: number
  remainingUnits: number
  registrationDeadlineUtc?: string | null
  state: 'notConfigured' | 'invalid' | 'open' | 'closed' | 'full'
}

export type EventPlan = {
  id: string
  eventId: string
  currentRevision: number
  status: EventPlanStatus
  isLegacyProjection: boolean
  updatedUtc: string
  eventStartUtc: string
  eventEndUtc: string
  occurrences: EventPlanOccurrence[]
  modules: EventPlanModule[]
  readinessGates: EventReadinessGate[]
  decisions?: EventPlanDecision[]
  approvals?: EventPlanApprovalItem[]
  milestones?: EventPlanMilestone[]
  preparationTasks?: EventPlanPreparationTaskSummary | null
  registration?: EventPlanRegistrationSummary | null
}

export type UpdateEventOccurrenceInput = {
  id?: string | null
  nameEn: string
  nameZh: string
  startUtc: string
  endUtc: string
  timeZoneId: string
}
