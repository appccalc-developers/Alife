import type { LocalizedText } from './eventComposition'

export type EventOccurrence = { id: string; eventId: string; startUtc: string; endUtc: string; localDate: string; status: string; isLegacyBackfill: boolean }
export type EventTeamMemberStatus = 'invited' | 'accepted' | 'declined' | 'ended'
export type EventTaskStatus = 'todo' | 'inProgress' | 'blocked' | 'done' | 'cancelled'
export type EventTeamMember = { id: string; eventId: string; memberId: string; displayName: string; status: EventTeamMemberStatus; joinedUtc?: string | null; declinedUtc?: string | null; endedUtc?: string | null }
export type EventRoleAssignment = { id: string; roleRequirementKey: string; memberId: string; status: EventTeamMemberStatus; acceptedUtc?: string | null; declinedUtc?: string | null; endedUtc?: string | null }
export type EventTaskApprovalStatus = 'notRequired' | 'notSubmitted' | 'pendingReview' | 'approved' | 'returned'
export type EventTask = { reviewerMemberId?: string | null; approvalStatus?: EventTaskApprovalStatus; approvalRound?: number; sourceType?: string | null; sourceId?: string | null; id: string; eventId: string; workflowStepId?: string | null; title: LocalizedText; description: LocalizedText; assignedMemberId?: string | null; status: EventTaskStatus; isRequired: boolean; requiresApproval: boolean; isRestricted: boolean; dueUtc?: string | null; completedUtc?: string | null; eTag: string; dependencies: Array<{ id: string; dependsOnEventTaskId: string; dependencyType: string }>; blockers: Array<{ id: string; reason: string; resolvedUtc?: string | null }> }
export type EventTeamWorkspace = { members: EventTeamMember[]; roles: EventRoleAssignment[]; tasks: EventTask[]; roleRequirements: Array<{ requirementKey: string; roleCode: string; minimum: number; recommended: number; maximum?: number | null }>; readinessBlockers: LocalizedText[]; canManage: boolean }

export type EventProgramItem = { id: string; sessionId: string; title: LocalizedText; description: LocalizedText; sortOrder: number; startOffsetMinutes: number; durationMinutes: number; ownerMemberId?: string | null }
export type EventSession = { id: string; occurrenceId: string; title: LocalizedText; startUtc: string; endUtc: string; placeJson: string; leadMemberId?: string | null; status: 'draft' | 'confirmed' | 'cancelled'; items: EventProgramItem[] }
export type EventProgramme = { eventId: string; occurrenceId: string; eTag: string; sessions: EventSession[]; canManage: boolean }

export type EventAvailabilityStatus = 'unknown' | 'available' | 'unavailable' | 'preferNot'
export type EventRosterAssignment = { id: string; serviceSlotId: string; memberId: string; status: 'invited' | 'confirmed' | 'declined' | 'ended'; replacesAssignmentId?: string | null }
export type EventServiceSlot = { id: string; occurrenceId: string; sessionId?: string | null; programItemId?: string | null; zoneId?: string | null; roleCode: string; roleLabel?: LocalizedText | null; startUtc: string; endUtc: string; requiredCount: number; eligibilityCode: string; confirmedCount: number; assignments: EventRosterAssignment[]; myAvailability?: EventAvailabilityStatus | null; moduleCode?: string; candidateMemberIds?: string[]; isRosterCandidate?: boolean }
export type EventRoster = { eventId: string; occurrenceId: string; eTag: string; slots: EventServiceSlot[]; readinessBlockers: LocalizedText[]; canManage: boolean }

export type EventRosterGroup = { roleCode: string; moduleCode: string; memberIds: string[]; eTag: string }

export type EventTaskDetail = {
  participants?: Array<{ id: string; name: string }>; task: EventTask; canManage: boolean; canSubmit: boolean; canWithdraw: boolean; canReview: boolean; history: Array<{ id: string; round: number; action: string; actorMemberId: string; reviewerMemberId?: string; snapshotJson: string; reason: string; createdUtc: string }> }
