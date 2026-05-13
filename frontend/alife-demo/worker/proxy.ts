import type { Env, ExecutionContext } from './index'

const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const ALLOWED_ORIGINS = new Set(['https://app.ccalc.live', 'http://localhost:5173'])
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, If-None-Match'
const PREFLIGHT_MAX_AGE_SECONDS = '86400'
const CACHE_TTL_SECONDS = 60
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      return addCorsHeaders(request, new Response('Not found', { status: 404 }))
    }

    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    if (request.method === 'GET') {
      const cacheKey = await createCacheKey(request)
      const cached = await getEdgeCache().match(cacheKey)
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
      ctx.waitUntil(passivelyInvalidate(request))
    }

    if (originResponse.status === 200 && request.method === 'GET') {
      const responseForCache = withCacheControl(originResponse.clone())
      ctx.waitUntil(createCacheKey(request).then((cacheKey) => getEdgeCache().put(cacheKey, responseForCache)))
      return addCorsHeaders(request, withCacheHeader(withCacheControl(originResponse), 'MISS'))
    }

    return addCorsHeaders(request, withCacheHeader(originResponse, 'BYPASS'))
  },
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

async function passivelyInvalidate(request: Request) {
  const cacheKey = await createCacheKey(request)

  await getEdgeCache().delete(cacheKey)
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

function getEdgeCache() {
  const cacheStorage = globalThis.caches as unknown as {
    default?: Cache
  } | undefined

  if (!cacheStorage?.default) {
    throw new Error('Cache storage is not available in this runtime.')
  }

  return cacheStorage.default
}