import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { EventDto, EventSessionSsePayload, EventSessionState, MultilingualString } from '../types/event'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
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

const EventPreview = ({ event, lang }: { event: EventDto; lang: string }) => {
  const t = (ml: MultilingualString) => (lang === 'zh' ? ml.zh : ml.en) || ml.en || ml.zh || '—'
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t(event.title)}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t(event.locationName)}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          Draft
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-700">{t(event.description)}</p>

      {/* Dates */}
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          { label: 'Start', value: fmt(event.startDate) },
          { label: 'End', value: fmt(event.endDate) },
          { label: 'Registration deadline', value: fmt(event.registrationDeadline) },
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
          Capacity: <strong>{event.maxCapacity} {event.capacityUnit}</strong>
        </span>
        {event.baseFeePerAdult != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Adult: <strong>{event.currency} {event.baseFeePerAdult}</strong>
          </span>
        )}
        {event.baseFeePerChild != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            Child: <strong>{event.currency} {event.baseFeePerChild}</strong>
          </span>
        )}
      </div>

      {/* Hard constraints */}
      {event.hardConstraints.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Rules &amp; Constraints</h3>
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
                    <span className="ml-1.5 text-xs text-red-500">(mandatory)</span>
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
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Optional Activities</h3>
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
          Bilingual fields ▸
        </summary>
        <div className="mt-3 space-y-3">
          <BilingualField label="Title" value={event.title} />
          <BilingualField label="Description" value={event.description} />
          <BilingualField label="Location" value={event.locationName} />
          {event.legacySummary && <BilingualField label="Legacy Summary" value={event.legacySummary} />}
        </div>
      </details>

      {/* Raw JSON toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-emerald-600 hover:underline"
        >
          {showRaw ? 'Hide' : 'Show'} raw JSON
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

const EventCreatorView = () => {
  const { language, me } = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const [searchParams] = useSearchParams()
  const groupIdFromParams = searchParams.get('groupId')
  const effectiveGroupId = groupIdFromParams ?? CurrentGroup?.id ?? null

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: "Hi! I'm your AI event assistant. Describe your event in English or Chinese (or both!) and I'll extract the details for you.\n\nExample: \"Plan a West Coast trip for 15 families on Dec 1–3 2026. Everyone must take the chartered bus. Optional kayaking is $30 per person. Fee: $150/adult, $80/child.\"",
      markdown: true,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [eventDraft, setEventDraft] = useState<EventDto | null>(null)
  const [aiInsight, setAiInsight] = useState<MultilingualString | null>(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const sessionIdRef = useRef(createSessionId(me?.id))
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let isMounted = true
    const sessionId = sessionIdRef.current
    const source = eventService.createSessionStream(sessionId)

    const applySessionState = (state: EventSessionState) => {
      if (!isMounted) return
      if (state.eventDraft) {
        setEventDraft(state.eventDraft)
      }
      setAiInsight(state.legacySummary)
    }

    source.addEventListener('snapshot', (event) => {
      applySessionState(JSON.parse((event as MessageEvent<string>).data) as EventSessionState)
    })

    source.addEventListener('message', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as EventSessionSsePayload
      if (payload.type === 'eventDraft') {
        applySessionState(payload.state)
      }
    })

    eventService.getSessionState(sessionId)
      .then(applySessionState)
      .catch(() => undefined)

    return () => {
      isMounted = false
      source.close()
    }
  }, [])

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    scrollToBottom()
    setLoading(true)

    try {
      const response = await eventService.extractFromChat(msg, sessionIdRef.current)

      if (response.responseMode === 'result' && response.result) {
        const dto = response.result
        setEventDraft(dto)
        setSaveStatus('idle')
        setAiInsight(response.legacySummary ?? dto.legacySummary ?? null)
        const lang = language === 'zh' ? dto.title.zh : dto.title.en
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `✅ I've extracted the event details for "${lang || 'your event'}". Review the preview below and refine by chatting further.`,
          },
        ])
      } else {
        const markdown = response.markdown?.trim()
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: markdown || 'I need a bit more information before I can finalize the event details.',
            markdown: true,
          },
        ])
      }
    } catch (err) {
      const apiError = normalizeApiError(err)
      setError(apiError.message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `❌ Sorry, I couldn't extract event details: ${apiError.message}`, markdown: true },
      ])
    } finally {
      setLoading(false)
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
      setError('Voice input is not supported by this browser. You can paste a transcript instead.')
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
      setError('Voice input stopped unexpectedly. Please try again or type the message.')
    }
    speechRecognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleCommitDraft = async () => {
    if (!eventDraft) {
      return
    }

    const eventName = (language === 'zh' ? eventDraft.title.zh : eventDraft.title.en) || eventDraft.title.en || eventDraft.title.zh || 'your event'

    if (!effectiveGroupId) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ No group selected. Please navigate to a group first, or use the "Events" link in a group's tools drawer.`,
        },
      ])
      scrollToBottom()
      return
    }

    setSaveStatus('saving')
    try {
      await eventService.createGroupEvent(effectiveGroupId, eventDraft)
      setSaveStatus('saved')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✅ "${eventName}" has been saved to the group successfully! You can view it in the group's Events section.`,
        },
      ])
    } catch (err) {
      setSaveStatus('error')
      const apiError = normalizeApiError(err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `❌ Failed to save event: ${apiError.message}`,
          markdown: true,
        },
      ])
    }
    scrollToBottom()
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Event with AI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chat with Gemini to design your event. The draft restores automatically across refreshes and devices using the session bridge.
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
        {loading && (
          <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm">
            <span className="animate-pulse">Gemini is thinking…</span>
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
          disabled={loading}
          placeholder="Describe your event… (Enter to send, Shift+Enter for new line)"
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
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
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
          disabled={loading || !input.trim()}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Event Preview */}
      {aiInsight && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="font-semibold">AI Insight: </span>
          {language === 'zh' ? aiInsight.zh : aiInsight.en}
        </div>
      )}
      {eventDraft && <EventPreview event={eventDraft} lang={language} />}
      {eventDraft && (
        <div className="flex items-center justify-end gap-3">
          {!effectiveGroupId && (
            <p className="text-xs text-amber-600">No group context — open from a group to save.</p>
          )}
          {saveStatus === 'saved' && (
            <p className="text-xs text-emerald-600">✓ Event saved to group</p>
          )}
          <button
            type="button"
            onClick={() => { handleCommitDraft().catch(() => undefined) }}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save to Group'}
          </button>
        </div>
      )}
    </div>
  )
}

export default EventCreatorView
