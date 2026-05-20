import type { MultilingualString } from './event'

export type EnrollmentDraft = {
  eventId: string
  applicantName: string
  consentStatus: 'unknown' | 'granted' | 'declined'
  assistantReply?: MultilingualString | null
}

export type EnrollmentPaymentFile = {
  fileName: string
  contentType: string
  size: number
  url: string
}

export type EnrollmentCommitResponse = {
  status: 'completed'
  message: string
}
