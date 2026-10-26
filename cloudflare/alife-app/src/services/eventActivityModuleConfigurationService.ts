import { http } from './http'
import type { ProjectModuleConfiguration, ProjectModuleConfigurationWorkspace, ProjectModuleDetails, ProjectModuleKind } from '../types/eventActivityModuleConfigurations'

const path = (eventId: string) => `/api/events/${eventId}/activity-project-configurations`
export const eventActivityModuleConfigurationService = {
  get: async (eventId: string) => (await http.get<ProjectModuleConfigurationWorkspace>(path(eventId), { headers: { 'Cache-Control': 'no-store' } })).data,
  save: async (eventId: string, activityId: string, kind: ProjectModuleKind, details: ProjectModuleDetails, eTag: string) =>
    (await http.put<ProjectModuleConfiguration>(`${path(eventId)}/projects/${encodeURIComponent(activityId)}/${kind}`, details, { headers: { 'If-Match': eTag } })).data,
}
