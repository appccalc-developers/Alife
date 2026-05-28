import { useEffect, useMemo, useRef, useState } from 'react'
import { translateUi, type UiTextKey } from '../../i18n/uiText'
import type { GroupEventRecord, MultilingualString } from '../../types/event'
import type { EnrollmentDraft } from '../../types/enrollment'
import type { AiSessionAppContext } from '../../types/aiSession'
import { useAiSession } from '../../hooks/useAiSession'
import { enrollmentSessionService } from '../../services/enrollmentSessionService'
import { normalizeApiError } from '../../services/http'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

type Props = {
  open?: boolean
  variant?: 'dialog' | 'page'
  groupId: string
  event: GroupEventRecord
  memberId?: string
  language: string
  onClose?: () => void
  onSuccess: (message: string) => void
}

const initialMessage = (language: string): ChatMessage => ({
  role: 'assistant',
  text: translateUi(language, 'enrollmentAssistantIntro'),
})

const createEnrollmentSessionId = (memberId: string | undefined, eventId: string) =>
  `member-${memberId ?? 'anonymous'}-event-${eventId}-enrollment`

const buildEnrollmentEventData = (event: GroupEventRecord) => {
  const fallback = {
    id: event.id,
    titleEn: event.titleEn,
    titleZh: event.titleZh,
    startDate: event.startDate,
    endDate: event.endDate,
  }

  try {
    const parsed = JSON.parse(event.eventDataJson)
    return typeof parsed === 'object' && parsed !== null
      ? {
        ...fallback,
        ...parsed,
        id: typeof parsed.id === 'string' ? parsed.id : event.id,
      }
      : fallback
  } catch {
    return fallback
  }
}

const getLocalizedText = (value: MultilingualString | null | undefined, language: string) =>
  (language === 'zh' ? value?.zh : value?.en) || value?.en || value?.zh || ''

const getFallbackReply = (draft: EnrollmentDraft | null, language: string) => {
  if (!draft?.applicantName.trim()) {
    return translateUi(language, 'enrollmentNeedName')
  }

  if (draft.consentStatus !== 'granted') {
    return translateUi(language, 'enrollmentNeedConsent')
  }

  return translateUi(language, 'enrollmentReadyToSubmit')
}

const getConsentLabel = (draft: EnrollmentDraft | null, language: string) => {
  switch (draft?.consentStatus) {
    case 'granted':
      return translateUi(language, 'consentGranted')
    case 'declined':
      return translateUi(language, 'consentDeclined')
    default:
      return translateUi(language, 'consentPending')
  }
}

const EnrollmentChatDialog = ({
  open = true,
  variant = 'dialog',
  groupId,
  event,
  memberId,
  language,
  onClose,
  onSuccess,
}: Props) => {
  const t = (key: UiTextKey) => translateUi(language, key)
  const isDialog = variant === 'dialog'
  const sessionId = useMemo(
    () => createEnrollmentSessionId(memberId, event.id),
    [event.id, memberId],
  )
  const appContext = useMemo<AiSessionAppContext>(() => ({
    language,
    groupId,
    ...(memberId ? { memberId } : {}),
    eventId: event.id,
    eventData: buildEnrollmentEventData(event),
  }), [event, groupId, language, memberId])
  const { state, loading, error, clearError, sendMessage } = useAiSession<EnrollmentDraft, MultilingualString | null>(
    sessionId,
    '/api/enrollments/session',
    appContext,
  )
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage(language)])
  const [input, setInput] = useState('')
  const [paymentFiles, setPaymentFiles] = useState<File[]>([])
  const [commitStatus, setCommitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [commitError, setCommitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([initialMessage(language)])
    setInput('')
    setPaymentFiles([])
    setCommitStatus('idle')
    setCommitError('')
    clearError()
  }, [clearError, event.id, language])

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, loading, open])

  if (!open) {
    return null
  }

  const draft = state?.draft ?? null
  const assistantReply = getLocalizedText(state?.context, language) || getFallbackReply(draft, language)
  const canCommit = Boolean(draft?.applicantName.trim())
    && draft?.consentStatus === 'granted'
    && paymentFiles.length > 0
    && commitStatus !== 'saving'

  const handleSend = async () => {
    const message = input.trim()
    if (!message || loading) {
      return
    }

    setInput('')
    setCommitStatus('idle')
    setCommitError('')
    clearError()
    setMessages((current) => [...current, { role: 'user', text: message }])

    try {
      const response = await sendMessage(message)
      const replyText = getLocalizedText(response.context ?? null, language)
        || getFallbackReply(response.result ?? draft, language)
      setMessages((current) => [...current, { role: 'assistant', text: replyText }])
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setMessages((current) => [...current, { role: 'assistant', text: `❌ ${apiError.message}` }])
    }
  }

  const handleCommit = async () => {
    if (!canCommit) {
      return
    }

    setCommitStatus('saving')
    setCommitError('')

    try {
      const response = await enrollmentSessionService.createEnrollment({
        eventId: event.id,
        groupId,
        sessionId,
        draft,
        paymentFiles,
      })
      setCommitStatus('saved')
      setMessages((current) => [...current, { role: 'assistant', text: `✅ ${response.message}` }])
      onSuccess(response.message)
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setCommitStatus('error')
      setCommitError(apiError.message)
      setMessages((current) => [...current, { role: 'assistant', text: `❌ ${apiError.message}` }])
    }
  }

  return (
    <div className={isDialog ? 'fixed inset-0 z-[60] flex items-end bg-slate-950/45 desktop:items-center desktop:justify-center' : 'mx-auto flex w-full max-w-6xl flex-col'}>
      {isDialog ? (
        <button type="button" className="absolute inset-0" aria-label="Close enrollment dialog" onClick={() => onClose?.()} />
      ) : null}
      <section className={isDialog ? 'relative z-10 flex h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl desktop:h-[80vh] desktop:max-w-4xl desktop:rounded-3xl' : 'flex min-h-[calc(100vh-9rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              {t('enrollmentAiAssistantTitle')}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {event.titleEn || event.titleZh || t('eventEnrollment')}
            </h2>
          </div>
          {isDialog ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => onClose?.()}
              aria-label="Close enrollment dialog"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-0 desktop:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-h-0 flex-col border-b border-slate-200 desktop:border-b-0 desktop:border-r">
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={[
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'ml-auto bg-emerald-700 text-white'
                      : 'mr-auto bg-white text-slate-800 shadow-sm',
                  ].join(' ')}
                >
                  {message.text}
                </div>
              ))}
              {loading && (
                <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                  <span className="animate-pulse">{t('preparingEnrollmentDraft')}</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-200 px-4 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSend().catch(() => undefined)
                    }
                  }}
                  disabled={loading}
                  placeholder={t('enrollmentChatPlaceholder')}
                  className="min-h-24 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => handleSend().catch(() => undefined)}
                  disabled={loading || !input.trim()}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                  aria-label={t('send')}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              {(error || commitError) && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {commitError || error}
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-4 overflow-y-auto bg-white px-4 py-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span className="font-semibold">{t('aiReply')}</span>
              {assistantReply}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t('enrollmentDraft')}
                </h3>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                  {t('live')}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {t('name')}
                  </p>
                  <p>{draft?.applicantName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {t('consent')}
                  </p>
                  <p>{getConsentLabel(draft, language)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {t('paymentFiles')}
                  </p>
                  {paymentFiles.length === 0 ? (
                    <p className="text-slate-500">{t('noFilesAttached')}</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-slate-600">
                      {paymentFiles.map((file) => (
                        <li key={`${file.name}-${file.size}`} className="rounded bg-white px-2 py-1">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('attachPaymentFiles')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  setPaymentFiles(files)
                }}
              />

              <button
                type="button"
                onClick={() => handleCommit().catch(() => undefined)}
                disabled={!canCommit}
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commitStatus === 'saving' ? t('submitting') : t('createEnrollment')}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                {t('enrollmentRequirementsHint')}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

export default EnrollmentChatDialog
