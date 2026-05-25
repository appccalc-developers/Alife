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
  title: import('./models').LocalizedText
  description?: import('./models').LocalizedText
  tagsJson?: string
  titleDisplayStyle?: string
}

export type UpdatePagePayload = {
  title: import('./models').LocalizedText
  description?: import('./models').LocalizedText
  tagsJson?: string
  titleDisplayStyle?: string
}
