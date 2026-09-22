import { validateRequiredBilingualFields, type BilingualText, type MissingTranslatableField } from './bilingualValidation.ts'

// Reuse the existing translation contract; no event records or private context are sent.
export function eventTranslationFields(value: BilingualText, textType: string) {
  return validateRequiredBilingualFields({ content: value }, [{ field: 'content', textType }]).missingTranslatableFields
}

export function applyEventTranslation(
  current: BilingualText, requested: MissingTranslatableField[],
  translated: { field: string; language: string; text: string }[], maxLength?: number,
) {
  const request = requested[0]
  if (!request || (current[request.sourceLanguage] || '').trim() !== request.sourceText || current[request.targetLanguage]?.trim()) return null
  const result = translated.find(item => item.field === request.field && item.language === request.targetLanguage)
  if (!result?.text?.trim() || (maxLength && result.text.length > maxLength)) return null
  return { en: current.en || '', zh: current.zh || '', [request.targetLanguage]: result.text }
}
