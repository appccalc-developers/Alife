import type { Language } from './locale'

export const languageNames: Record<Language, string> = { en: 'English', zh: '中文' }

export const languageSelectorText = {
  current: {
    en: (name: string) => `Select language, current language: ${name}`,
    zh: (name: string) => `选择语言，当前语言：${name}`,
  },
  select: { en: 'Select language', zh: '选择语言' },
}
