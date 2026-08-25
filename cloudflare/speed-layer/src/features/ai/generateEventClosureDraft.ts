import type { Env } from '../../index'
import { extractMemberIdFromRequest } from '../../middlewares/authCache'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LocalizedText = { en: string; zh: string }
type ClosureLearningDraft = { id: string; title: LocalizedText; detail: LocalizedText; reuseNextTime: false }

export async function handleGenerateEventClosureDraft(request: Request, env: Env): Promise<Response> {
  if (!extractMemberIdFromRequest(request)) return json({ message: 'Authentication is required.' }, 401)
  if (!env.GEMINI_API_KEY) return json({ message: 'GEMINI_API_KEY is not configured.' }, 503)

  let eventId = ''
  try {
    const body = await request.json() as unknown
    eventId = isRecord(body) && typeof body.eventId === 'string' ? body.eventId.trim() : ''
  } catch {
    return json({ message: 'Invalid closure draft request.' }, 400)
  }
  if (!UUID_PATTERN.test(eventId)) return json({ message: 'A valid eventId is required.' }, 400)

  const origin = env.API_PROXY_TARGET?.trim()
  if (!origin) return json({ message: 'The event service is unavailable.' }, 503)
  const contextResponse = await fetch(new URL(`/api/events/${encodeURIComponent(eventId)}/closure`, origin).toString(), {
    headers: forwardedAuthHeaders(request),
  })
  if (!contextResponse.ok) {
    if (contextResponse.status === 401 || contextResponse.status === 403 || contextResponse.status === 404) {
      return json({ message: contextResponse.status === 403 ? 'Only event leaders can draft the closure report.' : 'Event closure context is unavailable.' }, contextResponse.status)
    }
    return json({ message: 'Event closure context could not be loaded.' }, 502)
  }
  const context = normalizeClosureContext(await contextResponse.json() as unknown)
  if (!context.eventHasEnded) return json({ message: 'AI closure drafting is available after the event has ended.' }, 400)

  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const geminiResponse = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: closureSystemPrompt() }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ task: 'draft-event-closure', context }) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: closureResponseSchema,
        thinkingConfig: { thinkingLevel: 'minimal' },
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
  })
  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text()
    console.error('Gemini closure draft failed.', geminiResponse.status, readProviderErrorMessage(errorText))
    if (geminiResponse.status === 400 && /api key not valid/i.test(readProviderErrorMessage(errorText)))
      return json({ message: 'AI assistance is not configured with a valid Gemini API key. Please contact an administrator.' }, 503)
    return json({ message: geminiResponse.status === 429 ? 'AI is busy. Please try again shortly.' : 'AI could not draft the closure report.' }, geminiResponse.status === 429 ? 429 : 502)
  }

  const response = await geminiResponse.json() as unknown
  const text = readGeminiText(response)
  if (!text) return json({ message: 'AI returned no closure draft.' }, 502)
  try {
    const draft = normalizeDraft(JSON.parse(text) as unknown)
    return json({ draft, model, requiresLeaderConfirmation: true }, 200)
  } catch {
    return json({ message: 'AI returned an unexpected closure draft format.' }, 502)
  }
}

const closureResponseSchema = {
  type: 'object',
  properties: {
    summary: localizedSchema(),
    attendanceNotes: { type: 'string' },
    financeNotes: { type: 'string' },
    incidentNotes: { type: 'string' },
    followUpNotes: { type: 'string' },
    learnings: {
      type: 'array', maxItems: 10,
      items: { type: 'object', properties: { title: localizedSchema(), detail: localizedSchema() }, required: ['title', 'detail'] },
    },
  },
  required: ['summary', 'attendanceNotes', 'financeNotes', 'incidentNotes', 'followUpNotes', 'learnings'],
}

function localizedSchema() {
  return { type: 'object', properties: { en: { type: 'string' }, zh: { type: 'string' } }, required: ['en', 'zh'] }
}

function closureSystemPrompt() {
  return `You assist a Chinese Christian community event leader with a reviewable bilingual closure draft.
Use only the supplied sanitized event context. It contains aggregate counts, the leader's existing draft, and leader-approved learning from earlier events. It intentionally excludes member names, personal reflections, payment evidence, private contacts, and old approval records.

Rules:
1. Never invent attendance, money, incidents, people, contact details, safety conclusions, or completed follow-up.
2. When evidence is missing, write a clear bilingual placeholder asking the leader to verify it; do not write "none" unless the supplied draft already says none.
3. Member review count is only a count. Do not infer the content or sentiment of private member reviews.
4. Compare previous learning cautiously. Adapt useful wording to the current event, but never copy old dates, prices, contacts, permissions, or approvals.
5. Return concise English and Chinese summaries with equivalent meaning.
6. Draft reusable learning only when supported by the current aggregate or existing draft. Every suggested learning remains unselected; the leader decides whether to reuse it.
7. Do not confirm closure. Human confirmation is mandatory.`
}

function normalizeClosureContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  const report = isRecord(root.report) ? root.report : {}
  const evidence = isRecord(root.evidence) ? root.evidence : {}
  const previous = Array.isArray(root.previousLearnings) ? root.previousLearnings.slice(0, 20) : []
  return {
    eventTitle: localize(root.eventTitle, 300),
    eventEndUtc: readString(root.eventEndUtc, 80),
    eventHasEnded: root.eventHasEnded === true,
    evidence: {
      enrollmentSubmissions: readNumber(evidence.enrollmentSubmissions),
      acceptedRosterAssignments: readNumber(evidence.acceptedRosterAssignments),
      requiredRosterAssignments: readNumber(evidence.requiredRosterAssignments),
      memberReviews: readNumber(evidence.memberReviews),
      actualAttendanceUnits: readNumber(evidence.actualAttendanceUnits),
      attendanceRecorded: evidence.attendanceRecorded === true,
      actualIncome: readAmount(evidence.actualIncome),
      actualExpense: readAmount(evidence.actualExpense),
      financeReconciled: evidence.financeReconciled === true,
    },
    existingDraft: {
      summary: localize(report.summary, 4000),
      attendanceNotes: readString(report.attendanceNotes, 4000),
      financeNotes: readString(report.financeNotes, 4000),
      incidentNotes: readString(report.incidentNotes, 4000),
      followUpNotes: readString(report.followUpNotes, 4000),
    },
    previousLearnings: previous.map((item) => {
      const source = isRecord(item) ? item : {}
      const learning = isRecord(source.learning) ? source.learning : {}
      return {
        eventTitle: localize(source.eventTitle, 300),
        title: localize(learning.title, 300),
        detail: localize(learning.detail, 1500),
      }
    }),
  }
}

function normalizeDraft(value: unknown) {
  const root = isRecord(value) ? value : {}
  const learnings = Array.isArray(root.learnings) ? root.learnings.slice(0, 10) : []
  return {
    summary: localize(root.summary, 4000),
    attendanceNotes: readString(root.attendanceNotes, 4000),
    financeNotes: readString(root.financeNotes, 4000),
    incidentNotes: readString(root.incidentNotes, 4000),
    followUpNotes: readString(root.followUpNotes, 4000),
    learnings: learnings.map((item): ClosureLearningDraft => {
      const learning = isRecord(item) ? item : {}
      return { id: crypto.randomUUID(), title: localize(learning.title, 300), detail: localize(learning.detail, 2000), reuseNextTime: false }
    }).filter((item) => item.title.en || item.title.zh || item.detail.en || item.detail.zh),
    leaderConfirmed: false,
  }
}

function readGeminiText(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.candidates)) return ''
  const candidate = isRecord(value.candidates[0]) ? value.candidates[0] : {}
  const content = isRecord(candidate.content) ? candidate.content : {}
  const parts = Array.isArray(content.parts) ? content.parts : []
  return parts.filter((part) => isRecord(part) && part.thought !== true && typeof part.text === 'string')
    .map((part) => String((part as Record<string, unknown>).text)).join('').trim()
}

function forwardedAuthHeaders(request: Request) {
  const headers = new Headers({ accept: 'application/json', 'cache-control': 'no-store' })
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')
  if (cookie) headers.set('cookie', cookie)
  if (authorization) headers.set('authorization', authorization)
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function localize(value: unknown, max: number): LocalizedText {
  const record = isRecord(value) ? value : {}
  return { en: readString(record.en, max), zh: readString(record.zh, max) }
}

function readString(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function readAmount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0
}

function readProviderErrorMessage(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) && isRecord(parsed.error) ? readString(parsed.error.message) : ''
  } catch { return '' }
}

function json(value: unknown, status: number) {
  return Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } })
}
