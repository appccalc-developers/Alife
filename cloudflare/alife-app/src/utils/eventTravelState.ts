import type { EventTravelReadiness } from '../types/eventTravel'

export const travelReadinessItems = (value: EventTravelReadiness) => [
  { code: 'transport-and-stay-facts-confirmed', ready: value.transportFactsConfirmed && value.ramTransportChecksComplete },
  { code: 'drivers-and-vehicles-qualified', ready: value.driversAndVehiclesQualified },
  { code: 'manifests-and-night-roles-complete', ready: value.passengerManifestsComplete },
] as const

export const passengerCapacity = (count: number, seats?: number | null) => ({
  count,
  seats: seats ?? null,
  full: typeof seats === 'number' && count >= seats,
  exceeded: typeof seats === 'number' && count > seats,
})

export const resolveTravelLoadFailure = (status?: number) => status === 403 ? 'permission-denied' as const : 'error' as const

export const resolveTravelMutationFailure = (status?: number) =>
  status === 412 ? 'stale' as const : status === 409 ? 'conflict' as const : 'error' as const
