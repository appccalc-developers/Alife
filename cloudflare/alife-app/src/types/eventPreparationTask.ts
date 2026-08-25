import type { LocalizedText } from './models'

export type EventPreparationTaskStatus = 'todo' | 'inProgress' | 'completed' | 'cancelled'

export type EventPreparationTask = {
  id: string
  moduleKey: string
  title: LocalizedText
  description: LocalizedText
  assignedMemberId: string | null
  assignedDisplayName: string | null
  dueUtc: string | null
  isRequired: boolean
  status: EventPreparationTaskStatus
  dependencyTaskIds: string[]
  isBlocked: boolean
  updatedUtc: string
}

export type EventPreparationTaskWorkspace = {
  eventId: string
  groupId: string
  eventTitle: LocalizedText
  eventStartUtc: string
  moduleKeys: string[]
  members: Array<{ memberId: string; displayName: string }>
  tasks: EventPreparationTask[]
}

export type SaveEventPreparationTaskPayload = {
  moduleKey: string
  titleEn: string
  titleZh: string
  descriptionEn: string
  descriptionZh: string
  assignedMemberId?: string | null
  dueUtc?: string | null
  isRequired: boolean
  dependencyTaskIds: string[]
}
