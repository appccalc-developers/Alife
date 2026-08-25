import type { LocalizedText } from './models'

export type VenueBookingStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled'

export type VenueSpaceDto = {
  id: string
  name: LocalizedText
  capacity: number
  resourcesJson: string
  bookingPolicyJson: string
  isActive: boolean
}

export type VenueDto = {
  id: string
  churchGroupId: string
  name: LocalizedText
  description: LocalizedText
  address: LocalizedText
  timeZoneId: string
  isActive: boolean
  updatedUtc: string
  spaces: VenueSpaceDto[]
}

export type VenueBookingDto = {
  id: string
  eventId: string
  eventOccurrenceId: string | null
  eventOccurrenceName: LocalizedText | null
  venueSpaceId: string
  venueId: string
  venueName: LocalizedText
  spaceName: LocalizedText
  eventTitle: LocalizedText
  purpose: LocalizedText
  notes: string
  decisionNotes: string
  startUtc: string
  endUtc: string
  attendeeCount: number
  status: VenueBookingStatus
  requestedByMemberId: string
  requestedByDisplayName: string | null
  submittedByMemberId: string | null
  submittedByDisplayName: string | null
  reviewedByMemberId: string | null
  reviewedByDisplayName: string | null
  submittedUtc: string | null
  reviewedUtc: string | null
  updatedUtc: string
}

export type EventVenueWorkspaceDto = {
  eventId: string
  groupId: string
  churchGroupId: string
  eventTitle: LocalizedText
  eventStartUtc: string
  eventEndUtc: string
  occurrences: Array<{
    id: string
    name: LocalizedText
    startUtc: string
    endUtc: string
    timeZoneId: string
    sortOrder: number
  }>
  venues: VenueDto[]
  bookings: VenueBookingDto[]
}

export type SaveVenuePayload = {
  churchGroupId: string
  nameEn: string
  nameZh: string
  descriptionEn: string
  descriptionZh: string
  addressEn: string
  addressZh: string
  timeZoneId: string
  isActive: boolean
  spaces: Array<{
    id?: string | null
    nameEn: string
    nameZh: string
    capacity: number
    resourcesJson: string
    bookingPolicyJson: string
    isActive: boolean
  }>
}

export type SaveVenueBookingPayload = {
  eventOccurrenceId?: string | null
  venueSpaceId: string
  purposeEn: string
  purposeZh: string
  notes: string
  startUtc: string
  endUtc: string
  attendeeCount: number
}
