import type {
  EventArtifact,
  EventArtifactStatus,
  EventWorkflow,
  EventWorkflowStep,
  EventWorkflowStepStatus,
  EventWorkflowTemplate,
} from '../types/eventWorkflow'
import { http } from './http'

export const eventWorkflowService = {
  listTemplates: async (): Promise<EventWorkflowTemplate[]> => {
    const { data } = await http.get<EventWorkflowTemplate[]>('/api/event-workflow-templates')
    return data
  },

  get: async (eventId: string): Promise<EventWorkflow | null> => {
    const { data } = await http.get<EventWorkflow | null>(`/api/events/${eventId}/workflow`)
    return data
  },

  initialize: async (eventId: string, templateCode: string): Promise<EventWorkflow> => {
    const { data } = await http.post<EventWorkflow>(`/api/events/${eventId}/workflow`, { templateCode })
    return data
  },

  updateStep: async (
    eventId: string,
    step: EventWorkflowStep,
    status: EventWorkflowStepStatus,
  ): Promise<EventWorkflow> => {
    const { data } = await http.put<EventWorkflow>(`/api/events/${eventId}/workflow/steps/${step.id}`, {
      status,
      assignedMemberId: step.assignedMemberId ?? null,
      dueUtc: step.dueUtc ?? null,
    })
    return data
  },

  updateArtifactStatus: async (
    eventId: string,
    artifact: EventArtifact,
    status: EventArtifactStatus,
  ): Promise<EventArtifact> => {
    const { data } = await http.put<EventArtifact>(`/api/events/${eventId}/workflow/artifacts/${artifact.id}`, {
      titleEn: artifact.title.en,
      titleZh: artifact.title.zh,
      status,
      visibility: artifact.visibility,
      fileAssetId: artifact.fileAssetId ?? null,
      dataJson: artifact.dataJson || '{}',
    })
    return data
  },
}
