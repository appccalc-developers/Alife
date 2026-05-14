import type { Env } from './index'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3-pro'
const DEFAULT_SESSION_ID = 'default'
const SESSION_STORAGE_KEY = 'event-session-state'

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

type EventDto = {
  id?: string
  organizerId?: string
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

type ChatMessage = {
  role: 'user' | 'model'
  text: string
}

type SessionState = {
  sessionId: string
  eventDraft: EventDto | null
  legacySummary: MultilingualString | null
  chatHistory: ChatMessage[]
  updatedAt: string
}

type ExtractRequest = {
  sessionId?: unknown
  message?: unknown
  inputMode?: unknown
}

type DurableObjectState = {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
  }
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
    baseFeePerAdult: { type: ['number', 'null'] },
    baseFeePerChild: { type: ['number', 'null'] },
    currency: { type: 'string' },
    posterImageUrl: { type: ['string', 'null'] },
    galleryUrls: { type: 'array', items: { type: 'string' } },
    legacySummary: {
      type: ['object', 'null'],
      description: 'Creative ideas, venue research, logistics suggestions, and conversational context that are not strict DTO facts.',
      properties: {
        zh: { type: 'string' },
        en: { type: 'string' },
      },
    },
  },
} as const

const GEMINI_SYSTEM_INSTRUCTION = `You are the secure event-planning brain for Alife, a bilingual Chinese/English church community PWA.

Return exactly one JSON object that conforms to the provided EventDto response schema. Never return Markdown.

Critical extraction rules:
1. Bifurcate every response.
   - Strict facts go into first-class EventDto fields: title, dates, locationName, capacity, fees, optionalActivities, and hardConstraints.
   - Creative ideas, venue research, logistics suggestions, open questions, assumptions, and follow-up notes go into legacySummary.
2. Maintain bilingual parity. Every MultilingualString must have both zh and en populated with equivalent meaning.
3. Preserve state. You will receive the current in-progress EventDto and chat history; merge new information into the existing draft instead of starting over.
4. Treat natural voice transcripts the same as typed text. Clean up filler words, but do not erase meaningful uncertainty.
5. Extract hard constraints from non-negotiable language such as "must", "no", "deadline", "only", "required", and "not allowed".
6. Do not fabricate precise dates, prices, capacities, or venue facts. If the user gives only a month, set the date fields to the first day and include the ambiguity in legacySummary.
7. The current reference date is CURRENT_DATE_PLACEHOLDER.

West Coast demo calibration:
If the user mentions Wainui Park, a March camp, and asks about the hall, create or update a Wainui Park Camp draft. Put the hall inquiry in legacySummary. If an insight sentence is useful, include this English wording in legacySummary.en: "I've noted the hall inquiry. Wainui Park has a hall for 80 people; would you like me to add it to the budget?"`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    const url = new URL(request.url)
    const sessionId = getSessionId(request)
    const targetPath = createDurableObjectPath(url, request)

    if (env.EVENT_SESSIONS) {
      const objectId = env.EVENT_SESSIONS.idFromName(sessionId)
      const object = env.EVENT_SESSIONS.get(objectId)
      return object.fetch(new Request(new URL(targetPath, url.origin), request))
    }

    const fallbackObject = new EventPlanningSession(createMemoryDurableObjectState(), env)
    return fallbackObject.fetch(new Request(new URL(targetPath, url.origin), request))
  },
}

export class EventPlanningSession {
  private statePromise: Promise<SessionState>
  private readonly clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  private readonly durableState: DurableObjectState
  private readonly env: Env

  constructor(durableState: DurableObjectState, env: Env) {
    this.durableState = durableState
    this.env = env
    this.statePromise = this.loadState()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.endsWith('/stream') && request.method === 'GET') {
      return this.openEventStream()
    }

    if (url.pathname.endsWith('/state') && request.method === 'GET') {
      return Response.json(await this.statePromise)
    }

    if (url.pathname.endsWith('/message') && request.method === 'POST') {
      return this.handleMessage(request)
    }

    return Response.json({ message: 'Event planning session route not found.' }, { status: 404 })
  }

  private async handleMessage(request: Request) {
    if (!this.env.GEMINI_API_KEY) {
      return Response.json({ message: 'GEMINI_API_KEY is not configured.' }, { status: 503 })
    }

    let body: ExtractRequest
    try {
      body = await request.json() as ExtractRequest
    } catch {
      return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const userMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!userMessage) {
      return Response.json({ message: 'User message cannot be empty.' }, { status: 400 })
    }

    const state = await this.statePromise
    const inputMode = body.inputMode === 'voice' ? 'voice' : 'text'
    let nextDraft: EventDto
    try {
      nextDraft = await this.callGemini(userMessage, inputMode, state)
    } catch (error) {
      console.error('Gemini event extraction failed', error)
      return Response.json({ message: error instanceof Error ? error.message : 'AI extraction failed.' }, { status: 502 })
    }
    const validationErrors = validateEventDto(nextDraft)

    if (validationErrors.length > 0) {
      console.error('Gemini EventDto validation failed', validationErrors)
      return Response.json(
        { message: 'AI returned event data that failed EventDto validation.', validationErrors },
        { status: 502 },
      )
    }

    const nextState: SessionState = {
      ...state,
      eventDraft: nextDraft,
      legacySummary: nextDraft.legacySummary ?? null,
      chatHistory: [
        ...state.chatHistory,
        { role: 'user', text: userMessage },
        { role: 'model', text: JSON.stringify({ eventDraft: nextDraft }) },
      ].slice(-24),
      updatedAt: new Date().toISOString(),
    }

    this.statePromise = Promise.resolve(nextState)
    await this.durableState.storage.put(SESSION_STORAGE_KEY, nextState)
    this.broadcast({ type: 'eventDraft', state: nextState })

    return Response.json({
      responseMode: 'result',
      sessionId: nextState.sessionId,
      result: nextState.eventDraft,
      legacySummary: nextState.legacySummary,
    })
  }

  private openEventStream() {
    const encoder = new TextEncoder()
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        streamController = controller
        this.clients.add(controller)
        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode(sseMessage('snapshot', await this.statePromise)))
      },
      cancel: () => {
        if (streamController) {
          this.clients.delete(streamController)
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    })
  }

  private async callGemini(userMessage: string, inputMode: 'text' | 'voice', state: SessionState): Promise<EventDto> {
    const today = new Date().toISOString().slice(0, 10)
    const systemText = GEMINI_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today)
    const model = this.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const context = {
      inputMode,
      currentDraft: state.eventDraft,
      currentLegacySummary: state.legacySummary,
      chatHistory: state.chatHistory.slice(-12),
      userMessage,
    }

    const geminiPayload = {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EVENT_DTO_RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }

    const geminiRes = await fetch(
      `${GEMINI_API_BASE}/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.env.GEMINI_API_KEY ?? '' },
        body: JSON.stringify(geminiPayload),
      },
    )

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text()
      console.error('Gemini API error', geminiRes.status, errorText)
      throw new Error('AI extraction failed. Please try again.')
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    try {
      return normalizeEventDto(JSON.parse(jsonText))
    } catch {
      console.error('Gemini returned invalid JSON:', jsonText)
      throw new Error('AI returned an unexpected response format.')
    }
  }

  private async loadState(): Promise<SessionState> {
    const stored = await this.durableState.storage.get<SessionState>(SESSION_STORAGE_KEY)
    if (stored) {
      return stored
    }

    return {
      sessionId: crypto.randomUUID(),
      eventDraft: null,
      legacySummary: null,
      chatHistory: [],
      updatedAt: new Date().toISOString(),
    }
  }

  private broadcast(payload: unknown) {
    const message = new TextEncoder().encode(sseMessage('message', payload))

    for (const client of Array.from(this.clients)) {
      try {
        client.enqueue(message)
      } catch {
        this.clients.delete(client)
      }
    }
  }
}

function getSessionId(request: Request) {
  const url = new URL(request.url)
  const pathMatch = url.pathname.match(/^\/api\/events\/session\/([^/]+)/)
  const pathSessionId = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : ''
  const querySessionId = url.searchParams.get('sessionId') ?? ''

  return sanitizeSessionId(pathSessionId || querySessionId || DEFAULT_SESSION_ID)
}

function createDurableObjectPath(url: URL, request: Request) {
  if (url.pathname === '/api/events/extract') {
    return '/message'
  }

  if (url.pathname.endsWith('/stream')) {
    return '/stream'
  }

  if (url.pathname.endsWith('/state')) {
    return '/state'
  }

  if (request.method === 'POST') {
    return '/message'
  }

  return '/state'
}

function sanitizeSessionId(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 128)
  return cleaned || DEFAULT_SESSION_ID
}

function normalizeEventDto(value: unknown): EventDto {
  const candidate = value as Partial<EventDto>

  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    organizerId: typeof candidate.organizerId === 'string' ? candidate.organizerId : '',
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
    legacySummary: candidate.legacySummary == null ? null : normalizeMultilingualString(candidate.legacySummary),
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

function sseMessage(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

function multilingualSchema(description: string) {
  return {
    type: 'object',
    description,
    required: ['zh', 'en'],
    properties: {
      zh: { type: 'string' },
      en: { type: 'string' },
    },
  }
}

function createMemoryDurableObjectState(): DurableObjectState {
  const storage = new Map<string, unknown>()

  return {
    storage: {
      async get<T>(key: string) {
        return storage.get(key) as T | undefined
      },
      async put<T>(key: string, value: T) {
        storage.set(key, value)
      },
    },
  }
}
