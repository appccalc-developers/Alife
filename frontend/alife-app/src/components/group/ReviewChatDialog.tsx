import { useEffect, useMemo, useRef, useState } from 'react'
import { translateUi, type UiTextKey } from '../../i18n/uiText'
import type { AiSessionAppContext } from '../../types/aiSession'
import type { EventEnrollmentRecord } from '../../types/enrollment'
import type { GroupEventRecord, MultilingualString } from '../../types/event'
import type { EventReviewRecord, ReviewDraft } from '../../types/review'
import { useAiSession } from '../../hooks/useAiSession'
import { fileToAiAttachment, parseReviewDraft, reviewSessionService } from '../../services/reviewSessionService'
import { normalizeApiError } from '../../services/http'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

type Props = {
  groupId: string
  event: GroupEventRecord
  memberId?: string
  language: string
  existingReview?: EventReviewRecord | null
  enrollments?: EventEnrollmentRecord[]
  onSuccess: (message: string) => void
}

const createReviewSessionId = (memberId: string | undefined, eventId: string) =>
  `member-${memberId ?? 'anonymous'}-event-${eventId}-review`

const initialMessage = (language: string): ChatMessage => ({
  role: 'assistant',
  text: translateUi(language, 'reviewAssistantIntro'),
})

const buildEventData = (event: GroupEventRecord) => {
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

const localized = (value: MultilingualString | null | undefined, language: string) =>
  (language === 'zh' ? value?.zh : value?.en) || value?.en || value?.zh || ''

const fallbackReply = (draft: ReviewDraft | null, language: string) => {
  if (!draft?.reflection?.en?.trim() && !draft?.reflection?.zh?.trim()) {
    return translateUi(language, 'reviewNeedMoreInfo')
  }

  return translateUi(language, 'reviewDraftReady')
}

const ReviewChatDialog = ({
  groupId,
  event,
  memberId,
  language,
  existingReview = null,
  enrollments = [],
  onSuccess,
}: Props) => {
  const sessionId = useMemo(
    () => createReviewSessionId(memberId, event.id),
    [event.id, memberId],
  )
  const existingDraft = useMemo(() => parseReviewDraft(existingReview), [existingReview])
  const appContext = useMemo<AiSessionAppContext>(() => ({
    language,
    groupId,
    ...(memberId ? { memberId } : {}),
    eventId: event.id,
    eventData: buildEventData(event),
    knownFacts: {
      reviewId: existingReview?.id,
      existingReview: existingDraft,
      enrollments: enrollments.map((item) => {
        try {
          return JSON.parse(item.enrollmentJson)
        } catch {
          return {
            id: item.id,
            eventId: item.eventId,
            memberId: item.memberId,
          }
        }
      }),
    },
  }), [enrollments, event, existingDraft, existingReview?.id, groupId, language, memberId])
  const t = (key: UiTextKey) => translateUi(language, key)
  const { state, setState, loading, error, clearError, sendMessage } = useAiSession<ReviewDraft, MultilingualString | null>(
    sessionId,
    '/api/reviews/session',
    appContext,
  )
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage(language)])
  const [input, setInput] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [commitStatus, setCommitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [commitError, setCommitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([initialMessage(language)])
    setInput('')
    setPhotoFiles([])
    setCommitStatus('idle')
    setCommitError('')
    clearError()
  }, [clearError, event.id, language])

  useEffect(() => {
    if (!existingDraft) {
      return
    }

    reviewSessionService.start(sessionId, { appContext, draft: existingDraft }).catch(() => undefined)
    setState((current) => current
      ? { ...current, draft: current.draft ?? existingDraft, context: current.context ?? existingDraft.assistantReply ?? null }
      : current)
  }, [appContext, existingDraft, sessionId, setState])

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file))
    setPhotoPreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photoFiles])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, loading])

  const draft = state?.draft ?? existingDraft ?? null
  const assistantReply = localized(state?.context ?? draft?.assistantReply, language) || fallbackReply(draft, language)
  const canCommit = Boolean(draft?.reflection?.zh?.trim() && draft?.reflection?.en?.trim())
    && commitStatus !== 'saving'

  const handleSend = async (includePhotos = false) => {
    const message = input.trim()
    if ((!message && !includePhotos) || loading) {
      return
    }

    setInput('')
    setCommitStatus('idle')
    setCommitError('')
    clearError()
    const userText = message || t('analyzePhotosPrompt')
    setMessages((current) => [...current, { role: 'user', text: userText }])

    try {
      const attachments = includePhotos
        ? await Promise.all(photoFiles.map(fileToAiAttachment))
        : []
      const response = await sendMessage(userText, { inputMode: 'text', appContext, attachments })
      const replyText = localized(response.context ?? response.result?.assistantReply, language)
        || fallbackReply(response.result ?? draft, language)
      setMessages((current) => [...current, { role: 'assistant', text: replyText }])
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setMessages((current) => [...current, { role: 'assistant', text: `Error: ${apiError.message}` }])
    }
  }

  const handleCommit = async () => {
    if (!draft || !canCommit) {
      return
    }

    setCommitStatus('saving')
    setCommitError('')

    try {
      const response = await reviewSessionService.saveReview({
        eventId: event.id,
        groupId,
        memberId,
        sessionId,
        existingReview,
        draft,
        photoFiles,
      })
      setCommitStatus('saved')
      setMessages((current) => [...current, { role: 'assistant', text: response.message }])
      onSuccess(response.message)
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setCommitStatus('error')
      setCommitError(apiError.message)
      setMessages((current) => [...current, { role: 'assistant', text: `Error: ${apiError.message}` }])
    }
  }

  const title = language === 'zh'
    ? event.titleZh || event.titleEn || translateUi(language, 'untitled')
    : event.titleEn || event.titleZh || translateUi(language, 'untitled')

  return (
    <section className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {t('reviewAiAssistantTitle')}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {title}
          </h2>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 desktop:grid-cols-[minmax(0,1fr)_22rem]">
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
            {loading ? (
              <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
                <span className="animate-pulse">{t('preparingReviewDraft')}</span>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 px-4 py-4">
            <div className="flex items-end gap-3">
              <textarea
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend(false).catch(() => undefined)
                  }
                }}
                disabled={loading}
                placeholder={t('reviewChatPlaceholder')}
                className="min-h-24 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleSend(false).catch(() => undefined)}
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
            {(error || commitError) ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {commitError || error}
              </p>
            ) : null}
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
                {t('reviewDraft')}
              </h3>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                {existingReview ? t('edit') : t('new')}
              </span>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {t('summary')}
                </p>
                <p>{localized(draft?.summary, language) || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {t('reflection')}
                </p>
                <p className="whitespace-pre-wrap">{localized(draft?.reflection, language) || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {t('people')}
                </p>
                {draft?.recognizedPeople?.length ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {draft.recognizedPeople.map((person) => (
                      <li key={`${person.name}-${person.correction ?? ''}`} className="rounded-full bg-white px-2 py-1 text-xs">
                        {person.correction || person.name}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-slate-500">-</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {t('activities')}
                </p>
                {draft?.recognizedActivities?.length ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {draft.recognizedActivities.map((activity, index) => (
                      <li key={`${localized(activity.name, language)}-${index}`} className="rounded-full bg-white px-2 py-1 text-xs">
                        {localized(activity.name, language)}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-slate-500">-</p>}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={() => fileInputRef.current?.click()}
            >
              {t('chooseEventPhotos')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
            />
            {photoPreviews.length ? (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((url, index) => (
                  <img key={url} src={url} alt={`Review upload ${index + 1}`} className="aspect-square rounded-lg object-cover" />
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => handleSend(true).catch(() => undefined)}
              disabled={loading || photoFiles.length === 0}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('analyzePhotos')}
            </button>
            <button
              type="button"
              onClick={() => handleCommit().catch(() => undefined)}
              disabled={!canCommit}
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commitStatus === 'saving'
                ? t('saving')
                : existingReview ? t('updateReview') : t('submitReview')}
            </button>
            <p className="text-xs leading-5 text-slate-500">
              {t('reviewSubmitConfirmHint')}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default ReviewChatDialog
