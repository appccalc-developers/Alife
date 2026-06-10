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

  const title = toNotificationText(value.title) ?? toNotificationText(value.subject) ?? toNotificationText(value.message) ?? ''
  const body = toNotificationText(value.body) ?? toNotificationText(value.description) ?? toNotificationText(value.content)

  return {
    id,
    title,
    body,
    actionUrl: firstString(value.actionUrl, value.actionURL, value.actionUri, value.url) ?? null,
    status: firstString(value.status, value.state),
    createdUtc: firstString(value.createdUtc, value.createdAt, value.createdOn, value.updatedUtc),
  }
}

const normalizeNotifications = (payload: unknown): AppNotification[] =>
  readNotificationItems(payload).map(normalizeNotification).filter((item): item is AppNotification => Boolean(item))

const shouldFallbackToActiveList = (error: unknown) => {
  const status = (error as { status?: number } | undefined)?.status
  return status === 404 || status === 405
}

export const notificationService = {
  getOpenNotifications: async (): Promise<AppNotification[]> => {
    try {
      const { data } = await http.get<unknown>('/api/notifications/unopened')
      return normalizeNotifications(data)
    } catch (error) {
      if (!shouldFallbackToActiveList(error)) {
        throw error
      }

      const { data } = await http.get<unknown>('/api/notifications', { params: { status: 'active' } })
      return normalizeNotifications(data)
    }
  },

  openNotification: async (id: string): Promise<void> => {
    await http.post(`/api/notifications/${encodeURIComponent(id)}/open`)
  },
}
