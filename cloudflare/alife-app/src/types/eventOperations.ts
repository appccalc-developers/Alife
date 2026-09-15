import type { LocalizedText } from './eventComposition'

export type EventOccurrence = { id: string; eventId: string; startUtc: string; endUtc: string; localDate: string; status: string; isLegacyBackfill: boolean }
export type EventTeamMemberStatus = 'invited' | 'accepted' | 'declined' | 'ended'
export type EventTaskStatus = 'todo' | 'inProgress' | 'blocked' | 'done' | 'cancelled'
export type EventTeamMember = { id: string; eventId: string; memberId: string; displayName: string; status: EventTeamMemberStatus; joinedUtc?: string | null; declinedUtc?: string | null; endedUtc?: string | null }
export type EventRoleAssignment = { id: string; roleRequirementKey: string; memberId: string; status: EventTeamMemberStatus; acceptedUtc?: string | null; declinedUtc?: string | null; endedUtc?: string | null }
export type EventTaskApprovalStatus = 'notRequired' | 'notSubmitted' | 'pendingReview' | 'approved' | 'returned'
export type EventTask = { assignmentStatus?: 'unassigned' | 'invited' | 'accepted' | 'declined'; assignmentRespondedUtc?: string | null; preparation?: LocalizedText; preparationUpdatedUtc?: string | null; preparationPublicationCandidate?: boolean; stage?: string; eventOccurrenceId?: string | null; reviewerMemberId?: string | null; approvalStatus?: EventTaskApprovalStatus; approvalRound?: number; sourceType?: string | null; sourceId?: string | null; id: string; eventId: string; workflowStepId?: string | null; title: LocalizedText; description: LocalizedText; assignedMemberId?: string | null; status: EventTaskStatus; isRequired: boolean; requiresApproval: boolean; isRestricted: boolean; dueUtc?: string | null; completedUtc?: string | null; eTag: string; dependencies: Array<{ id: string; dependsOnEventTaskId: string; dependencyType: string }>; blockers: Array<{ id: string; reason: string; resolvedUtc?: string | null }> }
export type EventTeamWorkspace = { enabledModules?: Array<{ moduleCode: string; label: LocalizedText }>; members: EventTeamMember[]; roles: EventRoleAssignment[]; tasks: EventTask[]; roleRequirements: Array<{ moduleCode?: string; eligibility?: string[]; separationFrom?: string[]; requirementKey: string; roleCode: string; minimum: number; recommended: number; maximum?: number | null }>; readinessBlockers: LocalizedText[]; canManage: boolean; canConfigure?: boolean }

export type EventProgramItem = { id: string; sessionId: string; title: LocalizedText; description: LocalizedText; sortOrder: number; startOffsetMinutes: number; durationMinutes: number; ownerMemberId?: string | null }
export type EventSession = { id: string; occurrenceId: string; title: LocalizedText; startUtc: string; endUtc: string; placeJson: string; leadMemberId?: string | null; status: 'draft' | 'confirmed' | 'cancelled'; items: EventProgramItem[] }
export type EventProgramme = { eventId: string; occurrenceId: string; eTag: string; sessions: EventSession[]; canManage: boolean }

export type EventAvailabilityStatus = 'unknown' | 'available' | 'unavailable' | 'preferNot'
export type EventRosterAssignment = { id: string; serviceSlotId: string; memberId: string; status: 'invited' | 'confirmed' | 'declined' | 'ended'; replacesAssignmentId?: string | null }
export type EventServiceSlot = { id: string; occurrenceId: string; sessionId?: string | null; programItemId?: string | null; zoneId?: string | null; roleCode: string; roleLabel?: LocalizedText | null; startUtc: string; endUtc: string; requiredCount: number; eligibilityCode: string; confirmedCount: number; assignments: EventRosterAssignment[]; myAvailability?: EventAvailabilityStatus | null; moduleCode?: string; candidateMemberIds?: string[]; isRosterCandidate?: boolean; canAssign?: boolean }
export type EventRoster = { eventId: string; occurrenceId: string; eTag: string; slots: EventServiceSlot[]; readinessBlockers: LocalizedText[]; canManage: boolean; canConfigure?: boolean }

export type EventRosterGroup = { roleCode: string; moduleCode: string; memberIds: string[]; eTag: string }

export type EventRosterBatchChange = { occurrenceId: string; slotId: string; occurrenceETag: string; candidateGroupETag: string; memberId: string | null; replacesAssignmentId?: string | null }
export type EventRosterPage = { page: number; pageSize: number; total: number; timeZone: string; canManage: boolean; canConfigure: boolean; isRecurring: boolean; defaultsVersion: number | null; defaultsETag: string;
  occurrences: Array<{ id: string; startUtc: string; endUtc: string; roster: EventRoster }>; groups: EventRosterGroup[]; people: Array<{ id: string; displayName: string }> }

export type EventTaskDetail = { canRespond?: boolean; canPrepare?: boolean;
  participants?: Array<{ id: string; name: string }>; task: EventTask; canManage: boolean; canSubmit: boolean; canWithdraw: boolean; canReview: boolean; history: Array<{ id: string; round: number; action: string; actorMemberId: string; reviewerMemberId?: string; snapshotJson: string; reason: string; createdUtc: string }> }
