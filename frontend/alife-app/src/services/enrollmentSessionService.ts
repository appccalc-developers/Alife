import { http } from './http'
import { createAiSessionService } from './aiSessionService'
import { isImageFile, uploadImage } from './imageWorkerApi'
import type { EnrollmentCommitResponse, EnrollmentDraft, EnrollmentPaymentFile, EventEnrollmentRecord } from '../types/enrollment'
import type { MultilingualString } from '../types/event'

const aiSessionService = createAiSessionService<EnrollmentDraft, MultilingualString | null>('/api/enrollments/session')

const createEnrollmentId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => {
    const value = Number(char)
    return (value ^ (Math.floor(Math.random() * 16) >> (value / 4))).toString(16)
  })
}

const getEnrollmentPaymentFolder = (groupId: string, eventId: string, enrollmentId: string) =>
  `groups/${groupId}/events/${eventId}/enrollments/${enrollmentId}`

const uploadPaymentFile = async (
  file: File,
  groupId: string,
  eventId: string,
  enrollmentId: string,
): Promise<EnrollmentPaymentFile> => {
  if (!isImageFile(file)) {
    throw new Error('Only image payment proof files can be uploaded.')
  }

  const image = await uploadImage(file, getEnrollmentPaymentFolder(groupId, eventId, enrollmentId))
  return {
    fileName: file.name,
    contentType: file.type || image.contentType || 'application/octet-stream',
    size: file.size,
    key: image.key,
    url: image.url,
  }
}

const closeEnrollmentSession = async (sessionId?: string) => {
  if (!sessionId) {
    return
  }

  try {
    await aiSessionService.close(sessionId)
  } catch (error) {
    console.warn('Failed to close enrollment session after API success.', error)
  }
}

export const enrollmentSessionService = {
  ...aiSessionService,

  listEventEnrollments: async (eventId: string): Promise<EventEnrollmentRecord[]> => {
    const { data } = await http.get<EventEnrollmentRecord[]>(`/api/events/${eventId}/enrollments`)
    return data
  },

  createEnrollment: async (payload: {
    eventId: string
    groupId: string
    sessionId?: string
    draft: EnrollmentDraft
    paymentFiles: File[]
  }): Promise<EnrollmentCommitResponse> => {
    const enrollmentId = createEnrollmentId()
    const paymentFiles = await Promise.all(
      payload.paymentFiles.map((file) => uploadPaymentFile(file, payload.groupId, payload.eventId, enrollmentId)),
    )
    const enrollmentPayload = {
      id: enrollmentId,
      enrollmentId,
      eventId: payload.eventId,
      groupId: payload.groupId,
      applicantName: payload.draft.applicantName,
      consentStatus: payload.draft.consentStatus,
      assistantReply: payload.draft.assistantReply ?? null,
      paymentFiles,
      submittedAtUtc: new Date().toISOString(),
    }

    const { data } = await http.post<EventEnrollmentRecord>(
      `/api/events/${payload.eventId}/enrollments`,
      enrollmentPayload,
    )
    await closeEnrollmentSession(payload.sessionId)

    return {
      status: 'completed',
      message: 'Enrollment submitted successfully.',
      enrollment: data,
    }
  },

  updateEnrollment: async (eventId: string, enrollmentId: string, enrollmentPayload: unknown): Promise<EventEnrollmentRecord> => {
    const { data } = await http.put<EventEnrollmentRecord>(
      `/api/events/${eventId}/enrollments/${enrollmentId}`,
      enrollmentPayload,
    )
    return data
  },

  deleteEnrollment: async (eventId: string, enrollmentId: string): Promise<void> => {
    await http.delete(`/api/events/${eventId}/enrollments/${enrollmentId}`)
  },
}
