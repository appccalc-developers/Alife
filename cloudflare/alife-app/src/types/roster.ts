export type SchedulingUnavailableWindow = {
  daysOfWeek: number[]
  startLocalTime: string
  endLocalTime: string
  reason: string
}

export type SelfSchedulingProfile = {
  groupId: string
  memberId: string
  preferredRoleKeys: string[]
  unavailableWindows: SchedulingUnavailableWindow[]
  maxAssignmentsPerDay: number
  selfNotes: string
  updatedUtc?: string | null
}

export type ManagerQualification = {
  key: string
  validUntilUtc?: string | null
}

export type RosterCapability = {
  id: string
  groupId: string
  key: string
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  requiresExpiry: boolean
  defaultValidityDays?: number | null
  isActive: boolean
  updatedUtc: string
}

export type RosterMember = {
  memberId: string
  displayName: string
  preferredRoleKeys: string[]
  unavailableWindows: SchedulingUnavailableWindow[]
  maxAssignmentsPerDay: number
  selfNotes: string
  managerLabels: string[]
  managerNotes: string
  managerUnavailableWindows: SchedulingUnavailableWindow[]
  managerConfirmationStatus: 'notSet' | 'pending' | 'confirmed'
  managerConfirmationMethod: '' | 'inPerson' | 'phone' | 'memberPortal' | 'authorizedCarer' | 'legacy'
  managerConfirmedUtc?: string | null
  managerReviewDueUtc?: string | null
  managerQualifications: ManagerQualification[]
}

export type RosterAssignment = {
  id: string
  memberId: string
  displayName: string
  status: 'confirmed' | 'cancelled' | 'accepted' | 'declined' | 'changeRequested'
  basedOnSmartSuggestion: boolean
  confirmationNotes: string
  confirmedUtc: string
  memberResponseNotes: string
  respondedUtc?: string | null
}

export type RosterShift = {
  id: string
  roleKey: string
  name: { en: string; zh: string }
  startUtc: string
  endUtc: string
  requiredPeople: number
  requiredLabels: string[]
  notes: string
  assignments: RosterAssignment[]
}

export type EventRosterWorkspace = {
  eventId: string
  groupId: string
  eventTitle: { en: string; zh: string }
  eventStartUtc: string
  eventEndUtc: string
  capabilityCatalog: RosterCapability[]
  members: RosterMember[]
  shifts: RosterShift[]
}

export type RosterCandidateSuggestion = {
  memberId: string
  displayName: string
  score: number
  eligible: boolean
  reasons: Array<{
    code: string
    text: { en: string; zh: string }
    severity: 'conflict' | 'positive' | 'info'
  }>
  recentAssignmentCount: number
  pastSameRoleCount: number
  consecutiveServiceWeeks: number
  lastAssignedUtc?: string | null
}

export type RosterPlanAssignmentSuggestion = {
  shiftId: string
  memberId: string
  displayName: string
  score: number
  recentAssignmentCount: number
  pastSameRoleCount: number
  consecutiveServiceWeeks: number
  reasons: RosterCandidateSuggestion['reasons']
}

export type RosterPlanShiftSuggestion = {
  shiftId: string
  roleKey: string
  name: { en: string; zh: string }
  startUtc: string
  endUtc: string
  requiredPeople: number
  alreadyProposedOrAccepted: number
  suggestedAssignments: RosterPlanAssignmentSuggestion[]
  unfilledCount: number
  gapExplanation?: { en: string; zh: string } | null
}

export type RosterPlanScheme = {
  key: 'balanced' | 'experienced'
  name: { en: string; zh: string }
  description: { en: string; zh: string }
  filledCount: number
  unfilledCount: number
  shifts: RosterPlanShiftSuggestion[]
}

export type EventRosterPlanOptions = {
  eventId: string
  generatedUtc: string
  schemes: RosterPlanScheme[]
}

export type SaveManagerSchedulingProfilePayload = {
  managerLabels: string[]
  managerNotes: string
  unavailableWindows: SchedulingUnavailableWindow[]
  confirmationStatus: 'pending' | 'confirmed'
  confirmationMethod: '' | 'inPerson' | 'phone' | 'memberPortal' | 'authorizedCarer'
  reviewDueUtc?: string | null
  qualifications: ManagerQualification[]
}

export type SaveRosterCapabilityPayload = {
  key: string
  nameEn: string
  nameZh: string
  descriptionEn: string
  descriptionZh: string
  requiresExpiry: boolean
  defaultValidityDays?: number | null
  isActive: boolean
}

export type MyRosterAssignment = {
  id: string
  shiftId: string
  roleKey: string
  shiftName: { en: string; zh: string }
  startUtc: string
  endUtc: string
  status: RosterAssignment['status']
  confirmedUtc: string
  memberResponseNotes: string
  respondedUtc?: string | null
}

export type MyEventRosterWorkspace = {
  eventId: string
  groupId: string
  eventTitle: { en: string; zh: string }
  assignments: MyRosterAssignment[]
}

export type RosterMemberResponse = 'accept' | 'decline' | 'requestChange'

export type SaveRosterShiftPayload = {
  roleKey: string
  nameEn: string
  nameZh: string
  startUtc: string
  endUtc: string
  requiredPeople: number
  requiredLabels: string[]
  notes: string
}
