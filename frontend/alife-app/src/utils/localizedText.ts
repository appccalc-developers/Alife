import type { LocalizedText } from '../types'

export const languageKey = (language: string) => (language === 'zh' ? 'cn' : language)

export const localizeText = (value: LocalizedText | string | null | undefined, language = 'en') => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  const key = languageKey(language)
  return value[key] || value.en || value.cn || Object.values(value)[0] || ''
}

export const toLocalizedText = (value: LocalizedText | string | null | undefined): LocalizedText => {
  if (!value) {
    return { en: '', cn: '' }
  }

  if (typeof value === 'string') {
    return { en: value, cn: value }
  }

  return { en: value.en ?? '', cn: value.cn ?? '', ...value }
}
