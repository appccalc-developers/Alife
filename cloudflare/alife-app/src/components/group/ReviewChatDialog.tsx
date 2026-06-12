import { useEffect, useMemo, useRef, useState } from 'react'
import { translateUi, type UiTextKey } from '../../i18n/uiText'
import type { AiSessionAppContext } from '../../types/aiSession'
import type { EventEnrollmentRecord } from '../../types/enrollment'
import type { GroupEventRecord, MultilingualString } from '../../types/event'
import type { EventReviewRecord, ReviewDraft } from '../../types/review'
import { useAiSession } from '../../hooks/useAiSession'
import { createReviewId, fileToAiAttachment, parseReviewDraft, reviewSessionService } from '../../services/reviewSessionService'
import { normalizeApiError } from '../../services/http'
import { normalizeImageUrl } from '../../services/imageWorkerApi'
import type { AiContentContext } from '../../utils/aiContentContext'
import CoverImage from '../CoverImage'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

type Props = {
  groupId: string
  event: GroupEventRecord
  memberId?: string
  language: string
  reviewId?: string
  existingReview?: EventReviewRecord | null
  enrollments?: EventEnrollmentRecord[]
  aiContentContext?: AiContentContext
  onSuccess: (message: string) => void
}

const createReviewSessionId = (memberId: string | undefined, eventId: string, reviewId: string) =>
  `member-${memberId ?? 'anonymous'}-event-${eventId}-review-${reviewId}`

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

const hasMultilingualContent = (value: MultilingualString | null | undefined) =>
  Boolean(value?.zh?.trim() || value?.en?.trim())

const hasReviewDraftContent = (draft: ReviewDraft | null | undefined) =>
  Boolean(
    hasMultilingualContent(draft?.summary)
    || hasMultilingualContent(draft?.reflection)
    || draft?.recognizedPeople?.length
    || draft?.recognizedActivities?.length
    || draft?.photoFiles?.length,
  )

const timestampValue = (value: string | null | undefined) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const shouldPreferExistingDraft = (
  existingDraft: ReviewDraft | null,
  candidateDraft: ReviewDraft | null,
  targetReviewId: string,
) => {
  if (!existingDraft) {
    return false
  }

  if (!candidateDraft) {
    return true
  }

  if (candidateDraft.reviewId && candidateDraft.reviewId !== targetReviewId) {
    return true
  }

  if (!hasReviewDraftContent(candidateDraft)) {
    return true
  }

  return timestampValue(existingDraft.updatedAtUtc) > timestampValue(candidateDraft.updatedAtUtc)
}

const mergeMultilingualContent = (
  existingValue: MultilingualString,
  candidateValue: MultilingualString,
): MultilingualString => ({
  zh: candidateValue.zh?.trim() ? candidateValue.zh : existingValue.zh,
  en: candidateValue.en?.trim() ? candidateValue.en : existingValue.en,
})

const mergeExistingReviewDraft = (
  existingDraft: ReviewDraft | null,
  candidateDraft: ReviewDraft | null,
  targetReviewId: string,
): ReviewDraft | null => {
  if (!existingDraft) {
    return candidateDraft
  }

  if (shouldPreferExistingDraft(existingDraft, candidateDraft, targetReviewId)) {
    return existingDraft
  }

  if (!candidateDraft) {
    return existingDraft
  }

  return {
    ...existingDraft,
    ...candidateDraft,
    reviewId: targetReviewId,
    eventId: candidateDraft.eventId || existingDraft.eventId,
    groupId: candidateDraft.groupId || existingDraft.groupId,
    memberId: candidateDraft.memberId || existingDraft.memberId,
    summary: mergeMultilingualContent(existingDraft.summary, candidateDraft.summary),
    reflection: mergeMultilingualContent(existingDraft.reflection, candidateDraft.reflection),
    recognizedPeople: candidateDraft.recognizedPeople.length
      ? candidateDraft.recognizedPeople
      : existingDraft.recognizedPeople,
    recognizedActivities: candidateDraft.recognizedActivities.length
      ? candidateDraft.recognizedActivities
      : existingDraft.recognizedActivities,
    photoFiles: candidateDraft.photoFiles.length ? candidateDraft.photoFiles : existingDraft.photoFiles,
    assistantReply: candidateDraft.assistantReply ?? existingDraft.assistantReply,
    submittedAtUtc: candidateDraft.submittedAtUtc || existingDraft.submittedAtUtc,
    updatedAtUtc: candidateDraft.updatedAtUtc || existingDraft.updatedAtUtc,
  }
}

const ReviewChatDialog = ({
  groupId,
  event,
  memberId,
  language,
  reviewId,
  existingReview = null,
  enrollments = [],
  aiContentContext = { missionStatements: [], eventContext: null },
  onSuccess,
}: Props) => {
  const generatedReviewId = useMemo(() => createReviewId(), [event.id, memberId])
  const targetReviewId = existingReview?.id || reviewId || generatedReviewId
  const sessionId = useMemo(
    () => createReviewSessionId(memberId, event.id, targetReviewId),
    [event.id, memberId, targetReviewId],
  )
  const existingDraft = useMemo(() => parseReviewDraft(existingReview), [existingReview])
  const appContext = useMemo<AiSessionAppContext>(() => ({
    language,
    groupId,
    ...(memberId ? { memberId } : {}),
    eventId: event.id,
    eventData: buildEventData(event),
    missionStatements: aiContentContext.missionStatements,
    eventContext: aiContentContext.eventContext,
    knownFacts: {
      reviewId: targetReviewId,
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
  }), [aiContentContext.eventContext, aiContentContext.missionStatements, enrollments, event, existingDraft, groupId, language, memberId, targetReviewId])
  const t = (key: UiTextKey) => translateUi(language, key)
  const { state, setState, loading, error, clearError, sendMessage } = useAiSession<ReviewDraft, MultilingualString | null>(
    sessionId,
    '/api/reviews/session',
    appContext,
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [uploadedPhotoPreviews, setUploadedPhotoPreviews] = useState<string[]>([])
  const [commitStatus, setCommitStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [commitError, setCommitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initializedReplyRef = useRef('')
  const stateDraft = state?.draft ?? null
  const draft = useMemo(
    () => mergeExistingReviewDraft(existingDraft, stateDraft, targetReviewId),
    [existingDraft, stateDraft, targetReviewId],
  )
  const existingPhotoPreviews = useMemo(
    () => (draft?.photoFiles ?? [])
      .filter((photo) => Boolean(photo.url))
      .map((photo, index) => {
        const url = normalizeImageUrl(photo.url)
        return {
          key: `${url}-${index}`,
          url,
          alt: photo.fileName || `Review photo ${index + 1}`,
        }
      }),
    [draft?.photoFiles],
  )

  useEffect(() => {
    setMessages([])
    setInput('')
    setPhotoFiles([])
    setCommitStatus('idle')
    setCommitError('')
    initializedReplyRef.current = ''
    clearError()
  }, [clearError, event.id, language, targetReviewId])

  useEffect(() => {
    if (!existingDraft) {
      return
    }

    setState((current) => {
      const currentDraft = current?.draft ?? null
      if (current && !shouldPreferExistingDraft(existingDraft, currentDraft, targetReviewId)) {
        return current
      }

      return current
        ? { ...current, draft: existingDraft, context: current.context ?? existingDraft.assistantReply ?? null }
        : {
          sessionId,
          draft: existingDraft,
          context: existingDraft.assistantReply ?? null,
          appContext,
          attachments: [],
          chatHistory: [],
          updatedAt: new Date().toISOString(),
        }
    })

    let cancelled = false
    reviewSessionService.start(sessionId, { appContext, draft: existingDraft })
      .then((nextState) => {
        if (cancelled) {
          return
        }

        setState((current) => {
          const currentDraft = current?.draft ?? null
          if (current && !shouldPreferExistingDraft(existingDraft, currentDraft, targetReviewId)) {
            return current
          }

          const nextDraft = mergeExistingReviewDraft(existingDraft, nextState.draft ?? null, targetReviewId)
          return {
            ...nextState,
            draft: nextDraft,
            context: nextState.context ?? nextDraft?.assistantReply ?? null,
          }
        })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [appContext, existingDraft, sessionId, setState, targetReviewId])

  useEffect(() => {
    if (!existingDraft) {
      return
    }

    setState((current) => current
      ? {
        ...current,
        draft: mergeExistingReviewDraft(existingDraft, current.draft ?? null, targetReviewId),
        context: current.context ?? existingDraft.assistantReply ?? null,
      }
      : current)
  }, [existingDraft, setState, targetReviewId])

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file))
    setUploadedPhotoPreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photoFiles])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, loading])

  const assistantReplySource = state?.context ?? draft?.assistantReply ?? null
  const assistantReply = localized(assistantReplySource, language) || fallbackReply(draft, language)
  const hasDraftContent = Boolean(
    draft?.summary?.zh?.trim()
    || draft?.summary?.en?.trim()
    || draft?.reflection?.zh?.trim()
    || draft?.reflection?.en?.trim(),
  )
  const canCommit = Boolean(draft?.reflection?.zh?.trim() && draft?.reflection?.en?.trim())
    && commitStatus !== 'saving'

  useEffect(() => {
    const replyText = assistantReply.trim()
    if (!replyText || !hasDraftContent) {
      return
    }

    const replyKey = `${sessionId}:${language}:${replyText}`
    if (initializedReplyRef.current === replyKey) {
      return
    }

    setMessages((current) => {
      if (current.length > 0) {
        return current
      }

      initializedReplyRef.current = replyKey
      return [{ role: 'assistant', text: replyText }]
    })
  }, [assistantReply, hasDraftContent, language, sessionId])

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
        aiContext: aiContentContext,
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

      <div className="grid min-h-0 flex-1 gap-0 desktop:grid-cols-2">
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
            {existingPhotoPreviews.length || uploadedPhotoPreviews.length ? (
              <div className="grid grid-cols-3 gap-2">
                {existingPhotoPreviews.map((photo) => (
                  <CoverImage
                    key={photo.key}
                    src={photo.url}
                    alt={photo.alt}
                    aspectRatio={1}
                    className="rounded-lg"
                    openOnLongPressOrDoubleClick
                  />
                ))}
                {uploadedPhotoPreviews.map((url, index) => (
                  <CoverImage
                    key={url}
                    src={url}
                    alt={`Review upload ${index + 1}`}
                    aspectRatio={1}
                    className="rounded-lg"
                    openOnLongPressOrDoubleClick
                  />
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
