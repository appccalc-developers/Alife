import type { MultilingualString } from './event'

export type ReviewPhotoFile = {
  fileName: string
  contentType: string
  size: number
  key?: string
  url: string
}

export type RecognizedPerson = {
  name: string
  confidence?: number | null
  correction?: string | null
}

export type RecognizedActivity = {
  name: MultilingualString
  evidence?: string | null
  correction?: string | null
}

export type ReviewDraft = {
  reviewId: string
  eventId: string
  groupId: string
  memberId: string
  reflection: MultilingualString
  summary: MultilingualString
  recognizedPeople: RecognizedPerson[]
  recognizedActivities: RecognizedActivity[]
  photoFiles: ReviewPhotoFile[]
  assistantReply?: MultilingualString | null
  missionStatements?: Record<string, unknown>[]
  eventContext?: Record<string, unknown> | null
  submittedAtUtc: string
  updatedAtUtc: string
}

export type EventReviewRecord = {
  id: string
  groupId: string
  eventId: string
  memberId: string
  reviewJson: string
  createdUtc: string
  updatedUtc: string
}

export type ReviewCommitResponse = {
  status: 'completed'
  message: string
  review: EventReviewRecord
}
