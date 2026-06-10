import type { LocalizedText } from './models'

export type NotificationText = LocalizedText | string

export type AppNotification = {
  id: string
  actionType?: string
  title: NotificationText
  body?: NotificationText
  actionUrl?: string | null
  status?: string
  createdUtc?: string
  readUtc?: string
}
