import { sameOriginHttp } from './http'
import { createAiSessionService } from './aiSessionService'
import type { EnrollmentCommitResponse, EnrollmentDraft } from '../types/enrollment'
import type { MultilingualString } from '../types/event'

const aiSessionService = createAiSessionService<EnrollmentDraft, MultilingualString | null>('/api/enrollments/session')

export const enrollmentSessionService = {
  ...aiSessionService,

  commitEnrollment: async (sessionId: string, payload: { groupId: string; paymentFiles: File[] }): Promise<EnrollmentCommitResponse> => {
    const formData = new FormData()
    formData.set('groupId', payload.groupId)
    payload.paymentFiles.forEach((file) => formData.append('paymentFiles', file))

    const { data } = await sameOriginHttp.post<EnrollmentCommitResponse>(
      `/api/enrollments/session/${encodeURIComponent(sessionId)}/commit`,
      formData,
    )
    return data
  },
}
