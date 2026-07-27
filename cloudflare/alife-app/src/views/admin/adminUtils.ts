import type { AdminGroupOptionDto } from '../../services/groupService'

export type LocalText = { en: string; zh: string }

const hasTimeZone = (value: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)

export const parseUtcDate = (value: string) => {
  const normalized = value.trim()
  return new Date(hasTimeZone(normalized) ? normalized : `${normalized}Z`)
}

export const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(parseUtcDate(value))
export const formatRole = (role: string) => role === 'superadmin' ? 'System Admin' : role === 'admin' ? 'Admin' : role === 'user' ? 'User' : role
export const readLocalized = (text: Record<string, string> | null | undefined, language: string) => !text ? '' : (language === 'zh' ? text.zh : text.en) || text.en || text.zh || ''
export const parseLocalizedJson = (json: string | null, language: string) => {
  if (!json) return ''
  try {
    return readLocalized(JSON.parse(json) as Record<string, string>, language)
  } catch {
    return ''
  }
}
export const compactId = (value: string | null | undefined) => value ? `${value.slice(0, 8)}...${value.slice(-4)}` : ''
export const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
export const groupNameLabel = (group: AdminGroupOptionDto, language: string) => parseLocalizedJson(group.nameJson, language) || compactId(group.id)

type JsonRecord = Record<string, unknown>
export const parseJsonRecord = (json: string | null | undefined): JsonRecord | null => {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : null
  } catch {
    return null
  }
}
export const readJsonString = (record: JsonRecord | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}
export const readJsonNumber = (record: JsonRecord | null, key: string) => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
export const readNestedLocalized = (record: JsonRecord | null, key: string, language: string) => {
  const value = record?.[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? readLocalized(value as Record<string, string>, language)
    : ''
}
export const prettyJson = (json: string | null | undefined) => {
  const parsed = parseJsonRecord(json)
  return parsed ? JSON.stringify(parsed, null, 2) : json || ''
}
