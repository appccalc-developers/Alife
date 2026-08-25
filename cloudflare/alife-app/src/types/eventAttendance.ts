export type EventAttendanceText = { en: string; zh: string }

export type EventAttendanceOccurrence = {
  id: string
  name: EventAttendanceText
  startUtc: string
  endUtc: string
  timeZoneId: string
  canRecord: boolean
  attendedUnits: number
}

export type EventAttendanceEnrollment = {
  id: string
  applicantName: string
  reservedUnits: number
}

export type EventAttendanceRecord = {
  id: string
  eventOccurrenceId: string
  eventEnrollmentId?: string | null
  attendedUnits: number
  notes: string
  updatedUtc: string
}

export type EventAttendanceWorkspace = {
  eventId: string
  groupId: string
  title: EventAttendanceText
  capacityUnit: string
  occurrences: EventAttendanceOccurrence[]
  enrollments: EventAttendanceEnrollment[]
  records: EventAttendanceRecord[]
  totalAttendedUnits: number
  totalRegisteredUnits: number
}

export type SaveEventAttendanceRecord = {
  eventOccurrenceId: string
  eventEnrollmentId?: string | null
  attendedUnits: number
  notes: string
}
