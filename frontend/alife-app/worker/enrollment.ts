import type { Env } from './index'
import {
  AiChatSession,
  createAiSessionObjectRequest,
  createMemoryDurableObjectState,
  getSessionIdFromPath,
  multilingualSchema,
  resolveAiSessionObjectPath,
  type AiSessionAppContext,
  type DurableObjectStateLike,
} from './ai-session'

const DEFAULT_IMAGES_API_BASE = 'https://ccalc.live/images'
const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const DEFAULT_SESSION_ID = 'default'
const SESSION_STORAGE_KEY = 'enrollment-session-state'
const fallbackStates = new Map<string, DurableObjectStateLike>()

type MultilingualString = {
  zh: string
  en: string
}

type EnrollmentDto = {
  eventId: string
  groupId: string
  memberId: string
  applicantName: string
  applicantDisplayName: string
  consentStatus: 'unknown' | 'granted' | 'declined'
  assistantReply: MultilingualString | null
}

const ENROLLMENT_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['eventId', 'applicantName', 'consentStatus', 'assistantReply', 'groupId', 'memberId', 'applicantDisplayName'],
  properties: {
    eventId: { type: 'string' },
    groupId: { type: 'string' },
    memberId: { type: 'string' },
    applicantName: { type: 'string' },
    applicantDisplayName: { type: 'string' },
    consentStatus: { type: 'string', enum: ['unknown', 'granted', 'declined'] },
    assistantReply: multilingualSchema('A short bilingual response confirming what was captured and what the user should do next.'),
  },
} as const

const ENROLLMENT_SYSTEM_INSTRUCTION = `
You are the Alife enrollment assistant for a bilingual Chinese/English church community PWA.

Return exactly one JSON object matching the response schema. Never return Markdown.

Rules:
1. Work bilingually.
   - Understand Chinese or English input.
   - assistantReply must always contain equivalent Simplified Chinese and New Zealand English.
2. Bifurcate every response.
   - Preserve the current draft (eventId, groupId, memberId, applicantDisplayName) and merge new user information into it.
   - Generate a concise assistantReply in both Simplified Chinese and New Zealand English that confirms the captured information and guides the user on any missing requirements for enrollment submission.
3. Use supplied app context as known truth. You will receive user/member profile, group profile, event id, and event data when the app already knows them. Do not ask the user for those fields again.
4. Keep eventId, groupId, memberId, and applicantDisplayName unchanged unless app context supplies a more authoritative value.
5. applicantName should contain the enrollment applicant's full name. If the user profile gives a reliable full name, use it. If unknown, leave as empty string and ask the user to provide it.
6. consentStatus must be:
   - "granted" only when the user clearly agrees to submit the enrollment and payment proof.
   - "declined" only when the user clearly refuses.
   - "unknown" when consent has not been clearly stated yet.
7. If image/PDF attachments are supplied, read them as uploaded payment proof or event reference material. Reflect whether the attachment looks usable, but do not approve payment validity beyond visible facts.
8. assistantReply must be concise, reflective, and guide the user toward missing requirements (name, consent, or payment proof).
9. If all requirements are met, confirm that they are ready to click the "Submit" button.
10. The current reference date is CURRENT_DATE_PLACEHOLDER.
`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    const url = new URL(request.url)
    const sessionId = getSessionId(request)
    const targetPath = resolveAiSessionObjectPath(url, request, {
      extraRoutes: ['/commit', '/close'],
    })

    if (env.ENROLLMENT_SESSIONS) {
      const objectId = env.ENROLLMENT_SESSIONS.idFromName(sessionId)
      const object = env.ENROLLMENT_SESSIONS.get(objectId)
      return object.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
    }

    const fallbackObject = new EnrollmentSession(getFallbackState(sessionId), env)
    return fallbackObject.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
  },
}

export class EnrollmentSession extends AiChatSession<EnrollmentDto, MultilingualString | null> {
  constructor(durableState: DurableObjectStateLike, env: Env) {
    super(durableState, env, {
      storageKey: SESSION_STORAGE_KEY,
      routeNotFoundMessage: 'Enrollment session route not found.',
      systemInstruction: (today) => ENROLLMENT_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today),
      responseSchema: ENROLLMENT_RESPONSE_SCHEMA,
      normalizeDraft: normalizeEnrollmentDto,
      validateDraft: validateEnrollmentDto,
      getInitialDraft: (sessionId) => ({
        eventId: extractEventIdFromSessionId(sessionId),
        groupId: '',
        memberId: '',
        applicantName: '',
        applicantDisplayName: '',
        consentStatus: 'unknown',
        assistantReply: null,
      }),
      onStart: (draft, payload) => ({
        ...draft,
        eventId: payload.eventId || payload.appContext?.eventId || draft.eventId,
        groupId: payload.groupId || payload.appContext?.groupId || draft.groupId,
        memberId: payload.memberId || payload.appContext?.memberId || draft.memberId,
        applicantName: payload.applicantName
          || payload.userProfile?.name
          || payload.appContext?.userProfile?.name
          || payload.appContext?.memberProfile?.name
          || draft.applicantName,
        applicantDisplayName: payload.displayName
          || payload.userProfile?.displayName
          || payload.appContext?.userProfile?.displayName
          || payload.appContext?.memberProfile?.displayName
          || draft.applicantDisplayName,
      }),
      mergeDraft: (previousDraft, nextDraft, state) => mergeEnrollmentDraft(previousDraft, nextDraft, state.appContext),
      getContextFromDraft: (draft) => draft.assistantReply ?? null,
      buildGeminiContext: ({ state, userMessage, inputMode, appContext, attachments }) => ({
        task: 'event-enrollment',
        inputMode,
        language: appContext.language ?? 'bilingual',
        appContext,
        knownContextPolicy: 'Treat appContext fields as already known by the application; do not ask the user to repeat them.',
        currentDraft: state.draft,
        chatHistory: state.chatHistory.slice(-12),
        attachments: attachments.map(({ name, contentType, size, source, url }) => ({
          name,
          contentType,
          size,
          source,
          url,
        })),
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

    if (!draft) {
      return Response.json({ message: 'Enrollment draft not found.' }, { status: 400 })
    }

    if (!draft.eventId) {
      return Response.json({ message: 'Enrollment draft is missing eventId.' }, { status: 400 })
    }

    if (!draft.applicantName.trim()) {
      return Response.json({ message: 'Enrollment draft is missing applicant name.' }, { status: 400 })
    }

    if (draft.consentStatus !== 'granted') {
      return Response.json({ message: 'Enrollment consent must be granted before submission.' }, { status: 400 })
    }

    const formData = await request.formData()
    const groupId = draft.groupId || String(formData.get('groupId') ?? '').trim()
    if (!groupId) {
      return Response.json({ message: 'groupId is required.' }, { status: 400 })
    }

    const paymentFiles = formData
      .getAll('paymentFiles')
      .filter((item): item is File => item instanceof File && item.size > 0)

    if (paymentFiles.length === 0) {
      return Response.json({ message: 'At least one payment file is required.' }, { status: 400 })
    }

    const enrollmentId = crypto.randomUUID()
    let uploadedFiles
    try {
      uploadedFiles = await uploadPaymentFiles(groupId, draft.eventId, enrollmentId, paymentFiles)
    } catch (error) {
      return Response.json({ message: error instanceof Error ? error.message : 'Payment file upload failed.' }, { status: 502 })
    }

    const backendResponse = await postEnrollmentToBackend(request, this.env, draft.eventId, {
      id: enrollmentId,
      enrollmentId,
      eventId: draft.eventId,
      groupId,
      applicantName: draft.applicantName,
      ...(draft.memberId ? { memberId: draft.memberId } : {}),
      consent: true,
      paymentFiles: uploadedFiles,
      submittedAtUtc: new Date().toISOString(),
    })

    if (!backendResponse.ok) {
      const text = await backendResponse.text()
      return Response.json({ message: 'Failed to commit enrollment.', details: text }, { status: 502 })
    }

    await this.handleRequest(new Request(new URL('/close', request.url), { method: 'POST' }), sessionId)

    return Response.json({
      status: 'completed',
      message: 'Enrollment submitted successfully.',
    })
  }
}

function mergeEnrollmentDraft(
  previousDraft: EnrollmentDto | null,
  nextDraft: EnrollmentDto,
  appContext: AiSessionAppContext,
): EnrollmentDto {
  const userProfile = appContext.userProfile ?? appContext.memberProfile
  const eventData = appContext.eventData

  return {
    ...nextDraft,
    eventId: appContext.eventId || nextDraft.eventId || previousDraft?.eventId || extractEventId(eventData) || '',
    groupId: appContext.groupId || nextDraft.groupId || previousDraft?.groupId || '',
    memberId: appContext.memberId || nextDraft.memberId || previousDraft?.memberId || appContext.userId || '',
    applicantName: nextDraft.applicantName
      || stringFromProfile(userProfile, 'name')
      || previousDraft?.applicantName
      || '',
    applicantDisplayName: stringFromProfile(userProfile, 'displayName')
      || stringFromProfile(userProfile, 'name')
      || nextDraft.applicantDisplayName
      || previousDraft?.applicantDisplayName
      || '',
  }
}

function extractEventId(eventData: unknown) {
  return typeof eventData === 'object'
    && eventData !== null
    && 'id' in eventData
    && typeof eventData.id === 'string'
    ? eventData.id
    : ''
}

function stringFromProfile(profile: unknown, key: 'name' | 'displayName') {
  const record = typeof profile === 'object' && profile !== null
    ? profile as Record<string, unknown>
    : null

  return typeof profile === 'object'
    && profile !== null
    && key in profile
    && typeof record?.[key] === 'string'
    ? record[key]
    : ''
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
  const match = sessionId.match(/-event-(.+)-enrollment$/i)
  return match?.[1] ?? ''
}

function normalizeEnrollmentDto(value: unknown): EnrollmentDto {
  const candidate = value as Partial<EnrollmentDto>

  return {
    eventId: typeof candidate.eventId === 'string' ? candidate.eventId : '',
    groupId: typeof candidate.groupId === 'string' ? candidate.groupId : '',
    memberId: typeof candidate.memberId === 'string' ? candidate.memberId : '',
    applicantName: typeof candidate.applicantName === 'string' ? candidate.applicantName.trim() : '',
    applicantDisplayName: typeof candidate.applicantDisplayName === 'string' ? candidate.applicantDisplayName : '',
    consentStatus: candidate.consentStatus === 'granted' || candidate.consentStatus === 'declined'
      ? candidate.consentStatus
      : 'unknown',
    assistantReply: normalizeMultilingualString(candidate.assistantReply),
  }
}

function validateEnrollmentDto(draft: EnrollmentDto) {
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

async function uploadPaymentFiles(groupId: string, eventId: string, enrollmentId: string, files: File[]) {
  const uploaded: Array<{ fileName: string; contentType: string; size: number; key?: string; url: string }> = []
  const folder = [
    'groups',
    sanitizePath(groupId),
    'events',
    sanitizePath(eventId),
    'enrollments',
    sanitizePath(enrollmentId),
  ].join('/')

  for (const file of files) {
    if (!isAllowedPaymentFile(file)) {
      throw new Error('Unsupported payment file type.')
    }

    const formData = new FormData()
    formData.set('file', file, sanitizeFilename(file.name))
    console.log(`Uploading payment file to: ${DEFAULT_IMAGES_API_BASE}/api/images/${folder}`)
    const response = await fetch(`${DEFAULT_IMAGES_API_BASE}/api/images/${folder}`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      console.error('Payment file upload failed:', await response.text())
      throw new Error('Payment file upload failed.')
    }

    const body = await response.json() as { image?: { key?: string; url?: string } }
    const uploadedFile: { fileName: string; contentType: string; size: number; key?: string; url: string } = {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      url: body.image?.url ?? '',
    }
    if (body.image?.key) {
      uploadedFile.key = body.image.key
    }
    uploaded.push(uploadedFile)
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

function postEnrollmentToBackend(request: Request, env: Env, eventId: string, enrollmentJson: unknown) {
  const base = (env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET).replace(/\/$/, '')
  return fetch(`${base}/api/events/${encodeURIComponent(eventId)}/enrollments`, {
    method: 'POST',
    headers: getForwardHeaders(request),
    body: JSON.stringify(enrollmentJson),
  })
}
