export type AccessType = 'public' | 'protected' | 'private'
export type MembershipStatus = 'invited' | 'requested' | 'approved' | 'rejected' | 'removed'
export type MembershipRole = 'member' | 'coLeader' | 'leader'
export type PageScope = 'global' | 'group'
export type PageVisibility = 'draft' | 'group' | 'public'
export type LocalizedText = Record<string, string>
export type SectionIconKey =
  | 'church'
  | 'cross'
  | 'calendar'
  | 'bible'
  | 'people'
  | 'heart'
  | 'music'
  | 'map'
  | 'image'
  | 'video'
  | 'mic'
  | 'book'
  | 'handshake'

export type SectionHeader = {
  icon?: SectionIconKey
  title?: LocalizedText
  subtitle?: LocalizedText
  align?: 'left' | 'center'
  scale?: 'compact' | 'normal' | 'feature'
  tone?: 'default' | 'primary' | 'warm' | 'fresh' | 'rose'
}

export type SectionContentJson = Record<string, unknown> & {
  header?: SectionHeader
}

export type ListSourceType = 'sermons' | 'pages' | 'subgroups' | 'events' | 'members'
export type ListSourceScope = 'group' | 'global'
export type ListSortBy = 'source' | 'date' | 'title'
export type ListSortDirection = 'asc' | 'desc'
export interface ListViewMetadata {
  sourceType: ListSourceType
  sourceScope: ListSourceScope
  limit: number
  sortBy: ListSortBy
  sortDirection: ListSortDirection
  filterText?: string
  /** Optional resource ID such as subgroupId or eventId for precise scoped queries. */
  id?: string
}

export type GroupDto = {
  id: string
  name: LocalizedText
  description?: LocalizedText | null
  accessType: AccessType
  isChurch: boolean
  isClosed: boolean
  parentGroupId: string | null
  createdUtc?: string
  updatedUtc?: string
}

export type GroupSummaryDto = {
  id: string
  name: LocalizedText
  description?: LocalizedText | null
  accessType: AccessType
  isChurch: boolean
  isClosed: boolean
  parentGroupId: string | null
}

export type GroupMembershipDto = {
  groupId: string
  status: MembershipStatus
  role: MembershipRole
}

export type LinkDto = {
  id?: string
  ownerSectionId?: string
  type: string
  targetGroupId?: string | null
  targetPageId?: string | null
  title: string
  imageUrl?: string | null
  sortOrder?: number
}

export type SectionType =
  | 'Hero'
  | 'Spotlight'
  | 'RichText'
  | 'Sermon'
  | 'ListView'

export type SectionEditModel = {
  id?: string
  order: number
  type: SectionType | ''
  contentJson: SectionContentJson
  styleJson: Record<string, unknown>
}

export type PageSummaryDto = {
  id: string
  title: LocalizedText
  visibility: PageVisibility
  createdByMemberId: string
  updatedUtc?: string
  scope?: PageScope
  ownerGroupId?: string | null
  description?: LocalizedText | null
  tagsJson?: string
  titleDisplayStyle?: string
}

export type PageDetailDto = {
  id: string
  title: LocalizedText
  description?: LocalizedText | null
  tags: string[]
  titleDisplayStyle: string
  visibility: PageVisibility
  sections: SectionEditModel[]
  createdByMemberId: string
  ownerGroupId?: string | null
}

export type PageEditModel = {
  id?: string
  groupId: string
  title: LocalizedText
  description: LocalizedText
  tags: string[]
  titleDisplayStyle: string
  visibility: PageVisibility
  sections: SectionEditModel[]
  createdByMemberId?: string
}

export type MeDto = {
  id: string
  displayName?: string
  sex?: string
  age?: number
  email?: string
  phoneE164?: string
  language: 'en' | 'zh'
  isGuest: boolean
  isRegistered: boolean
  isAdmin: boolean
  memberships: GroupMembershipDto[]
}

export type PageEditorValidation = {
  title?: string
  sectionTypeErrors: string[]
}
