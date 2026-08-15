export type Language = 'en' | 'zh'

export const LANGUAGE_STORAGE_KEY = 'alife.language'

type LocaleMetadata = {
  lang: string
  dir: 'ltr' | 'rtl'
  title: string
  description: string
  socialDescription: string
  author: string
  imageAlt: string
  openGraphLocale: string
  alternateOpenGraphLocale: string
}

export const localeConfig: Record<Language, LocaleMetadata> = {
  en: {
    lang: 'en-NZ',
    dir: 'ltr',
    title: 'Chinese Abundant Life Church | Alife',
    description: 'A bilingual community platform for Chinese Abundant Life Church groups, members, events, sermons, and shared pages.',
    socialDescription: 'Connect with groups, events, sermons, pages, and shared community life in one bilingual church platform.',
    author: 'Chinese Abundant Life Church',
    imageAlt: 'Chinese Abundant Life Church on Alife',
    openGraphLocale: 'en_NZ',
    alternateOpenGraphLocale: 'zh_CN',
  },
  zh: {
    lang: 'zh-CN',
    dir: 'ltr',
    title: '基督城华人丰盛生命教会 | Alife',
    description: 'Alife 是面向基督城华人丰盛生命教会小组、成员、活动、讲道和共享页面的双语社区平台。',
    socialDescription: '在一个双语教会平台中连接小组、活动、讲道、页面与群体生活。',
    author: '基督城华人丰盛生命教会',
    imageAlt: '基督城华人丰盛生命教会 Alife 平台',
    openGraphLocale: 'zh_CN',
    alternateOpenGraphLocale: 'en_NZ',
  },
}

const isLanguage = (value: string | null): value is Language => value === 'en' || value === 'zh'

const isChineseBrowserLanguage = (value: string) => /^zh(?:-|$)/i.test(value.trim())

export const resolveInitialLanguage = (
  storedLanguage: string | null,
  browserLanguages: readonly string[],
): Language => {
  if (isLanguage(storedLanguage)) {
    return storedLanguage
  }

  const primaryBrowserLanguage = browserLanguages.find((value) => value.trim()) ?? ''
  return isChineseBrowserLanguage(primaryBrowserLanguage) ? 'zh' : 'en'
}

export const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  let storedLanguage: string | null = null
  try {
    storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // Browsers can disable storage while still exposing localStorage.
  }

  const browserLanguages = [...(navigator.languages ?? []), navigator.language]
  return resolveInitialLanguage(storedLanguage, browserLanguages)
}

export const saveLanguagePreference = (language: Language) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Language switching should still work when preference storage is unavailable.
  }
}

const setMetaContent = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

export const updateLocalizedDocumentMetadata = (language: Language) => {
  if (typeof document === 'undefined') return

  const config = localeConfig[language]
  document.title = config.title
  setMetaContent('name', 'description', config.description)
  setMetaContent('name', 'author', config.author)
  setMetaContent('property', 'og:title', config.title)
  setMetaContent('property', 'og:description', config.socialDescription)
  setMetaContent('property', 'og:locale', config.openGraphLocale)
  setMetaContent('property', 'og:locale:alternate', config.alternateOpenGraphLocale)
  setMetaContent('property', 'og:image:alt', config.imageAlt)
  setMetaContent('name', 'twitter:card', 'summary_large_image')
  setMetaContent('name', 'twitter:title', config.title)
  setMetaContent('name', 'twitter:description', config.socialDescription)
  setMetaContent('name', 'twitter:image', '/icons/icon-512x512.png')
  setMetaContent('name', 'twitter:image:alt', config.imageAlt)
}

export const applyDocumentLocale = (language: Language) => {
  if (typeof document === 'undefined') return

  const config = localeConfig[language]
  document.documentElement.lang = config.lang
  document.documentElement.dir = config.dir
  updateLocalizedDocumentMetadata(language)
}
