import { http } from './http'
import type { MeDto } from '../types'
import { normalizeMe } from '../utils/apiEnums'

type UpdateProfileLanguageResponse = {
  ok: boolean
  language: MeDto['language']
  expiresUtc: string
}

export const authService = {
  async getMe() {
    const { data } = await http.get<MeDto>('/api/me')
    return normalizeMe(data)
  },

  async updateProfileLanguage(language: MeDto['language']) {
    const { data } = await http.put<UpdateProfileLanguageResponse>('/api/me/profile', { language })
    return data
  },

  async logout() {
    await http.post('/api/auth/logout')
  },
}
