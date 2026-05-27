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
const AUTHZ_MIRROR_TTL_SECONDS = 7 * 24 * 60 * 60
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const PUBLIC_CACHEABLE_API_PATHS = new Set(['/api/sermons', '/api/pages/global'])

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (!isProxyPath(url.pathname)) {
      return addCorsHeaders(request, new Response('Not found', { status: 404 }))
    }

    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    const bypassEdgeCache = shouldBypassEdgeCache(url.pathname)
    const groupDetailId = getGroupDetailId(url.pathname)
    const groupDetailMemberId = groupDetailId ? extractMemberIdFromRequest(request) : ''
    const groupAuthzStatus = groupDetailId
      ? await getGroupAuthzStatus(env, groupDetailId, groupDetailMemberId)
      : 'not-applicable'
    const allowGroupSharedCache = groupAuthzStatus === 'hit'

    if (request.method === 'GET' && !bypassEdgeCache) {
      const cacheKey = await createCacheKey(request)
      const canReadCache = !groupDetailId || allowGroupSharedCache
      const cached = canReadCache ? await getEdgeCache().match(cacheKey) : undefined
      if (cached) {
        const clientEtag = request.headers.get('if-none-match')
        const cachedEtag = cached.headers.get('etag')
        if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
          return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(new Response(null, {
            status: 304,
            headers: cached.headers,
          }), url.pathname, groupAuthzStatus), 'REVALIDATED'))
        }

        return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(cached, url.pathname, groupAuthzStatus), 'HIT'))
      }
    }

    const originRequest = createOriginRequest(request, env, {
      stripConditionalHeaders: request.method === 'GET' && !bypassEdgeCache,
    })
    console.log('Proxying request to origin:', originRequest.url)

    const originResponse = await fetch(originRequest)

    if (originResponse.ok && MUTATING_METHODS.has(request.method)) {
      ctx.waitUntil(passivelyInvalidate(request, originResponse.clone()))
    }

    if (originResponse.status === 200 && request.method === 'GET' && !bypassEdgeCache) {
      const responseForCache = withEdgeCacheControl(originResponse.clone())
      ctx.waitUntil(Promise.all([
        createCacheKey(request).then((cacheKey) => getEdgeCache().put(cacheKey, responseForCache)),
        rememberEntityGroups(request, originResponse.clone()),
        rememberGroupAuthorization(env, groupDetailId, groupDetailMemberId, originResponse.clone()),
      ]))
      return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(originResponse, url.pathname, groupAuthzStatus), 'MISS'))
    }

    const response = bypassEdgeCache ? withNoStore(originResponse) : originResponse
    return addCorsHeaders(request, withCacheHeader(withGroupAuthzHeader(response, groupAuthzStatus), 'BYPASS'))
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
  const targetPath = getProxyTargetPath(incomingUrl.pathname)
  const targetUrl = new URL(targetPath + incomingUrl.search, targetBase)
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
  return pathname.startsWith('/api/') || pathname === '/images' || pathname.startsWith('/images/')
}

function getProxyTargetForPath(pathname: string, env: Env) {
  if (pathname === '/images' || pathname.startsWith('/images/')) {
    return DEFAULT_IMAGES_API_PROXY_TARGET
  }

  return env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET
}

function getProxyTargetPath(pathname: string) {
  if (pathname === '/images') {
    return '/'
  }

  if (pathname.startsWith('/images/')) {
    return pathname.slice('/images'.length) || '/'
  }

  return pathname
}

function shouldBypassEdgeCache(pathname: string) {
  if (pathname === '/images' || pathname.startsWith('/images/')) {
    return false
  }

  if (PUBLIC_CACHEABLE_API_PATHS.has(pathname)) {
    return false
  }

  if (getGroupDetailId(pathname)) {
    return false
  }

  return pathname.startsWith('/api/')
}

function getGroupDetailId(pathname: string) {
  return pathname.match(/^\/api\/groups\/([^/]+)$/)?.[1] ?? ''
}

async function createCacheKey(request: Request, pathname?: string) {
  const url = new URL(request.url)
  if (pathname) {
    url.pathname = pathname
    url.search = ''
  }
  url.hash = ''
  url.searchParams.sort()
  const credentialKey = shouldUseSharedCacheKey(url.pathname) ? '' : await createCredentialCacheKey(request)
  if (credentialKey) {
    url.searchParams.set('__alife_credential', credentialKey)
  }

  return new Request(url.toString(), { method: 'GET' })
}

function shouldUseSharedCacheKey(pathname: string) {
  return pathname === '/images' ||
    pathname.startsWith('/images/') ||
    PUBLIC_CACHEABLE_API_PATHS.has(pathname) ||
    Boolean(getGroupDetailId(pathname))
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

function withEdgeCacheControl(response: Response) {
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

function withBrowserCacheControl(response: Response, pathname: string, groupAuthzStatus?: GroupAuthzStatus) {
  const headers = new Headers(response.headers)

  if (pathname === '/images' || pathname.startsWith('/images/') || PUBLIC_CACHEABLE_API_PATHS.has(pathname)) {
    headers.set(
      'cache-control',
      `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE_SECONDS}, stale-if-error=${CACHE_STALE_IF_ERROR_SECONDS}`,
    )
    headers.set('vary', appendVary(headers.get('vary'), 'Accept-Encoding'))
  } else {
    headers.set('cache-control', 'private, no-cache')
    headers.set('vary', appendVary(appendVary(appendVary(headers.get('vary'), 'Accept-Encoding'), 'Cookie'), 'Authorization'))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withGroupAuthzHeaders(headers, groupAuthzStatus),
  })
}

function withNoStore(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function passivelyInvalidate(request: Request, response: Response) {
  const paths = await getInvalidationPaths(request, response)
  const originalCacheKey = await createCacheKey(request)
  await Promise.all([
    getEdgeCache().delete(originalCacheKey),
    ...paths.map(async (path) => {
      const cacheKey = await createCacheKey(request, path)
      await getEdgeCache().delete(cacheKey)
    }),
  ])
}

async function getInvalidationPaths(request: Request, response: Response) {
  const url = new URL(request.url)
  const path = url.pathname
  const paths = new Set<string>()

  const groupSubresourceMatch = path.match(/^\/api\/groups\/([^/]+)\/(subgroups|pages|events|memberships)$/)
  if (groupSubresourceMatch) {
    paths.add(`/api/groups/${groupSubresourceMatch[1]}/${groupSubresourceMatch[2]}`)
  }

  const groupActionMatch = path.match(/^\/api\/groups\/([^/]+)\/(join-request|invite|invite\/accept|approve|reject|set-coleader|kick)$/)
  if (groupActionMatch) {
    paths.add(`/api/groups/${groupActionMatch[1]}/memberships`)
  }

  const groupCloseMatch = path.match(/^\/api\/groups\/([^/]+)\/close$/)
  if (groupCloseMatch) {
    paths.add(`/api/groups/${groupCloseMatch[1]}`)
  }

  const pageId = path.match(/^\/api\/pages\/([^/]+)(?:\/publish)?$/)?.[1]
  if (pageId) {
    paths.add(`/api/pages/${pageId}`)
    const body = await readJsonObject(response)
    const ownerGroupId = readString(body?.ownerGroupId) ?? await readEntityGroup('page', pageId)
    if (ownerGroupId) {
      paths.add(`/api/groups/${ownerGroupId}/pages`)
    }
  }

  const eventId = path.match(/^\/api\/events\/([^/]+)$/)?.[1]
  if (eventId) {
    const body = await readJsonObject(response)
    const groupId = readString(body?.groupId) ?? await readEntityGroup('event', eventId)
    if (groupId) {
      paths.add(`/api/groups/${groupId}/events`)
    }
  }

  const enrollmentMatch = path.match(/^\/api\/events\/([^/]+)\/enrollments(?:\/[^/]+)?$/)
  if (enrollmentMatch) {
    paths.add(path)
  }

  const reviewMatch = path.match(/^\/api\/events\/([^/]+)\/reviews(?:\/[^/]+)?$/)
  if (reviewMatch) {
    paths.add(path)
  }

  if (path === '/api/admin/sermons/sync') {
    paths.add('/api/sermons')
  }

  paths.add(path)
  return Array.from(paths)
}

async function rememberEntityGroups(request: Request, response: Response) {
  const path = new URL(request.url).pathname
  const groupListMatch = path.match(/^\/api\/groups\/([^/]+)\/(pages|events)$/)
  const pageDetailMatch = path.match(/^\/api\/pages\/([^/]+)$/)

  if (!groupListMatch && !pageDetailMatch) {
    return
  }

  const body = await readJson(response)
  if (Array.isArray(body)) {
    await Promise.all(body.map(async (item) => {
      const entityType = groupListMatch?.[2] === 'events' ? 'event' : 'page'
      const id = readString(item?.id)
      const groupId = readString(item?.groupId) ?? readString(item?.ownerGroupId) ?? groupListMatch?.[1]
      if (id && groupId) {
        await writeEntityGroup(entityType, id, groupId)
      }
    }))
    return
  }

  if (pageDetailMatch && body && typeof body === 'object') {
    const id = readString((body as Record<string, unknown>).id) ?? pageDetailMatch[1]
    const groupId = readString((body as Record<string, unknown>).ownerGroupId)
    if (id && groupId) {
      await writeEntityGroup('page', id, groupId)
    }
  }
}

type GroupAuthzStatus = 'hit' | 'miss' | 'unbound' | 'no-principal' | 'not-applicable'

function withGroupAuthzHeader(response: Response, status?: GroupAuthzStatus) {
  const headers = new Headers(response.headers)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withGroupAuthzHeaders(headers, status),
  })
}

function withGroupAuthzHeaders(headers: Headers, status?: GroupAuthzStatus) {
  if (status && status !== 'not-applicable') {
    headers.set('x-alife-authz', status)
  }

  return headers
}

async function rememberGroupAuthorization(
  env: Env,
  groupId: string,
  memberId: string,
  response: Response,
) {
  if (!groupId || !memberId || response.status !== 200 || !env.ALIFE_AUTHZ) {
    return
  }

  await env.ALIFE_AUTHZ.put(
    createMembershipKey(groupId, memberId),
    JSON.stringify({
      status: 'approved',
      source: 'origin-validated',
      updatedUtc: new Date().toISOString(),
    }),
    { expirationTtl: AUTHZ_MIRROR_TTL_SECONDS },
  )
}

async function readJsonObject(response: Response) {
  const value = await readJson(response)
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

async function readJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

async function getGroupAuthzStatus(env: Env, groupId: string, memberId: string): Promise<GroupAuthzStatus> {
  if (!memberId) {
    return 'no-principal'
  }

  if (!env.ALIFE_AUTHZ) {
    return 'unbound'
  }

  const record = await env.ALIFE_AUTHZ.get(createMembershipKey(groupId, memberId), { type: 'json' })
  return isApprovedMembershipRecord(record) ? 'hit' : 'miss'
}

function isApprovedMembershipRecord(record: unknown) {
  if (!record || typeof record !== 'object') {
    return false
  }

  const status = (record as Record<string, unknown>).status
  return typeof status === 'string' && status.toLowerCase() === 'approved'
}

function createMembershipKey(groupId: string, memberId: string) {
  return `membership:${groupId}:${memberId}`
}

async function writeEntityGroup(entityType: string, entityId: string, groupId: string) {
  await getEdgeCache().put(
    createEntityGroupMapKey(entityType, entityId),
    Response.json({ groupId }),
  )
}

async function readEntityGroup(entityType: string, entityId: string) {
  const response = await getEdgeCache().match(createEntityGroupMapKey(entityType, entityId))
  if (!response) {
    return null
  }

  const body = await readJsonObject(response)
  return readString(body?.groupId)
}

function createEntityGroupMapKey(entityType: string, entityId: string) {
  return new Request(`https://alife.local/__cache-map/${entityType}/${entityId}`, { method: 'GET' })
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

function extractMemberIdFromRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const cookies = parseCookies(request.headers.get('cookie') ?? '')

  return extractSubjectFromAuthorization(authorization) || extractSubjectFromJwt(cookies.alife_auth)
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

function extractSubjectFromAuthorization(authorizationHeader: string) {
  if (!authorizationHeader) {
    return ''
  }

  const parts = authorizationHeader.trim().split(/\s+/)
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return ''
  }

  return extractSubjectFromJwt(parts[1])
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

function extractSubjectFromJwt(token: string | undefined) {
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
    return typeof subject === 'string' && subject.trim() ? subject : ''
  } catch {
    return ''
  }
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
