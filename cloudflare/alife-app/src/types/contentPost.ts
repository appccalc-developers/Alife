import type { LocalizedText } from './models'

export type ContentPostCategory =
  | 'news'
  | 'sermonOutline'
  | 'testimony'
  | 'learning'
  | 'general'

export type ContentPostSummaryDto = {
  id: string
  ownerGroupId: string
  title: LocalizedText
  summary: LocalizedText
  category: ContentPostCategory
  slug: string
  coverImageUrl?: string | null
  byline?: string | null
  publishedUtc: string
  updatedUtc: string
}

export type ContentPostDetailDto = ContentPostSummaryDto & {
  body: LocalizedText
  sourceUrl?: string | null
}
