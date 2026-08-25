export type ClosureLearning = {
  id: string
  title: { en: string; zh: string }
  detail: { en: string; zh: string }
  reuseNextTime: boolean
}

export type ClosureSourceLearning = {
  eventId: string
  eventTitle: { en: string; zh: string }
  eventEndUtc: string
  learning: ClosureLearning
}

export type EventClosureWorkspace = {
  eventId: string
  groupId: string
  eventTitle: { en: string; zh: string }
  eventEndUtc: string
  eventHasEnded: boolean
  evidence: {
    enrollmentSubmissions: number
    acceptedRosterAssignments: number
    requiredRosterAssignments: number
    memberReviews: number
    actualAttendanceUnits: number
    attendanceRecorded: boolean
    actualIncome: number
    actualExpense: number
    financeReconciled: boolean
  }
  report: {
    summary: { en: string; zh: string }
    attendanceNotes: string
    financeNotes: string
    incidentNotes: string
    followUpNotes: string
    learnings: ClosureLearning[]
    leaderConfirmed: boolean
    confirmedByMemberId?: string | null
    confirmedByDisplayName?: string | null
    confirmedUtc?: string | null
    updatedUtc?: string | null
  }
  previousLearnings: ClosureSourceLearning[]
}

export type UpdateEventClosurePayload = {
  summaryEn: string
  summaryZh: string
  attendanceNotes: string
  financeNotes: string
  incidentNotes: string
  followUpNotes: string
  learnings: ClosureLearning[]
  leaderConfirmed: boolean
}

export type GeneratedEventClosureDraft = {
  summary: { en: string; zh: string }
  attendanceNotes: string
  financeNotes: string
  incidentNotes: string
  followUpNotes: string
  learnings: ClosureLearning[]
  leaderConfirmed: false
}

export type GenerateEventClosureDraftResponse = {
  draft: GeneratedEventClosureDraft
  model: string
  requiresLeaderConfirmation: true
}
