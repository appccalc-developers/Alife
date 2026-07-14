import type { LocalizedText } from './models'

export type AnnouncementAudience = 'public' | 'churchMembers' | 'specificGroup'
export type AnnouncementPriority = 'normal' | 'important' | 'urgent'
export type AnnouncementStatus = 'draft' | 'published' | 'archived'

export type AnnouncementDto = {
  id: string
  groupId: string
  title: LocalizedText
  summary: LocalizedText
  content?: LocalizedText | null
  audience: AnnouncementAudience
  priority: AnnouncementPriority
  status: AnnouncementStatus
  publishUtc: string
  expireUtc?: string | null
  isPinned: boolean
  createdByMemberId: string
  createdUtc: string
  updatedUtc: string
}

export type SaveAnnouncementPayload = Pick<AnnouncementDto,
  'groupId' | 'title' | 'summary' | 'content' | 'audience' | 'priority' | 'status' | 'publishUtc' | 'expireUtc' | 'isPinned'> & {
  createNotifications: boolean
}
