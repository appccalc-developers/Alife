import type {
  EventRosterPlanOptions, EventRosterWorkspace, MyEventRosterWorkspace, MyRosterAssignment, RosterAssignment, RosterCandidateSuggestion, RosterMember,
  RosterCapability, RosterMemberResponse, RosterShift, SaveRosterCapabilityPayload, SaveRosterShiftPayload,
  SchedulingUnavailableWindow, SelfSchedulingProfile, SaveManagerSchedulingProfilePayload,
} from '../types/roster'
import { http } from './http'

export const rosterService = {
  getSelfProfile: async (groupId: string) => (await http.get<SelfSchedulingProfile>(`/api/groups/${groupId}/scheduling-profile`)).data,
  saveSelfProfile: async (groupId: string, payload: { preferredRoleKeys: string[]; unavailableWindows: SchedulingUnavailableWindow[]; maxAssignmentsPerDay: number; selfNotes: string }) =>
    (await http.put<SelfSchedulingProfile>(`/api/groups/${groupId}/scheduling-profile`, payload)).data,
  saveManagerProfile: async (groupId: string, memberId: string, payload: SaveManagerSchedulingProfilePayload) =>
    (await http.put<RosterMember>(`/api/groups/${groupId}/scheduling-profiles/${memberId}/manager`, payload)).data,
  listCapabilities: async (groupId: string) =>
    (await http.get<RosterCapability[]>(`/api/groups/${groupId}/roster-capabilities`)).data,
  saveCapability: async (groupId: string, capabilityId: string | null, payload: SaveRosterCapabilityPayload) =>
    (await (capabilityId
      ? http.put<RosterCapability>(`/api/groups/${groupId}/roster-capabilities/${capabilityId}`, payload)
      : http.post<RosterCapability>(`/api/groups/${groupId}/roster-capabilities`, payload))).data,
  getWorkspace: async (eventId: string) => (await http.get<EventRosterWorkspace>(`/api/events/${eventId}/roster`)).data,
  getMyAssignments: async (eventId: string) => (await http.get<MyEventRosterWorkspace>(`/api/events/${eventId}/roster/my-assignments`)).data,
  saveShift: async (eventId: string, shiftId: string | null, payload: SaveRosterShiftPayload) =>
    (await (shiftId ? http.put<RosterShift>(`/api/events/${eventId}/roster/shifts/${shiftId}`, payload) : http.post<RosterShift>(`/api/events/${eventId}/roster/shifts`, payload))).data,
  suggestions: async (eventId: string, shiftId: string) =>
    (await http.get<RosterCandidateSuggestion[]>(`/api/events/${eventId}/roster/shifts/${shiftId}/suggestions`)).data,
  planOptions: async (eventId: string) =>
    (await http.get<EventRosterPlanOptions>(`/api/events/${eventId}/roster/plan-options`)).data,
  confirmAssignment: async (eventId: string, shiftId: string, memberId: string, basedOnSmartSuggestion = true) =>
    (await http.post<RosterAssignment>(`/api/events/${eventId}/roster/shifts/${shiftId}/assignments`, { memberId, basedOnSmartSuggestion, confirmationNotes: '' })).data,
  cancelAssignment: async (eventId: string, assignmentId: string) =>
    (await http.post<boolean>(`/api/events/${eventId}/roster/assignments/${assignmentId}/cancel`)).data,
  respondAssignment: async (eventId: string, assignmentId: string, response: RosterMemberResponse, notes: string) =>
    (await http.post<MyRosterAssignment>(`/api/events/${eventId}/roster/assignments/${assignmentId}/response`, { response, notes })).data,
}
