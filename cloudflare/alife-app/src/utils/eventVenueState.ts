type EventVenueReadinessView = {
  capacitySufficient: boolean
  bookingsConfirmed: boolean
  conflictsResolved: boolean
}

export const intervalsOverlap = (start: string, end: string, otherStart: string, otherEnd: string) =>
  new Date(start).getTime() < new Date(otherEnd).getTime() && new Date(otherStart).getTime() < new Date(end).getTime()

export const venueCapacityLabel = (required: number, capacity: number) => `${required}/${capacity}`

export const venueReadinessItems = (value: EventVenueReadinessView) => [
  { code: 'capacity-sufficient', ready: value.capacitySufficient },
  { code: 'bookings-confirmed', ready: value.bookingsConfirmed },
  { code: 'conflicts-resolved', ready: value.conflictsResolved },
] as const
