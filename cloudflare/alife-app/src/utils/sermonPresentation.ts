import type { SermonDto } from '../services/sermonService'

const trimSeparators = (value: string) => value.replace(/^[\s:：|｜\-–—·]+|[\s|｜\-–—·]+$/g, '').trim()

export const parseSermonTitle = (rawTitle: string) => {
  let title = rawTitle.trim()
  let date: string | null = null
  const prefix = title.match(/^(\d{4})(?:\s*[-/._年]\s*|\s+)(\d{1,2})(?:\s*[-/._月]\s*|\s+)(\d{1,2})(?:日)?(?=\D|$)/)
  if (prefix) {
    const [, year, month, day] = prefix
    const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsed = new Date(`${candidate}T12:00:00Z`)
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate) date = candidate
    title = title.slice(prefix[0].length)
  }
  const speaker = title.match(/(?:讲员|講員|讲者|講者|Speaker)\s*[:：]?\s*(.+)$/i)
  const speakerName = speaker ? trimSeparators(speaker[1].split(/[|｜]/)[0]) : ''
  if (speaker?.index !== undefined) title = title.slice(0, speaker.index)
  title = trimSeparators(title)
    .replace(/^(?:主日(?:证道|證道|正道|圣道|聖道|庆典|慶典|崇拜)|Sunday\s+(?:Sermon|Service))\s*/i, '')
  title = trimSeparators(title).replace(/^(?:直播|Live)\s*[:：]?\s*/i, '')
  return { title: trimSeparators(title), speakerName, date }
}

// Derive display fields without changing the synchronized record or its cache identity.
export const sundayBeforePublication = (publishedAt: string | null | undefined) => {
  if (!publishedAt) return null
  const published = new Date(publishedAt)
  if (!Number.isFinite(published.getTime())) return null
  const calendarDate = /^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ? publishedAt : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(published)
  const date = new Date(`${calendarDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() || 7))
  return date.toISOString().slice(0, 10)
}

export const presentSermon = (sermon: SermonDto): SermonDto => {
  if ((sermon.metadataVersion ?? 0) >= 1) return sermon
  const parsed = parseSermonTitle(sermon.title)
  return { ...sermon, title: parsed.title, speakerName: parsed.speakerName, preachedAt: parsed.date ?? sundayBeforePublication(sermon.preachedAt) }
}

export const formatSermonDate = (date: string | null | undefined, language: string, fallback: string) => {
  if (!date) return fallback
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`))
}

export const bulletinDateForSermon = (value: string | null | undefined) => {
  const date = value?.slice(0, 10)
  if (!date) return null
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}
