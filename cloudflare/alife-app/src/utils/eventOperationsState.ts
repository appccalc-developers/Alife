import type { EventOccurrence, EventServiceSlot, EventTask, EventTaskStatus } from '../types/eventOperations'

export const eventTaskStatuses: EventTaskStatus[] = ['todo', 'inProgress', 'blocked', 'done', 'cancelled']

export const groupEventTasks = (tasks: EventTask[]): Record<EventTaskStatus, EventTask[]> => ({
  todo: tasks.filter((task) => task.status === 'todo'),
  inProgress: tasks.filter((task) => task.status === 'inProgress'),
  blocked: tasks.filter((task) => task.status === 'blocked'),
  done: tasks.filter((task) => task.status === 'done'),
  cancelled: tasks.filter((task) => task.status === 'cancelled'),
})

export const selectOccurrenceId = (occurrences: EventOccurrence[], currentId?: string) =>
  occurrences.some((occurrence) => occurrence.id === currentId) ? currentId! : occurrences[0]?.id ?? ''

export const rosterCoverage = (slot: Pick<EventServiceSlot, 'confirmedCount' | 'requiredCount'>) => ({
  complete: slot.confirmedCount >= slot.requiredCount,
  missing: Math.max(0, slot.requiredCount - slot.confirmedCount),
  label: `${slot.confirmedCount}/${slot.requiredCount}`,
})

export const localizeOperationsText = (value: { en: string; zh: string }, language: 'en' | 'zh') =>
  value[language] || value.en || value.zh

const hasExplicitOffset = (value: string) => /(?:z|[+-]\d{2}:?\d{2})$/i.test(value)

// SQL datetime values may reach the client without a trailing Z. The API fields
// are explicitly UTC, so normalize them before asking the browser to localize.
export const parseUtcInstant = (value: string) =>
  new Date(hasExplicitOffset(value) ? value : `${value}Z`)

export const formatLocalOccurrenceTime = (
  value: string,
  language: 'en' | 'zh',
  timeZone?: string,
) => new Intl.DateTimeFormat(language === 'zh' ? 'zh-TW' : 'en-NZ', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone,
  timeZoneName: 'short',
}).format(parseUtcInstant(value))

export const formatLocalTime = (value: string, language: 'en' | 'zh', timeZone?: string) =>
  new Intl.DateTimeFormat(language === 'zh' ? 'zh-TW' : 'en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short',
  }).format(parseUtcInstant(value))

export const localTimeValue = (utcValue: string) => {
  const date = parseUtcInstant(utcValue)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export const occurrenceLocalTimeToUtc = (occurrenceStartUtc: string, value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new RangeError('A valid local time is required.')
  }
  const date = parseUtcInstant(occurrenceStartUtc)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

export type TwelveHourTimeParts = { hour: string; minute: string; period: 'AM' | 'PM' }

export const toTwelveHourTimeParts = (value: string): TwelveHourTimeParts => {
  if (!/^\d{2}:\d{2}$/.test(value)) return { hour: '', minute: '00', period: 'AM' }
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) return { hour: '', minute: '00', period: 'AM' }
  return {
    hour: String(hours % 12 || 12),
    minute: String(minutes).padStart(2, '0'),
    period: hours >= 12 ? 'PM' : 'AM',
  }
}

export const fromTwelveHourTimeParts = (parts: TwelveHourTimeParts) => {
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) return ''
  const hours = (hour % 12) + (parts.period === 'PM' ? 12 : 0)
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
