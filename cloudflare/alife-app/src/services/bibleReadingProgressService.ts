import { http } from './http'

export type BibleReadingProgress = {
  book: string
  chapter: number
  language: 'zh' | 'en'
  zhVersion?: string
  enVersion?: string
  updatedUtc: string
}

export type SaveBibleReadingProgress = Omit<BibleReadingProgress, 'updatedUtc'>

export const bibleReadingProgressService = {
  async get(signal?: AbortSignal): Promise<BibleReadingProgress | null> {
    try {
      const { data } = await http.get<BibleReadingProgress>('/api/me/bible-reading-progress', { signal })
      return data
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return null
      throw error
    }
  },

  async save(progress: SaveBibleReadingProgress, signal?: AbortSignal): Promise<BibleReadingProgress> {
    const { data } = await http.put<BibleReadingProgress>('/api/me/bible-reading-progress', progress, { signal })
    return data
  },
}
