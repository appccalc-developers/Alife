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
  async get(): Promise<BibleReadingProgress | null> {
    try {
      const { data } = await http.get<BibleReadingProgress>('/api/me/bible-reading-progress')
      return data
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) return null
      throw error
    }
  },

  async save(progress: SaveBibleReadingProgress): Promise<BibleReadingProgress> {
    const { data } = await http.put<BibleReadingProgress>('/api/me/bible-reading-progress', progress)
    return data
  },
}
