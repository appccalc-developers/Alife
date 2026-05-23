import type { Env } from './index'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

export type AiChatMessage = {
  role: 'user' | 'model'
  text: string
}

export type AiSessionLanguage = 'zh' | 'en' | 'bilingual'

export type AiSessionProfile = {
  id?: string
  displayName?: string
  name?: string
  role?: string
  language?: string
  [key: string]: unknown
}

export type AiSessionAppContext = {
  language?: AiSessionLanguage | string
  userId?: string
  userProfile?: AiSessionProfile | null
  memberId?: string
  memberProfile?: AiSessionProfile | null
  groupId?: string
  groupProfile?: Record<string, unknown> | null
  groupProfiles?: AiSessionProfile[]
  eventId?: string
  eventData?: Record<string, unknown> | null
  knownFacts?: Record<string, unknown>
}

export type AiSessionAttachment = {
  name: string
  contentType: string
  size: number
  source: 'inline' | 'url' | 'uploaded'
  url?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

export type AiSessionState<TDraft, TContext> = {
  sessionId: string
  draft: TDraft | null
  context: TContext | null
  appContext: AiSessionAppContext
  attachments: AiSessionAttachment[]
  chatHistory: AiChatMessage[]
  updatedAt: string
}

export type DurableObjectStateLike = {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
  }
}

type ExtractRequest = {
  message?: unknown
  inputMode?: unknown
  language?: unknown
  appContext?: unknown
  userId?: unknown
  userProfile?: unknown
  memberId?: unknown
  memberProfile?: unknown
  groupId?: unknown
  groupProfile?: unknown
  groupProfiles?: unknown
  eventId?: unknown
  eventData?: unknown
  attachments?: unknown
}

type AiChatSessionConfig<TDraft, TContext> = {
  storageKey: string
  routeNotFoundMessage: string
  systemInstruction: string | ((today: string) => string)
  responseSchema: unknown
  normalizeDraft: (value: unknown) => TDraft
  validateDraft: (draft: TDraft) => string[]
  onStart?: (draft: TDraft, payload: any) => TDraft
  mergeDraft?: (previousDraft: TDraft | null, nextDraft: TDraft, state: AiSessionState<TDraft, TContext>) => TDraft
  buildGeminiContext: (args: {
    state: AiSessionState<TDraft, TContext>
    userMessage: string
    inputMode: 'text' | 'voice'
    appContext: AiSessionAppContext
    attachments: AiSessionAttachment[]
  }) => unknown
  getContextFromDraft?: (draft: TDraft) => TContext | null
  getInitialDraft?: (sessionId: string) => TDraft | null
  formatState?: (state: AiSessionState<TDraft, TContext>) => unknown
  formatMessageResponse?: (state: AiSessionState<TDraft, TContext>) => unknown
  formatSsePayload?: (state: AiSessionState<TDraft, TContext>) => unknown
  formatChatHistoryEntry?: (draft: TDraft, context: TContext | null) => string
}

export class AiChatSession<TDraft, TContext = unknown> {
  private statePromise: Promise<AiSessionState<TDraft, TContext>>
  private readonly clients = new Set<ReadableStreamDefaultController<Uint8Array>>()

  protected readonly durableState: DurableObjectStateLike
  protected readonly env: Env
  private readonly config: AiChatSessionConfig<TDraft, TContext>

  constructor(
    durableState: DurableObjectStateLike,
    env: Env,
    config: AiChatSessionConfig<TDraft, TContext>,
  ) {
    this.durableState = durableState
    this.env = env
    this.config = config
    this.statePromise = this.loadState()
  }

  protected async handleRequest(request: Request, sessionIdHint: string): Promise<Response> {
    const url = new URL(request.url)
    const state = await this.applyRequestContext(request, await this.ensureState(sessionIdHint))

    if (url.pathname.endsWith('/stream') && request.method === 'GET') {
      return this.openEventStream(state)
    }

    if (url.pathname.endsWith('/state') && request.method === 'GET') {
      return Response.json(this.formatState(state))
    }

    if (url.pathname.endsWith('/message') && request.method === 'POST') {
      return this.handleMessage(request, sessionIdHint)
    }

    if (url.pathname.endsWith('/start') && request.method === 'POST') {
      return this.handleStart(request, sessionIdHint)
    }

    return Response.json({ message: this.config.routeNotFoundMessage }, { status: 404 })
  }

  protected async handleStart(request: Request, sessionIdHint: string) {
    let payload: any
    try {
      payload = await request.json()
    } catch {
      payload = {}
    }

    const state = await this.applyRequestContext(request, await this.ensureState(sessionIdHint))
    const appContext = mergeAppContext(state.appContext, extractAppContext(payload))
    let changed = appContext !== state.appContext
    state.appContext = appContext

    if (this.config.onStart && state.draft) {
      state.draft = this.config.onStart(state.draft, { ...payload, appContext })
      changed = true
    }

    if (changed) {
      state.updatedAt = new Date().toISOString()
      await this.setSessionState(state)
    }

    return Response.json(this.formatState(state))
  }

  protected async getSessionState(sessionIdHint: string): Promise<AiSessionState<TDraft, TContext>> {
    return this.ensureState(sessionIdHint)
  }

  protected async setSessionState(state: AiSessionState<TDraft, TContext>) {
    this.statePromise = Promise.resolve(state)
    await this.durableState.storage.put(this.config.storageKey, state)
    this.broadcast(this.formatSsePayload(state))
  }

  protected formatState(state: AiSessionState<TDraft, TContext>) {
    return this.config.formatState?.(state) ?? state
  }

  protected formatSsePayload(state: AiSessionState<TDraft, TContext>) {
    return this.config.formatSsePayload?.(state) ?? { type: 'draft', state: this.formatState(state) }
  }

  private async handleMessage(request: Request, sessionIdHint: string) {
    if (!this.env.GEMINI_API_KEY) {
      return Response.json({ message: 'GEMINI_API_KEY is not configured.' }, { status: 503 })
    }

    let body: ExtractRequest
    let uploadedAttachments: AiSessionAttachment[] = []
    try {
      const parsed = await parseMessageRequest(request)
      body = parsed.body
      uploadedAttachments = parsed.attachments
    } catch {
      return Response.json({ message: 'Invalid message request body.' }, { status: 400 })
    }

    const userMessage = typeof body.message === 'string' ? body.message.trim() : ''
    const declaredAttachments = normalizeAttachmentList(body.attachments)
    const attachments = [...uploadedAttachments, ...declaredAttachments]
    if (!userMessage && attachments.length === 0) {
      return Response.json({ message: 'User message or attachment is required.' }, { status: 400 })
    }

    const state = await this.applyRequestContext(request, await this.ensureState(sessionIdHint))
    const inputMode = body.inputMode === 'voice' ? 'voice' : 'text'
    let nextDraft: TDraft
    try {
      state.appContext = mergeAppContext(state.appContext, extractAppContext(body))
      state.attachments = dedupeAttachments([...state.attachments, ...attachments]).slice(-20)
      nextDraft = await this.callGemini(userMessage, inputMode, state, attachments)
    } catch (error) {
      console.error('Gemini extraction failed', error)
      return Response.json({ message: error instanceof Error ? error.message : 'AI extraction failed.' }, { status: 502 })
    }

    const mergedDraft = this.config.mergeDraft
      ? this.config.mergeDraft(state.draft, nextDraft, state)
      : nextDraft
    const validationErrors = this.config.validateDraft(mergedDraft)
    if (validationErrors.length > 0) {
      console.error('Gemini draft validation failed', validationErrors)
      return Response.json(
        { message: 'AI returned data that failed validation.', validationErrors },
        { status: 502 },
      )
    }

    const nextContext = this.config.getContextFromDraft
      ? (this.config.getContextFromDraft(mergedDraft) ?? state.context ?? null)
      : (state.context ?? null)
    const nextState: AiSessionState<TDraft, TContext> = {
      ...state,
      draft: mergedDraft,
      context: nextContext,
      chatHistory: [
        ...state.chatHistory,
        { role: 'user' as const, text: formatUserHistoryEntry(userMessage, attachments) },
        { role: 'model' as const, text: this.config.formatChatHistoryEntry?.(mergedDraft, nextContext) ?? JSON.stringify({ draft: mergedDraft, context: nextContext }) },
      ].slice(-24),
      updatedAt: new Date().toISOString(),
    }

    await this.setSessionState(nextState)

    return Response.json(
      this.config.formatMessageResponse?.(nextState)
      ?? {
        responseMode: 'result',
        sessionId: nextState.sessionId,
        result: nextState.draft,
        context: nextState.context,
      },
    )
  }

  private openEventStream(initialState: AiSessionState<TDraft, TContext>) {
    const encoder = new TextEncoder()
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        streamController = controller
        this.clients.add(controller)
        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode(sseMessage('snapshot', this.formatState(initialState))))
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

  private async callGemini(
    userMessage: string,
    inputMode: 'text' | 'voice',
    state: AiSessionState<TDraft, TContext>,
    attachments: AiSessionAttachment[],
  ): Promise<TDraft> {
    const today = new Date().toISOString().slice(0, 10)
    const systemText = typeof this.config.systemInstruction === 'function'
      ? this.config.systemInstruction(today)
      : this.config.systemInstruction
    const model = this.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const userParts = [
      {
        text: JSON.stringify(this.config.buildGeminiContext({
          state,
          userMessage,
          inputMode,
          appContext: state.appContext,
          attachments,
        })),
      },
      ...attachments
        .filter((attachment) => attachment.inlineData)
        .map((attachment) => ({
          inline_data: {
            mime_type: attachment.inlineData?.mimeType,
            data: attachment.inlineData?.data,
          },
        })),
    ]
    const geminiPayload = {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: this.config.responseSchema,
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
      return this.config.normalizeDraft(JSON.parse(jsonText))
    } catch {
      console.error('Gemini returned invalid JSON:', jsonText)
      throw new Error('AI returned an unexpected response format.')
    }
  }

  private async loadState(): Promise<AiSessionState<TDraft, TContext>> {
    const stored = await this.durableState.storage.get<unknown>(this.config.storageKey)
    const normalized = normalizeSessionState<TDraft, TContext>(stored)

    if (stored !== undefined && sessionStateNeedsRepair(stored)) {
      await this.durableState.storage.put(this.config.storageKey, normalized)
    }

    return normalized
  }

  private async ensureState(sessionIdHint: string) {
    const current = normalizeSessionState<TDraft, TContext>(await this.statePromise)
    const sessionId = current.sessionId || sessionIdHint || crypto.randomUUID()
    const draft = current.draft ?? this.config.getInitialDraft?.(sessionId) ?? null
    const context = draft ? (this.config.getContextFromDraft?.(draft) ?? current.context) : current.context

    if (sessionId === current.sessionId && draft === current.draft && context === current.context) {
      return current
    }

    const nextState = {
      ...current,
      sessionId,
      draft,
      context,
      appContext: current.appContext ?? {},
      attachments: current.attachments ?? [],
    }
    this.statePromise = Promise.resolve(nextState)
    await this.durableState.storage.put(this.config.storageKey, nextState)
    return nextState
  }

  private async applyRequestContext(request: Request, state: AiSessionState<TDraft, TContext>) {
    const requestContext = extractAppContextFromUrl(new URL(request.url))
    if (!requestContext) {
      return state
    }

    const appContext = mergeAppContext(state.appContext, requestContext)
    const nextState = {
      ...state,
      appContext,
      updatedAt: new Date().toISOString(),
    }
    this.statePromise = Promise.resolve(nextState)
    await this.durableState.storage.put(this.config.storageKey, nextState)
    return nextState
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

export function sanitizeSessionId(value: string, fallback = 'default') {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 128)
  return cleaned || fallback
}

export function getSessionIdFromPath(request: Request, prefix: string, fallback = 'default') {
  const url = new URL(request.url)
  const match = url.pathname.match(new RegExp(`^${escapeRegExp(prefix)}/([^/]+)`))
  const pathSessionId = match?.[1] ? decodeURIComponent(match[1]) : ''
  const querySessionId = url.searchParams.get('sessionId') ?? ''

  return sanitizeSessionId(pathSessionId || querySessionId, fallback)
}

export function resolveAiSessionObjectPath(
  url: URL,
  request: Request,
  options?: { messageAliasPaths?: string[]; extraRoutes?: string[] },
) {
  if (options?.messageAliasPaths?.includes(url.pathname)) {
    return '/message'
  }

  for (const route of options?.extraRoutes ?? []) {
    if (url.pathname.endsWith(route)) {
      return route
    }
  }

  if (url.pathname.endsWith('/stream')) {
    return '/stream'
  }

  if (url.pathname.endsWith('/state')) {
    return '/state'
  }

  if (url.pathname.endsWith('/message')) {
    return '/message'
  }

  if (request.method === 'POST') {
    return '/start'
  }

  return '/state'
}

export function sseMessage(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export function multilingualSchema(description: string) {
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

export function createAiSessionObjectRequest(targetPath: string, sourceUrl: URL, request: Request, sessionId?: string) {
  const objectUrl = new URL(targetPath, sourceUrl.origin)
  objectUrl.search = sourceUrl.search
  if (sessionId) {
    objectUrl.searchParams.set('sessionId', sessionId)
  }
  return new Request(objectUrl, request)
}

export function normalizeAppContext(value: unknown): AiSessionAppContext {
  const candidate = isRecord(value) ? value : {}

  return {
    language: typeof candidate.language === 'string' ? candidate.language : undefined,
    userId: stringValue(candidate.userId),
    userProfile: recordValue(candidate.userProfile),
    memberId: stringValue(candidate.memberId),
    memberProfile: recordValue(candidate.memberProfile),
    groupId: stringValue(candidate.groupId),
    groupProfile: recordValue(candidate.groupProfile),
    groupProfiles: Array.isArray(candidate.groupProfiles)
      ? candidate.groupProfiles.filter(isRecord) as AiSessionProfile[]
      : undefined,
    eventId: stringValue(candidate.eventId),
    eventData: recordValue(candidate.eventData),
    knownFacts: recordValue(candidate.knownFacts),
  }
}

export function mergeAppContext(
  current: AiSessionAppContext | undefined,
  next: AiSessionAppContext | undefined,
): AiSessionAppContext {
  const normalizedCurrent = current ?? {}
  const normalizedNext = next ?? {}
  const merged: AiSessionAppContext = {
    ...normalizedCurrent,
    ...dropUndefined(normalizedNext),
    userProfile: mergeRecord(normalizedCurrent.userProfile, normalizedNext.userProfile),
    memberProfile: mergeRecord(normalizedCurrent.memberProfile, normalizedNext.memberProfile),
    groupProfile: mergeRecord(normalizedCurrent.groupProfile, normalizedNext.groupProfile),
    eventData: mergeRecord(normalizedCurrent.eventData, normalizedNext.eventData),
    knownFacts: mergeRecord(normalizedCurrent.knownFacts, normalizedNext.knownFacts),
  }

  if (normalizedNext.groupProfiles?.length) {
    merged.groupProfiles = normalizedNext.groupProfiles
  }

  return merged
}

export function createMemoryDurableObjectState(): DurableObjectStateLike {
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

async function parseMessageRequest(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const body: Record<string, unknown> = {}
    const attachments: AiSessionAttachment[] = []

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        if (value.size > 0 && (key === 'file' || key === 'files' || key === 'attachments')) {
          attachments.push(await fileToAttachment(value))
        }
        continue
      }

      body[key] = parseMaybeJson(value)
    }

    if (!body.message && typeof formData.get('message') === 'string') {
      body.message = formData.get('message')
    }

    return { body: body as ExtractRequest, attachments }
  }

  return { body: await request.json() as ExtractRequest, attachments: [] }
}

function extractAppContext(body: ExtractRequest): AiSessionAppContext {
  const explicit = normalizeAppContext(body.appContext)
  return mergeAppContext(explicit, normalizeAppContext(body))
}

function extractAppContextFromUrl(url: URL): AiSessionAppContext | undefined {
  const params = url.searchParams
  const context: Record<string, unknown> = {}
  const appContext = parseSearchParam(params, 'appContext')
  let hasContext = appContext !== undefined

  for (const key of [
    'language',
    'userId',
    'userProfile',
    'memberId',
    'memberProfile',
    'groupId',
    'groupProfile',
    'groupProfiles',
    'eventId',
    'eventData',
    'knownFacts',
  ]) {
    const value = parseSearchParam(params, key)
    if (value !== undefined) {
      context[key] = value
      hasContext = true
    }
  }

  if (!hasContext) {
    return undefined
  }

  return mergeAppContext(
    normalizeAppContext(appContext),
    normalizeAppContext(context),
  )
}

function createEmptySessionState<TDraft, TContext>(): AiSessionState<TDraft, TContext> {
  return {
    sessionId: '',
    draft: null,
    context: null,
    appContext: {},
    attachments: [],
    chatHistory: [],
    updatedAt: new Date().toISOString(),
  }
}

function normalizeSessionState<TDraft, TContext>(value: unknown): AiSessionState<TDraft, TContext> {
  const fallback = createEmptySessionState<TDraft, TContext>()
  if (!isRecord(value)) {
    return fallback
  }

  return {
    sessionId: stringValue(value.sessionId) ?? '',
    draft: ('draft' in value ? value.draft as TDraft | null | undefined : undefined) ?? null,
    context: ('context' in value ? value.context as TContext | null | undefined : undefined) ?? null,
    appContext: normalizeAppContext(value.appContext),
    attachments: normalizeAttachmentList(value.attachments),
    chatHistory: normalizeChatHistory(value.chatHistory),
    updatedAt: stringValue(value.updatedAt) ?? fallback.updatedAt,
  }
}

function normalizeChatHistory(value: unknown): AiChatMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((message) => {
    if (!isRecord(message)) {
      return []
    }

    if ((message.role !== 'user' && message.role !== 'model') || typeof message.text !== 'string') {
      return []
    }

    return [{ role: message.role, text: message.text }]
  })
}

function sessionStateNeedsRepair(value: unknown) {
  if (!isRecord(value)) {
    return true
  }

  return !isRecord(value.appContext)
    || !Array.isArray(value.attachments)
    || !Array.isArray(value.chatHistory)
    || typeof value.updatedAt !== 'string'
}

async function fileToAttachment(file: File): Promise<AiSessionAttachment> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return {
    name: file.name || 'attachment',
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    source: 'inline',
    inlineData: {
      mimeType: file.type || 'application/octet-stream',
      data: bytesToBase64(bytes),
    },
  }
}

function normalizeAttachmentList(value: unknown): AiSessionAttachment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((attachment) => {
      const inlineData = isRecord(attachment.inlineData)
        && typeof attachment.inlineData.mimeType === 'string'
        && typeof attachment.inlineData.data === 'string'
        ? {
          mimeType: attachment.inlineData.mimeType,
          data: attachment.inlineData.data,
        }
        : undefined

      return {
        name: stringValue(attachment.name) || stringValue(attachment.fileName) || 'attachment',
        contentType: stringValue(attachment.contentType) || inlineData?.mimeType || 'application/octet-stream',
        size: typeof attachment.size === 'number' ? attachment.size : 0,
        source: attachment.source === 'url' || attachment.source === 'uploaded' || attachment.source === 'inline'
          ? attachment.source
          : (inlineData ? 'inline' : 'url'),
        url: stringValue(attachment.url),
        inlineData,
      } satisfies AiSessionAttachment
    })
}

function dedupeAttachments(attachments: AiSessionAttachment[]) {
  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    const key = `${attachment.name}:${attachment.contentType}:${attachment.size}:${attachment.url ?? ''}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function formatUserHistoryEntry(message: string, attachments: AiSessionAttachment[]) {
  if (attachments.length === 0) {
    return message
  }

  return JSON.stringify({
    message,
    attachments: attachments.map(({ name, contentType, size, source, url }) => ({
      name,
      contentType,
      size,
      source,
      url,
    })),
  })
}

function parseMaybeJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function parseSearchParam(params: URLSearchParams, key: string) {
  const value = params.get(key)
  return value === null ? undefined : parseMaybeJson(value)
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function mergeRecord<T extends Record<string, unknown>>(
  current: T | null | undefined,
  next: T | null | undefined,
) {
  if (!current && !next) {
    return undefined
  }

  return {
    ...(current ?? {}),
    ...dropUndefined(next ?? {}),
  } as T
}

function dropUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
