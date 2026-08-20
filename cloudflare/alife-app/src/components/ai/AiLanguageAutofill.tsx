import { useState } from 'react'
import { Languages } from 'lucide-react'
import { aiTranslationService, type TranslatedTextField } from '../../services/aiTranslationService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import type { MissingTranslatableField } from '../../utils/bilingualValidation'

type Props = {
  fields: MissingTranslatableField[]
  onTranslated: (fields: TranslatedTextField[]) => void
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
    if (fields.length === 0 || translating) return

    setStatus('translating')
    setMessage(isZh ? 'Gemini 正在补全缺少的语言…' : 'Gemini is filling the missing language…')
    try {
      const translated = await aiTranslationService.translateTextFields({
        scope,
        groupId: groupId || undefined,
        fields,
      })
      onTranslated(translated)
      setStatus('translated')
      setMessage(isZh ? '另一种语言已作为 AI 草稿补全，请人工检查。' : 'The other language was filled as an AI draft. Please review it.')
    } catch (reason) {
      setStatus('error')
      setMessage(normalizeApiError(reason).message || (isZh ? 'AI 暂时无法补全内容。' : 'AI could not fill the content.'))
    }
  }

  const unavailableHint = isZh
    ? '请先只填写一种语言；已经有中英文的字段不会被覆盖。'
    : 'First fill one language only; fields that already have both languages are not overwritten.'

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
          ? (isZh ? 'AI 翻译中…' : 'AI translating…')
          : (isZh ? 'AI 补全另一语言' : 'AI fill missing language')}
      </button>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {sensitive
          ? (isZh
              ? '只会把上方缺少翻译的文字发送给 Gemini；电话、邮箱和照片不会发送。请勿填写私人或敏感备注，并在保存前检查草稿。'
              : 'Only untranslated text above is sent to Gemini; phone, email, and photos are not sent. Avoid private or sensitive notes and review the draft before saving.')
          : (isZh
              ? '只补全空白语言，不会覆盖已有文字；内容会发送给 Gemini，请在保存或发布前检查草稿。'
              : 'Only empty languages are filled and existing text is preserved. Text is sent to Gemini; review the draft before saving or publishing.')}
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
