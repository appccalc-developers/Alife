type Env = {
  API_PROXY_TARGET?: string
  /** Gemini API key stored as a Cloudflare Worker secret. */
  GEMINI_API_KEY?: string
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const ALLOWED_ORIGINS = new Set(['https://app.ccalc.live', 'http://localhost:5173'])
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, If-None-Match'
const PREFLIGHT_MAX_AGE_SECONDS = '86400'
const CACHE_TTL_SECONDS = 60
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// ── Gemini event-extraction system instruction ──────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GEMINI_SYSTEM_INSTRUCTION = `You are an AI assistant for Alife, a bilingual (Chinese/English) church community app.
Your sole task is to extract event details from a user's natural-language text or voice transcript
and return a single, minified JSON object that strictly conforms to the EventDto schema below.

=== EventDto JSON Schema (OpenAPI 3.1 inline object schema) ===
{
  "type": "object",
  "required": ["title", "description", "locationName", "startDate", "endDate", "registrationDeadline"],
  "properties": {
    "id":           { "type": "string", "format": "uuid", "description": "Leave empty string — server will assign." },
    "organizerId":  { "type": "string", "description": "Leave empty string — server will assign." },
    "title": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": {
        "zh": { "type": "string", "description": "Event title in Simplified Chinese." },
        "en": { "type": "string", "description": "Event title in New-Zealand English." }
      }
    },
    "description": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    },
    "locationName": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    },
    "startDate":             { "type": "string", "format": "date-time", "description": "ISO-8601 UTC." },
    "endDate":               { "type": "string", "format": "date-time" },
    "registrationDeadline":  { "type": "string", "format": "date-time" },
    "maxCapacity":           { "type": "integer", "minimum": 1 },
    "capacityUnit":          { "type": "string", "enum": ["Families", "People"], "default": "Families" },
    "hardConstraints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["ruleKey", "displayMessage", "isMandatory"],
        "properties": {
          "ruleKey":        { "type": "string", "description": "E.g. Transport, Food, Safety, General." },
          "displayMessage": { "type": "object", "properties": { "zh": { "type": "string" }, "en": { "type": "string" } } },
          "isMandatory":    { "type": "boolean", "default": true }
        }
      }
    },
    "optionalActivities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "extraFee"],
        "properties": {
          "id":       { "type": "string", "format": "uuid" },
          "name":     { "type": "object", "properties": { "zh": { "type": "string" }, "en": { "type": "string" } } },
          "extraFee": { "type": "number", "minimum": 0 }
        }
      }
    },
    "baseFeePerAdult":  { "type": ["number", "null"] },
    "baseFeePerChild":  { "type": ["number", "null"] },
    "currency":         { "type": "string", "default": "NZD" },
    "posterImageUrl":   { "type": ["string", "null"] },
    "galleryUrls":      { "type": "array", "items": { "type": "string" } },
    "legacySummary": {
      "type": ["object", "null"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    }
  }
}
=== End Schema ===

Rules:
1. Output ONLY the raw JSON object — no markdown fences, no prose, no comments.
2. All date-time fields MUST be ISO-8601 UTC strings (e.g. "2026-12-01T08:00:00Z").
3. Every MultilingualString field MUST have both "zh" and "en" keys populated.
   If the user spoke only one language, translate the other field yourself.
4. Extract hard constraints from phrases like "must take the bus", "no pork", "must RSVP".
   Map each to a ruleKey: Transport | Food | Safety | RSVP | General.
5. If a value cannot be inferred, use a sensible default (e.g. maxCapacity: 20, currency: "NZD").
6. Do NOT fabricate specific dates unless clearly stated; use the current year and a plausible month.
7. The current reference date is: CURRENT_DATE_PLACEHOLDER.`

async function handleEventExtract(request: Request, env: Env): Promise<Response> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ message: 'GEMINI_API_KEY is not configured.' }, { status: 503 })
  }

  let body: { message?: unknown }
  try {
    body = await request.json() as { message?: unknown }
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const userMessage = typeof body.message === 'string' ? body.message.trim() : ''
  if (!userMessage) {
    return Response.json({ message: 'User message cannot be empty.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const systemText = GEMINI_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today)

  const geminiPayload = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 },
  }

  const geminiRes = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(geminiPayload),
    },
  )

  if (!geminiRes.ok) {
    console.error('Gemini API error', geminiRes.status, await geminiRes.text())
    return Response.json({ message: 'AI extraction failed. Please try again.' }, { status: 502 })
  }

  const geminiData = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let eventDto: unknown
  try {
    eventDto = JSON.parse(jsonText)
  } catch {
    console.error('Gemini returned invalid JSON:', jsonText)
    return Response.json({ message: 'AI returned an unexpected response format.' }, { status: 502 })
  }

  return Response.json(eventDto, { status: 200 })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx)
    } catch (error) {
      console.error('API proxy failed.', error)
      return addCorsHeaders(
        request,
        new Response('API proxy failed.', {
          status: 502,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'x-alife-cache': 'BYPASS',
          },
        }),
      )
    }
  },
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)

  if (!url.pathname.startsWith('/api/')) {
    return addCorsHeaders(request, new Response('Not found', { status: 404 }))
  }

  if (request.method === 'OPTIONS') {
    return handleOptions(request)
  }

  // ── Edge-handled routes ────────────────────────────────────────────────────
  if (url.pathname === '/api/events/extract' && request.method === 'POST') {
    return addCorsHeaders(request, await handleEventExtract(request, env))
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (request.method === 'GET') {
    const cacheKey = await createCacheKey(request)
    const cached = await caches.default.match(cacheKey)
    if (cached) {
      const clientEtag = request.headers.get('if-none-match')
      const cachedEtag = cached.headers.get('etag')
      if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
        return addCorsHeaders(request, withCacheHeader(new Response(null, {
          status: 304,
          headers: cached.headers,
        }), 'REVALIDATED'))
      }

      return addCorsHeaders(request, withCacheHeader(cached, 'HIT'))
    }
  }

  const originRequest = createOriginRequest(request, env)
  const originResponse = await fetch(originRequest)

  if (originResponse.ok && MUTATING_METHODS.has(request.method)) {
    ctx.waitUntil(passivelyInvalidate(request, env))
  }

  if (originResponse.status === 200 && request.method === 'GET') {
    const responseForCache = withCacheControl(originResponse.clone())
    ctx.waitUntil(createCacheKey(request).then((cacheKey) => caches.default.put(cacheKey, responseForCache)))
    return addCorsHeaders(request, withCacheHeader(withCacheControl(originResponse), 'MISS'))
  }

  return addCorsHeaders(request, withCacheHeader(originResponse, 'BYPASS'))
}

function handleOptions(request: Request) {
  return addCorsHeaders(
    request,
    new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': ALLOWED_METHODS,
        'access-control-allow-headers': ALLOWED_HEADERS,
        'access-control-max-age': PREFLIGHT_MAX_AGE_SECONDS,
      },
    }),
  )
}

function addCorsHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers)
  const allowedOrigin = getAllowedOrigin(request)

  if (allowedOrigin) {
    headers.set('access-control-allow-origin', allowedOrigin)
    headers.set('access-control-allow-credentials', 'true')
    headers.set('vary', appendVaryOrigin(headers.get('vary')))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined
}

function appendVaryOrigin(vary: string | null) {
  if (!vary) {
    return 'Origin'
  }

  return vary
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .includes('origin')
    ? vary
    : `${vary}, Origin`
}

function createOriginRequest(request: Request, env: Env) {
  const incomingUrl = new URL(request.url)
  const targetBase = new URL((env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET).replace(/\/$/, ''))
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, targetBase)

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    redirect: 'manual',
  }

  if (request.body) {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(targetUrl, init)
}

async function createCacheKey(request: Request) {
  const url = new URL(request.url)
  url.hash = ''
  url.searchParams.sort()
  const credentialKey = await createCredentialCacheKey(request)
  if (credentialKey) {
    url.searchParams.set('__alife_credential', credentialKey)
  }

  return new Request(url.toString(), { method: 'GET' })
}

function withCacheHeader(response: Response, value: 'HIT' | 'MISS' | 'BYPASS' | 'REVALIDATED') {
  const headers = new Headers(response.headers)
  headers.set('x-alife-cache', value)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}


function withCacheControl(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('cache-control', `public, max-age=${CACHE_TTL_SECONDS}`)
  headers.set('vary', appendVary(headers.get('vary'), 'Accept-Encoding'))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function passivelyInvalidate(request: Request, env: Env) {
  const cacheKey = await createCacheKey(request)

  await caches.default.delete(cacheKey)
}

function matchesIfNoneMatch(ifNoneMatch: string, etag: string) {
  return ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === etag || value === `W/${etag}`)
}

function appendVary(vary: string | null, value: string) {
  if (!vary) {
    return value
  }

  return vary
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .includes(value.toLowerCase())
    ? vary
    : `${vary}, ${value}`
}

async function createCredentialCacheKey(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const cookie = request.headers.get('cookie') ?? ''
  const credential = `${authorization}\n${cookie}`
  if (!credential.trim()) {
    return ''
  }

  const encoded = new TextEncoder().encode(credential)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
