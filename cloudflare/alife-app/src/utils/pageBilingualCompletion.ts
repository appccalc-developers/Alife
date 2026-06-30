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

const cjkPattern = /[\u3400-\u9fff]/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const trimText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

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

  if (section.type === 'Hero' || section.type === 'LandingHeroSection' || section.type === 'Spotlight') {
    const body = findFirstTextValue(section.contentJson, ['body', 'centerText', 'subtitle', 'subheadline', 'text'])
    if (body !== undefined) {
      candidates.push({
        field: `sections.${index}.body`,
        textType: 'sectionBody',
        value: body,
      })
    }

    const linkLabel = findFirstTextValue(section.contentJson, ['primaryLabel', 'linkLabel', 'linkText', 'ctaLabel'])
    if (linkLabel !== undefined) {
      candidates.push({
        field: `sections.${index}.linkLabel`,
        textType: 'sectionActionLabel',
        value: linkLabel,
      })
    }

    if (section.type === 'LandingHeroSection') {
      const secondaryLabel = findFirstTextValue(section.contentJson, ['secondaryLabel', 'secondaryLinkText'])
      if (secondaryLabel !== undefined) {
        candidates.push({
          field: `sections.${index}.secondaryLabel`,
          textType: 'sectionActionLabel',
          value: secondaryLabel,
        })
      }
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

const mergeTranslation = (
  current: unknown,
  language: LanguageCode,
  text: string,
): LocalizedText => {
  const value = readBilingualText(current)
  if (value[language]?.trim()) {
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
) => {
  const baseValue = findFirstTextValue(section.contentJson, keys)
  const nextValue = mergeTranslation(baseValue, language, text)
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
    if (section.type === 'LandingHeroSection') {
      return ['body', 'centerText', 'subtitle', 'subheadline']
    }

    return section.type === 'Spotlight'
      ? ['body', 'centerText', 'text']
      : ['body', 'centerText']
  }

  if (field === 'linkLabel') {
    if (section.type === 'LandingHeroSection') {
      return ['primaryLabel', 'linkLabel', 'linkText', 'ctaLabel']
    }

    return ['linkLabel', 'linkText', 'ctaLabel']
  }

  if (field === 'secondaryLabel') {
    return ['secondaryLabel', 'secondaryLinkText']
  }

  return [field]
}

const applySectionTranslation = (
  section: SectionEditModel,
  path: string[],
  language: LanguageCode,
  text: string,
) => {
  if (path[0] === 'header' && (path[1] === 'title' || path[1] === 'subtitle')) {
    const header = readHeader(section)
    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        header: {
          ...header,
          [path[1]]: mergeTranslation(header[path[1]], language, text),
        },
      },
    }
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
      label: mergeTranslation(currentAction.label, language, text),
    }

    return {
      ...section,
      contentJson: {
        ...section.contentJson,
        actions,
      },
    }
  }

  if (!path[0]) {
    return section
  }

  return patchContentAliases(section, contentAliasesForField(section, path[0]), language, text)
}

export const applyPageTranslations = (
  model: PageEditModel,
  translatedFields: TranslationResultField[],
  requestedFields: MissingTranslatableField[],
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
        [field]: mergeTranslation(currentModel[field], translated.language, translated.text),
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
    )

    return {
      ...currentModel,
      sections: nextSections,
    }
  }, model)
}
