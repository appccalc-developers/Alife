import type { Env } from '../../index'
import {
  AiChatSession,
  createAiSessionObjectName,
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

type RamMissingInformation = {
  code: string
  fieldPath: string
  message: MultilingualString
}

type RamHazard = {
  id?: string
  hazard: MultilingualString
  likelihood: number | null
  impact: number | null
  riskScore: number | null
  controlMeasures: MultilingualString
  personResponsible: string
}

type RamEmergencyContact = {
  role: MultilingualString
  name: string
  phone: string
}

type EventRamDraft = {
  activityName: MultilingualString
  activityDescription: MultilingualString
  participantCount: number | null
  participantAgeRange: MultilingualString
  isOuting: boolean | null
  hazards: RamHazard[]
  emergencyContacts: RamEmergencyContact[]
  outingSafety: {
    transportRequired: boolean | null
    licensedDriverConfirmed: boolean | null
    vehicleRegistrationConfirmed: boolean | null
    vehicleWofConfirmed: boolean | null
    venueRiskAssessed: boolean | null
    firstAidKitAvailable: boolean | null
    trainedFirstAiderName: string
    trainedFirstAiderQualificationConfirmed: boolean | null
    participantHealthNeedsReviewed: boolean | null
    weatherPlanReviewed: boolean | null
  }
  missingInformation: RamMissingInformation[]
  leaderConfirmed: boolean
}

export type EventDto = {
  id?: string
  organizerId?: string
  organizerDisplayName?: string
  visibility?: 'groupVisible' | 'churchVisible' | 'public'
  personResponsible?: string
  memberId?: string
  groupId?: string
  purpose?: MultilingualString
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
  requiresRoster: boolean
  baseFeePerAdult?: number | null
  baseFeePerChild?: number | null
  currency: string
  paymentInstructions?: MultilingualString
  refundPolicy?: MultilingualString
  paymentEvidenceRequired?: boolean
  financeLeaderConfirmed?: boolean
  posterImageUrl?: string | null
  galleryUrls: string[]
  legacySummary?: MultilingualString | null
  ram: EventRamDraft
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
    'requiresRoster',
    'currency',
    'galleryUrls',
    'legacySummary',
    'ram',
  ],
  properties: {
    id: { type: 'string' },
    organizerId: { type: 'string' },
    organizerDisplayName: { type: 'string' },
    personResponsible: { type: 'string', description: 'Exact event lead name supplied by the user or trusted app context.' },
    memberId: { type: 'string' },
    groupId: { type: 'string' },
    purpose: multilingualSchema('The ministry or community purpose of the event in both languages.'),
    title: multilingualSchema('Event title in Simplified Chinese and New Zealand English.'),
    description: multilingualSchema('Event description in Simplified Chinese and New Zealand English.'),
    locationName: multilingualSchema('Venue or location name in both languages.'),
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    registrationDeadline: {
      type: 'string',
      description: 'ISO-8601 registration deadline, or an empty string when the event does not require registration.',
    },
    maxCapacity: {
      type: 'integer',
      minimum: 0,
      description: 'Positive registration capacity, or 0 when the event does not require registration.',
    },
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
    requiresRoster: {
      type: 'boolean',
      description: 'Whether this event needs a volunteer roster module. Preserve the current value unless the user explicitly changes the staffing need.',
    },
    baseFeePerAdult: { type: 'number', nullable: true },
    baseFeePerChild: { type: 'number', nullable: true },
    currency: { type: 'string' },
    paymentInstructions: multilingualSchema('How members pay, in both languages.'),
    refundPolicy: multilingualSchema('The refund and cancellation rule, in both languages.'),
    paymentEvidenceRequired: { type: 'boolean' },
    financeLeaderConfirmed: { type: 'boolean', description: 'Always false for AI output. Only an event leader may confirm finance settings.' },
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
    ram: {
      type: 'object',
      required: ['activityName', 'activityDescription', 'participantCount', 'participantAgeRange', 'isOuting', 'hazards', 'emergencyContacts', 'outingSafety', 'missingInformation', 'leaderConfirmed'],
      properties: {
        activityName: multilingualSchema('RAM activity name in Simplified Chinese and New Zealand English.'),
        activityDescription: multilingualSchema('RAM activity description including participant context.'),
        participantCount: { type: 'integer', nullable: true, minimum: 1 },
        participantAgeRange: multilingualSchema('Participant age range in both languages, blank when unknown.'),
        isOuting: { type: 'boolean', nullable: true },
        hazards: {
          type: 'array',
          items: {
            type: 'object',
            required: ['hazard', 'likelihood', 'impact', 'riskScore', 'controlMeasures', 'personResponsible'],
            properties: {
              id: { type: 'string' },
              hazard: multilingualSchema('Identified hazard in both languages.'),
              likelihood: { type: 'integer', nullable: true, minimum: 1, maximum: 5 },
              impact: { type: 'integer', nullable: true, minimum: 1, maximum: 5 },
              riskScore: { type: 'integer', nullable: true, minimum: 1, maximum: 25 },
              controlMeasures: multilingualSchema('Specific control measures in both languages.'),
              personResponsible: { type: 'string', description: 'Exact user-provided or app-context name only; otherwise blank.' },
            },
          },
        },
        emergencyContacts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['role', 'name', 'phone'],
            properties: {
              role: multilingualSchema('Emergency contact role in both languages.'),
              name: { type: 'string', description: 'Exact known name only; otherwise blank.' },
              phone: { type: 'string', description: 'Exact known phone number only; otherwise blank.' },
            },
          },
        },
        outingSafety: {
          type: 'object',
          required: ['transportRequired', 'licensedDriverConfirmed', 'vehicleRegistrationConfirmed', 'vehicleWofConfirmed', 'venueRiskAssessed', 'firstAidKitAvailable', 'trainedFirstAiderName', 'trainedFirstAiderQualificationConfirmed', 'participantHealthNeedsReviewed', 'weatherPlanReviewed'],
          properties: {
            transportRequired: { type: 'boolean', nullable: true },
            licensedDriverConfirmed: { type: 'boolean', nullable: true },
            vehicleRegistrationConfirmed: { type: 'boolean', nullable: true },
            vehicleWofConfirmed: { type: 'boolean', nullable: true },
            venueRiskAssessed: { type: 'boolean', nullable: true },
            firstAidKitAvailable: { type: 'boolean', nullable: true },
            trainedFirstAiderName: { type: 'string', description: 'Exact known name only; otherwise blank.' },
            trainedFirstAiderQualificationConfirmed: { type: 'boolean', nullable: true },
            participantHealthNeedsReviewed: { type: 'boolean', nullable: true },
            weatherPlanReviewed: { type: 'boolean', nullable: true },
          },
        },
        missingInformation: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'fieldPath', 'message'],
            properties: {
              code: { type: 'string' },
              fieldPath: { type: 'string' },
              message: multilingualSchema('Clear description of missing information in both languages.'),
            },
          },
        },
        leaderConfirmed: { type: 'boolean', description: 'Always false for AI output. Only the human editor may set this true.' },
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
   - missionStatements contains the current group description and, when present, the parent group description. Align event tone, purpose, outreach, and logistics with these statements.
   - eventContext contains the existing eventDataJson/eventData for the event being created or edited. Treat it as authoritative event context unless the user corrects it.
4. Preserve state. Merge new information into the existing draft instead of starting over. Keep id, organizerId, organizerDisplayName, memberId, and groupId unchanged unless app context supplies a more authoritative value.
5. Guide the user across two deliverables: the public event notice and the internal RAM report. In legacySummary, briefly reflect what is known, state whether each deliverable has enough information to submit, list the highest-priority missing facts, and ask one useful next question.
6. Read attachments. If image or PDF parts are supplied, extract visible event details, dates, prices, poster text, QR/payment instructions, and relevant logistics. Mention uncertainty in legacySummary. Treat an expired or prior-event poster as reference material unless the user explicitly says it is the current poster; do not silently reuse old dates.
7. Treat natural voice transcripts the same as typed text. Clean up filler words, but do not erase meaningful uncertainty.
8. Extract hard constraints from non-negotiable language such as "must", "no", "deadline", "only", "required", and "not allowed".
9. Do not fabricate precise dates, prices, capacities, or venue facts. If the user gives only a month, set the date fields to the first day and include the ambiguity in legacySummary.
10. Reuse shared facts consistently across both deliverables. In particular, keep purpose, title/activity name, description, participant count, participant age range, location, schedule, activities, people responsible, and contacts aligned between the public EventDto fields and ram fields whenever the same fact is used. Do not ask for a fact that is already present in the draft or trusted app context.
11. Registration semantics are explicit. If the user says registration, RSVP, or enrolment is not required, set maxCapacity to 0 and registrationDeadline to an empty string. A zero capacity means "no registration required", not missing information. If registration is required, use a positive maxCapacity and a valid ISO-8601 registrationDeadline.
12. The current reference date is CURRENT_DATE_PLACEHOLDER.

RAM safety rules derived from the church Risk Assessment Manual:
13. Produce a RAM draft together with every event draft. Use bilingual activity name/description, participant count and age range, hazards, controls, responsible person, emergency contacts, and outing checks.
14. Score each hazard with likelihood 1-5 and impact 1-5. Likelihood: 1 rare (<5%), 2 unlikely (5-29%), 3 moderate (30-59%), 4 likely (60-79%), 5 almost certain (80%+). Impact: 1 insignificant, 2 minor/basic first aid, 3 moderate/medical visit, 4 major/hospitalisation, 5 catastrophic/permanent disability or death. riskScore must equal likelihood multiplied by impact.
15. Never invent or infer a responsible person's name, phone number, first-aid qualification, driver licence, vehicle registration, WOF, or vehicle safety status. Only copy an exact fact explicitly supplied by the user or trusted app context. Otherwise leave the field blank or null and add a bilingual missingInformation item with its fieldPath.
16. For outings, explicitly consider transport safety, venue risk, first-aid kit and a trained first aider, participant health needs, and weather. Unknown confirmations remain null and are marked missing.
17. leaderConfirmed is always false in AI output. Human confirmation happens only in the editor.
18. requiresRoster is a module choice, not a guess about a person. Preserve the current value unless the user explicitly says staffing or volunteer shifts are or are not needed. AI may suggest the module in legacySummary, but the human confirms the setting.
19. Finance assistance may draft bilingual payment instructions and refund rules, but financeLeaderConfirmed is always false. Never approve a payment file or claim that money was received.

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
      const objectId = env.EVENT_SESSIONS.idFromName(createAiSessionObjectName(request, sessionId))
      const object = env.EVENT_SESSIONS.get(objectId)
      return object.fetch(createAiSessionObjectRequest(targetPath, url, request, sessionId))
    }

    const fallbackObject = new EventPlanningSession(getFallbackState(createAiSessionObjectName(request, sessionId)), env)
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
        personResponsible: '',
        purpose: { zh: '', en: '' },
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
        requiresRoster: false,
        currency: 'NZD',
        galleryUrls: [],
        legacySummary: null,
        ram: createEmptyRamDraft(),
      }),
      onStart: (draft, payload) => {
        const seededDraft = payload.draft || payload.eventDraft
          ? normalizeEventDto(payload.draft ?? payload.eventDraft)
          : draft

        return {
          ...draft,
          ...seededDraft,
          id: payload.eventId || payload.id || payload.appContext?.eventId || seededDraft.id,
          organizerId: payload.userId || payload.organizerId || payload.appContext?.userId || seededDraft.organizerId,
          organizerDisplayName: payload.displayName
            || payload.userProfile?.displayName
            || payload.appContext?.userProfile?.displayName
            || seededDraft.organizerDisplayName,
          memberId: payload.memberId || payload.appContext?.memberId || seededDraft.memberId,
          groupId: payload.groupId || payload.appContext?.groupId || seededDraft.groupId,
          ram: {
            ...seededDraft.ram,
            leaderConfirmed: false,
          },
        }
      },
      mergeDraft: (previousDraft, nextDraft, state) => mergeEventDraft(previousDraft, nextDraft, state.appContext),
      getContextFromDraft: (draft) => draft.legacySummary ?? null,
      buildGeminiContext: ({ state, userMessage, inputMode, appContext, attachments }) => ({
        task: 'event-planning',
        inputMode,
        language: appContext.language ?? 'bilingual',
        appContext,
        missionStatements: appContext.missionStatements ?? [],
        eventContext: appContext.eventContext ?? appContext.eventData ?? null,
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
        appContext: state.appContext,
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
          appContext: state.appContext,
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
    visibility: previousDraft?.visibility ?? eventData?.visibility ?? nextDraft.visibility ?? 'groupVisible',
    // Module composition is committed by the operator in the event editor. AI may
    // explain or recommend a roster, but a chat response must not silently add or
    // remove the module from an existing draft.
    requiresRoster: previousDraft?.requiresRoster ?? eventData?.requiresRoster ?? false,
    id: appContext.eventId || nextDraft.id || previousDraft?.id || eventData?.id || '',
    organizerId: appContext.userId || nextDraft.organizerId || previousDraft?.organizerId || eventData?.organizerId || '',
    organizerDisplayName: userProfile?.displayName
      || userProfile?.name
      || nextDraft.organizerDisplayName
      || previousDraft?.organizerDisplayName
      || '',
    personResponsible: nextDraft.personResponsible
      || previousDraft?.personResponsible
      || eventData?.personResponsible
      || '',
    memberId: appContext.memberId || nextDraft.memberId || previousDraft?.memberId || '',
    groupId: appContext.groupId || nextDraft.groupId || previousDraft?.groupId || eventData?.groupId || '',
    purpose: hasMultilingualContent(nextDraft.purpose)
      ? nextDraft.purpose
      : previousDraft?.purpose ?? eventData?.purpose ?? { zh: '', en: '' },
    ram: {
      ...(hasRamContent(nextDraft.ram) ? nextDraft.ram : previousDraft?.ram ?? createEmptyRamDraft()),
      leaderConfirmed: false,
    },
  }
}

function hasRamContent(ram: EventRamDraft) {
  return Boolean(
    ram.activityName.zh.trim()
    || ram.activityName.en.trim()
    || ram.activityDescription.zh.trim()
    || ram.activityDescription.en.trim()
    || ram.hazards.length
    || ram.emergencyContacts.length
    || ram.missingInformation.length,
  )
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
    visibility: candidate.visibility === 'churchVisible' || candidate.visibility === 'public'
      ? candidate.visibility
      : 'groupVisible',
    personResponsible: typeof candidate.personResponsible === 'string' ? candidate.personResponsible : '',
    memberId: typeof candidate.memberId === 'string' ? candidate.memberId : '',
    groupId: typeof candidate.groupId === 'string' ? candidate.groupId : '',
    purpose: normalizeMultilingualString(candidate.purpose),
    title: normalizeMultilingualString(candidate.title),
    description: normalizeMultilingualString(candidate.description),
    locationName: normalizeMultilingualString(candidate.locationName),
    startDate: typeof candidate.startDate === 'string' ? candidate.startDate : '',
    endDate: typeof candidate.endDate === 'string' ? candidate.endDate : '',
    registrationDeadline: typeof candidate.registrationDeadline === 'string' ? candidate.registrationDeadline : '',
    maxCapacity: Number.isInteger(candidate.maxCapacity) && Number(candidate.maxCapacity) >= 0 ? Number(candidate.maxCapacity) : 1,
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
    requiresRoster: candidate.requiresRoster === true,
    baseFeePerAdult: typeof candidate.baseFeePerAdult === 'number' ? candidate.baseFeePerAdult : null,
    baseFeePerChild: typeof candidate.baseFeePerChild === 'number' ? candidate.baseFeePerChild : null,
    currency: typeof candidate.currency === 'string' && candidate.currency.trim() ? candidate.currency : 'NZD',
    paymentInstructions: normalizeMultilingualString(candidate.paymentInstructions),
    refundPolicy: normalizeMultilingualString(candidate.refundPolicy),
    paymentEvidenceRequired: candidate.paymentEvidenceRequired === true,
    financeLeaderConfirmed: false,
    posterImageUrl: typeof candidate.posterImageUrl === 'string' ? candidate.posterImageUrl : null,
    galleryUrls: Array.isArray(candidate.galleryUrls) ? candidate.galleryUrls.filter((url) => typeof url === 'string') : [],
    legacySummary: candidate.legacySummary ? normalizeMultilingualString(candidate.legacySummary) : null,
    ram: normalizeRamDraft(candidate.ram),
  }
}

function createEmptyRamDraft(): EventRamDraft {
  return {
    activityName: { zh: '', en: '' },
    activityDescription: { zh: '', en: '' },
    participantCount: null,
    participantAgeRange: { zh: '', en: '' },
    isOuting: null,
    hazards: [],
    emergencyContacts: [],
    outingSafety: {
      transportRequired: null,
      licensedDriverConfirmed: null,
      vehicleRegistrationConfirmed: null,
      vehicleWofConfirmed: null,
      venueRiskAssessed: null,
      firstAidKitAvailable: null,
      trainedFirstAiderName: '',
      trainedFirstAiderQualificationConfirmed: null,
      participantHealthNeedsReviewed: null,
      weatherPlanReviewed: null,
    },
    missingInformation: [],
    leaderConfirmed: false,
  }
}

function normalizeNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeScore(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null
}

function normalizeRamDraft(value: unknown): EventRamDraft {
  const candidate = value as Partial<EventRamDraft> | null | undefined
  const empty = createEmptyRamDraft()
  const outingSafety = candidate?.outingSafety ?? empty.outingSafety
  return {
    activityName: normalizeMultilingualString(candidate?.activityName),
    activityDescription: normalizeMultilingualString(candidate?.activityDescription),
    participantCount: Number.isInteger(candidate?.participantCount) && Number(candidate?.participantCount) > 0 ? Number(candidate?.participantCount) : null,
    participantAgeRange: normalizeMultilingualString(candidate?.participantAgeRange),
    isOuting: normalizeNullableBoolean(candidate?.isOuting),
    hazards: Array.isArray(candidate?.hazards) ? candidate.hazards.map((hazard) => {
      const likelihood = normalizeScore(hazard?.likelihood)
      const impact = normalizeScore(hazard?.impact)
      return {
        id: typeof hazard?.id === 'string' ? hazard.id : '',
        hazard: normalizeMultilingualString(hazard?.hazard),
        likelihood,
        impact,
        riskScore: likelihood !== null && impact !== null ? likelihood * impact : null,
        controlMeasures: normalizeMultilingualString(hazard?.controlMeasures),
        personResponsible: typeof hazard?.personResponsible === 'string' ? hazard.personResponsible : '',
      }
    }) : [],
    emergencyContacts: Array.isArray(candidate?.emergencyContacts) ? candidate.emergencyContacts.map((contact) => ({
      role: normalizeMultilingualString(contact?.role),
      name: typeof contact?.name === 'string' ? contact.name : '',
      phone: typeof contact?.phone === 'string' ? contact.phone : '',
    })) : [],
    outingSafety: {
      transportRequired: normalizeNullableBoolean(outingSafety.transportRequired),
      licensedDriverConfirmed: normalizeNullableBoolean(outingSafety.licensedDriverConfirmed),
      vehicleRegistrationConfirmed: normalizeNullableBoolean(outingSafety.vehicleRegistrationConfirmed),
      vehicleWofConfirmed: normalizeNullableBoolean(outingSafety.vehicleWofConfirmed),
      venueRiskAssessed: normalizeNullableBoolean(outingSafety.venueRiskAssessed),
      firstAidKitAvailable: normalizeNullableBoolean(outingSafety.firstAidKitAvailable),
      trainedFirstAiderName: typeof outingSafety.trainedFirstAiderName === 'string' ? outingSafety.trainedFirstAiderName : '',
      trainedFirstAiderQualificationConfirmed: normalizeNullableBoolean(outingSafety.trainedFirstAiderQualificationConfirmed),
      participantHealthNeedsReviewed: normalizeNullableBoolean(outingSafety.participantHealthNeedsReviewed),
      weatherPlanReviewed: normalizeNullableBoolean(outingSafety.weatherPlanReviewed),
    },
    missingInformation: Array.isArray(candidate?.missingInformation) ? candidate.missingInformation.map((item) => ({
      code: typeof item?.code === 'string' ? item.code : '',
      fieldPath: typeof item?.fieldPath === 'string' ? item.fieldPath : '',
      message: normalizeMultilingualString(item?.message),
    })) : [],
    leaderConfirmed: false,
  }
}

function normalizeMultilingualString(value: unknown): MultilingualString {
  const candidate = value as Partial<MultilingualString>

  return {
    zh: typeof candidate?.zh === 'string' ? candidate.zh : '',
    en: typeof candidate?.en === 'string' ? candidate.en : '',
  }
}

function hasMultilingualContent(value: MultilingualString | null | undefined) {
  return Boolean(value?.zh.trim() || value?.en.trim())
}

function validateEventDto(event: EventDto) {
  const errors: string[] = []

  requireMultilingual(errors, event.title, 'title')
  requireMultilingual(errors, event.description, 'description')
  requireMultilingual(errors, event.locationName, 'locationName')
  requireIsoDate(errors, event.startDate, 'startDate')
  requireIsoDate(errors, event.endDate, 'endDate')
  if (event.maxCapacity > 0) {
    requireIsoDate(errors, event.registrationDeadline, 'registrationDeadline')
  }

  if (!Number.isInteger(event.maxCapacity) || event.maxCapacity < 0) {
    errors.push('maxCapacity must be a non-negative integer.')
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

  if (!event.ram || !Array.isArray(event.ram.hazards) || !Array.isArray(event.ram.missingInformation)) {
    errors.push('ram draft is required.')
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
