import { localizeText } from '../utils/localizedText.ts'
import { virtualChurchGatheringColumns } from '../i18n/virtualChurchGatherings.ts'

// Match SpotlightSection's displayed body fields before looking for its table.
// A stale alias must not make the 3D dialog disagree with the public homepage.
export const readHomeGatheringSectionHtml = (contentJson: unknown, language: string): string => {
  let content: Record<string, unknown>
  try {
    content = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson as Record<string, unknown>
  } catch {
    return ''
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) return ''

  for (const field of ['centerText', 'body', 'text', 'html']) {
    const value = content[field]
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const localized = localizeText(value as Record<string, string>, language)
    if (typeof localized === 'string' && localized) return localized
  }
  return ''
}

// The published three-column timetable has no authored column headings.
// Name those columns for screen readers only when their shape and time column
// match; do not guess the meaning of a different homepage table.
export const gatheringTableColumnHeaders = (rows: string[][], language: string): string[] | null => {
  if (!rows.length || !rows.every(row => row.length === 3 && /\d{1,2}[:：]\d{2}/.test(row[2]))) return null
  return [...virtualChurchGatheringColumns[language === 'zh' ? 'zh' : 'en']]
}
