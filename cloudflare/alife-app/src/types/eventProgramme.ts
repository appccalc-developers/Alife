import type { EventModuleStatus, EventPlanText } from './eventPlan'

export type EventProgrammeItemStatus = 'draft' | 'ready' | 'completed'
export type EventRosterAssignmentStatus = 'confirmed' | 'accepted' | 'declined' | 'changeRequested' | 'cancelled'

export type EventProgrammeAssignee = {
  memberId: string
  displayName: string
  status: EventRosterAssignmentStatus
}

export type EventProgrammeRosterLink = {
  shiftId: string
  roleKey: string
  name: EventPlanText
  assignees: EventProgrammeAssignee[]
}

export type EventProgrammeItem = {
  id: string
  eventOccurrenceId: string | null
  rosterShiftId: string | null
  ownerMemberId: string | null
  ownerDisplayName: string | null
  sortOrder: number
  startUtc: string
  endUtc: string
  title: EventPlanText
  instructions: EventPlanText
  requiresHandover: boolean
  handover: EventPlanText
  status: EventProgrammeItemStatus
  canBeReady: boolean
  roster: EventProgrammeRosterLink | null
  updatedUtc: string
}

export type EventProgrammeWorkspace = {
  eventId: string
  groupId: string
  eventTitle: EventPlanText
  eventStartUtc: string
  eventEndUtc: string
  status: EventModuleStatus
  occurrences: Array<{ id: string; name: EventPlanText; startUtc: string; endUtc: string; timeZoneId: string }>
  members: Array<{ id: string; displayName: string }>
  rosterOptions: Array<{ shiftId: string; name: EventPlanText; startUtc: string; endUtc: string; assignees: EventProgrammeAssignee[] }>
  items: EventProgrammeItem[]
}

export type SaveEventProgrammeItemPayload = {
  eventOccurrenceId: string | null
  rosterShiftId: string | null
  ownerMemberId: string | null
  sortOrder: number
  startUtc: string
  endUtc: string
  titleEn: string
  titleZh: string
  instructionsEn: string
  instructionsZh: string
  requiresHandover: boolean
  handoverEn: string
  handoverZh: string
  status: EventProgrammeItemStatus
}
