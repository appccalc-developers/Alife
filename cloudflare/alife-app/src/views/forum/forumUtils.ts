import type { LocalizedText } from '../../types'
import type { ForumCategoryDto, ForumMediaItem } from '../../types/forum'
import { localizeText } from '../../utils/localizedText'

export const parseLocalizedJson = (json: string | null | undefined): LocalizedText => {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, (value as string).trim()]),
    )
  } catch {
    return {}
  }
}

export const localizedJsonText = (json: string | null | undefined, language: string) =>
  localizeText(parseLocalizedJson(json), language)

export const localizedJsonExcerpt = (json: string | null | undefined, language: string, maxLength = 140) => {
  const value = localizedJsonText(json, language).replace(/\s+/g, ' ').trim()
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trim()}...`
}

export const oneLanguagePayload = (language: string, value: string): LocalizedText => ({
  [language === 'zh' ? 'zh' : 'en']: value.trim(),
})

export const formatForumDate = (value: string | null | undefined, language: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value

  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const categoryName = (categories: ForumCategoryDto[], categoryId: string, language: string) =>
  localizedJsonText(categories.find((category) => category.id === categoryId)?.nameJson, language)

export const parseForumMedia = (json: string | null | undefined): ForumMediaItem[] => {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
      .map((item): ForumMediaItem => {
        const kind: ForumMediaItem['kind'] = item.kind === 'video' ? 'video' : 'image'
        return {
          kind,
          url: typeof item.url === 'string' ? item.url : '',
          key: typeof item.key === 'string' ? item.key : null,
          name: typeof item.name === 'string' ? item.name : null,
          contentType: typeof item.contentType === 'string' ? item.contentType : null,
          sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : null,
        }
      })
      .filter((item) => item.url)
  } catch {
    return []
  }
}
