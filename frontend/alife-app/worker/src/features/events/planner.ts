import type { Env } from '../../index'
import {
  AiChatSession,
  createAiSessionObjectRequest,
  createMemoryDurableObjectState,
  getSessionIdFromPath,
  multilingualSchema,
  resolveAiSessionObjectPath,
  type AiSessionAppContext,
} from '../ai/aiSession'

const DEFAULT_SESSION_ID = 'default'
const SESSION_STORAGE_KEY = 'event-session-state'
const fallbackStates = new Map<string, ReturnType<typeof createMemoryDurableObjectState>>()

type MultilingualString = {
  zh: string
  en: string
}

type EventRuleDto = {
  ruleKey: string
  displayMessage: MultilingualString
  isMandatory: boolean
}

type OptionalActivityDto = {
  id?: string
  name: MultilingualString
  extraFee: number
}

export type EventDto = {
  id?: string
  organizerId?: string
  organizerDisplayName?: string
  memberId?: string
  groupId?: string
  title: MultilingualString
  description: MultilingualString
  locationName: MultilingualString
  startDate: string
  endDate: string
  registrationDeadline: string
  maxCapacity: number
  capacityUnit: 'Families' | 'People'
  hardConstraints: EventRuleDto[]
  optionalActivities: OptionalActivityDto[]
  baseFeePerAdult?: number | null
  baseFeePerChild?: number | null
  currency: string
  posterImageUrl?: string | null
  galleryUrls: string[]
  legacySummary?: MultilingualString | null
}

const EVENT_DTO_RESPONSE_SCHEMA = {
  type: 'object',
  required: [
    'title',
    'description',
    'locationName',
    'startDate',
    'endDate',
    'registrationDeadline',
    'maxCapacity',
    'capacityUnit',
    'hardConstraints',
    'optionalActivities',
    'currency',
    'galleryUrls',
    'legacySummary',
  ],
  properties: {
    id: { type: 'string' },
    organizerId: { type: 'string' },
    organizerDisplayName: { type: 'string' },
    memberId: { type: 'string' },
    groupId: { type: 'string' },
    title: multilingualSchema('Event title in Simplified Chinese and New Zealand English.'),
    description: multilingualSchema('Event description in Simplified Chinese and New Zealand English.'),
    locationName: multilingualSchema('Venue or location name in both languages.'),
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    registrationDeadline: { type: 'string', format: 'date-time' },
    maxCapacity: { type: 'integer', minimum: 1 },
    capacityUnit: { type: 'string', enum: ['Families', 'People'] },
    hardConstraints: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ruleKey', 'displayMessage', 'isMandatory'],
        properties: {
          ruleKey: { type: 'string', enum: ['Transport', 'Food', 'Safety', 'RSVP', 'Budget', 'Venue', 'General'] },
          displayMessage: multilingualSchema('Strict, user-facing rule text.'),
          isMandatory: { type: 'boolean' },
        },
      },
    },
    optionalActivities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'extraFee'],
        properties: {
          id: { type: 'string' },
          name: multilingualSchema('Optional activity name.'),
          extraFee: { type: 'number', minimum: 0 },
        },
      },
    },
    baseFeePerAdult: { type: 'number', nullable: true },
    baseFeePerChild: { type: 'number', nullable: true },
    currency: { type: 'string' },
    posterImageUrl: { type: 'string', nullable: true },
    galleryUrls: { type: 'array', items: { type: 'string' } },
    legacySummary: {
      type: 'object',
      description: 'Creative ideas, venue research, logistics suggestions, and conversational context that are not strict DTO facts.',
      properties: {
        zh: { type: 'string' },
        en: { type: 'string' },
      },
    },
  },
} as const

const GEMINI_SYSTEM_INSTRUCTION = `
You are the secure event-planning brain for Alife, a bilingual Chinese/English church community PWA.

Return exactly one JSON object that conforms to the provided EventDto response schema. Never return Markdown.

Critical extraction rules:
1. Work bilingually.
   - Understand either Chinese or English input.
   - Populate every MultilingualString with equivalent Simplified Chinese and New Zealand English.
   - If the app context specifies a preferred language, keep legacySummary concise in that language first while still filling both fields.
2. Bifurcate every response.
   - Strict facts go into first-class EventDto fields: title, dates, locationName, capacity, fees, optionalActivities, and hardConstraints.
   - Creative ideas, venue research, logistics suggestions, open questions, assumptions, missing fields, and reflective follow-up notes go into legacySummary.
3. Use supplied app context as known truth. You will receive userId/profile, memberId/profile, groupId/profile and member profiles, and possibly an existing eventId/eventData. Do not ask for these again when present.
4. Preserve state. Merge new information into the existing draft instead of starting over. Keep id, organizerId, organizerDisplayName, memberId, and groupId unchanged unless app context supplies a more authoritative value.
5. Guide the user. In legacySummary, briefly reflect what is known, what is still missing for creating/enrolling the event, and the next best question.
6. Read attachments. If image or PDF parts are supplied, extract visible event details, dates, prices, poster text, QR/payment instructions, and relevant logistics. Mention uncertainty in legacySummary.
7. Treat natural voice transcripts the same as typed text. Clean up filler words, but do not erase meaningful uncertainty.
8. Extract hard constraints from non-negotiable language such as "must", "no", "deadline", "only", "required", and "not allowed".
9. Do not fabricate precise dates, prices, capacities, or venue facts. If the user gives only a month, set the date fields to the first day and include the ambiguity in legacySummary.
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
      messageAliasPaths: ['/api/events/extract'],
      extraRoutes: ['/close'],
    })

    if (env.EVENT_SESSIONS) {
      const objectId = env.EVENT_SESSIONS.idFromName(sessionId)
      const object = env.EVENT_SESSIONS.get(objectId)
      return object.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
    }

    const fallbackObject = new EventPlanningSession(getFallbackState(sessionId), env)
    return fallbackObject.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
  },
}

export class EventPlanningSession extends AiChatSession<EventDto, MultilingualString | null> {
  constructor(durableState: ConstructorParameters<typeof AiChatSession<EventDto, MultilingualString | null>>[0], env: Env) {
    super(durableState, env, {
      storageKey: SESSION_STORAGE_KEY,
      routeNotFoundMessage: 'Event planning session route not found.',
      systemInstruction: (today) => GEMINI_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today),
      responseSchema: EVENT_DTO_RESPONSE_SCHEMA,
      normalizeDraft: normalizeEventDto,
      validateDraft: validateEventDto,
      getInitialDraft: () => ({
        title: { zh: '', en: '' },
        description: { zh: '', en: '' },
        locationName: { zh: '', en: '' },
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        maxCapacity: 1,
        capacityUnit: 'Families',
        hardConstraints: [],
        optionalActivities: [],
        currency: 'NZD',
        galleryUrls: [],
        legacySummary: null,
      }),
      onStart: (draft, payload) => ({
        ...draft,
        id: payload.eventId || payload.id || payload.appContext?.eventId || draft.id,
        organizerId: payload.userId || payload.organizerId || payload.appContext?.userId || draft.organizerId,
        organizerDisplayName: payload.displayName
          || payload.userProfile?.displayName
          || payload.appContext?.userProfile?.displayName
          || draft.organizerDisplayName,
        memberId: payload.memberId || payload.appContext?.memberId || draft.memberId,
        groupId: payload.groupId || payload.appContext?.groupId || draft.groupId,
      }),
      mergeDraft: (previousDraft, nextDraft, state) => mergeEventDraft(previousDraft, nextDraft, state.appContext),
      getContextFromDraft: (draft) => draft.legacySummary ?? null,
      buildGeminiContext: ({ state, userMessage, inputMode, appContext, attachments }) => ({
        task: 'event-planning',
        inputMode,
        language: appContext.language ?? 'bilingual',
        appContext,
        knownContextPolicy: 'Treat appContext fields as already known by the application; do not ask the user to repeat them.',
        currentDraft: state.draft,
        currentLegacySummary: state.context,
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
      formatState: (state) => ({
        sessionId: state.sessionId,
        draft: state.draft,
        eventDraft: state.draft,
        context: state.context,
        legacySummary: state.context,
        chatHistory: state.chatHistory,
        updatedAt: state.updatedAt,
      }),
      formatMessageResponse: (state) => ({
        responseMode: 'result',
        sessionId: state.sessionId,
        result: state.draft,
        context: state.context,
        legacySummary: state.context,
      }),
      formatSsePayload: (state) => ({
        type: 'eventDraft',
        state: {
          sessionId: state.sessionId,
          draft: state.draft,
          eventDraft: state.draft,
          context: state.context,
          legacySummary: state.context,
          chatHistory: state.chatHistory,
          updatedAt: state.updatedAt,
        },
      }),
      formatChatHistoryEntry: (draft) => JSON.stringify({ eventDraft: draft }),
    })
  }

  async fetch(request: Request): Promise<Response> {
    return this.handleRequest(request, getSessionId(request))
  }
}

function mergeEventDraft(
  previousDraft: EventDto | null,
  nextDraft: EventDto,
  appContext: AiSessionAppContext,
): EventDto {
  const eventData = appContext.eventData as Partial<EventDto> | null | undefined
  const userProfile = appContext.userProfile ?? appContext.memberProfile

  return {
    ...nextDraft,
    id: appContext.eventId || nextDraft.id || previousDraft?.id || eventData?.id || '',
    organizerId: appContext.userId || nextDraft.organizerId || previousDraft?.organizerId || eventData?.organizerId || '',
    organizerDisplayName: userProfile?.displayName
      || userProfile?.name
      || nextDraft.organizerDisplayName
      || previousDraft?.organizerDisplayName
      || '',
    memberId: appContext.memberId || nextDraft.memberId || previousDraft?.memberId || '',
    groupId: appContext.groupId || nextDraft.groupId || previousDraft?.groupId || eventData?.groupId || '',
  }
}

function getSessionId(request: Request) {
  return getSessionIdFromPath(request, '/api/events/session', DEFAULT_SESSION_ID)
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

function normalizeEventDto(value: unknown): EventDto {
  const candidate = value as Partial<EventDto>

  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    organizerId: typeof candidate.organizerId === 'string' ? candidate.organizerId : '',
    organizerDisplayName: typeof candidate.organizerDisplayName === 'string' ? candidate.organizerDisplayName : '',
    memberId: typeof candidate.memberId === 'string' ? candidate.memberId : '',
    groupId: typeof candidate.groupId === 'string' ? candidate.groupId : '',
    title: normalizeMultilingualString(candidate.title),
    description: normalizeMultilingualString(candidate.description),
    locationName: normalizeMultilingualString(candidate.locationName),
    startDate: typeof candidate.startDate === 'string' ? candidate.startDate : '',
    endDate: typeof candidate.endDate === 'string' ? candidate.endDate : '',
    registrationDeadline: typeof candidate.registrationDeadline === 'string' ? candidate.registrationDeadline : '',
    maxCapacity: Number.isInteger(candidate.maxCapacity) && Number(candidate.maxCapacity) > 0 ? Number(candidate.maxCapacity) : 1,
    capacityUnit: candidate.capacityUnit === 'People' ? 'People' : 'Families',
    hardConstraints: Array.isArray(candidate.hardConstraints)
      ? candidate.hardConstraints.map((rule) => ({
        ruleKey: typeof rule?.ruleKey === 'string' ? rule.ruleKey : 'General',
        displayMessage: normalizeMultilingualString(rule?.displayMessage),
        isMandatory: typeof rule?.isMandatory === 'boolean' ? rule.isMandatory : true,
      }))
      : [],
    optionalActivities: Array.isArray(candidate.optionalActivities)
      ? candidate.optionalActivities.map((activity) => ({
        id: typeof activity?.id === 'string' ? activity.id : '',
        name: normalizeMultilingualString(activity?.name),
        extraFee: typeof activity?.extraFee === 'number' && activity.extraFee >= 0 ? activity.extraFee : 0,
      }))
      : [],
    baseFeePerAdult: typeof candidate.baseFeePerAdult === 'number' ? candidate.baseFeePerAdult : null,
    baseFeePerChild: typeof candidate.baseFeePerChild === 'number' ? candidate.baseFeePerChild : null,
    currency: typeof candidate.currency === 'string' && candidate.currency.trim() ? candidate.currency : 'NZD',
    posterImageUrl: typeof candidate.posterImageUrl === 'string' ? candidate.posterImageUrl : null,
    galleryUrls: Array.isArray(candidate.galleryUrls) ? candidate.galleryUrls.filter((url) => typeof url === 'string') : [],
    legacySummary: candidate.legacySummary ? normalizeMultilingualString(candidate.legacySummary) : null,
  }
}

function normalizeMultilingualString(value: unknown): MultilingualString {
  const candidate = value as Partial<MultilingualString>

  return {
    zh: typeof candidate?.zh === 'string' ? candidate.zh : '',
    en: typeof candidate?.en === 'string' ? candidate.en : '',
  }
}

function validateEventDto(event: EventDto) {
  const errors: string[] = []

  requireMultilingual(errors, event.title, 'title')
  requireMultilingual(errors, event.description, 'description')
  requireMultilingual(errors, event.locationName, 'locationName')
  requireIsoDate(errors, event.startDate, 'startDate')
  requireIsoDate(errors, event.endDate, 'endDate')
  requireIsoDate(errors, event.registrationDeadline, 'registrationDeadline')

  if (!Number.isInteger(event.maxCapacity) || event.maxCapacity < 1) {
    errors.push('maxCapacity must be a positive integer.')
  }

  if (event.capacityUnit !== 'Families' && event.capacityUnit !== 'People') {
    errors.push('capacityUnit must be Families or People.')
  }

  if (!Array.isArray(event.hardConstraints)) {
    errors.push('hardConstraints must be an array.')
  } else {
    event.hardConstraints.forEach((rule, index) => {
      if (!rule.ruleKey.trim()) {
        errors.push(`hardConstraints[${index}].ruleKey is required.`)
      }
      requireMultilingual(errors, rule.displayMessage, `hardConstraints[${index}].displayMessage`)
      if (typeof rule.isMandatory !== 'boolean') {
        errors.push(`hardConstraints[${index}].isMandatory must be boolean.`)
      }
    })
  }

  if (!Array.isArray(event.optionalActivities)) {
    errors.push('optionalActivities must be an array.')
  } else {
    event.optionalActivities.forEach((activity, index) => {
      requireMultilingual(errors, activity.name, `optionalActivities[${index}].name`)
      if (typeof activity.extraFee !== 'number' || activity.extraFee < 0) {
        errors.push(`optionalActivities[${index}].extraFee must be a non-negative number.`)
      }
    })
  }

  if (!event.currency.trim()) {
    errors.push('currency is required.')
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

function requireIsoDate(errors: string[], value: string, path: string) {
  if (!value.trim() || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO-8601 date-time string.`)
  }
}
