import { http } from './http'
import type { LocalizedText } from '../types/eventComposition'
import type { EventAvailabilityStatus, EventOccurrence, EventProgramme, EventRoster, EventTask, EventTaskStatus, EventTeamMember, EventTeamWorkspace } from '../types/eventOperations'

const ifMatch = (eTag: string) => ({ headers: { 'If-Match': eTag } })

export const eventOperationsService = {
  listOccurrences: async (eventId: string) => (await http.get<EventOccurrence[]>(`/api/events/${eventId}/occurrences`)).data,
  getTeam: async (eventId: string) => (await http.get<EventTeamWorkspace>(`/api/events/${eventId}/team`)).data,
  inviteTeamMember: async (eventId: string, memberId: string) => (await http.post<EventTeamMember>(`/api/events/${eventId}/team/members`, { memberId })).data,
  respondToTeamInvite: async (eventId: string, teamMemberId: string, accept: boolean) => (await http.post<EventTeamMember>(`/api/events/${eventId}/team/members/${teamMemberId}/${accept ? 'accept' : 'decline'}`)).data,
  respondToRoleInvitation: async (eventId: string, assignmentId: string, accept: boolean) => (await http.post(`/api/events/${eventId}/role-assignments/${assignmentId}/${accept ? 'accept' : 'decline'}`)).data,
  createRoleInvitation: async (eventId: string, roleRequirementKey: string, memberId: string) => (await http.post(`/api/events/${eventId}/role-assignments`, { roleRequirementKey, memberId, scopeType: 'event' }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data,
  createTask: async (eventId: string, request: { title: LocalizedText; description: LocalizedText; assignedMemberId?: string | null; dueUtc?: string | null; isRequired: boolean; requiresApproval: boolean; isRestricted: boolean }) => (await http.post<EventTask>(`/api/events/${eventId}/tasks`, request)).data,
  updateTask: async (eventId: string, task: EventTask, status: EventTaskStatus) => (await http.put<EventTask>(`/api/events/${eventId}/tasks/${task.id}`, {
    title: task.title, description: task.description, assignedMemberId: task.assignedMemberId, dueUtc: task.dueUtc,
    status, isRequired: task.isRequired, requiresApproval: task.requiresApproval, isRestricted: task.isRestricted,
  }, ifMatch(task.eTag))).data,
  addTaskDependency: async (eventId: string, taskId: string, dependsOnEventTaskId: string) => (await http.post<EventTask>(`/api/events/${eventId}/tasks/${taskId}/dependencies`, { dependsOnEventTaskId, dependencyType: 'finishToStart' })).data,
  addTaskBlocker: async (eventId: string, taskId: string, reason: string) => (await http.post<EventTask>(`/api/events/${eventId}/tasks/${taskId}/blockers`, { reason })).data,
  resolveTaskBlocker: async (eventId: string, taskId: string, blockerId: string, resolution: string) => (await http.post<EventTask>(`/api/events/${eventId}/tasks/${taskId}/blockers/${blockerId}/resolve`, { resolution })).data,
  getProgramme: async (eventId: string, occurrenceId: string) => (await http.get<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme`)).data,
  createSession: async (eventId: string, occurrenceId: string, eTag: string, request: { title: LocalizedText; startUtc: string; endUtc: string; placeJson: string; leadMemberId?: string | null; status: string }) => (await http.post<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/sessions`, request, ifMatch(eTag))).data,
  updateSession: async (eventId: string, occurrenceId: string, sessionId: string, eTag: string, request: { title: LocalizedText; startUtc: string; endUtc: string; placeJson: string; leadMemberId?: string | null; status: string }) => (await http.put<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/sessions/${sessionId}`, request, ifMatch(eTag))).data,
  deleteSession: async (eventId: string, occurrenceId: string, sessionId: string, eTag: string) => (await http.delete<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/sessions/${sessionId}`, ifMatch(eTag))).data,
  createProgramItem: async (eventId: string, occurrenceId: string, sessionId: string, eTag: string, request: { title: LocalizedText; description: LocalizedText; startOffsetMinutes: number; durationMinutes: number; ownerMemberId?: string | null }) => (await http.post<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/sessions/${sessionId}/items`, request, ifMatch(eTag))).data,
  updateProgramItem: async (eventId: string, occurrenceId: string, itemId: string, eTag: string, request: { title: LocalizedText; description: LocalizedText; startOffsetMinutes: number; durationMinutes: number; ownerMemberId?: string | null }) => (await http.put<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/items/${itemId}`, request, ifMatch(eTag))).data,
  deleteProgramItem: async (eventId: string, occurrenceId: string, itemId: string, eTag: string) => (await http.delete<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/items/${itemId}`, ifMatch(eTag))).data,
  reorderProgramItems: async (eventId: string, occurrenceId: string, sessionId: string, eTag: string, itemIds: string[]) => (await http.post<EventProgramme>(`/api/events/${eventId}/occurrences/${occurrenceId}/programme/sessions/${sessionId}/reorder`, { itemIds }, ifMatch(eTag))).data,
  getRoster: async (eventId: string, occurrenceId: string) => (await http.get<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster`)).data,
  createSlot: async (eventId: string, occurrenceId: string, eTag: string, request: { sessionId?: string | null; programItemId?: string | null; roleCode: string; startUtc: string; endUtc: string; requiredCount: number; eligibilityCode: string }) => (await http.post<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/slots`, request, ifMatch(eTag))).data,
  updateSlot: async (eventId: string, occurrenceId: string, slotId: string, eTag: string, request: { sessionId?: string | null; programItemId?: string | null; zoneId?: string | null; roleCode: string; startUtc: string; endUtc: string; requiredCount: number; eligibilityCode: string }) => (await http.put<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/slots/${slotId}`, request, ifMatch(eTag))).data,
  deleteSlot: async (eventId: string, occurrenceId: string, slotId: string, eTag: string) => (await http.delete<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/slots/${slotId}`, ifMatch(eTag))).data,
  setAvailability: async (eventId: string, occurrenceId: string, slotId: string, status: EventAvailabilityStatus) => (await http.put<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/slots/${slotId}/availability/me`, { status })).data,
  assignRosterMember: async (eventId: string, occurrenceId: string, slotId: string, eTag: string, memberId: string, replacesAssignmentId?: string) => (await http.post<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/slots/${slotId}/assignments`, { memberId, replacesAssignmentId }, ifMatch(eTag))).data,
  respondToRosterAssignment: async (eventId: string, occurrenceId: string, assignmentId: string, confirm: boolean) => (await http.post<EventRoster>(`/api/events/${eventId}/occurrences/${occurrenceId}/roster/assignments/${assignmentId}/${confirm ? 'confirm' : 'decline'}`)).data,
}
