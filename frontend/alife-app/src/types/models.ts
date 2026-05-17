export type AccessType = 'Public' | 'Protected' | 'Private'
export type MembershipStatus = 'Invited' | 'Requested' | 'Approved' | 'Rejected' | 'Removed'
export type MembershipRole = 'Member' | 'CoLeader' | 'Leader'
export type PageScope = 'Global' | 'Group'
export type PageVisibility = 'InvisibleDraft' | 'VisibleToGroup' | 'VisiblePublic'

export type ListSourceType = 'sermons' | 'pages' | 'subgroups' | 'events' | 'members'
export type ListSourceScope = 'group' | 'global'
export interface ListViewMetadata {
  sourceType: ListSourceType
  sourceScope: ListSourceScope
  limit: number
  /** 可选的资源 ID，如 subgroupId、eventId 等，用于精确查询某个资源下的数据 */
  id?: string
}

export type GroupDto = {
  id: string
  name: string
  accessType: AccessType
  isChurch: boolean
  isClosed: boolean
  parentGroupId: string | null
  description?: string | null
  createdUtc?: string
  updatedUtc?: string
}

export type GroupSummaryDto = {
  id: string
  name: string
  accessType: AccessType
  isChurch: boolean
  isClosed: boolean
  parentGroupId: string | null
  description?: string | null
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
  | 'MediaSpotlight'
  | 'IconFeatureGrid'
  | 'SermonSpotlight'
  | 'RichText'
  | 'PostFeed'
  | 'Sermon'
  | 'GroupList'
  | 'PageList'
  | 'SermonList'

export type SectionEditModel = {
  id?: string
  order: number
  type: SectionType | ''
  contentJson: Record<string, unknown>
  styleJson: Record<string, unknown>
}

export type PageSummaryDto = {
  id: string
  title: string
  slug: string
  language: string
  visibility: PageVisibility
  createdByMemberId: string
  updatedUtc?: string
  scope?: PageScope
  ownerGroupId?: string | null
  description?: string | null
  tagsJson?: string
  titleDisplayStyle?: string
}

export type PageDetailDto = {
  id: string
  title: string
  description?: string | null
  tags: string[]
  titleDisplayStyle: string
  language: string
  visibility: PageVisibility
  sections: SectionEditModel[]
  slug: string
  createdByMemberId?: string
  ownerGroupId?: string | null
}

export type PageEditModel = {
  id?: string
  groupId: string
  slug: string
  title: string
  description: string
  tags: string[]
  titleDisplayStyle: string
  language: string
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
  isGuest: boolean
  isRegistered: boolean
  isAdmin: boolean
  memberships: GroupMembershipDto[]
}

export type PageEditorValidation = {
  title?: string
  sectionTypeErrors: string[]
}

