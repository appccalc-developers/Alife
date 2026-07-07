import type { LocalizedText } from './models'

export type ForumPostVisibility = 1 | 2 | 3 | 'public' | 'membersOnly' | 'groupOnly' | 'Public' | 'MembersOnly' | 'GroupOnly'
export type ForumPostVisibilityRequest = 'Public' | 'MembersOnly' | 'GroupOnly'

export type ForumAuthorDto = {
  id: string
  displayName?: string | null
}

export type ForumMediaItem = {
  kind: 'image' | 'video'
  url: string
  key?: string | null
  name?: string | null
  contentType?: string | null
  sizeBytes?: number | null
}

export type ForumCategoryDto = {
  id: string
  nameJson: string
  descriptionJson?: string | null
  sortOrder: number
  isEnabled: boolean
}

export type ForumSermonDto = {
  id: string
  title: string
  speakerName: string
  thumbnailUrl?: string | null
  videoUrl?: string | null
  preachedAt?: string | null
}

export type ForumPostSummaryDto = {
  id: string
  categoryId: string
  groupId?: string | null
  sermonId?: string | null
  sermon?: ForumSermonDto | null
  titleJson: string
  bodyJson: string
  mediaJson: string
  visibility: ForumPostVisibility
  isPinned: boolean
  isLocked: boolean
  isHidden: boolean
  commentCount: number
  lastCommentUtc?: string | null
  createdUtc: string
  updatedUtc: string
  author: ForumAuthorDto
}

export type ForumCommentDto = {
  id: string
  postId: string
  parentCommentId?: string | null
  bodyJson: string
  mediaJson: string
  isHidden: boolean
  createdUtc: string
  updatedUtc: string
  author: ForumAuthorDto
}

export type ForumPostDetailDto = ForumPostSummaryDto & {
  comments: ForumCommentDto[]
}

export type ForumPagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type ForumPostRequest = {
  categoryId: string
  groupId?: string | null
  title: LocalizedText
  body: LocalizedText
  media?: ForumMediaItem[] | null
  visibility: ForumPostVisibilityRequest
}

export type ForumCommentRequest = {
  body?: LocalizedText | null
  parentCommentId?: string | null
  media?: ForumMediaItem[] | null
}
