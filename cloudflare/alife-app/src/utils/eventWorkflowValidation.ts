export type VenueDraftValidationCode =
  | 'occurrenceRequired'
  | 'spaceRequired'
  | 'purposeRequired'
  | 'invalidTime'
  | 'endBeforeStart'
  | 'outsideOccurrence'
  | 'attendanceRequired'
  | 'capacityExceeded'

export type RosterShiftValidationCode =
  | 'roleRequired'
  | 'nameRequired'
  | 'invalidTime'
  | 'endBeforeStart'
  | 'outsideEvent'
  | 'peopleRequired'

const instant = (value: string) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const validateVenueDraft = (value: {
  occurrenceRequired: boolean
  occurrenceId: string
  occurrenceStartUtc?: string
  occurrenceEndUtc?: string
  venueSpaceId: string
  purposeEn: string
  purposeZh: string
  startLocal: string
  endLocal: string
  attendeeCount: number
  spaceCapacity?: number
}): VenueDraftValidationCode | null => {
  if (value.occurrenceRequired && !value.occurrenceId) return 'occurrenceRequired'
  if (!value.venueSpaceId) return 'spaceRequired'
  if (!value.purposeEn.trim() && !value.purposeZh.trim()) return 'purposeRequired'
  const start = instant(value.startLocal)
  const end = instant(value.endLocal)
  if (start === null || end === null) return 'invalidTime'
  if (end <= start) return 'endBeforeStart'
  const occurrenceStart = value.occurrenceStartUtc ? instant(value.occurrenceStartUtc) : null
  const occurrenceEnd = value.occurrenceEndUtc ? instant(value.occurrenceEndUtc) : null
  if ((occurrenceStart !== null && start < occurrenceStart) || (occurrenceEnd !== null && end > occurrenceEnd)) return 'outsideOccurrence'
  if (!Number.isInteger(value.attendeeCount) || value.attendeeCount < 1) return 'attendanceRequired'
  if (typeof value.spaceCapacity === 'number' && value.attendeeCount > value.spaceCapacity) return 'capacityExceeded'
  return null
}

export const validateRosterShift = (value: {
  roleKey: string
  nameEn: string
  nameZh: string
  startLocal: string
  endLocal: string
  requiredPeople: number
  eventStartUtc: string
  eventEndUtc: string
}): RosterShiftValidationCode | null => {
  if (!value.roleKey.trim()) return 'roleRequired'
  if (!value.nameEn.trim() && !value.nameZh.trim()) return 'nameRequired'
  const start = instant(value.startLocal)
  const end = instant(value.endLocal)
  if (start === null || end === null) return 'invalidTime'
  if (end <= start) return 'endBeforeStart'
  const eventStart = instant(value.eventStartUtc)
  const eventEnd = instant(value.eventEndUtc)
  if (eventStart === null || eventEnd === null || start < eventStart || end > eventEnd) return 'outsideEvent'
  if (!Number.isInteger(value.requiredPeople) || value.requiredPeople < 1 || value.requiredPeople > 100) return 'peopleRequired'
  return null
}
