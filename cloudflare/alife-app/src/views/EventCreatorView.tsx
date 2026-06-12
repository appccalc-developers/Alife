import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import type { EventDto, GroupEventRecord, MultilingualString } from '../types/event'
import type { AiSessionAppContext } from '../types/aiSession'
import { eventService } from '../services/eventService'
import { isImageFile, uploadImage } from '../services/imageWorkerApi'
import { useAiSession } from '../hooks/useAiSession'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import { useUiText } from '../i18n/uiText'
import CoverImage from '../components/CoverImage'
import { createEventContextFromDto, loadAiContentContext, type AiContentContext } from '../utils/aiContentContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ────────────────────────────────────────────────────────────────────────────
// Helper sub-components
// ────────────────────────────────────────────────────────────────────────────

const BilingualField = ({ label, value }: { label: string; value: MultilingualString }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
    <span className="col-span-2 font-semibold text-slate-700">{label}</span>
    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
      <span className="mr-1 text-xs text-slate-400">zh</span>
      {value.zh || <span className="italic text-slate-400">—</span>}
    </span>
    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
      <span className="mr-1 text-xs text-slate-400">en</span>
      {value.en || <span className="italic text-slate-400">—</span>}
    </span>
  </div>
)

const fmt = (iso: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const EventPreview = ({
  event,
  lang,
  posterPreviewUrl,
  posterPendingUpload = false,
}: {
  event: EventDto
  lang: string
  posterPreviewUrl?: string
  posterPendingUpload?: boolean
}) => {
  const ui = useUiText()
  const t = (ml: MultilingualString) => (lang === 'zh' ? ml.zh : ml.en) || ml.en || ml.zh || '—'
  const [showRaw, setShowRaw] = useState(false)
  const title = t(event.title)
  const posterUrl = posterPreviewUrl || event.posterImageUrl || ''

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t(event.locationName)}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {ui('draft')}
        </span>
      </div>

      {posterUrl ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <CoverImage src={posterUrl} alt={`${title || ui('yourEvent')} ${ui('poster')}`} aspectRatio={16 / 9} fetchPriority="high" className="w-full" />
          {posterPendingUpload ? (
            <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              {ui('previewImagePending')}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Description */}
      <p className="text-sm text-slate-700">{t(event.description)}</p>

      {/* Dates */}
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          { label: ui('start'), value: fmt(event.startDate) },
          { label: ui('end'), value: fmt(event.endDate) },
          { label: ui('registrationDeadline'), value: fmt(event.registrationDeadline) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
            <span className="block text-xs text-slate-500">{label}</span>
            <span className="font-medium text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      {/* Capacity & fees */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          {ui('capacity')}: <strong>{event.maxCapacity} {event.capacityUnit}</strong>
        </span>
        {event.baseFeePerAdult != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {ui('adult')}: <strong>{event.currency} {event.baseFeePerAdult}</strong>
          </span>
        )}
        {event.baseFeePerChild != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {ui('child')}: <strong>{event.currency} {event.baseFeePerChild}</strong>
          </span>
        )}
      </div>

      {/* Hard constraints */}
      {event.hardConstraints.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{ui('rulesConstraints')}</h3>
          <ul className="space-y-1.5">
            {event.hardConstraints.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                  !
                </span>
                <span>
                  <span className="mr-1.5 rounded bg-amber-200 px-1 py-0.5 text-xs font-medium text-amber-800">
                    {rule.ruleKey}
                  </span>
                  {t(rule.displayMessage)}
                  {rule.isMandatory && (
                    <span className="ml-1.5 text-xs text-red-500">({ui('mandatory')})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional activities */}
      {event.optionalActivities.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{ui('optionalActivities')}</h3>
          <ul className="flex flex-wrap gap-2">
            {event.optionalActivities.map((act, i) => (
              <li key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                {t(act.name)}
                {act.extraFee > 0 && (
                  <span className="ml-1.5 text-xs text-emerald-600">+{event.currency} {act.extraFee}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bilingual fields (detailed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 group-open:text-slate-700">
          {ui('bilingualFields')}
        </summary>
        <div className="mt-3 space-y-3">
          <BilingualField label={ui('title')} value={event.title} />
          <BilingualField label={ui('description')} value={event.description} />
          <BilingualField label={ui('location')} value={event.locationName} />
          {event.legacySummary && <BilingualField label={ui('legacySummary')} value={event.legacySummary} />}
        </div>
      </details>

      {/* Raw JSON toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-emerald-600 hover:underline"
        >
          {showRaw ? ui('hideRawJson') : ui('showRawJson')}
        </button>
        {showRaw && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
            {JSON.stringify(event, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; text: string; markdown?: boolean }
type PosterUploadStatus = 'idle' | 'selected' | 'uploading' | 'uploaded' | 'error'

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const EVENT_SESSION_STORAGE_KEY = 'alife-event-planning-session-id'
const eventPosterFolder = (groupId: string, eventId: string) => `groups/${groupId}/events/${eventId}/calendar`
const createIntroMessage = (text: string): ChatMessage => ({
  role: 'assistant',
  text,
  markdown: true,
})

const createSessionId = (memberId?: string) => {
  if (memberId) {
    return `member-${memberId}-event-draft`
  }

  const existing = localStorage.getItem(EVENT_SESSION_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const next = crypto.randomUUID()
  localStorage.setItem(EVENT_SESSION_STORAGE_KEY, next)
  return next
}

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

const fallbackDraftFromRecord = (record: GroupEventRecord): EventDto => ({
  id: record.id,
  title: { zh: record.titleZh, en: record.titleEn },
  description: { zh: '', en: '' },
  locationName: { zh: '', en: '' },
  startDate: record.startDate,
  endDate: record.endDate,
  registrationDeadline: record.startDate,
  maxCapacity: 0,
  capacityUnit: 'People',
  hardConstraints: [],
  optionalActivities: [],
  baseFeePerAdult: null,
  baseFeePerChild: null,
  currency: 'USD',
  posterImageUrl: null,
  galleryUrls: [],
  legacySummary: null,
})

const getDraftFromRecord = (record: GroupEventRecord): EventDto => {
  try {
    const parsed = JSON.parse(record.eventDataJson) as EventDto
    if (parsed && parsed.title && parsed.description && parsed.locationName) {
      return { ...parsed, id: record.id }
    }
  } catch {
    // no-op
  }

  return fallbackDraftFromRecord(record)
}

const EventCreatorView = () => {
  const { language, me } = useAuthStore()
  const t = useUiText()
  const { CurrentGroup } = useCurrentGroupStore()
  const location = useLocation()
  const { eventId } = useParams<{ eventId?: string }>()
  const isEditMode = Boolean(eventId)
  const eventIdValue = eventId ?? ''
  const [searchParams] = useSearchParams()
  const groupIdFromParams = searchParams.get('groupId')
  const effectiveGroupId = groupIdFromParams ?? CurrentGroup?.id ?? null
  const eventFromNavigationState = (location.state as { event?: GroupEventRecord } | null)?.event
  const eventFromNavigationStateId = eventFromNavigationState ? String(eventFromNavigationState.id) : ''
  const eventFromNavigationStateData = eventFromNavigationState?.eventDataJson ?? ''

  const [messages, setMessages] = useState<ChatMessage[]>(() => [createIntroMessage(t('eventAssistantIntro'))])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [eventDraft, setEventDraft] = useState<EventDto | null>(null)
  const [aiInsight, setAiInsight] = useState<MultilingualString | null>(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedEventId, setSavedEventId] = useState('')
  const [pendingPosterFile, setPendingPosterFile] = useState<File | null>(null)
  const [posterPreviewUrl, setPosterPreviewUrl] = useState('')
  const [posterUploadStatus, setPosterUploadStatus] = useState<PosterUploadStatus>('idle')
  const [posterUploadError, setPosterUploadError] = useState('')
  const [aiContentContext, setAiContentContext] = useState<AiContentContext>({ missionStatements: [], eventContext: null })
  const targetEventId = eventId ?? savedEventId
  const sessionIdRef = useRef(createSessionId(me?.id))
  const posterInputRef = useRef<HTMLInputElement>(null)
  const posterObjectUrlRef = useRef('')
  const eventContext = useMemo(
    () => eventDraft ? createEventContextFromDto(eventDraft) : aiContentContext.eventContext,
    [aiContentContext.eventContext, eventDraft],
  )
  const baseAiAppContext = useMemo<AiSessionAppContext>(() => ({
    language,
    ...(me?.id ? { userId: me.id, memberId: me.id } : {}),
    ...(effectiveGroupId ? { groupId: effectiveGroupId } : {}),
    missionStatements: aiContentContext.missionStatements,
    eventContext: aiContentContext.eventContext,
    eventData: aiContentContext.eventContext?.eventData ?? null,
  }), [aiContentContext.eventContext, aiContentContext.missionStatements, effectiveGroupId, language, me?.id])
  const aiAppContext = useMemo<AiSessionAppContext>(() => ({
    language,
    ...(me?.id ? { userId: me.id, memberId: me.id } : {}),
    ...(effectiveGroupId ? { groupId: effectiveGroupId } : {}),
    missionStatements: aiContentContext.missionStatements,
    eventContext,
    eventData: eventContext?.eventData ?? null,
    knownFacts: {
      ...(targetEventId ? { eventId: targetEventId } : {}),
    },
  }), [aiContentContext.missionStatements, effectiveGroupId, eventContext, language, me?.id, targetEventId])
  const {
    state: sessionState,
    loading: sessionLoading,
    error: sessionError,
    clearError: clearSessionError,
    sendMessage,
  } = useAiSession<EventDto, MultilingualString | null>(
    isEditMode ? '' : sessionIdRef.current,
    '/api/events/session',
    baseAiAppContext,
  )
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const clearPosterObjectUrl = () => {
    if (posterObjectUrlRef.current) {
      URL.revokeObjectURL(posterObjectUrlRef.current)
      posterObjectUrlRef.current = ''
    }
  }

  useEffect(() => {
    return () => {
      clearPosterObjectUrl()
    }
  }, [])

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== 'assistant') {
        return prev
      }

      return [createIntroMessage(t('eventAssistantIntro'))]
    })
  }, [t])

  useEffect(() => {
    if (isEditMode) {
      return
    }
    if (sessionState?.draft) {
      setEventDraft(sessionState.draft)
    }
    setAiInsight(sessionState?.context ?? null)
  }, [isEditMode, sessionState])

  useEffect(() => {
    if (!effectiveGroupId) {
      setAiContentContext({ missionStatements: [], eventContext: null })
      return
    }

    let cancelled = false
    loadAiContentContext(effectiveGroupId, { currentGroup: CurrentGroup })
      .then((context) => {
        if (!cancelled) {
          setAiContentContext(context)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiContentContext({ missionStatements: [], eventContext: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [CurrentGroup, effectiveGroupId])

  useEffect(() => {
    if (!isEditMode || !eventId) {
      return
    }

    if (eventFromNavigationState && eventFromNavigationStateId === eventIdValue) {
      const draft = getDraftFromRecord(eventFromNavigationState)
      setError('')
      setEventDraft(draft)
      setAiInsight(draft.legacySummary ?? null)
      return
    }

    if (!effectiveGroupId) {
      setError(t('eventLoadFromGroupFailed'))
      return
    }

    let cancelled = false
    eventService.getGroupEvents(effectiveGroupId)
      .then((records) => {
        if (cancelled) return
        const record = records.find((item) => String(item.id) === eventIdValue)
        if (!record) {
          setError(t('eventNotFound'))
          return
        }

        const draft = getDraftFromRecord(record)
        setError('')
        setEventDraft(draft)
        setAiInsight(draft.legacySummary ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('eventLoadFailed'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [effectiveGroupId, eventFromNavigationState, eventFromNavigationStateData, eventFromNavigationStateId, eventIdValue, isEditMode])

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleSend = async () => {
    const msg = input.trim()
    const isSending = isEditMode ? loading : sessionLoading
    if (!msg || isSending) return

    setInput('')
    if (isEditMode) {
      setError('')
    } else {
      clearSessionError()
    }
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    scrollToBottom()
    if (isEditMode) {
      setLoading(true)
    }

    try {
      const response = isEditMode
        ? await eventService.extractFromChat(msg, sessionIdRef.current, 'text', aiAppContext)
        : await sendMessage(msg, { inputMode: 'text', appContext: aiAppContext })

      if (response.responseMode === 'result' && response.result) {
        const dto = response.result
        let nextInsight: MultilingualString | null = dto.legacySummary ?? null
        if (isEditMode) {
          nextInsight = (response as typeof response & { legacySummary?: MultilingualString | null }).legacySummary ?? nextInsight
        } else {
          nextInsight = response.context ?? nextInsight
        }
        setEventDraft(dto)
        setSaveStatus('idle')
        setAiInsight(nextInsight)
        const lang = language === 'zh' ? dto.title.zh : dto.title.en
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: t('eventExtracted', { name: lang || t('yourEvent') }),
          },
        ])
      } else {
        const markdown = response.markdown?.trim()
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: markdown || t('eventNeedMoreInfo'),
            markdown: true,
          },
        ])
      }
    } catch (err) {
      const apiError = normalizeApiError(err)
      if (isEditMode) {
        setError(apiError.message)
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: t('eventExtractFailed', { message: apiError.message }), markdown: true },
      ])
    } finally {
      if (isEditMode) {
        setLoading(false)
      }
      scrollToBottom()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleVoiceToggle = () => {
    if (listening) {
      speechRecognitionRef.current?.stop()
      setListening(false)
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError(t('voiceUnsupported'))
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language === 'zh' ? 'zh-CN' : 'en-NZ'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      setInput(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setError(t('voiceStopped'))
    }
    speechRecognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const setLocalPosterPreview = (file: File) => {
    clearPosterObjectUrl()
    const objectUrl = URL.createObjectURL(file)
    posterObjectUrlRef.current = objectUrl
    setPosterPreviewUrl(objectUrl)
  }

  const uploadPosterFile = async (file: File, groupId: string, uploadEventId: string) => {
    setPosterUploadStatus('uploading')
    setPosterUploadError('')
    const uploaded = await uploadImage(file, eventPosterFolder(groupId, uploadEventId))
    clearPosterObjectUrl()
    setPosterPreviewUrl('')
    setPendingPosterFile(null)
    setPosterUploadStatus('uploaded')
    return uploaded.url
  }

  const handlePosterChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    if (!isImageFile(file)) {
      setPosterUploadStatus('error')
      setPosterUploadError(t('selectImageFile'))
      return
    }

    setLocalPosterPreview(file)
    setPendingPosterFile(file)
    setPosterUploadError('')
    setSaveStatus('idle')

    if (!targetEventId) {
      setPosterUploadStatus('selected')
      return
    }

    if (!effectiveGroupId) {
      setPosterUploadStatus('error')
      setPosterUploadError(t('missingGroupForEvent'))
      return
    }

    try {
      const posterImageUrl = await uploadPosterFile(file, effectiveGroupId, targetEventId)
      setEventDraft((current) => current ? { ...current, posterImageUrl } : current)
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setPosterUploadStatus('error')
      setPosterUploadError(t('eventPosterUploadFailed', { message: apiError.message }))
    }
  }

  const handleCommitDraft = async () => {
    if (!eventDraft) {
      return
    }

    const eventName = (language === 'zh' ? eventDraft.title.zh : eventDraft.title.en) || eventDraft.title.en || eventDraft.title.zh || t('yourEvent')

    if (!isEditMode && !effectiveGroupId) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: t('noGroupSelected'),
        },
      ])
      scrollToBottom()
      return
    }

    setSaveStatus('saving')
    try {
      if (targetEventId) {
        let draftToSave = eventDraft
        if (pendingPosterFile) {
          if (!effectiveGroupId) {
            throw new Error(t('missingGroupForEvent'))
          }
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, targetEventId)
          draftToSave = { ...eventDraft, posterImageUrl }
          setEventDraft(draftToSave)
        }
        await eventService.updateGroupEvent(
          targetEventId,
          draftToSave,
          sessionIdRef.current,
          { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
        )
      } else if (effectiveGroupId) {
        const created = await eventService.createGroupEvent(
          effectiveGroupId,
          pendingPosterFile ? { ...eventDraft, posterImageUrl: null } : eventDraft,
          pendingPosterFile ? undefined : sessionIdRef.current,
          {
            ...aiContentContext,
            eventContext: createEventContextFromDto(pendingPosterFile ? { ...eventDraft, posterImageUrl: null } : eventDraft),
          },
        )
        setSavedEventId(created.id)

        if (pendingPosterFile) {
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, created.id)
          const draftToSave = { ...eventDraft, id: created.id, posterImageUrl }
          setEventDraft(draftToSave)
          await eventService.updateGroupEvent(
            created.id,
            draftToSave,
            sessionIdRef.current,
            { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
          )
        }
      } else {
        throw new Error(t('missingGroupForEvent'))
      }
      setSaveStatus('saved')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: isEditMode
            ? t('eventUpdated', { name: eventName })
            : t('eventSavedToGroup', { name: eventName }),
        },
      ])
    } catch (err) {
      setSaveStatus('error')
      const apiError = normalizeApiError(err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: t('eventSaveFailed', { message: apiError.message }),
          markdown: true,
        },
      ])
    }
    scrollToBottom()
  }

  const isSending = isEditMode ? loading : sessionLoading
  const isPosterUploading = posterUploadStatus === 'uploading'
  const posterStatusMessage =
    posterUploadStatus === 'selected'
      ? t('eventPosterSelectedPendingUpload')
      : posterUploadStatus === 'uploading'
        ? t('eventPosterUploading')
        : posterUploadStatus === 'uploaded'
          ? t('eventPosterUploaded')
          : posterUploadStatus === 'error'
            ? posterUploadError
            : ''
  const posterButtonLabel = eventDraft?.posterImageUrl || posterPreviewUrl
    ? t('eventPosterReplace')
    : t('eventPosterChoose')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? t('editEventWithAi') : t('createEventWithAi')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEditMode
            ? t('editEventAiDescription')
            : t('createEventAiDescription')}
        </p>
      </div>

      {/* Chat window */}
      <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={[
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'ml-auto bg-emerald-700 text-white'
                : 'mr-auto bg-white text-slate-800 shadow-sm',
            ].join(' ')}
          >
            {msg.markdown && msg.role === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{children}</code>,
                }}
              >
                {msg.text}
              </ReactMarkdown>
            ) : (
              msg.text.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.text.split('\n').length - 1 && <br />}
                </span>
              ))
            )}
          </div>
        ))}
        {isSending && (
          <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
            <span className="animate-pulse">{t('geminiThinking')}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder={t('describeEventPlaceholder')}
          className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleVoiceToggle}
          className={[
            'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition',
            listening
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
          ].join(' ')}
          aria-label={listening ? t('stopVoiceInput') : t('startVoiceInput')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
          aria-label={t('send')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      {(error || sessionError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error || sessionError}</p>
      )}

      {/* Event Preview */}
      {aiInsight && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="font-semibold">{t('aiInsight')}</span>
          {language === 'zh' ? aiInsight.zh : aiInsight.en}
        </div>
      )}
      {eventDraft && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t('poster')}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{t('eventPosterUploadHelp')}</p>
            </div>
            <input
              ref={posterInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => { void handlePosterChange(event) }}
            />
            <button
              type="button"
              onClick={() => posterInputRef.current?.click()}
              disabled={isPosterUploading || saveStatus === 'saving'}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {posterButtonLabel}
            </button>
          </div>
          {posterStatusMessage ? (
            <p className={[
              'mt-3 rounded-lg px-3 py-2 text-xs',
              posterUploadStatus === 'error'
                ? 'border border-rose-200 bg-rose-50 text-rose-700'
                : posterUploadStatus === 'selected'
                  ? 'border border-amber-200 bg-amber-50 text-amber-700'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-700',
            ].join(' ')}>
              {posterStatusMessage}
            </p>
          ) : null}
        </div>
      )}
      {eventDraft && (
        <EventPreview
          event={eventDraft}
          lang={language}
          posterPreviewUrl={posterPreviewUrl}
          posterPendingUpload={Boolean(pendingPosterFile)}
        />
      )}
      {eventDraft && (
        <div className="flex items-center justify-end gap-3">
          {!effectiveGroupId && (
            <p className="text-xs text-amber-600">{t('noGroupContext')}</p>
          )}
          {saveStatus === 'saved' && (
            <p className="text-xs text-emerald-600">{t('eventSavedToGroupShort')}</p>
          )}
          <button
            type="button"
            onClick={() => { void handleCommitDraft() }}
            disabled={saveStatus === 'saving' || isPosterUploading}
            className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {saveStatus === 'saving' ? t('saving') : targetEventId ? t('updateEvent') : t('saveToGroup')}
          </button>
        </div>
      )}
    </div>
  )
}

export default EventCreatorView
