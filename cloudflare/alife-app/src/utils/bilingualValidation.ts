import type { LocalizedText } from '../types'

export type LanguageCode = 'zh' | 'en'

export type BilingualText = {
  zh?: string
  en?: string
}

export type MissingTranslatableField = {
  field: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  sourceText: string
  textType: string
}

export type BilingualValidationResult = {
  isComplete: boolean
  canAiAutofill: boolean
  missingTranslatableFields: MissingTranslatableField[]
  blockingIncompleteFields: string[]
}

export type RequiredBilingualField = {
  field: string
  textType: string
}

export function validateRequiredBilingualFields(
  form: Record<string, BilingualText | LocalizedText | null | undefined>,
  requiredFields: RequiredBilingualField[],
): BilingualValidationResult {
  const missingTranslatableFields: MissingTranslatableField[] = []
  const blockingIncompleteFields: string[] = []

  for (const { field, textType } of requiredFields) {
    const value = form[field]
    const zh = typeof value?.zh === 'string' ? value.zh.trim() : ''
    const en = typeof value?.en === 'string' ? value.en.trim() : ''

    if (zh && en) {
      continue
    }

    if (!zh && !en) {
      blockingIncompleteFields.push(field)
      continue
    }

    missingTranslatableFields.push({
      field,
      sourceLanguage: zh ? 'zh' : 'en',
      targetLanguage: zh ? 'en' : 'zh',
      sourceText: zh || en,
      textType,
    })
  }

  return {
    isComplete: blockingIncompleteFields.length === 0 && missingTranslatableFields.length === 0,
    canAiAutofill: blockingIncompleteFields.length === 0 && missingTranslatableFields.length > 0,
    missingTranslatableFields,
    blockingIncompleteFields,
  }
}
