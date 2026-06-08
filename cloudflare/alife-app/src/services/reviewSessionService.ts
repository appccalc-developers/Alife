import { http } from './http'
import { createAiSessionService } from './aiSessionService'
import { isImageFile, uploadImage } from './imageWorkerApi'
import type { AiSessionAttachment } from '../types/aiSession'
import type { MultilingualString } from '../types/event'
import type { EventReviewRecord, ReviewCommitResponse, ReviewDraft, ReviewPhotoFile } from '../types/review'

const aiSessionService = createAiSessionService<ReviewDraft, MultilingualString | null>('/api/reviews/session')

const createReviewId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => {
    const value = Number(char)
    return (value ^ (Math.floor(Math.random() * 16) >> (value / 4))).toString(16)
  })
}

const isValidGuid = (value: string | null | undefined): value is string => {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

const getReviewPhotoFolder = (groupId: string, eventId: string, reviewId: string) =>
  `groups/${groupId}/events/${eventId}/reviews/${reviewId}`

const uploadReviewPhoto = async (
  file: File,
  groupId: string,
  eventId: string,
  reviewId: string,
): Promise<ReviewPhotoFile> => {
  if (!isImageFile(file)) {
    throw new Error('Only image files can be uploaded for event reviews.')
  }

  const image = await uploadImage(file, getReviewPhotoFolder(groupId, eventId, reviewId))
  return {
    fileName: file.name,
    contentType: file.type || image.contentType || 'application/octet-stream',
    size: file.size,
    key: image.key,
    url: image.url,
  }
}

const closeReviewSession = async (sessionId?: string) => {
  if (!sessionId) {
    return
  }

  try {
    await aiSessionService.close(sessionId)
  } catch (error) {
    console.warn('Failed to close review session after API success.', error)
  }
}

export const fileToAiAttachment = async (file: File): Promise<AiSessionAttachment> => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return {
    name: file.name || 'review-photo',
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    source: 'inline',
    inlineData: {
      mimeType: file.type || 'application/octet-stream',
      data: btoa(binary),
    },
  }
}

export const parseReviewDraft = (record: EventReviewRecord | null | undefined): ReviewDraft | null => {
  if (!record?.reviewJson) {
    return null
  }

  try {
    const parsed = JSON.parse(record.reviewJson) as ReviewDraft
    return {
      ...parsed,
      reviewId: parsed.reviewId || record.id,
      eventId: parsed.eventId || record.eventId,
      groupId: parsed.groupId || record.groupId,
      memberId: parsed.memberId || record.memberId,
      recognizedPeople: Array.isArray(parsed.recognizedPeople) ? parsed.recognizedPeople : [],
      recognizedActivities: Array.isArray(parsed.recognizedActivities) ? parsed.recognizedActivities : [],
      photoFiles: Array.isArray(parsed.photoFiles) ? parsed.photoFiles : [],
    }
  } catch {
    return null
  }
}

export const reviewSessionService = {
  ...aiSessionService,

  listEventReviews: async (eventId: string): Promise<EventReviewRecord[]> => {
    const { data } = await http.get<EventReviewRecord[]>(`/api/events/${eventId}/reviews`)
    return data
  },

  saveReview: async (payload: {
    eventId: string
    groupId: string
    memberId?: string
    sessionId?: string
    existingReview?: EventReviewRecord | null
    draft: ReviewDraft
    photoFiles: File[]
  }): Promise<ReviewCommitResponse> => {
    const reviewId = payload.existingReview?.id || (isValidGuid(payload.draft.reviewId) ? payload.draft.reviewId : null) || createReviewId()
    const uploadedPhotos = await Promise.all(
      payload.photoFiles.map((file) => uploadReviewPhoto(file, payload.groupId, payload.eventId, reviewId)),
    )
    const existingPhotos = Array.isArray(payload.draft.photoFiles) ? payload.draft.photoFiles : []
    const now = new Date().toISOString()
    const reviewPayload: ReviewDraft & { id: string } = {
      ...payload.draft,
      id: reviewId,
      reviewId,
      eventId: payload.eventId,
      groupId: payload.groupId,
      memberId: payload.memberId || payload.draft.memberId,
      photoFiles: [...existingPhotos, ...uploadedPhotos],
      submittedAtUtc: payload.draft.submittedAtUtc || now,
      updatedAtUtc: now,
    }

    const { data } = payload.existingReview
      ? await http.put<EventReviewRecord>(
        `/api/events/${payload.eventId}/reviews/${payload.existingReview.id}`,
        reviewPayload,
      )
      : await http.post<EventReviewRecord>(
        `/api/events/${payload.eventId}/reviews`,
        reviewPayload,
      )

    await closeReviewSession(payload.sessionId)

    return {
      status: 'completed',
      message: payload.existingReview ? 'Review updated successfully.' : 'Review submitted successfully.',
      review: data,
    }
  },
}
