import type { LocalizedText } from './eventComposition'
import type { EventOccurrence } from './eventOperations'

export type EventTravelMemberOption = { memberId: string; displayName: string }

export type EventTravelDriver = {
  id: string
  eventId: string
  memberId: string
  memberDisplayName: string
  licenceClass: string
  licenceExpiresOn?: string | null
  licenceConfirmed: boolean
  fitToDriveConfirmed: boolean
  evidenceNotes: string
  isActive: boolean
  verifiedByMemberId: string
  verifiedUtc: string
  isEligible: boolean
  eTag: string
  createdUtc: string
  updatedUtc: string
}

export type SaveEventTravelDriverRequest = Omit<EventTravelDriver,
  'id' | 'eventId' | 'memberDisplayName' | 'verifiedByMemberId' | 'verifiedUtc' | 'isEligible' | 'eTag' | 'createdUtc' | 'updatedUtc'>

export type EventTravelVehicle = {
  id: string
  eventId: string
  name: LocalizedText
  registrationReference: string
  seatCapacity: number
  registrationConfirmed: boolean
  registrationExpiresOn?: string | null
  wofConfirmed: boolean
  wofExpiresOn?: string | null
  evidenceNotes: string
  isActive: boolean
  verifiedByMemberId: string
  verifiedUtc: string
  evidenceComplete: boolean
  eTag: string
  createdUtc: string
  updatedUtc: string
}

export type SaveEventTravelVehicleRequest = Omit<EventTravelVehicle,
  'id' | 'eventId' | 'verifiedByMemberId' | 'verifiedUtc' | 'evidenceComplete' | 'eTag' | 'createdUtc' | 'updatedUtc'>

export type EventTravelPickupStop = {
  id: string
  journeyId: string
  sortOrder: number
  name: LocalizedText
  address: LocalizedText
  pickupUtc: string
}

export type SaveEventTravelPickupStopRequest = Omit<EventTravelPickupStop, 'id' | 'journeyId'>

export type EventTravelPassenger = {
  id: string
  journeyId: string
  memberId: string
  memberDisplayName: string
  pickupStopId: string
  pickupStopName: LocalizedText
  pickupUtc: string
  assignedByMemberId: string
  assignedUtc: string
}

export type EventTravelJourneyStatus = 'planned' | 'confirmed' | 'cancelled'

export type EventTravelJourney = {
  id: string
  eventId: string
  eventOccurrenceId: string
  name: LocalizedText
  startUtc: string
  endUtc: string
  driver?: EventTravelDriver | null
  vehicle?: EventTravelVehicle | null
  pickupStops: EventTravelPickupStop[]
  passengerManifest: EventTravelPassenger[]
  passengerCount: number
  manifestConfirmed: boolean
  status: EventTravelJourneyStatus
  eTag: string
  createdUtc: string
  updatedUtc: string
}

export type EventTravelRamEvidence = {
  transportRequired?: boolean | null
  licensedDriverConfirmed?: boolean | null
  vehicleRegistrationConfirmed?: boolean | null
  vehicleWofConfirmed?: boolean | null
  status: 'draft' | 'awaitingReview' | 'approved'
  checksComplete: boolean
}

export type EventTravelReadiness = {
  transportFactsConfirmed: boolean
  driversAndVehiclesQualified: boolean
  passengerManifestsComplete: boolean
  ramTransportChecksComplete: boolean
  blockers: LocalizedText[]
}

export type EventTravelWorkspace = {
  eventId: string
  occurrences: EventOccurrence[]
  eligibleMembers: EventTravelMemberOption[]
  drivers: EventTravelDriver[]
  vehicles: EventTravelVehicle[]
  journeys: EventTravelJourney[]
  ramEvidence: EventTravelRamEvidence
  readiness: EventTravelReadiness
  canManage: boolean
  dataClassification: 'roleRestricted'
}

export type CreateEventTravelJourneyRequest = {
  eventOccurrenceId: string
  name: LocalizedText
  startUtc: string
  endUtc: string
  driverId?: string | null
  vehicleId?: string | null
}

export type UpdateEventTravelJourneyRequest = Omit<CreateEventTravelJourneyRequest, 'eventOccurrenceId'> & {
  manifestConfirmed: boolean
  status: EventTravelJourneyStatus
}

export type EventTravelMyJourney = {
  journeyId: string
  eventOccurrenceId: string
  name: LocalizedText
  startUtc: string
  endUtc: string
  driverDisplayName?: string | null
  vehicleName?: LocalizedText | null
  vehicleRegistrationReference?: string | null
  pickupStopName?: LocalizedText | null
  pickupStopAddress?: LocalizedText | null
  pickupUtc?: string | null
  status: EventTravelJourneyStatus
}

export type EventTravelMyJourneys = {
  eventId: string
  journeys: EventTravelMyJourney[]
  dataClassification: 'userSpecific'
}
