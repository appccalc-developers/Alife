import type { BibleReadingProgress } from '../services/bibleReadingProgressService'
import { bibleBooks } from './bibleBooks'

export type ReaderLanguage = 'zh' | 'en'

export type SavedReadingPosition = {
  book: string
  chapter: number
  language: ReaderLanguage
  zhVersion?: string
  enVersion?: string
  updatedUtc: string
}

const readingPositionStorageKey = (memberId: string) => `alife:bible-reading-position:${memberId}`

const normalizeChapter = (value: unknown, maximum: number) => {
  const chapter = Number.parseInt(String(value ?? 1), 10)
  return Number.isFinite(chapter) ? Math.min(Math.max(chapter, 1), maximum) : 1
}

export const normalizeReadingPosition = (value: BibleReadingProgress): SavedReadingPosition | null => {
  const savedBook = bibleBooks.find((item) => item.id === value.book)
  if (!savedBook) return null
  return {
    book: savedBook.id,
    chapter: normalizeChapter(value.chapter, savedBook.chapters),
    language: value.language === 'en' ? 'en' : 'zh',
    zhVersion: value.zhVersion || undefined,
    enVersion: value.enVersion || undefined,
    updatedUtc: value.updatedUtc,
  }
}

export const readSavedReadingPosition = (memberId: string): SavedReadingPosition | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(readingPositionStorageKey(memberId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SavedReadingPosition>
    const savedBook = bibleBooks.find((item) => item.id === value.book)
    if (!savedBook) return null
    return {
      book: savedBook.id,
      chapter: normalizeChapter(value.chapter, savedBook.chapters),
      language: value.language === 'en' ? 'en' : 'zh',
      zhVersion: typeof value.zhVersion === 'string' ? value.zhVersion : undefined,
      enVersion: typeof value.enVersion === 'string' ? value.enVersion : undefined,
      updatedUtc: typeof value.updatedUtc === 'string' ? value.updatedUtc : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export const saveReadingPosition = (memberId: string, position: SavedReadingPosition) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(readingPositionStorageKey(memberId), JSON.stringify(position))
  } catch {
    // Reading remains available when storage is disabled or full.
  }
}
