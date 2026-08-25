import type { GroupEventRecord } from '../types/event'

export type EventLifecycle = 'past' | 'upcoming' | 'planning'
export type EventPreparationModuleKey = 'venue' | 'registration' | 'finance' | 'ram' | 'roster' | 'programme'

type EventLifecycleData = {
  registrationDeadline?: unknown
  maxCapacity?: unknown
  description?: { en?: unknown; zh?: unknown }
  locationName?: { en?: unknown; zh?: unknown }
  posterImageUrl?: unknown
  publicationStatus?: unknown
  enabledModules?: unknown
  requiresRoster?: unknown
  baseFeePerAdult?: unknown
  baseFeePerChild?: unknown
  optionalActivities?: unknown
  hardConstraints?: unknown
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
  const enabledModules = Array.isArray(event.enabledModules)
    ? event.enabledModules.filter((value) => typeof value === 'string')
    : Array.isArray(data.enabledModules)
      ? data.enabledModules.filter((value): value is string => typeof value === 'string')
      : null
  const inferredModules: EventPreparationModuleKey[] = []
  if (maxCapacity > 0 || validTime(registrationDeadline) !== null) inferredModules.push('registration')
  const hasBaseFee = [data.baseFeePerAdult, data.baseFeePerChild]
    .some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
  const hasFeeOption = Array.isArray(data.optionalActivities) && data.optionalActivities.some((value) => {
    if (!value || typeof value !== 'object') return false
    const fee = (value as { extraFee?: unknown }).extraFee
    return typeof fee === 'number' && Number.isFinite(fee) && fee > 0
  })
  if (hasBaseFee || hasFeeOption) inferredModules.push('finance')
  if ((Array.isArray(data.hardConstraints) && data.hardConstraints.length > 0) || event.requiresRam === true) inferredModules.push('ram')
  if (data.requiresRoster === true) inferredModules.push('roster')
  const registrationEnabled = enabledModules?.includes('registration') ?? inferredModules.includes('registration')

  return {
    registrationDeadline,
    registrationDeadlineTime: validTime(registrationDeadline),
    acceptsEnrollments: registrationEnabled
      && maxCapacity > 0
      && validTime(registrationDeadline) !== null
      && (!(event.requiresRam ?? true) || event.ramStatus === 'approved'),
    descriptionEn: typeof data.description?.en === 'string' ? data.description.en : '',
    descriptionZh: typeof data.description?.zh === 'string' ? data.description.zh : '',
    locationEn: typeof data.locationName?.en === 'string' ? data.locationName.en : '',
    locationZh: typeof data.locationName?.zh === 'string' ? data.locationName.zh : '',
    posterImageUrl: typeof data.posterImageUrl === 'string' ? data.posterImageUrl.trim() : '',
    publicationStatus: data.publicationStatus === 'published' ? 'published' : 'draft',
    enabledModules,
    inferredModules,
    requiresRoster: data.requiresRoster === true,
  }
}

export const eventUsesPreparationModule = (
  data: Pick<ReturnType<typeof readEventLifecycleData>, 'enabledModules' | 'inferredModules'> | null,
  moduleKey: EventPreparationModuleKey,
) => {
  if (!data) return false
  if (data.enabledModules === null) return data.inferredModules.includes(moduleKey)
  return data.enabledModules.includes(moduleKey)
}

export const getEventLifecycle = (event: GroupEventRecord, now = Date.now()): EventLifecycle => {
  const publicationStatus = readEventLifecycleData(event).publicationStatus
  if (publicationStatus !== 'published' && event.ramStatus !== 'approved') return 'planning'

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
