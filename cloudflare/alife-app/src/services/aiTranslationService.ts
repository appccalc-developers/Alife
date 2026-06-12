import { http } from './http'
import type { LanguageCode, MissingTranslatableField } from '../utils/bilingualValidation'

export type TranslateTextFieldsPayload = {
  scope: 'group' | 'church'
  groupId?: string
  fields: MissingTranslatableField[]
}

export type TranslatedTextField = {
  field: string
  language: LanguageCode
  text: string
}

export const aiTranslationService = {
  async translateTextFields(payload: TranslateTextFieldsPayload) {
    const { data } = await http.post<{ fields: TranslatedTextField[] }>('/api/ai/translate-text-fields', payload)
    return data.fields
  },
}
