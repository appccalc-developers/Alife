import type { LocalizedText } from './models'

export type NotificationText = LocalizedText | string

export type NotificationTaskCategory = 'urgent' | 'general'
export type NotificationTaskCompletionMode = 'workflow' | 'read'

export type NotificationTaskDetails = {
  displayName?: string
  email?: string
  phone?: string
  message?: string
  preferredLanguage?: string
  sourcePage?: string
}

export type AppNotification = {
  id: string
  actionType?: string
  title: NotificationText
  body?: NotificationText
  actionUrl?: string | null
  status?: string
  createdUtc?: string
  readUtc?: string
  category?: NotificationTaskCategory
  completionMode?: NotificationTaskCompletionMode
  details?: NotificationTaskDetails
  sourceType?: string | null
  sourceId?: string | null
}
