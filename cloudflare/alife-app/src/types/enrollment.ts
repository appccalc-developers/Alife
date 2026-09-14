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
  key?: string
  url: string
}

export type EventEnrollmentRecord = {
  id: string
  groupId: string
  eventId: string
  memberId: string
  enrollmentJson: string
  createdUtc: string
  updatedUtc: string
  status?: 'confirmed' | 'waitlisted' | 'cancelled'
  queuedUtc?: string | null
  statusChangedUtc?: string | null
  waitlistPosition?: number | null
  eTag?: string
}

export type EnrollmentCapacity = { capacity: number; confirmed: number; waitlisted: number; overCapacity: boolean; isOpen: boolean; canManage: boolean }

export type EnrollmentCommitResponse = {
  status: 'completed'
  message: string
  enrollment: EventEnrollmentRecord
}
