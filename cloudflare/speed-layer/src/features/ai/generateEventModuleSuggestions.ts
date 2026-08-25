import type { Env } from '../../index'
import { extractMemberIdFromRequest } from '../../middlewares/authCache'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MODULES = ['registration', 'finance', 'venue', 'roster', 'programme'] as const

type ModuleKey = typeof MODULES[number]
type LocalizedText = { en: string; zh: string }
type SuggestionBasis = 'currentEvent' | 'confirmedHistory' | 'inference'
type ModuleSuggestion = {
  key: string
  label: LocalizedText
  value: string
  rationale: LocalizedText
  basis: SuggestionBasis
}

const allowedSuggestionKeys: Record<ModuleKey, Set<string>> = {
  registration: new Set(['maxCapacity', 'capacityUnit', 'registrationDeadlineUtc']),
  finance: new Set(['currency', 'paymentInstructionsZh', 'paymentInstructionsEn', 'refundPolicyZh', 'refundPolicyEn', 'paymentEvidenceRequired']),
  venue: new Set(['venueSpaceId', 'purposeZh', 'purposeEn', 'notes']),
  roster: new Set(['roleKey', 'nameZh', 'nameEn', 'startUtc', 'endUtc', 'requiredPeople', 'requiredLabels', 'notes']),
  programme: new Set(['titleZh', 'titleEn', 'startUtc', 'endUtc', 'instructionsZh', 'instructionsEn', 'requiresHandover', 'handoverZh', 'handoverEn']),
}

const contextRoutes: Record<ModuleKey, string> = {
  registration: 'registration',
  finance: 'finance',
  venue: 'venue-workspace',
  roster: 'roster',
  programme: 'programme',
}

export async function handleGenerateEventModuleSuggestions(request: Request, env: Env): Promise<Response> {
  if (!extractMemberIdFromRequest(request)) return json({ message: 'Authentication is required.' }, 401)
  if (!env.GEMINI_API_KEY) return json({ message: 'GEMINI_API_KEY is not configured.' }, 503)

  let payload: Record<string, unknown>
  try {
    const value = await request.json() as unknown
    payload = isRecord(value) ? value : {}
  } catch {
    return json({ message: 'Invalid module suggestion request.' }, 400)
  }

  const eventId = readString(payload.eventId, 80)
  const moduleKey = MODULES.includes(payload.module as ModuleKey) ? payload.module as ModuleKey : null
  const guidance = readString(payload.guidance, 1000)
  if (!UUID_PATTERN.test(eventId)) return json({ message: 'A valid eventId is required.' }, 400)
  if (!moduleKey) return json({ message: 'The requested event module is not supported.' }, 400)

  const origin = env.API_PROXY_TARGET?.trim()
  if (!origin) return json({ message: 'The event service is unavailable.' }, 503)

  const contextResponse = await fetch(new URL(`/api/events/${encodeURIComponent(eventId)}/${contextRoutes[moduleKey]}`, origin).toString(), {
    headers: forwardedAuthHeaders(request),
  })
  if (!contextResponse.ok) {
    if (contextResponse.status === 401 || contextResponse.status === 403 || contextResponse.status === 404) {
      return json({ message: contextResponse.status === 403 ? 'Only event leaders can request module suggestions.' : 'Event module context is unavailable.' }, contextResponse.status)
    }
    return json({ message: 'Event module context could not be loaded.' }, 502)
  }

  const rawContext = await contextResponse.json() as unknown
  const moduleContext = moduleKey === 'registration'
    ? normalizeRegistrationContext(rawContext)
    : moduleKey === 'finance'
      ? normalizeFinanceContext(rawContext)
      : moduleKey === 'venue'
        ? normalizeVenueContext(rawContext)
        : moduleKey === 'roster'
          ? normalizeRosterContext(rawContext)
          : normalizeProgrammeContext(rawContext)
  const confirmedHistory = await loadConfirmedHistory(eventId, request, env)
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

  const geminiResponse = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt(moduleKey) }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({
        task: 'suggest-event-module-settings',
        module: moduleKey,
        guidance,
        currentEvent: moduleContext,
        confirmedHistory,
      }) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema(moduleKey),
        thinkingConfig: { thinkingLevel: 'minimal' },
        temperature: 0.15,
        maxOutputTokens: 3072,
      },
    }),
  })

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text()
    const providerMessage = readProviderErrorMessage(errorText)
    console.error('Gemini event module suggestions failed.', geminiResponse.status, providerMessage)
    if (geminiResponse.status === 400 && /api key not valid/i.test(providerMessage)) {
      return json({ message: 'AI assistance is not configured with a valid Gemini API key. Please contact an administrator.' }, 503)
    }
    return json({ message: geminiResponse.status === 429 ? 'AI is busy. Please try again shortly.' : 'AI could not prepare module suggestions.' }, geminiResponse.status === 429 ? 429 : 502)
  }

  const text = readGeminiText(await geminiResponse.json() as unknown)
  if (!text) return json({ message: 'AI returned no module suggestions.' }, 502)
  try {
    const root = JSON.parse(text) as unknown
    const suggestions = normalizeSuggestions(root, moduleKey, moduleContext)
    return json({
      module: moduleKey,
      suggestions,
      warnings: normalizeWarnings(root),
      model,
      requiresHumanReview: true,
      persisted: false,
    }, 200)
  } catch {
    return json({ message: 'AI returned an unexpected module suggestion format.' }, 502)
  }
}

function responseSchema(moduleKey: ModuleKey) {
  return {
    type: 'object',
    required: ['suggestions', 'warnings'],
    properties: {
      suggestions: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          required: ['key', 'label', 'value', 'rationale', 'basis'],
          properties: {
            key: { type: 'string', enum: [...allowedSuggestionKeys[moduleKey]] },
            label: localizedSchema(),
            value: { type: 'string' },
            rationale: localizedSchema(),
            basis: { type: 'string', enum: ['currentEvent', 'confirmedHistory', 'inference'] },
          },
        },
      },
      warnings: { type: 'array', maxItems: 6, items: localizedSchema() },
    },
  }
}

function localizedSchema() {
  return { type: 'object', required: ['en', 'zh'], properties: { en: { type: 'string' }, zh: { type: 'string' } } }
}

function systemPrompt(moduleKey: ModuleKey) {
  const moduleRules: Record<ModuleKey, string> = {
    registration: `Registration suggestions may use only maxCapacity, capacityUnit, and registrationDeadlineUtc. A deadline must be a valid ISO-8601 instant before the supplied event start. Do not invent attendance demand. If capacity lacks evidence, preserve the current value or omit it.`,
    finance: `Finance suggestions may use only currency, paymentInstructionsZh, paymentInstructionsEn, refundPolicyZh, refundPolicyEn, and paymentEvidenceRequired. Never propose or infer prices, bank details, account numbers, payment receipt status, or that money was received.`,
    venue: `Venue suggestions may use only venueSpaceId, purposeZh, purposeEn, and notes. venueSpaceId must be one of the active maintained spaces supplied in currentEvent. You may compare stated capacity and equipment needs, but never invent a venue, imply availability, submit a request, or imply approval. If attendance or equipment needs are unknown, ask the leader to confirm them instead of choosing a space.`,
    roster: `Roster suggestions configure one new shift only and may use roleKey, nameZh, nameEn, startUtc, endUtc, requiredPeople, requiredLabels, and notes. Never suggest or rank people. Never infer personal circumstances or capability labels. Candidate matching is performed later by deterministic availability and workload rules. Shift times must stay inside the event window, and staffing counts are recommendations that require leader review.`,
    programme: `Programme suggestions configure one run-sheet item only and may use titleZh, titleEn, startUtc, endUtc, instructionsZh, instructionsEn, requiresHandover, handoverZh, and handoverEn. Never choose or name a person, never mark the item ready or completed, and never imply that a roster assignment has been accepted. Times must stay inside the event window. Handover text may describe only operational information that a leader still reviews.`,
  }

  return `You prepare reviewable bilingual suggestions for one optional module in Alife, a Chinese Christian community event system.

The response is a preview only. A human leader chooses individual suggestions and saves the module later.

Rules:
1. Use only currentEvent, optional leader guidance, and leader-confirmed history supplied in the prompt.
2. Never invent names, contact details, permissions, approvals, safety conclusions, personal circumstances, prices, demand, or completed work.
3. Do not copy old dates, prices, contacts, approvals, or venue decisions from history. History may support a rationale only.
4. Use basis=currentEvent for directly supplied facts, confirmedHistory for a leader-confirmed lesson, and inference only for a clearly labelled recommendation.
5. Return only useful changes or checks. Do not repeat every existing value.
6. Provide equivalent Simplified Chinese and New Zealand English labels and rationales.
7. If evidence is insufficient, omit the suggestion and add a concise bilingual warning asking the leader to confirm the missing fact.
8. Never say a suggestion has been saved, approved, published, or applied.

${moduleRules[moduleKey]}`
}

function normalizeRegistrationContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  return {
    eventId: readString(root.eventId, 80),
    title: { en: readString(root.titleEn, 300), zh: readString(root.titleZh, 300) },
    startUtc: readString(root.startUtc, 80),
    maxCapacity: readInteger(root.maxCapacity),
    capacityUnit: root.capacityUnit === 'Families' ? 'Families' : 'People',
    registrationDeadlineUtc: readString(root.registrationDeadlineUtc, 80),
    status: readString(root.status, 40),
    enrollmentCount: readInteger(root.enrollmentCount),
    reservedUnits: readInteger(root.reservedUnits),
    remainingUnits: readInteger(root.remainingUnits),
    // Applicant names, member IDs and individual registration records are
    // intentionally excluded from the AI prompt.
  }
}

function normalizeFinanceContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  return {
    eventId: readString(root.eventId, 80),
    title: { en: readString(root.titleEn, 300), zh: readString(root.titleZh, 300) },
    status: readString(root.status, 40),
    currency: readString(root.currency, 3).toUpperCase(),
    paymentInstructions: localize(root.paymentInstructions, 3000),
    refundPolicy: localize(root.refundPolicy, 3000),
    paymentEvidenceRequired: root.paymentEvidenceRequired === true,
    leaderConfirmed: root.leaderConfirmed === true,
    optionCount: Array.isArray(root.options) ? root.options.length : 0,
    evidenceSubmissionCount: readInteger(root.evidenceSubmissionCount),
    evidenceFileCount: readInteger(root.evidenceFileCount),
    eventEnded: root.eventEnded === true,
    // Applicant names, evidence summaries, file URLs, transactions and bank
    // details are intentionally excluded from the AI prompt.
  }
}

function normalizeVenueContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  const venues = Array.isArray(root.venues) ? root.venues : []
  const spaces = venues.flatMap((venueValue) => {
    const venue = isRecord(venueValue) ? venueValue : {}
    const venueName = localize(venue.name, 300)
    return (Array.isArray(venue.spaces) ? venue.spaces : []).flatMap((spaceValue) => {
      const space = isRecord(spaceValue) ? spaceValue : {}
      if (space.isActive === false) return []
      return [{
        id: readString(space.id, 80),
        venueName,
        name: localize(space.name, 300),
        capacity: readInteger(space.capacity),
        resources: readStringArrayJson(space.resourcesJson, 30, 120),
      }]
    }).filter((space) => UUID_PATTERN.test(space.id))
  })
  return {
    eventId: readString(root.eventId, 80),
    title: localize(root.eventTitle, 300),
    startUtc: readString(root.eventStartUtc, 80),
    endUtc: readString(root.eventEndUtc, 80),
    occurrences: (Array.isArray(root.occurrences) ? root.occurrences : []).slice(0, 50).map((value) => {
      const occurrence = isRecord(value) ? value : {}
      return {
        id: readString(occurrence.id, 80),
        name: localize(occurrence.name, 300),
        startUtc: readString(occurrence.startUtc, 80),
        endUtc: readString(occurrence.endUtc, 80),
      }
    }),
    spaces,
    existingRequests: (Array.isArray(root.bookings) ? root.bookings : []).slice(0, 50).map((value) => {
      const booking = isRecord(value) ? value : {}
      return {
        occurrenceId: readString(booking.eventOccurrenceId, 80),
        venueSpaceId: readString(booking.venueSpaceId, 80),
        startUtc: readString(booking.startUtc, 80),
        endUtc: readString(booking.endUtc, 80),
        status: readString(booking.status, 30),
      }
    }),
    // Addresses, requesters, reviewers and decision notes are intentionally
    // excluded. AI may compare maintained spaces but cannot approve one.
  }
}

function normalizeRosterContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  return {
    eventId: readString(root.eventId, 80),
    title: localize(root.eventTitle, 300),
    startUtc: readString(root.eventStartUtc, 80),
    endUtc: readString(root.eventEndUtc, 80),
    existingShifts: (Array.isArray(root.shifts) ? root.shifts : []).slice(0, 100).map((value) => {
      const shift = isRecord(value) ? value : {}
      return {
        roleKey: readString(shift.roleKey, 120),
        name: localize(shift.name, 300),
        startUtc: readString(shift.startUtc, 80),
        endUtc: readString(shift.endUtc, 80),
        requiredPeople: readInteger(shift.requiredPeople),
        requiredLabels: readStringArray(shift.requiredLabels, 20, 100),
      }
    }),
    // Member names, availability reasons, profile notes, manager notes and
    // assignments are intentionally excluded. The existing rules engine ranks
    // candidates only after a leader saves a shift.
  }
}

function normalizeProgrammeContext(value: unknown) {
  const root = isRecord(value) ? value : {}
  return {
    eventId: readString(root.eventId, 80),
    title: localize(root.eventTitle, 300),
    startUtc: readString(root.eventStartUtc, 80),
    endUtc: readString(root.eventEndUtc, 80),
    occurrences: (Array.isArray(root.occurrences) ? root.occurrences : []).slice(0, 50).map((value) => {
      const occurrence = isRecord(value) ? value : {}
      return {
        id: readString(occurrence.id, 80),
        name: localize(occurrence.name, 300),
        startUtc: readString(occurrence.startUtc, 80),
        endUtc: readString(occurrence.endUtc, 80),
      }
    }),
    existingItems: (Array.isArray(root.items) ? root.items : []).slice(0, 100).map((value) => {
      const item = isRecord(value) ? value : {}
      return {
        title: localize(item.title, 300),
        startUtc: readString(item.startUtc, 80),
        endUtc: readString(item.endUtc, 80),
        requiresHandover: item.requiresHandover === true,
      }
    }),
    rosterSlots: (Array.isArray(root.rosterOptions) ? root.rosterOptions : []).slice(0, 100).map((value) => {
      const slot = isRecord(value) ? value : {}
      return {
        shiftId: readString(slot.shiftId, 80),
        name: localize(slot.name, 300),
        startUtc: readString(slot.startUtc, 80),
        endUtc: readString(slot.endUtc, 80),
        acceptedCount: (Array.isArray(slot.assignees) ? slot.assignees : []).filter((assignment) => isRecord(assignment) && readString(assignment.status, 30).toLowerCase() === 'accepted').length,
      }
    }),
    // Member names, IDs, notes and private availability are excluded. AI may
    // draft an operational slot but cannot choose an owner or confirm readiness.
  }
}

async function loadConfirmedHistory(eventId: string, request: Request, env: Env) {
  const origin = env.API_PROXY_TARGET?.trim()
  if (!origin) return []
  try {
    const response = await fetch(new URL(`/api/events/${encodeURIComponent(eventId)}/closure`, origin).toString(), {
      headers: forwardedAuthHeaders(request),
    })
    if (!response.ok) return []
    const root = await response.json() as unknown
    if (!isRecord(root) || !Array.isArray(root.previousLearnings)) return []
    return root.previousLearnings.slice(0, 15).map((value) => {
      const source = isRecord(value) ? value : {}
      const learning = isRecord(source.learning) ? source.learning : {}
      return {
        eventTitle: localize(source.eventTitle, 300),
        title: localize(learning.title, 300),
        detail: localize(learning.detail, 1500),
      }
    })
  } catch {
    return []
  }
}

type ModuleContext = ReturnType<typeof normalizeRegistrationContext> | ReturnType<typeof normalizeFinanceContext> | ReturnType<typeof normalizeVenueContext> | ReturnType<typeof normalizeRosterContext> | ReturnType<typeof normalizeProgrammeContext>

function normalizeSuggestions(value: unknown, moduleKey: ModuleKey, moduleContext: ModuleContext): ModuleSuggestion[] {
  const root = isRecord(value) ? value : {}
  const raw = Array.isArray(root.suggestions) ? root.suggestions.slice(0, 8) : []
  const seen = new Set<string>()
  const suggestions: ModuleSuggestion[] = []
  for (const value of raw) {
    const item = isRecord(value) ? value : {}
    const key = readString(item.key, 80)
    if (!allowedSuggestionKeys[moduleKey].has(key) || seen.has(key)) continue
    const normalizedValue = normalizeSuggestionValue(moduleKey, key, item.value, moduleContext)
    if (normalizedValue === null) continue
    seen.add(key)
    suggestions.push({
      key,
      label: localize(item.label, 200),
      value: normalizedValue,
      rationale: localize(item.rationale, 1000),
      basis: item.basis === 'confirmedHistory' || item.basis === 'inference' ? item.basis : 'currentEvent',
    })
  }
  return suggestions
}

function normalizeSuggestionValue(moduleKey: ModuleKey, key: string, value: unknown, moduleContext: ModuleContext) {
  const text = readString(value, key.includes('Instructions') || key.includes('Policy') ? 3000 : 120)
  if (!text) return null
  if (moduleKey === 'registration') {
    if (key === 'maxCapacity') {
      const count = Number(text)
      return Number.isInteger(count) && count > 0 && count <= 100000 ? String(count) : null
    }
    if (key === 'capacityUnit') return text === 'People' || text === 'Families' ? text : null
    if (key === 'registrationDeadlineUtc') {
      const deadline = Date.parse(text)
      const start = Date.parse('startUtc' in moduleContext ? moduleContext.startUtc : '')
      return Number.isFinite(deadline) && Number.isFinite(start) && deadline < start ? new Date(deadline).toISOString() : null
    }
  }
  if (moduleKey === 'venue') {
    if (key === 'venueSpaceId') {
      const spaces = 'spaces' in moduleContext ? moduleContext.spaces : []
      return spaces.some((space) => space.id === text) ? text : null
    }
    return text
  }
  if (moduleKey === 'roster') {
    if (key === 'requiredPeople') {
      const count = Number(text)
      return Number.isInteger(count) && count > 0 && count <= 100 ? String(count) : null
    }
    if (key === 'requiredLabels') {
      const labels = text.split(/[,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 20)
      return labels.length ? labels.join(', ') : null
    }
    if (key === 'startUtc' || key === 'endUtc') {
      const instant = Date.parse(text)
      const eventStart = Date.parse('startUtc' in moduleContext ? moduleContext.startUtc : '')
      const eventEnd = Date.parse('endUtc' in moduleContext ? moduleContext.endUtc : '')
      return Number.isFinite(instant) && Number.isFinite(eventStart) && Number.isFinite(eventEnd) && instant >= eventStart && instant <= eventEnd
        ? new Date(instant).toISOString()
        : null
    }
    if (key === 'roleKey') return /^[a-z0-9][a-z0-9-]{1,79}$/.test(text) ? text : null
    return text
  }
  if (moduleKey === 'programme') {
    if (key === 'requiresHandover') return text === 'true' || text === 'false' ? text : null
    if (key === 'startUtc' || key === 'endUtc') {
      const instant = Date.parse(text)
      const eventStart = Date.parse('startUtc' in moduleContext ? moduleContext.startUtc : '')
      const eventEnd = Date.parse('endUtc' in moduleContext ? moduleContext.endUtc : '')
      return Number.isFinite(instant) && Number.isFinite(eventStart) && Number.isFinite(eventEnd) && instant >= eventStart && instant <= eventEnd
        ? new Date(instant).toISOString()
        : null
    }
    return text
  }
  if (key === 'currency') return /^[A-Z]{3}$/.test(text.toUpperCase()) ? text.toUpperCase() : null
  if (key === 'paymentEvidenceRequired') return text === 'true' || text === 'false' ? text : null
  return text
}

function normalizeWarnings(value: unknown) {
  const root = isRecord(value) ? value : {}
  return (Array.isArray(root.warnings) ? root.warnings : []).slice(0, 6)
    .map((warning) => localize(warning, 800))
    .filter((warning) => warning.en || warning.zh)
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
  const root = isRecord(value) ? value : {}
  return { en: readString(root.en, max), zh: readString(root.zh, max) }
}

function readString(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function readInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  return (Array.isArray(value) ? value : []).slice(0, maxItems)
    .map((item) => readString(item, maxLength))
    .filter(Boolean)
}

function readStringArrayJson(value: unknown, maxItems: number, maxLength: number) {
  if (typeof value !== 'string') return []
  try { return readStringArray(JSON.parse(value), maxItems, maxLength) }
  catch { return [] }
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
