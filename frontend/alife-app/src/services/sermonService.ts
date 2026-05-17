import { http } from './http'

export type SermonDto = {
  id: string
  title: string
  speakerName: string
  thumbnailUrl?: string | null
  videoUrl?: string | null
  preachedAt?: string | null
}

export const sermonService = {
  async getLatest() {
    const { data } = await http.get<SermonDto[]>('/api/sermons')
    return data
  },
}
