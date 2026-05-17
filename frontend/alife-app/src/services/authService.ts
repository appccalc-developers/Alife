import { http } from './http'
import type { MeDto } from '../types'

export const authService = {
  async getMe() {
    const { data } = await http.get<MeDto>('/api/me')
    return data
  },

  async logout() {
    await http.post('/api/auth/logout')
  },
}
