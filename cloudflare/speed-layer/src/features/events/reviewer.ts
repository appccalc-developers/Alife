import type { Env } from '../../index'
import {
  AiChatSession,
  createAiSessionObjectRequest,
  createMemoryDurableObjectState,
  getSessionIdFromPath,
  multilingualSchema,
  resolveAiSessionObjectPath,
  type AiSessionAppContext,
  type DurableObjectStateLike,
} from '../ai/aiSession'

const DEFAULT_SESSION_ID = 'default'
const SESSION_STORAGE_KEY = 'review-session-state'
const fallbackStates = new Map<string, DurableObjectStateLike>()

type MultilingualString = {
  zh: string
  en: string
}

type ReviewPhotoFile = {
  fileName: string
  contentType: string
  size: number
  key?: string
  url: string
}

type RecognizedPerson = {
  name: string
  confidence?: number | null
  correction?: string | null
}

type RecognizedActivity = {
  name: MultilingualString
  evidence?: string | null
  correction?: string | null
}

export type ReviewDraft = {
  reviewId: string
  eventId: string
  groupId: string
  memberId: string
  reflection: MultilingualString
  summary: MultilingualString
  recognizedPeople: RecognizedPerson[]
  recognizedActivities: RecognizedActivity[]
  photoFiles: ReviewPhotoFile[]
  assistantReply: MultilingualString | null
  submittedAtUtc: string
  updatedAtUtc: string
}

const REVIEW_RESPONSE_SCHEMA = {
  type: 'object',
  required: [
    'reviewId',
    'eventId',
    'groupId',
    'memberId',
    'reflection',
    'summary',
    'recognizedPeople',
    'recognizedActivities',
    'photoFiles',
    'assistantReply',
    'submittedAtUtc',
    'updatedAtUtc',
  ],
  properties: {
    reviewId: { type: 'string' },
    eventId: { type: 'string' },
    groupId: { type: 'string' },
    memberId: { type: 'string' },
    reflection: multilingualSchema('A warm event reflection in Simplified Chinese and New Zealand English.'),
    summary: multilingualSchema('A short review summary in Simplified Chinese and New Zealand English.'),
    recognizedPeople: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          confidence: { type: 'number', nullable: true, minimum: 0, maximum: 1 },
          correction: { type: 'string', nullable: true },
        },
      },
    },
    recognizedActivities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: multilingualSchema('Recognized activity name.'),
          evidence: { type: 'string', nullable: true },
          correction: { type: 'string', nullable: true },
        },
      },
    },
    photoFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fileName', 'contentType', 'size', 'url'],
        properties: {
          fileName: { type: 'string' },
          contentType: { type: 'string' },
          size: { type: 'number' },
          key: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    assistantReply: multilingualSchema('A concise bilingual response confirming captured reflection context and next steps.'),
    submittedAtUtc: { type: 'string' },
    updatedAtUtc: { type: 'string' },
  },
} as const

const REVIEW_SYSTEM_INSTRUCTION = `
You are the Alife event review assistant for a bilingual Chinese/English church community PWA.

Return exactly one JSON object matching the ReviewDraft response schema. Never return Markdown.

Rules:
1. Work bilingually.
   - Understand Chinese or English input.
   - reflection, summary, recognizedActivities.name, and assistantReply must always contain equivalent Simplified Chinese and New Zealand English.
2. Use supplied app context as known truth. You will receive user/member profile, group profile, event id, event data, existing enrollment data, and possibly an existing review draft. Do not ask the user for those fields again.
   - missionStatements contains the current group description and, when present, the parent group description. Use it to keep the reflection aligned with the community's purpose and pastoral tone.
   - eventContext contains the eventDataJson/eventData for the reviewed event. Use it as the primary event context for summary, reflection, activities, schedule, and logistics.
3. Preserve ids. Keep reviewId, eventId, groupId, and memberId unchanged unless app context supplies a more authoritative value.
4. Build a thoughtful reflection from event context, enrollment context, photo observations, and conversation. Do not invent names or activities; mark uncertainty in assistantReply and confidence.
5. Treat user corrections as authoritative. If the user corrects a person name, activity name, date, or what happened, update the draft and set correction fields where useful.
6. Read image/PDF attachments. Extract visible activities, people if the user identifies them, setting, mood, signs, schedules, meals, and group moments. Never identify a person by face alone; only use names supplied by the user or app context.
7. photoFiles should preserve uploaded file metadata already present in the draft or app context. Inline analysis attachments that are not uploaded yet should influence reflection but should not create permanent URLs.
8. assistantReply must briefly confirm what changed and ask for missing corrections or confirmation. If the reflection is ready, say it is ready to submit.
9. The current reference date is CURRENT_DATE_PLACEHOLDER.
`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    const url = new URL(request.url)
    const sessionId = getSessionId(request)
    const targetPath = resolveAiSessionObjectPath(url, request, {
      extraRoutes: ['/close'],
    })

    if (env.REVIEW_SESSIONS) {
      const objectId = env.REVIEW_SESSIONS.idFromName(sessionId)
      const object = env.REVIEW_SESSIONS.get(objectId)
      return object.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
    }

    const fallbackObject = new ReviewSession(getFallbackState(sessionId), env)
    return fallbackObject.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
  },
}

export class ReviewSession extends AiChatSession<ReviewDraft, MultilingualString | null> {
  constructor(durableState: DurableObjectStateLike, env: Env) {
    super(durableState, env, {
      storageKey: SESSION_STORAGE_KEY,
      routeNotFoundMessage: 'Review session route not found.',
      systemInstruction: (today) => REVIEW_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today),
      responseSchema: REVIEW_RESPONSE_SCHEMA,
      normalizeDraft: normalizeReviewDraft,
      validateDraft: validateReviewDraft,
      getInitialDraft: (sessionId) => createInitialDraft(sessionId),
      onStart: (draft, payload) => mergeReviewDraft(draft, normalizeReviewDraft(payload.draft ?? payload.reviewDraft ?? {}), {
        appContext: payload.appContext ?? {},
        preserveNextPhotoFiles: true,
      }),
      mergeDraft: (previousDraft, nextDraft, state) => mergeReviewDraft(previousDraft, nextDraft, state),
      getContextFromDraft: (draft) => draft.assistantReply ?? null,
      buildGeminiContext: ({ state, userMessage, inputMode, appContext, attachments }) => ({
        task: 'event-review',
        inputMode,
        language: appContext.language ?? 'bilingual',
        appContext,
        missionStatements: appContext.missionStatements ?? [],
        eventContext: appContext.eventContext ?? appContext.eventData ?? null,
        knownContextPolicy: 'Treat appContext and knownFacts fields as already known by the application; do not ask the user to repeat them.',
        currentDraft: state.draft,
        currentAssistantReply: state.context,
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
      formatChatHistoryEntry: (draft, context) => JSON.stringify({ reviewDraft: draft, assistantReply: context }),
    })
  }

  async fetch(request: Request): Promise<Response> {
    return this.handleRequest(request, getSessionId(request))
  }
}

function createInitialDraft(sessionId: string): ReviewDraft {
  const now = new Date().toISOString()
  return {
    reviewId: crypto.randomUUID(),
    eventId: extractEventIdFromSessionId(sessionId),
    groupId: '',
    memberId: '',
    reflection: { zh: '', en: '' },
    summary: { zh: '', en: '' },
    recognizedPeople: [],
    recognizedActivities: [],
    photoFiles: [],
    assistantReply: {
      zh: '請分享活動照片、回憶，或需要修正的人名與活動內容，我會整理成活動回顧。',
      en: 'Share event photos, memories, or corrections to names and activities, and I will shape them into an event reflection.',
    },
    submittedAtUtc: '',
    updatedAtUtc: now,
  }
}

function mergeReviewDraft(
  previousDraft: ReviewDraft | null,
  nextDraft: ReviewDraft,
  state: { appContext: AiSessionAppContext; preserveNextPhotoFiles?: boolean },
): ReviewDraft {
  const knownFacts = isRecord(state.appContext.knownFacts) ? state.appContext.knownFacts : {}
  const existingReview = normalizeReviewDraft(knownFacts.existingReview)
  const eventData = state.appContext.eventData
  const now = new Date().toISOString()
  const knownPhotoFiles = dedupeReviewPhotoFiles([
    ...(previousDraft?.photoFiles ?? []),
    ...existingReview.photoFiles,
  ])
  const photoFiles = state.preserveNextPhotoFiles
    ? dedupeReviewPhotoFiles([...knownPhotoFiles, ...nextDraft.photoFiles])
    : knownPhotoFiles

  return {
    ...nextDraft,
    reviewId: stringValue(knownFacts.reviewId)
      || nextDraft.reviewId
      || previousDraft?.reviewId
      || existingReview.reviewId
      || crypto.randomUUID(),
    eventId: state.appContext.eventId || nextDraft.eventId || previousDraft?.eventId || extractEventId(eventData) || existingReview.eventId || '',
    groupId: state.appContext.groupId || nextDraft.groupId || previousDraft?.groupId || existingReview.groupId || '',
    memberId: state.appContext.memberId || nextDraft.memberId || previousDraft?.memberId || state.appContext.userId || existingReview.memberId || '',
    photoFiles,
    submittedAtUtc: nextDraft.submittedAtUtc || previousDraft?.submittedAtUtc || existingReview.submittedAtUtc || '',
    updatedAtUtc: now,
  }
}

function dedupeReviewPhotoFiles(photoFiles: ReviewPhotoFile[]) {
  const seen = new Set<string>()
  return photoFiles.filter((file) => {
    const key = file.key?.trim()
      ? `key:${file.key.trim()}`
      : `url:${file.url.trim()}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function extractEventId(eventData: unknown) {
  return isRecord(eventData) && typeof eventData.id === 'string' ? eventData.id : ''
}

function getSessionId(request: Request) {
  return getSessionIdFromPath(request, '/api/reviews/session', DEFAULT_SESSION_ID)
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
  const match = sessionId.match(/-event-(.+)-review(?:-.+)?$/i)
  return match?.[1] ?? ''
}

function normalizeReviewDraft(value: unknown): ReviewDraft {
  const candidate = isRecord(value) ? value : {}
  const now = new Date().toISOString()

  return {
    reviewId: stringValue(candidate.reviewId) || stringValue(candidate.id) || '',
    eventId: stringValue(candidate.eventId) || '',
    groupId: stringValue(candidate.groupId) || '',
    memberId: stringValue(candidate.memberId) || '',
    reflection: normalizeMultilingualString(candidate.reflection),
    summary: normalizeMultilingualString(candidate.summary),
    recognizedPeople: Array.isArray(candidate.recognizedPeople)
      ? candidate.recognizedPeople.filter(isRecord).map((person) => ({
        name: stringValue(person.name) || '',
        confidence: typeof person.confidence === 'number' ? person.confidence : null,
        correction: stringValue(person.correction) || null,
      })).filter((person) => person.name.trim())
      : [],
    recognizedActivities: Array.isArray(candidate.recognizedActivities)
      ? candidate.recognizedActivities.filter(isRecord).map((activity) => ({
        name: normalizeMultilingualString(activity.name),
        evidence: stringValue(activity.evidence) || null,
        correction: stringValue(activity.correction) || null,
      })).filter((activity) => activity.name.zh.trim() || activity.name.en.trim())
      : [],
    photoFiles: Array.isArray(candidate.photoFiles)
      ? candidate.photoFiles.filter(isRecord).map((file) => ({
        fileName: stringValue(file.fileName) || '',
        contentType: stringValue(file.contentType) || 'application/octet-stream',
        size: typeof file.size === 'number' ? file.size : 0,
        key: stringValue(file.key),
        url: stringValue(file.url) || '',
      })).filter((file) => file.fileName.trim() && file.url.trim())
      : [],
    assistantReply: normalizeMultilingualString(candidate.assistantReply),
    submittedAtUtc: stringValue(candidate.submittedAtUtc) || '',
    updatedAtUtc: stringValue(candidate.updatedAtUtc) || now,
  }
}

function validateReviewDraft(draft: ReviewDraft) {
  const errors: string[] = []

  if (!draft.eventId.trim()) {
    errors.push('eventId is required.')
  }

  requireMultilingual(errors, draft.reflection, 'reflection')
  requireMultilingual(errors, draft.summary, 'summary')

  if (!draft.assistantReply || !draft.assistantReply.zh.trim()) {
    errors.push('assistantReply.zh is required.')
  }

  if (!draft.assistantReply || !draft.assistantReply.en.trim()) {
    errors.push('assistantReply.en is required.')
  }

  return errors
}

function requireMultilingual(errors: string[], value: MultilingualString, path: string) {
  if (!value.zh.trim()) {
    errors.push(`${path}.zh is required.`)
  }

  if (!value.en.trim()) {
    errors.push(`${path}.en is required.`)
  }
}

function normalizeMultilingualString(value: unknown): MultilingualString {
  const candidate = isRecord(value) ? value : {}

  return {
    zh: stringValue(candidate.zh) || '',
    en: stringValue(candidate.en) || '',
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
