import type { LocalizedText } from './eventComposition'

export type EventVenue = {
  id: string
  managingGroupId: string
  name: LocalizedText
  address: LocalizedText
  capacity: number
  isActive: boolean
  eTag: string
  createdUtc: string
  updatedUtc: string
}

export type EventVenueReservationStatus = 'confirmed' | 'released'

export type EventVenueReservation = {
  id: string
  venueId: string
  eventId: string
  eventOccurrenceId?: string | null
  venueName: LocalizedText
  venueCapacity: number
  startUtc: string
  endUtc: string
  requiredCapacity: number
  status: EventVenueReservationStatus
  reservedByMemberId: string
  releasedByMemberId?: string | null
  releasedUtc?: string | null
  eTag: string
  createdUtc: string
  updatedUtc: string
}

export type EventVenueConflict = {
  venueId: string
  venueName: LocalizedText
  startUtc: string
  endUtc: string
}

export type EventVenueWorkspace = {
  eventId: string
  managingGroupId: string
  venues: EventVenue[]
  reservations: EventVenueReservation[]
  conflicts: EventVenueConflict[]
  readiness: {
    capacitySufficient: boolean
    bookingsConfirmed: boolean
    conflictsResolved: boolean
    blockers: LocalizedText[]
  }
  canManage: boolean
  canManageCatalogue: boolean
  legacySessionPlacePreserved: boolean
}

export type SaveEventVenueRequest = {
  name: LocalizedText
  address: LocalizedText
  capacity: number
  isActive: boolean
}

export type ReserveEventVenueRequest = {
  venueId: string
  eventOccurrenceId?: string | null
  startUtc: string
  endUtc: string
  requiredCapacity: number
}
