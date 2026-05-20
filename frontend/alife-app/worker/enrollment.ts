import type { Env } from './index'
import {
  AiChatSession,
  createMemoryDurableObjectState,
  getSessionIdFromPath,
  multilingualSchema,
  resolveAiSessionObjectPath,
  type DurableObjectStateLike,
} from './ai-session'

const DEFAULT_IMAGES_API_BASE = 'https://images.ccalc.live'
const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const DEFAULT_SESSION_ID = 'default'
const SESSION_STORAGE_KEY = 'enrollment-session-state'
const fallbackStates = new Map<string, DurableObjectStateLike>()

type MultilingualString = {
  zh: string
  en: string
}

type EnrollmentDraft = {
  eventId: string
  applicantName: string
  consentStatus: 'unknown' | 'granted' | 'declined'
  assistantReply: MultilingualString | null
}

const ENROLLMENT_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['eventId', 'applicantName', 'consentStatus', 'assistantReply'],
  properties: {
    eventId: { type: 'string' },
    applicantName: { type: 'string' },
    consentStatus: { type: 'string', enum: ['unknown', 'granted', 'declined'] },
    assistantReply: multilingualSchema('A short bilingual response confirming what was captured and what the user should do next.'),
  },
} as const

const ENROLLMENT_SYSTEM_INSTRUCTION = `You are the Alife enrollment assistant for a bilingual Chinese/English church community PWA.

Return exactly one JSON object matching the response schema. Never return Markdown.

Rules:
1. Preserve the current draft and merge new user information into it.
2. Keep eventId unchanged from the current draft.
3. applicantName should contain the enrollment applicant's name, or an empty string if it is still unknown.
4. consentStatus must be:
   - "granted" only when the user clearly agrees to submit the enrollment and payment proof.
   - "declined" only when the user clearly refuses.
   - "unknown" when consent has not been clearly stated yet.
5. assistantReply must be bilingual, concise, and guide the user toward any missing requirement.
6. The current reference date is CURRENT_DATE_PLACEHOLDER.
`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    const url = new URL(request.url)
    const sessionId = getSessionId(request)
    const targetPath = resolveAiSessionObjectPath(url, request, {
      extraRoutes: ['/commit'],
    })

    if (env.ENROLLMENT_SESSIONS) {
      const objectId = env.ENROLLMENT_SESSIONS.idFromName(sessionId)
      const object = env.ENROLLMENT_SESSIONS.get(objectId)
      return object.fetch(new Request(new URL(targetPath, url.origin), request))
    }

    const fallbackObject = new EnrollmentSession(getFallbackState(sessionId), env)
    return fallbackObject.fetch(new Request(new URL(targetPath, url.origin), request))
  },
}

export class EnrollmentSession extends AiChatSession<EnrollmentDraft, MultilingualString | null> {
  constructor(durableState: DurableObjectStateLike, env: Env) {
    super(durableState, env, {
      storageKey: SESSION_STORAGE_KEY,
      routeNotFoundMessage: 'Enrollment session route not found.',
      systemInstruction: (today) => ENROLLMENT_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today),
      responseSchema: ENROLLMENT_RESPONSE_SCHEMA,
      normalizeDraft: normalizeEnrollmentDraft,
      validateDraft: validateEnrollmentDraft,
      getInitialDraft: (sessionId) => ({
        eventId: extractEventIdFromSessionId(sessionId),
        applicantName: '',
        consentStatus: 'unknown',
        assistantReply: null,
      }),
      getContextFromDraft: (draft) => draft.assistantReply ?? null,
      buildGeminiContext: ({ state, userMessage, inputMode }) => ({
        inputMode,
        currentDraft: state.draft,
        chatHistory: state.chatHistory.slice(-12),
        userMessage,
      }),
      formatChatHistoryEntry: (_draft, context) => JSON.stringify({ assistantReply: context }),
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const sessionId = getSessionId(request)

    if (url.pathname.endsWith('/commit') && request.method === 'POST') {
      return this.handleCommit(request, sessionId)
    }

    return this.handleRequest(request, sessionId)
  }

  private async handleCommit(request: Request, sessionId: string) {
    const state = await this.getSessionState(sessionId)
    const draft = state.draft

    if (!draft?.eventId) {
      return Response.json({ message: 'Enrollment draft is missing eventId.' }, { status: 400 })
    }

    if (!draft.applicantName.trim()) {
      return Response.json({ message: 'Enrollment draft is missing applicant name.' }, { status: 400 })
    }

    if (draft.consentStatus !== 'granted') {
      return Response.json({ message: 'Enrollment consent must be granted before submission.' }, { status: 400 })
    }

    const formData = await request.formData()
    const groupId = String(formData.get('groupId') ?? '').trim()
    if (!groupId) {
      return Response.json({ message: 'groupId is required.' }, { status: 400 })
    }

    const paymentFiles = formData
      .getAll('paymentFiles')
      .filter((item): item is File => item instanceof File && item.size > 0)

    if (paymentFiles.length === 0) {
      return Response.json({ message: 'At least one payment file is required.' }, { status: 400 })
    }

    let uploadedFiles
    try {
      uploadedFiles = await uploadPaymentFiles(draft.eventId, paymentFiles)
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : 'Payment file upload failed.' }, { status: 502 })
    }

    const backendResponse = await postEnrollmentToBackend(request, this.env, groupId, {
      eventId: draft.eventId,
      applicantName: draft.applicantName,
      consent: true,
      paymentFiles: uploadedFiles,
      submittedAtUtc: new Date().toISOString(),
    })

    if (!backendResponse.ok) {
      const text = await backendResponse.text()
      return Response.json({ message: 'Failed to commit enrollment.', details: text }, { status: 502 })
    }

    return Response.json({
      status: 'completed',
      message: 'Enrollment submitted successfully.',
    })
  }
}

function getSessionId(request: Request) {
  return getSessionIdFromPath(request, '/api/enrollments/session', DEFAULT_SESSION_ID)
}

function getFallbackState(sessionId: string) {
  const existing = fallbackStates.get(sessionId)
  if (existing) {
    return existing
  }

  const created = createMemoryDurableObjectState()
  fallbackStates.set(sessionId, created)
  return created
}

function extractEventIdFromSessionId(sessionId: string) {
  const match = sessionId.match(/-event-([a-f0-9-]+)-enrollment$/i)
  return match?.[1] ?? ''
}

function normalizeEnrollmentDraft(value: unknown): EnrollmentDraft {
  const candidate = value as Partial<EnrollmentDraft>

  return {
    eventId: typeof candidate.eventId === 'string' ? candidate.eventId : '',
    applicantName: typeof candidate.applicantName === 'string' ? candidate.applicantName.trim() : '',
    consentStatus: candidate.consentStatus === 'granted' || candidate.consentStatus === 'declined'
      ? candidate.consentStatus
      : 'unknown',
    assistantReply: normalizeMultilingualString(candidate.assistantReply),
  }
}

function validateEnrollmentDraft(draft: EnrollmentDraft) {
  const errors: string[] = []
  const assistantReply = draft.assistantReply

  if (!draft.eventId.trim()) {
    errors.push('eventId is required.')
  }

  if (!['unknown', 'granted', 'declined'].includes(draft.consentStatus)) {
    errors.push('consentStatus must be unknown, granted, or declined.')
  }

  if (!assistantReply || !assistantReply.zh.trim()) {
    errors.push('assistantReply.zh is required.')
  }

  if (!assistantReply || !assistantReply.en.trim()) {
    errors.push('assistantReply.en is required.')
  }

  return errors
}

function normalizeMultilingualString(value: unknown): MultilingualString {
  const candidate = value as Partial<MultilingualString>

  return {
    zh: typeof candidate?.zh === 'string' ? candidate.zh : '',
    en: typeof candidate?.en === 'string' ? candidate.en : '',
  }
}

async function uploadPaymentFiles(eventId: string, files: File[]) {
  const uploaded: Array<{ fileName: string; contentType: string; size: number; url: string }> = []
  const folder = `enrollments/${sanitizePath(eventId)}`

  for (const file of files) {
    if (!isAllowedPaymentFile(file)) {
      throw new Error('Unsupported payment file type.')
    }

    const formData = new FormData()
    formData.set('file', file, sanitizeFilename(file.name))
    const response = await fetch(`${DEFAULT_IMAGES_API_BASE}/api/images/${folder}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Payment file upload failed.')
    }

    const body = await response.json() as { image?: { url?: string } }
    uploaded.push({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      url: body.image?.url ?? '',
    })
  }

  return uploaded
}

function isAllowedPaymentFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[^\w.\-() ]+/g, '-').slice(0, 180) || 'payment-proof'
}

function sanitizePath(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
}

function getForwardHeaders(request: Request) {
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')

  if (cookie) {
    headers.set('cookie', cookie)
  }

  if (authorization) {
    headers.set('authorization', authorization)
  }

  return headers
}

function postEnrollmentToBackend(request: Request, env: Env, groupId: string, enrollmentJson: unknown) {
  const base = (env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET).replace(/\/$/, '')
  return fetch(`${base}/api/group/${encodeURIComponent(groupId)}/enroll`, {
    method: 'POST',
    headers: getForwardHeaders(request),
    body: JSON.stringify(enrollmentJson),
  })
}
