import type {
  AppNotification,
  NotificationTaskCategory,
  NotificationTaskCompletionMode,
  NotificationTaskDetails,
  NotificationText,
} from '../types/notification'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string')

const toNotificationText = (value: unknown): NotificationText | undefined => {
  if (typeof value === 'string') return value
  return isStringRecord(value) ? value : undefined
}

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)

const parseJsonObject = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || value.trim().length === 0) return undefined

  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const readNotificationItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []

  for (const key of ['notifications', 'items', 'data']) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[]
  }

  if (isRecord(payload.data)) {
    for (const key of ['notifications', 'items']) {
      if (Array.isArray(payload.data[key])) return payload.data[key] as unknown[]
    }
  }

  return []
}

const readDetails = (actionData: Record<string, unknown> | undefined): NotificationTaskDetails | undefined => {
  if (!actionData) return undefined
  const details: NotificationTaskDetails = {}
  for (const key of ['displayName', 'email', 'phone', 'message', 'preferredLanguage', 'sourcePage'] as const) {
    const value = actionData[key]
    if (typeof value === 'string' && value.trim()) details[key] = value.trim()
  }
  return Object.keys(details).length ? details : undefined
}

const readCategory = (value: unknown): NotificationTaskCategory | undefined =>
  value === 'urgent' || value === 'general' ? value : undefined

const readCompletionMode = (value: unknown): NotificationTaskCompletionMode | undefined =>
  value === 'workflow' || value === 'read' ? value : undefined

export const normalizeCurrentTask = (value: unknown): AppNotification | null => {
  if (!isRecord(value)) return null
  const id = firstString(value.id, value.notificationId, value.notificationID)
  if (!id) return null

  const actionData = parseJsonObject(value.actionDataJson ?? value.actionData)
  const actionType = firstString(value.actionType, value.type)
  const groupId = firstString(value.groupId, actionData?.groupId)
  const eventId = firstString(value.eventId, actionData?.eventId)
  const eventActionUrl = actionType === 'event.created' && groupId && eventId
    ? `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`
    : undefined

  const category = readCategory(value.category)
  const completionMode = readCompletionMode(value.completionMode)

  return {
    id,
    actionType,
    title:
      toNotificationText(value.title) ??
      toNotificationText(actionData?.title) ??
      toNotificationText(value.subject) ??
      toNotificationText(value.message) ??
      '',
    body:
      toNotificationText(value.body) ??
      toNotificationText(actionData?.body) ??
      toNotificationText(value.description) ??
      toNotificationText(value.content),
    actionUrl: firstString(value.actionUrl, value.actionURL, value.actionUri, value.url, actionData?.actionUrl) ?? eventActionUrl ?? null,
    status: firstString(value.status, value.state),
    createdUtc: firstString(value.occurredUtc, value.createdUtc, value.createdAt, value.createdOn, value.updatedUtc),
    readUtc: firstString(value.readUtc, value.readAt, value.openedUtc, value.openedAt),
    category,
    completionMode,
    details: readDetails(actionData),
    sourceType: firstString(value.sourceType, actionData?.sourceType) ?? null,
    sourceId: firstString(value.sourceId, actionData?.sourceId) ?? null,
  }
}

export const normalizeCurrentTasks = (payload: unknown): AppNotification[] =>
  readNotificationItems(payload)
    .map(normalizeCurrentTask)
    .filter((item): item is AppNotification => Boolean(item?.category && item.completionMode))
    .sort((left, right) => Date.parse(right.createdUtc || '') - Date.parse(left.createdUtc || ''))

export const localizeNotificationText = (value: NotificationText | undefined, language: string) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return language === 'zh'
    ? value.zh || value.en || Object.values(value)[0] || ''
    : value.en || value.zh || Object.values(value)[0] || ''
}

export const formatNotificationDate = (value: string | undefined, language: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const normalizeNotificationActionUrl = (actionUrl: string) => {
  const trimmed = actionUrl.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/^\/+/, '')}`
}

export const countCurrentTasks = (tasks: AppNotification[]) => ({
  urgent: tasks.filter((task) => task.category === 'urgent').length,
  general: tasks.filter((task) => task.category === 'general').length,
})

export const formatTaskCount = (count: number) => count > 99 ? '99+' : String(count)
