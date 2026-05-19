import type { Env, ExecutionContext } from './index'

const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const DEFAULT_IMAGES_API_PROXY_TARGET = 'https://images.ccalc.live'
const ALLOWED_ORIGINS = new Set(['https://ccalc.live', 'http://localhost:5173'])
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, If-None-Match'
const PREFLIGHT_MAX_AGE_SECONDS = '86400'
const CACHE_TTL_SECONDS = 86400 // 24 hours
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 300
const CACHE_STALE_IF_ERROR_SECONDS = 86400
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (!isProxyPath(url.pathname)) {
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

    const originRequest = createOriginRequest(request, env, {
      stripConditionalHeaders: request.method === 'GET',
    })
    console.log('Proxying request to origin:', originRequest.url)

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

function createOriginRequest(
  request: Request,
  env: Env,
  options?: { stripConditionalHeaders?: boolean },
) {
  const incomingUrl = new URL(request.url)
  const targetBase = new URL(getProxyTargetForPath(incomingUrl.pathname, env).replace(/\/$/, ''))
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, targetBase)
  const headers = new Headers(request.headers)

  // On an edge miss, forwarding browser validators can produce origin 304 responses
  // without a body, which prevents populating the edge cache for this key.
  if (options?.stripConditionalHeaders) {
    headers.delete('if-none-match')
    headers.delete('if-modified-since')
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.body) {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(targetUrl, init)
}

function isProxyPath(pathname: string) {
  return pathname.startsWith('/api/') || pathname === '/images/api' || pathname.startsWith('/images/api/')
}

function getProxyTargetForPath(pathname: string, env: Env) {
  if (pathname === '/images/api' || pathname.startsWith('/images/api/')) {
    return DEFAULT_IMAGES_API_PROXY_TARGET
  }

  return env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET
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
  headers.set(
    'cache-control',
    `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}, stale-if-error=${CACHE_STALE_IF_ERROR_SECONDS}`,
  )
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
  // Fast path: exact match first
  if (ifNoneMatch === etag) {
    return true
  }
  
  // Weak tag comparison
  if (ifNoneMatch === `W/${etag}`) {
    return true
  }
  
  // Only split if simple checks fail
  const values = ifNoneMatch.split(',')
  for (let i = 0; i < values.length; i++) {
    const trimmed = values[i].trim()
    if (trimmed === etag || trimmed === `W/${etag}`) {
      return true
    }
  }
  
  return false
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
  const cookies = parseCookies(request.headers.get('cookie') ?? '')

  const authPrincipal = extractPrincipalFromAuthorization(authorization)
  const cookiePrincipal = extractPrincipalFromJwt(cookies.alife_auth)

  const credentialScope = [
    authPrincipal ? `auth:${authPrincipal}` : '',
    cookiePrincipal ? `cookie:${cookiePrincipal}` : '',
  ].filter(Boolean).join('|')

  if (!credentialScope) {
    return ''
  }

  const encoded = new TextEncoder().encode(credentialScope)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseCookies(cookieHeader: string) {
  const pairs = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const result: Record<string, string> = {}
  for (const pair of pairs) {
    const separator = pair.indexOf('=')
    if (separator <= 0) {
      continue
    }

    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    if (!name || !value) {
      continue
    }

    result[name] = value
  }

  return result
}

function extractPrincipalFromAuthorization(authorizationHeader: string) {
  if (!authorizationHeader) {
    return ''
  }

  const parts = authorizationHeader.trim().split(/\s+/)
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return stableFallbackPrincipal(authorizationHeader)
  }

  return extractPrincipalFromJwt(parts[1]) || stableFallbackPrincipal(parts[1])
}

function extractPrincipalFromJwt(token: string | undefined) {
  if (!token) {
    return ''
  }

  const sections = token.split('.')
  if (sections.length < 2) {
    return ''
  }

  try {
    const payloadJson = decodeBase64Url(sections[1])
    const payload = JSON.parse(payloadJson) as Record<string, unknown>
    const subject = payload.sub
    if (typeof subject === 'string' && subject.trim()) {
      return `sub:${subject}`
    }
  } catch {
    return ''
  }

  return ''
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = `${base64}${'='.repeat(padLength)}`
  const raw = atob(padded)
  return decodeUtf8(raw)
}

function decodeUtf8(raw: string) {
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function stableFallbackPrincipal(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return `raw:${trimmed}`
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
