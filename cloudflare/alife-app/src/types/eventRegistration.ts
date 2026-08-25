export type EventRegistrationEntry = {
  enrollmentId: string
  memberId: string
  applicantName: string
  reservedUnits: number
  updatedUtc: string
}

export type EventRegistrationWorkspace = {
  eventId: string
  groupId: string
  titleEn: string
  titleZh: string
  startUtc: string
  maxCapacity: number
  capacityUnit: 'People' | 'Families'
  registrationDeadlineUtc?: string | null
  status: 'notConfigured' | 'invalid' | 'open' | 'closed' | 'full'
  blockingReason: string
  enrollmentCount: number
  reservedUnits: number
  remainingUnits: number
  registrations: EventRegistrationEntry[]
}

export type UpdateEventRegistrationSettings = {
  maxCapacity: number
  capacityUnit: 'People' | 'Families'
  registrationDeadlineUtc?: string | null
}
