import type { LocalizedText } from './models'

export type ContactProfileVisibility = 'public' | 'groupOnly'

export type ContactProfileDto = {
  id: string
  memberId: string
  ownerGroupId: string
  name: LocalizedText
  role: LocalizedText
  photoUrl?: string | null
  notes?: LocalizedText | null
  phone?: string | null
  email?: string | null
  visibility: ContactProfileVisibility
  createdUtc: string
  updatedUtc: string
}

export type ContactProfileInput = Pick<ContactProfileDto, 'memberId' | 'name' | 'role' | 'photoUrl' | 'notes' | 'phone' | 'email' | 'visibility'>

export type ContactInquiryInput = {
  displayName: string
  email?: string
  phone?: string
  message: string
  preferredLanguage?: string
  sourcePage?: string
}
