import type { LocalizedText, PageEditModel, SectionEditModel } from '../types'
import type { LanguageCode, MissingTranslatableField } from './bilingualValidation'

type TranslationResultField = {
  field: string
  language: LanguageCode
  text: string
}

type FieldCandidate = {
  field: string
  textType: string
  value: unknown
}

export type PageI18nStructureIssue = {
  field: string
  sectionIndex?: number
}

export type PageI18nLanguageIssue = MissingTranslatableField & {
  sectionIndex?: number
  issue: 'englishLooksChinese' | 'chineseLooksEnglish'
}

const cjkPattern = /[\u3400-\u9fff]/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const trimText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const stripHtmlForLanguageGuess = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/https?:\/\/\S+|\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const countMatches = (value: string, pattern: RegExp) => value.match(pattern)?.length ?? 0

const looksChinese = (value: string) => {
  const text = stripHtmlForLanguageGuess(value)
  if (!text) {
    return false
  }

  const cjkCount = countMatches(text, /[\u3400-\u9fff]/g)
  const latinCount = countMatches(text, /[A-Za-z]/g)
  const meaningfulCount = cjkCount + latinCount
  return cjkCount >= 2 || (meaningfulCount > 0 && cjkCount / meaningfulCount >= 0.18)
}

const looksEnglish = (value: string) => {
  const text = stripHtmlForLanguageGuess(value)
  if (!text || cjkPattern.test(text)) {
    return false
  }

  const latinCount = countMatches(text, /[A-Za-z]/g)
  const wordCount = countMatches(text, /\b[A-Za-z]{3,}\b/g)
  return latinCount >= 24 || wordCount >= 4
}

const fieldAllowsEnglishInChinese = (field: string, textType: string) =>
  textType === 'quoteAuthor'
  || /\.streetAddress$|\.locationAddress$|\.locationName$|\.address$|\.addressNote$/.test(field)

const isLocalizedTextShape = (value: unknown) =>
  isRecord(value) && typeof value.en === 'string' && typeof value.zh === 'string'

const localizedFromUnknown = (value: unknown): LocalizedText => {
  if (typeof value === 'string') {
    if (!value.trim()) {
      return { en: '', zh: '' }
    }

    return cjkPattern.test(value) ? { en: '', zh: value } : { en: value, zh: '' }
  }

  if (!isRecord(value)) {
    return { en: '', zh: '' }
  }

  return {
    en: typeof value.en === 'string' ? value.en : '',
    zh: typeof value.zh === 'string' ? value.zh : '',
  }
}

const collectStructureIssue = (
  issues: PageI18nStructureIssue[],
  field: string,
  value: unknown,
  sectionIndex?: number,
) => {
  if (value === undefined) {
    return
  }

  if (!isLocalizedTextShape(value)) {
    issues.push({ field, sectionIndex })
  }
}

const readBilingualText = (value: unknown): LocalizedText => {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) {
      return { en: '', zh: '' }
    }

    return cjkPattern.test(text) ? { en: '', zh: text } : { en: text, zh: '' }
  }

  if (!isRecord(value)) {
    return { en: '', zh: '' }
  }

  return {
    en: trimText(value.en),
    zh: trimText(value.zh),
  }
}

const hasAnyText = (value: unknown) => {
  const text = readBilingualText(value)
  return Boolean(text.en || text.zh)
}

const findFirstTextValue = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (hasAnyText(source[key])) {
      return source[key]
    }
  }

  return undefined
}

const readHeader = (section: SectionEditModel) =>
  isRecord(section.contentJson.header) ? section.contentJson.header : {}

const normalizeExistingContentField = (
  content: Record<string, unknown>,
  key: string,
) => {
  if (!Object.prototype.hasOwnProperty.call(content, key)) {
    return
  }

  content[key] = localizedFromUnknown(content[key])
}

const landingHeroTextKeys = [
  'title',
  'headline',
  'centerText',
  'body',
  'subtitle',
  'subheadline',
  'linkLabel',
  'linkText',
  'ctaLabel',
  'secondaryLinkLabel',
  'secondaryLabel',
  'secondaryCtaLabel',
]

const countdownTextKeys = [
  'eyebrow',
  'title',
  'headline',
  'body',
  'centerText',
  'text',
  'cardEyebrow',
  'countdownLabel',
  'currentLabel',
  'completeLabel',
  'metaLabel',
  'metaValue',
  'footerText',
  'linkLabel',
  'linkText',
  'ctaLabel',
]

const contactLocationTextKeys = [
  'locationTitle',
  'locationName',
  'title',
  'streetAddress',
  'address',
  'locationAddress',
  'addressNote',
  'body',
  'contactName',
  'contactNameLabel',
  'contactPhoneLabel',
  'openMapLabel',
  'linkLabel',
  'linkText',
  'ctaLabel',
]

const spotlightTextKeys = [
  'title',
  'headline',
  'subtitle',
  'subheadline',
  'centerText',
  'body',
  'text',
  'linkLabel',
  'linkText',
  'ctaLabel',
]

const richTextKeys = [
  'title',
  'subtitle',
  'text',
  'quoteAuthor',
]

const translatableContentKeysForSection = (section: SectionEditModel) => {
  if (section.type === 'LandingHero') {
    return landingHeroTextKeys
  }

  if (section.type === 'Countdown') {
    return countdownTextKeys
  }

  if (section.type === 'ContactLocation') {
    return contactLocationTextKeys
  }

  if (section.type === 'Spotlight') {
    return spotlightTextKeys
  }

  if (section.type === 'RichText') {
    return richTextKeys
  }

  return [] as string[]
}

const visitTranslatableSectionFields = (
  section: SectionEditModel,
  sectionIndex: number,
  issues?: PageI18nStructureIssue[],
) => {
  const content = section.contentJson as Record<string, unknown>
  const header = isRecord(content.header) ? content.header : undefined

  if (header) {
    if (issues) {
      collectStructureIssue(issues, `sections.${sectionIndex}.header.title`, header.title, sectionIndex)
      collectStructureIssue(issues, `sections.${sectionIndex}.header.subtitle`, header.subtitle, sectionIndex)
    } else {
      normalizeExistingContentField(header, 'title')
      normalizeExistingContentField(header, 'subtitle')
    }
  }

  translatableContentKeysForSection(section).forEach((key) => {
    if (issues) {
      collectStructureIssue(issues, `sections.${sectionIndex}.${key}`, content[key], sectionIndex)
      return
    }

    normalizeExistingContentField(content, key)
  })

  if (section.type === 'Spotlight' && isRecord(content.contactUs)) {
    if (issues) {
      collectStructureIssue(issues, `sections.${sectionIndex}.contactUs.guidance`, content.contactUs.guidance, sectionIndex)
      collectStructureIssue(issues, `sections.${sectionIndex}.contactUs.successMessage`, content.contactUs.successMessage, sectionIndex)
    } else {
      normalizeExistingContentField(content.contactUs, 'guidance')
      normalizeExistingContentField(content.contactUs, 'successMessage')
    }
  }

  if (section.type === 'Countdown' && Array.isArray(content.items)) {
    if (issues) {
      content.items.forEach((item, itemIndex) => {
        if (isRecord(item) && Object.prototype.hasOwnProperty.call(item, 'text')) {
          collectStructureIssue(issues, `sections.${sectionIndex}.items.${itemIndex}.text`, item.text, sectionIndex)
        }
      })
    } else {
      content.items = content.items.map((item) => {
        if (!isRecord(item) || !Object.prototype.hasOwnProperty.call(item, 'text')) {
          return item
        }

        return {
          ...item,
          text: localizedFromUnknown(item.text),
        }
      })
    }
  }

  if (Array.isArray(content.actions)) {
    if (issues) {
      content.actions.forEach((action, actionIndex) => {
        if (isRecord(action) && Object.prototype.hasOwnProperty.call(action, 'label')) {
          collectStructureIssue(issues, `sections.${sectionIndex}.actions.${actionIndex}.label`, action.label, sectionIndex)
        }
      })
    } else {
      content.actions = content.actions.map((action) => {
        if (!isRecord(action) || !Object.prototype.hasOwnProperty.call(action, 'label')) {
          return action
        }

        return {
          ...action,
          label: localizedFromUnknown(action.label),
        }
      })
    }
  }
}

export const collectPageI18nStructureIssues = (model: PageEditModel): PageI18nStructureIssue[] => {
  const issues: PageI18nStructureIssue[] = []

  collectStructureIssue(issues, 'page.title', model.title)
  collectStructureIssue(issues, 'page.description', model.description)

  model.sections.forEach((section, sectionIndex) => {
    visitTranslatableSectionFields(section, sectionIndex, issues)
  })

  return issues
}

export const normalizePageI18nStructure = (model: PageEditModel): PageEditModel => ({
  ...model,
  title: localizedFromUnknown(model.title),
  description: localizedFromUnknown(model.description),
  sections: model.sections.map((section, sectionIndex) => {
    const nextSection: SectionEditModel = {
      ...section,
      contentJson: { ...section.contentJson },
      styleJson: { ...section.styleJson },
    }

    const content = nextSection.contentJson as Record<string, unknown>
    if (isRecord(content.header)) {
      content.header = { ...content.header }
    }
    if (isRecord(content.contactUs)) {
      content.contactUs = { ...content.contactUs }
    }

    visitTranslatableSectionFields(nextSection, sectionIndex)

    return nextSection
  }),
})

const collectCandidate = (
  fields: MissingTranslatableField[],
  candidate: FieldCandidate,
) => {
  const value = readBilingualText(candidate.value)
  const en = value.en.trim()
  const zh = value.zh.trim()

  if ((!en && !zh) || (en && zh)) {
    return
  }

  fields.push({
    field: candidate.field,
    sourceLanguage: zh ? 'zh' : 'en',
    targetLanguage: zh ? 'en' : 'zh',
    sourceText: zh || en,
    textType: candidate.textType,
  })
}

const pushSectionCandidates = (
  candidates: FieldCandidate[],
  section: SectionEditModel,
  index: number,
) => {
  const header = readHeader(section)
  const headerTitle = header.title
  const headerSubtitle = header.subtitle

  if (hasAnyText(headerTitle)) {
    candidates.push({
      field: `sections.${index}.header.title`,
      textType: 'sectionHeaderTitle',
      value: headerTitle,
    })
  } else {
    const title = findFirstTextValue(section.contentJson, ['title', 'headline'])
    if (title !== undefined) {
      candidates.push({
        field: `sections.${index}.title`,
        textType: 'sectionTitle',
        value: title,
      })
    }
  }

  if (hasAnyText(headerSubtitle)) {
    candidates.push({
      field: `sections.${index}.header.subtitle`,
      textType: 'sectionHeaderSubtitle',
      value: headerSubtitle,
    })
  } else {
    const subtitle = findFirstTextValue(section.contentJson, ['subtitle', 'subheadline'])
    if (subtitle !== undefined) {
      candidates.push({
        field: `sections.${index}.subtitle`,
        textType: 'sectionSubtitle',
        value: subtitle,
      })
    }
  }

  if (section.type === 'LandingHero' || section.type === 'Countdown' || section.type === 'Spotlight') {
    const body = findFirstTextValue(section.contentJson, ['body', 'centerText', 'text'])
    if (body !== undefined) {
      candidates.push({
        field: `sections.${index}.body`,
        textType: 'sectionBody',
        value: body,
      })
    }

    if (section.type === 'Spotlight' && isRecord(section.contentJson.contactUs)) {
      const guidance = section.contentJson.contactUs.guidance
      const successMessage = section.contentJson.contactUs.successMessage
      if (hasAnyText(guidance)) {
        candidates.push({
          field: `sections.${index}.contactUs.guidance`,
          textType: 'sectionBody',
          value: guidance,
        })
      }
      if (hasAnyText(successMessage)) {
        candidates.push({
          field: `sections.${index}.contactUs.successMessage`,
          textType: 'sectionBody',
          value: successMessage,
        })
      }
    }

    const linkLabel = findFirstTextValue(section.contentJson, ['linkLabel', 'linkText', 'ctaLabel'])
    if (linkLabel !== undefined) {
      candidates.push({
        field: `sections.${index}.linkLabel`,
        textType: 'sectionActionLabel',
        value: linkLabel,
      })
    }

    if (section.type === 'LandingHero') {
      const secondaryLinkLabel = findFirstTextValue(section.contentJson, ['secondaryLinkLabel', 'secondaryLabel', 'secondaryCtaLabel'])
      if (secondaryLinkLabel !== undefined) {
        candidates.push({
          field: `sections.${index}.secondaryLinkLabel`,
          textType: 'sectionActionLabel',
          value: secondaryLinkLabel,
        })
      }
    }
  }

  if (section.type === 'ContactLocation') {
    const locationTitle = findFirstTextValue(section.contentJson, ['locationTitle'])
    if (locationTitle !== undefined) {
      candidates.push({
        field: `sections.${index}.locationTitle`,
        textType: 'sectionHeaderTitle',
        value: locationTitle,
      })
    }

    const locationName = findFirstTextValue(section.contentJson, ['locationName', 'title'])
    if (locationName !== undefined) {
      candidates.push({
        field: `sections.${index}.locationName`,
        textType: 'sectionTitle',
        value: locationName,
      })
    }

    const streetAddress = findFirstTextValue(section.contentJson, ['streetAddress', 'address'])
    if (streetAddress !== undefined) {
      candidates.push({
        field: `sections.${index}.streetAddress`,
        textType: 'sectionBody',
        value: streetAddress,
      })
    }

    const locationAddress = findFirstTextValue(section.contentJson, ['locationAddress', 'addressNote', 'body'])
    if (locationAddress !== undefined) {
      candidates.push({
        field: `sections.${index}.locationAddress`,
        textType: 'sectionBody',
        value: locationAddress,
      })
    }

    const contactNameLabel = findFirstTextValue(section.contentJson, ['contactNameLabel'])
    if (contactNameLabel !== undefined) {
      candidates.push({
        field: `sections.${index}.contactNameLabel`,
        textType: 'sectionBody',
        value: contactNameLabel,
      })
    }

    const contactPhoneLabel = findFirstTextValue(section.contentJson, ['contactPhoneLabel'])
    if (contactPhoneLabel !== undefined) {
      candidates.push({
        field: `sections.${index}.contactPhoneLabel`,
        textType: 'sectionBody',
        value: contactPhoneLabel,
      })
    }

    const openMapLabel = findFirstTextValue(section.contentJson, ['openMapLabel', 'linkLabel', 'linkText', 'ctaLabel'])
    if (openMapLabel !== undefined) {
      candidates.push({
        field: `sections.${index}.openMapLabel`,
        textType: 'sectionActionLabel',
        value: openMapLabel,
      })
    }
  }

  if (section.type === 'RichText') {
    const text = findFirstTextValue(section.contentJson, ['text'])
    if (text !== undefined) {
      candidates.push({
        field: `sections.${index}.text`,
        textType: 'richTextBody',
        value: text,
      })
    }

    const quoteAuthor = findFirstTextValue(section.contentJson, ['quoteAuthor'])
    if (quoteAuthor !== undefined) {
      candidates.push({
        field: `sections.${index}.quoteAuthor`,
        textType: 'quoteAuthor',
        value: quoteAuthor,
      })
    }
  }

  const actions = Array.isArray(section.contentJson.actions) ? section.contentJson.actions : []
  actions.forEach((action, actionIndex) => {
    if (!isRecord(action) || !hasAnyText(action.label)) {
      return
    }

    candidates.push({
      field: `sections.${index}.actions.${actionIndex}.label`,
      textType: 'sectionActionLabel',
      value: action.label,
    })
  })
}

export const collectMissingPageTranslations = (model: PageEditModel): MissingTranslatableField[] => {
  const candidates: FieldCandidate[] = [
    { field: 'page.title', textType: 'pageTitle', value: model.title },
    { field: 'page.description', textType: 'pageDescription', value: model.description },
  ]

  model.sections.forEach((section, index) => {
    pushSectionCandidates(candidates, section, index)
  })

  const fields: MissingTranslatableField[] = []
  candidates.forEach((candidate) => collectCandidate(fields, candidate))
  return fields
}

export const collectSectionTranslationRequests = (
  section: SectionEditModel,
  index: number,
  sourceLanguage: LanguageCode,
): MissingTranslatableField[] => {
  const candidates: FieldCandidate[] = []
  pushSectionCandidates(candidates, section, index)

  const targetLanguage: LanguageCode = sourceLanguage === 'zh' ? 'en' : 'zh'

  return candidates.flatMap((candidate) => {
    const sourceText = readBilingualText(candidate.value)[sourceLanguage].trim()
    if (!sourceText) {
      return []
    }

    return [{
      field: candidate.field,
      sourceLanguage,
      targetLanguage,
      sourceText,
      textType: candidate.textType,
    }]
  })
}

const sectionIndexFromField = (field: string) => {
  const match = /^sections\.(\d+)\./.exec(field)
  if (!match) {
    return undefined
  }

  const index = Number.parseInt(match[1], 10)
  return Number.isInteger(index) ? index : undefined
}

const collectLanguageIssue = (
  issues: PageI18nLanguageIssue[],
  candidate: FieldCandidate,
) => {
  const value = readBilingualText(candidate.value)
  const en = value.en.trim()
  const zh = value.zh.trim()
  const sectionIndex = sectionIndexFromField(candidate.field)

  if (en && looksChinese(en)) {
    issues.push({
      field: candidate.field,
      sectionIndex,
      sourceLanguage: 'zh',
      targetLanguage: 'en',
      sourceText: looksChinese(zh) ? zh : en,
      textType: candidate.textType,
      issue: 'englishLooksChinese',
    })
  }

  if (zh && !fieldAllowsEnglishInChinese(candidate.field, candidate.textType) && looksEnglish(zh)) {
    issues.push({
      field: candidate.field,
      sectionIndex,
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      sourceText: looksEnglish(en) ? en : zh,
      textType: candidate.textType,
      issue: 'chineseLooksEnglish',
    })
  }
}

export const collectSectionLanguageQualityIssues = (
  section: SectionEditModel,
  index: number,
): PageI18nLanguageIssue[] => {
  const candidates: FieldCandidate[] = []
  pushSectionCandidates(candidates, section, index)

  const issues: PageI18nLanguageIssue[] = []
  candidates.forEach((candidate) => collectLanguageIssue(issues, candidate))
  return issues
}

export const collectPageLanguageQualityIssues = (model: PageEditModel): PageI18nLanguageIssue[] => {
  const candidates: FieldCandidate[] = [
    { field: 'page.title', textType: 'pageTitle', value: model.title },
    { field: 'page.description', textType: 'pageDescription', value: model.description },
  ]

  model.sections.forEach((section, index) => {
    pushSectionCandidates(candidates, section, index)
  })

  const issues: PageI18nLanguageIssue[] = []
  candidates.forEach((candidate) => collectLanguageIssue(issues, candidate))
  return issues
}

const mergeTranslation = (
  current: unknown,
  language: LanguageCode,
  text: string,
  overwriteExisting = false,
): LocalizedText => {
  const value = readBilingualText(current)
  if (!overwriteExisting && value[language]?.trim()) {
    return value
  }

  return {
    en: value.en ?? '',
    zh: value.zh ?? '',
    [language]: text,
  }
}

const patchContentAliases = (
  section: SectionEditModel,
  keys: string[],
  language: LanguageCode,
  text: string,
  overwriteExisting = false,
) => {
  const baseValue = findFirstTextValue(section.contentJson, keys)
  const nextValue = mergeTranslation(baseValue, language, text, overwriteExisting)
  const contentPatch = Object.fromEntries(keys.map((key) => [key, nextValue]))

  return {
    ...section,
    contentJson: {
      ...section.contentJson,
      ...contentPatch,
    },
  }
}

const contentAliasesForField = (section: SectionEditModel, field: string) => {
  if (field === 'title') {
    return section.type === 'RichText' ? ['title'] : ['title', 'headline']
  }

  if (field === 'subtitle') {
    return section.type === 'RichText' ? ['subtitle'] : ['subtitle', 'subheadline']
  }

  if (field === 'body') {
    return section.type === 'Spotlight'
      ? ['body', 'centerText', 'text']
      : ['body', 'centerText']
  }

  if (field === 'linkLabel') {
    return ['linkLabel', 'linkText', 'ctaLabel']
  }

  if (field === 'secondaryLinkLabel') {
    return ['secondaryLinkLabel', 'secondaryLabel', 'secondaryCtaLabel']
  }

  if (field === 'locationName') {
    return ['locationName', 'title']
  }

  if (field === 'streetAddress') {
    return ['streetAddress', 'address']
  }

  if (field === 'locationAddress') {
    return ['locationAddress', 'addressNote', 'body']
  }

  if (field === 'openMapLabel') {
    return ['openMapLabel', 'linkLabel', 'linkText', 'ctaLabel']
  }

  return [field]
}

const contentAliasesForHeaderField = (
  section: SectionEditModel,
  field: 'title' | 'subtitle',
) => {
  if (section.type === 'LandingHero') {
    return field === 'title'
      ? ['title', 'headline']
      : ['centerText', 'body', 'subtitle', 'subheadline']
  }

  if (section.type === 'Spotlight') {
    return field === 'title'
      ? ['title', 'headline']
      : ['subtitle', 'subheadline']
  }

  if (section.type === 'RichText') {
    return [field]
  }

  return []
}

const applySectionTranslation = (
  section: SectionEditModel,
  path: string[],
  language: LanguageCode,
  text: string,
  overwriteExisting = false,
) => {
  if (path[0] === 'header' && (path[1] === 'title' || path[1] === 'subtitle')) {
    const header = readHeader(section)
    const nextSection = {
      ...section,
      contentJson: {
        ...section.contentJson,
        header: {
          ...header,
          [path[1]]: mergeTranslation(header[path[1]], language, text, overwriteExisting),
        },
      },
    }
    const aliases = contentAliasesForHeaderField(section, path[1])
    return aliases.length > 0
      ? patchContentAliases(nextSection, aliases, language, text, overwriteExisting)
      : nextSection
  }

  if (path[0] === 'actions') {
    const actionIndex = Number.parseInt(path[1] ?? '', 10)
    if (!Number.isInteger(actionIndex)) {
      return section
    }

    const actions = Array.isArray(section.contentJson.actions) ? [...section.contentJson.actions] : []
    const currentAction = isRecord(actions[actionIndex]) ? actions[actionIndex] : {}
    actions[actionIndex] = {
      ...currentAction,
      label: mergeTranslation(currentAction.label, language, text, overwriteExisting),
    }

    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        actions,
      },
    }
  }

  if (path[0] === 'contactUs' && (path[1] === 'guidance' || path[1] === 'successMessage')) {
    const contactUs = isRecord(section.contentJson.contactUs) ? section.contentJson.contactUs : {}
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        contactUs: {
          ...contactUs,
          [path[1]]: mergeTranslation(contactUs[path[1]], language, text, overwriteExisting),
        },
      },
    }
  }

  if (!path[0]) {
    return section
  }

  return patchContentAliases(
    section,
    contentAliasesForField(section, path[0]),
    language,
    text,
    overwriteExisting,
  )
}

const prepareLocalizedForLanguageIssue = (
  current: unknown,
  issue: PageI18nLanguageIssue,
): LocalizedText => {
  const value = readBilingualText(current)
  const next: LocalizedText = {
    en: value.en ?? '',
    zh: value.zh ?? '',
  }

  if (!next[issue.sourceLanguage]?.trim()) {
    next[issue.sourceLanguage] = issue.sourceText
  }
  next[issue.targetLanguage] = ''

  return next
}

const prepareContentAliasesForLanguageIssue = (
  section: SectionEditModel,
  keys: string[],
  issue: PageI18nLanguageIssue,
) => {
  const baseValue = findFirstTextValue(section.contentJson, keys) ?? section.contentJson[keys[0]]
  const nextValue = prepareLocalizedForLanguageIssue(baseValue, issue)
  const contentPatch = Object.fromEntries(keys.map((key) => [key, nextValue]))

  return {
    ...section,
    contentJson: {
      ...section.contentJson,
      ...contentPatch,
    },
  }
}

const prepareSectionForLanguageIssue = (
  section: SectionEditModel,
  path: string[],
  issue: PageI18nLanguageIssue,
) => {
  if (path[0] === 'header' && (path[1] === 'title' || path[1] === 'subtitle')) {
    const header = readHeader(section)
    const nextSection = {
      ...section,
      contentJson: {
        ...section.contentJson,
        header: {
          ...header,
          [path[1]]: prepareLocalizedForLanguageIssue(header[path[1]], issue),
        },
      },
    }
    const aliases = contentAliasesForHeaderField(section, path[1])
    return aliases.length > 0 ? prepareContentAliasesForLanguageIssue(nextSection, aliases, issue) : nextSection
  }

  if (path[0] === 'actions') {
    const actionIndex = Number.parseInt(path[1] ?? '', 10)
    if (!Number.isInteger(actionIndex)) {
      return section
    }

    const actions = Array.isArray(section.contentJson.actions) ? [...section.contentJson.actions] : []
    const currentAction = isRecord(actions[actionIndex]) ? actions[actionIndex] : {}
    actions[actionIndex] = {
      ...currentAction,
      label: prepareLocalizedForLanguageIssue(currentAction.label, issue),
    }

    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        actions,
      },
    }
  }

  if (path[0] === 'contactUs' && (path[1] === 'guidance' || path[1] === 'successMessage')) {
    const contactUs = isRecord(section.contentJson.contactUs) ? section.contentJson.contactUs : {}
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        contactUs: {
          ...contactUs,
          [path[1]]: prepareLocalizedForLanguageIssue(contactUs[path[1]], issue),
        },
      },
    }
  }

  if (!path[0]) {
    return section
  }

  return prepareContentAliasesForLanguageIssue(section, contentAliasesForField(section, path[0]), issue)
}

export const preparePageForLanguageQualityTranslations = (
  model: PageEditModel,
  issues: PageI18nLanguageIssue[],
): PageEditModel =>
  issues.reduce<PageEditModel>((currentModel, issue) => {
    if (issue.field === 'page.title' || issue.field === 'page.description') {
      const field = issue.field === 'page.title' ? 'title' : 'description'
      return {
        ...currentModel,
        [field]: prepareLocalizedForLanguageIssue(currentModel[field], issue),
      }
    }

    const match = /^sections\.(\d+)\.(.+)$/.exec(issue.field)
    if (!match) {
      return currentModel
    }

    const sectionIndex = Number.parseInt(match[1], 10)
    const section = currentModel.sections[sectionIndex]
    if (!section) {
      return currentModel
    }

    const nextSections = [...currentModel.sections]
    nextSections[sectionIndex] = prepareSectionForLanguageIssue(
      section,
      match[2].split('.'),
      issue,
    )

    return {
      ...currentModel,
      sections: nextSections,
    }
  }, model)

export const applyPageTranslations = (
  model: PageEditModel,
  translatedFields: TranslationResultField[],
  requestedFields: MissingTranslatableField[],
  options: { overwriteExisting?: boolean } = {},
): PageEditModel => {
  const requestedTargets = new Set(
    requestedFields.map((field) => `${field.field}.${field.targetLanguage}`),
  )

  return translatedFields.reduce<PageEditModel>((currentModel, translated) => {
    if (!requestedTargets.has(`${translated.field}.${translated.language}`)) {
      return currentModel
    }

    if (translated.field === 'page.title' || translated.field === 'page.description') {
      const field = translated.field === 'page.title' ? 'title' : 'description'
      return {
        ...currentModel,
        [field]: mergeTranslation(
          currentModel[field],
          translated.language,
          translated.text,
          options.overwriteExisting,
        ),
      }
    }

    const match = /^sections\.(\d+)\.(.+)$/.exec(translated.field)
    if (!match) {
      return currentModel
    }

    const sectionIndex = Number.parseInt(match[1], 10)
    const section = currentModel.sections[sectionIndex]
    if (!section) {
      return currentModel
    }

    const nextSections = [...currentModel.sections]
    nextSections[sectionIndex] = applySectionTranslation(
      section,
      match[2].split('.'),
      translated.language,
      translated.text,
      options.overwriteExisting,
    )

    return {
      ...currentModel,
      sections: nextSections,
    }
  }, model)
}
