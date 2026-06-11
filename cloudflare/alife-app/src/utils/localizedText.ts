import type { LocalizedText } from '../types'

export const languageKey = (language: string) => (language === 'zh' ? 'zh' : language)

export const localizeText = (value: LocalizedText | string | null | undefined, language = 'en') => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  const key = languageKey(language)
  if (key === 'zh') {
    return value.zh || value.cn || value.en || Object.values(value)[0] || ''
  }

  return value[key] || value.en || value.zh || value.cn || Object.values(value)[0] || ''
}

export const toLocalizedText = (value: LocalizedText | string | null | undefined): LocalizedText => {
  if (!value) {
    return { en: '', zh: '' }
  }

  if (typeof value === 'string') {
    return { en: value, zh: value }
  }

  return { en: value.en ?? '', zh: value.zh ?? value.cn ?? '' }
}
