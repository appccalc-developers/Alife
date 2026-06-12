import { http } from './http'
import type { MeDto } from '../types'
import { normalizeMe } from '../utils/apiEnums'

export const authService = {
  async getMe() {
    const { data } = await http.get<MeDto>('/api/me')
    return normalizeMe(data)
  },

  async logout() {
    await http.post('/api/auth/logout')
  },
}
