export type WorkflowText = { en: string; zh: string }

export type FileAssetVisibility = 'public' | 'groupVisible' | 'memberPrivate'
export type EventArtifactStatus = 'draft' | 'submitted' | 'approved'
export type EventWorkflowStepStatus =
  | 'notStarted'
  | 'inProgress'
  | 'awaitingApproval'
  | 'needsChanges'
  | 'completed'
  | 'skipped'

export type EventArtifactRequirement = {
  type: string
  title: WorkflowText
  required: boolean
  visibility: FileAssetVisibility
}

export type EventWorkflowStageDefinition = {
  key: string
  name: WorkflowText
  required: boolean
  requiresApproval: boolean
  integrationKey?: string | null
  artifacts: EventArtifactRequirement[]
}

export type EventWorkflowTemplate = {
  id: string
  code: string
  version: number
  name: WorkflowText
  description: WorkflowText
  stages: EventWorkflowStageDefinition[]
}

export type EventArtifact = {
  id: string
  eventId: string
  workflowStepId?: string | null
  artifactType: string
  title: WorkflowText
  isRequired: boolean
  status: EventArtifactStatus
  visibility: FileAssetVisibility
  fileAssetId?: string | null
  dataJson: string
  createdByMemberId: string
  approvedByMemberId?: string | null
  approvedUtc?: string | null
  createdUtc: string
  updatedUtc: string
}

export type EventWorkflowStep = {
  id: string
  stepKey: string
  sortOrder: number
  name: WorkflowText
  isRequired: boolean
  requiresApproval: boolean
  integrationKey?: string | null
  status: EventWorkflowStepStatus
  assignedMemberId?: string | null
  dueUtc?: string | null
  completedByMemberId?: string | null
  completedUtc?: string | null
  artifacts: EventArtifact[]
}

export type EventWorkflow = {
  id: string
  eventId: string
  status: 'active' | 'completed' | 'cancelled'
  currentStepKey?: string | null
  startedUtc: string
  completedUtc?: string | null
  updatedUtc: string
  template: EventWorkflowTemplate
  steps: EventWorkflowStep[]
}
