import { http } from './http'

export type VisitContactPayload = {
  displayName: string
  salutation?: string | null
  email?: string | null
  phone?: string | null
  preferredLanguage?: 'zh' | 'en' | 'bilingual' | null
  message: string
  sourcePage?: string | null
}

export type VisitContactRequestDto = VisitContactPayload & {
  id: string
  status: string
  submittedUtc: string
}

export const visitContactService = {
  async create(payload: VisitContactPayload) {
    const { data } = await http.post<VisitContactRequestDto>('/api/visit-contact-requests', payload)
    return data
  },
}
