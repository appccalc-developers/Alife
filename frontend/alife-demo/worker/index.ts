type Env = {
  API_PROXY_TARGET?: string
}

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const ALLOWED_ORIGINS = new Set(['https://app.ccalc.live', 'http://localhost:5173'])
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'
const PREFLIGHT_MAX_AGE_SECONDS = '86400'
const CACHE_TTL_SECONDS = 86400; // 1 day in seconds
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

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

  if (request.method === 'GET') {
    const cacheKey = createCacheKey(request)
    const cached = await caches.default.match(cacheKey)
    if (cached) {
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
    ctx.waitUntil(caches.default.put(createCacheKey(request), responseForCache))
    return addCorsHeaders(request, withCacheHeader(originResponse, 'MISS'))
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

function createCacheKey(request: Request) {
  const url = new URL(request.url)
  url.hash = ''
  url.searchParams.sort()

  return new Request(url.toString(), { method: 'GET' })
}

function withCacheHeader(response: Response, value: 'HIT' | 'MISS' | 'BYPASS') {
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
  headers.set('cache-control', `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=0`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function passivelyInvalidate(request: Request, env: Env) {
  const cacheKey = createCacheKey(request)

  await caches.default.delete(cacheKey)
}
