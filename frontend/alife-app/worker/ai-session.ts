import type { Env } from './index'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'

export type AiChatMessage = {
  role: 'user' | 'model'
  text: string
}

export type AiSessionState<TDraft, TContext> = {
  sessionId: string
  draft: TDraft | null
  context: TContext | null
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
}

type AiChatSessionConfig<TDraft, TContext> = {
  storageKey: string
  routeNotFoundMessage: string
  systemInstruction: string | ((today: string) => string)
  responseSchema: unknown
  normalizeDraft: (value: unknown) => TDraft
  validateDraft: (draft: TDraft) => string[]
  buildGeminiContext: (args: {
    state: AiSessionState<TDraft, TContext>
    userMessage: string
    inputMode: 'text' | 'voice'
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
    const state = await this.ensureState(sessionIdHint)

    if (url.pathname.endsWith('/stream') && request.method === 'GET') {
      return this.openEventStream(state)
    }

    if (url.pathname.endsWith('/state') && request.method === 'GET') {
      return Response.json(this.formatState(state))
    }

    if (url.pathname.endsWith('/message') && request.method === 'POST') {
      return this.handleMessage(request, sessionIdHint)
    }

    return Response.json({ message: this.config.routeNotFoundMessage }, { status: 404 })
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
    try {
      body = await request.json() as ExtractRequest
    } catch {
      return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const userMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!userMessage) {
      return Response.json({ message: 'User message cannot be empty.' }, { status: 400 })
    }

    const state = await this.ensureState(sessionIdHint)
    const inputMode = body.inputMode === 'voice' ? 'voice' : 'text'
    let nextDraft: TDraft
    try {
      nextDraft = await this.callGemini(userMessage, inputMode, state)
    } catch (error) {
      console.error('Gemini extraction failed', error)
      return Response.json({ message: error instanceof Error ? error.message : 'AI extraction failed.' }, { status: 502 })
    }

    const validationErrors = this.config.validateDraft(nextDraft)
    if (validationErrors.length > 0) {
      console.error('Gemini draft validation failed', validationErrors)
      return Response.json(
        { message: 'AI returned data that failed validation.', validationErrors },
        { status: 502 },
      )
    }

    const nextContext = this.config.getContextFromDraft
      ? (this.config.getContextFromDraft(nextDraft) ?? state.context ?? null)
      : (state.context ?? null)
    const nextState: AiSessionState<TDraft, TContext> = {
      ...state,
      draft: nextDraft,
      context: nextContext,
      chatHistory: [
        ...state.chatHistory,
        { role: 'user', text: userMessage },
        { role: 'model', text: this.config.formatChatHistoryEntry?.(nextDraft, nextContext) ?? JSON.stringify({ draft: nextDraft, context: nextContext }) },
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
  ): Promise<TDraft> {
    const today = new Date().toISOString().slice(0, 10)
    const systemText = typeof this.config.systemInstruction === 'function'
      ? this.config.systemInstruction(today)
      : this.config.systemInstruction
    const model = this.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const geminiPayload = {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(this.config.buildGeminiContext({ state, userMessage, inputMode })) }] }],
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
    return await this.durableState.storage.get<AiSessionState<TDraft, TContext>>(this.config.storageKey) ?? {
      sessionId: '',
      draft: null,
      context: null,
      chatHistory: [],
      updatedAt: new Date().toISOString(),
    }
  }

  private async ensureState(sessionIdHint: string) {
    const current = await this.statePromise
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

  return sanitizeSessionId(pathSessionId || querySessionId || fallback, fallback)
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
    return '/message'
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
