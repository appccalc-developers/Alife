import type { GroupEventRecord } from '../types/event'

export type EventLifecycle = 'past' | 'upcoming' | 'planning'

type EventLifecycleData = {
  registrationDeadline?: unknown
  maxCapacity?: unknown
  description?: { en?: unknown; zh?: unknown }
  locationName?: { en?: unknown; zh?: unknown }
  posterImageUrl?: unknown
}

const validTime = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export const readEventLifecycleData = (event: GroupEventRecord) => {
  let data: EventLifecycleData = {}

  try {
    const parsed = JSON.parse(event.eventDataJson) as unknown
    if (parsed && typeof parsed === 'object') data = parsed as EventLifecycleData
  } catch {
    // Summary row fields still provide enough information to show the event.
  }

  const registrationDeadline = typeof data.registrationDeadline === 'string'
    ? data.registrationDeadline
    : ''
  const maxCapacity = typeof data.maxCapacity === 'number' && Number.isFinite(data.maxCapacity)
    ? data.maxCapacity
    : 0

  return {
    registrationDeadline,
    registrationDeadlineTime: validTime(registrationDeadline),
    acceptsEnrollments: maxCapacity > 0 && validTime(registrationDeadline) !== null,
    descriptionEn: typeof data.description?.en === 'string' ? data.description.en : '',
    descriptionZh: typeof data.description?.zh === 'string' ? data.description.zh : '',
    locationEn: typeof data.locationName?.en === 'string' ? data.locationName.en : '',
    locationZh: typeof data.locationName?.zh === 'string' ? data.locationName.zh : '',
    posterImageUrl: typeof data.posterImageUrl === 'string' ? data.posterImageUrl.trim() : '',
  }
}

export const getEventLifecycle = (event: GroupEventRecord, now = Date.now()): EventLifecycle => {
  if (event.ramStatus !== 'approved') return 'planning'

  const startTime = validTime(event.startDate)
  const endTime = validTime(event.endDate) ?? startTime
  if (endTime !== null && endTime < now) return 'past'

  return 'upcoming'
}

export const sortEventsByLatestStart = (events: GroupEventRecord[]) =>
  [...events].sort((left, right) => {
    const rightTime = validTime(right.startDate) ?? 0
    const leftTime = validTime(left.startDate) ?? 0
    return rightTime - leftTime
  })
