export type {
  AccessType,
  GroupDto,
  GroupSummaryDto,
  GroupMembershipDto,
  PageScope,
  PageVisibility,
  PageSummaryDto,
} from './models'

export type GroupPageDto = import('./models').PageSummaryDto
export type GroupTab = 'overview' | 'subgroups' | 'pages'

export type CreatePagePayload = {
  title: string
  slug: string
  language: string
  description?: string
  tagsJson?: string
  titleDisplayStyle?: string
}

export type UpdatePagePayload = {
  title: string
  description?: string
  tagsJson?: string
  titleDisplayStyle?: string
}
