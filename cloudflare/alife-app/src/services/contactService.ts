import type { ContactInquiryInput, ContactProfileDto, ContactProfileInput } from '../types/contact'
import { http } from './http'

export const contactService = {
  list: async (groupId: string): Promise<ContactProfileDto[]> => {
    const { data } = await http.get<ContactProfileDto[]>(`/api/groups/${encodeURIComponent(groupId)}/contacts`)
    return data
  },

  create: async (groupId: string, input: ContactProfileInput): Promise<ContactProfileDto> => {
    const { data } = await http.post<ContactProfileDto>(`/api/groups/${encodeURIComponent(groupId)}/contacts`, input)
    return data
  },

  update: async (id: string, input: ContactProfileInput): Promise<ContactProfileDto> => {
    const { data } = await http.put<ContactProfileDto>(`/api/contact-profiles/${encodeURIComponent(id)}`, input)
    return data
  },

  remove: async (id: string): Promise<void> => {
    await http.delete(`/api/contact-profiles/${encodeURIComponent(id)}`)
  },

  inquire: async (id: string, input: ContactInquiryInput): Promise<void> => {
    await http.post(`/api/contact-profiles/${encodeURIComponent(id)}/inquiries`, input)
  },
}
