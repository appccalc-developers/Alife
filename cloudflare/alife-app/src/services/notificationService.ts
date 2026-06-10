import { http } from './http'
import type { AppNotification, NotificationText } from '../types/notification'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string')

const toNotificationText = (value: unknown): NotificationText | undefined => {
  if (typeof value === 'string') {
    return value
  }

  if (isStringRecord(value)) {
    return value
  }

  return undefined
}

const firstString = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)

const parseJsonObject = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) {
    return value
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const readNotificationItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const key of ['notifications', 'items', 'data']) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  const data = payload.data
  if (isRecord(data)) {
    for (const key of ['notifications', 'items']) {
      const value = data[key]
      if (Array.isArray(value)) {
        return value
      }
    }
  }

  return []
}

const normalizeNotification = (value: unknown): AppNotification | null => {
  if (!isRecord(value)) {
    return null
  }

  const id = firstString(value.id, value.notificationId, value.notificationID)
  if (!id) {
    return null
  }

  const actionData = parseJsonObject(value.actionDataJson ?? value.actionData)
  const actionType = firstString(value.actionType, value.type)
  const groupId = firstString(value.groupId, actionData?.groupId)
  const eventId = firstString(value.eventId, actionData?.eventId)
  const eventActionUrl = actionType === 'event.created' && groupId && eventId
    ? `/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}`
    : undefined

  const title =
    toNotificationText(value.title) ??
    toNotificationText(actionData?.title) ??
    toNotificationText(value.subject) ??
    toNotificationText(value.message) ??
    ''
  const body =
    toNotificationText(value.body) ??
    toNotificationText(actionData?.body) ??
    toNotificationText(value.description) ??
    toNotificationText(value.content)

  return {
    id,
    actionType,
    title,
    body,
    actionUrl: firstString(value.actionUrl, value.actionURL, value.actionUri, value.url, actionData?.actionUrl) ?? eventActionUrl ?? null,
    status: firstString(value.status, value.state),
    createdUtc: firstString(value.createdUtc, value.createdAt, value.createdOn, value.updatedUtc),
    readUtc: firstString(value.readUtc, value.readAt, value.openedUtc, value.openedAt),
  }
}

const normalizeNotifications = (payload: unknown): AppNotification[] =>
  readNotificationItems(payload).map(normalizeNotification).filter((item): item is AppNotification => Boolean(item))

export const notificationService = {
  getOpenNotifications: async (): Promise<AppNotification[]> => {
    const { data } = await http.get<unknown>('/api/notifications')
    return normalizeNotifications(data).filter((notification) => !notification.readUtc)
  },

  openNotification: async (id: string): Promise<void> => {
    await http.post(`/api/notifications/${encodeURIComponent(id)}/read`)
  },
}
