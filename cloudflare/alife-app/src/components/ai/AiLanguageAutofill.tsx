import { aiLanguageAutofillText } from '../../i18n/aiLanguageAutofill.ts'
import { useState } from 'react'
import { Languages } from 'lucide-react'
import { aiTranslationService, type TranslatedTextField } from '../../services/aiTranslationService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { MissingTranslatableField } from '../../utils/bilingualValidation'

type Props = {
  fields: MissingTranslatableField[]
  onTranslated: (fields: TranslatedTextField[]) => void | boolean
  groupId?: string
  scope?: 'group' | 'church'
  disabled?: boolean
  sensitive?: boolean
  className?: string
}

type TranslationStatus = 'idle' | 'translating' | 'translated' | 'error'

const AiLanguageAutofill = ({
  fields,
  onTranslated,
  groupId,
  scope = 'group',
  disabled,
  sensitive,
  className = '',
}: Props) => {
  const { language } = useAuthStore()
  const isZh = language === 'zh'
  const [status, setStatus] = useState<TranslationStatus>('idle')
  const [message, setMessage] = useState('')
  const translating = status === 'translating'

  const translate = async () => {
    if (disabled || fields.length === 0 || translating) return

    setStatus('translating')
    setMessage(isZh ? aiLanguageAutofillText.geminiIsFillingTheMissingLanguage.zh : aiLanguageAutofillText.geminiIsFillingTheMissingLanguage.en)
    try {
      const translated = await aiTranslationService.translateTextFields({
        scope,
        groupId: groupId || undefined,
        fields,
      })
      if (onTranslated(translated) === false) {
        setStatus('error')
        setMessage(isZh ? aiLanguageAutofillText.translationWasNotAppliedContentOrEditAccessChanged.zh : aiLanguageAutofillText.translationWasNotAppliedContentOrEditAccessChanged.en)
        return
      }
      setStatus('translated')
      setMessage(isZh ? aiLanguageAutofillText.theOtherLanguageWasFilledAsAnAiDraft.zh : aiLanguageAutofillText.theOtherLanguageWasFilledAsAnAiDraft.en)
    } catch (reason) {
      setStatus('error')
      setMessage(normalizeApiError(reason).message || (isZh ? aiLanguageAutofillText.aiCouldNotFillTheContent.zh : aiLanguageAutofillText.aiCouldNotFillTheContent.en))
    }
  }

  const unavailableHint = isZh
    ? aiLanguageAutofillText.firstFillOneLanguageOnlyFieldsThatAlreadyHave.zh
    : aiLanguageAutofillText.firstFillOneLanguageOnlyFieldsThatAlreadyHave.en

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => { void translate() }}
        disabled={disabled || fields.length === 0 || translating}
        title={fields.length === 0 ? unavailableHint : undefined}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {translating
          ? (isZh ? aiLanguageAutofillText.aiTranslating.zh : aiLanguageAutofillText.aiTranslating.en)
          : (isZh ? aiLanguageAutofillText.aiFillMissingLanguage.zh : aiLanguageAutofillText.aiFillMissingLanguage.en)}
      </button>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {sensitive
          ? (isZh
              ? aiLanguageAutofillText.onlyUntranslatedTextAboveIsSentToGeminiPhone.zh
              : aiLanguageAutofillText.onlyUntranslatedTextAboveIsSentToGeminiPhone.en)
          : (isZh
              ? aiLanguageAutofillText.onlyEmptyLanguagesAreFilledAndExistingTextIs.zh
              : aiLanguageAutofillText.onlyEmptyLanguagesAreFilledAndExistingTextIs.en)}
      </p>
      {message ? (
        <p
          aria-live="polite"
          className={[
            'mt-2 rounded-lg border px-3 py-2 text-xs',
            status === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : status === 'translated'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-sky-200 bg-sky-50 text-sky-800',
          ].join(' ')}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

export default AiLanguageAutofill
