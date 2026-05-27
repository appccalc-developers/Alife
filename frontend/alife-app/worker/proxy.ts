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
const GROUP_SHARED_SUBRESOURCES = new Set(['pages', 'events', 'memberships', 'subgroups'])
const EVENT_SHARED_SUBRESOURCES = new Set(['enrollments', 'reviews'])

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (!isProxyPath(url.pathname)) {
      return addCorsHeaders(request, new Response('Not found', { status: 404 }))
    }

    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    const sharedContext = await getSharedCacheContext(request, env)
    const bypassEdgeCache = shouldBypassEdgeCache(url.pathname, sharedContext)

    if (request.method === 'GET' && !bypassEdgeCache) {
      const cached = sharedContext
        ? await readSharedCachedResponse(env, request, sharedContext)
        : await getEdgeCache().match(await createCacheKey(request))
      if (cached) {
        const clientEtag = request.headers.get('if-none-match')
        const cachedEtag = cached.headers.get('etag')
        if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
          return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(new Response(null, {
            status: 304,
            headers: cached.headers,
          }), url.pathname, sharedContext?.authzStatus), 'REVALIDATED'))
        }

        return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(cached, url.pathname, sharedContext?.authzStatus), 'HIT'))
      }
    }

    const originRequest = createOriginRequest(request, env, {
      stripConditionalHeaders: request.method === 'GET' && !bypassEdgeCache,
    })
    console.log('Proxying request to origin:', originRequest.url)

    const originResponse = await fetch(originRequest)

    if (originResponse.ok && MUTATING_METHODS.has(request.method)) {
      ctx.waitUntil(passivelyInvalidate(env, request, originResponse.clone()))
    }

    if (originResponse.status === 200 && request.method === 'GET' && !bypassEdgeCache) {
      const waitUntilTasks = [
        rememberEntityGroups(env, request, originResponse.clone()),
        rememberGroupAuthorization(env, sharedContext?.groupId ?? '', sharedContext?.memberId ?? '', originResponse.clone()),
      ]

      if (sharedContext) {
        if (sharedContext.memberId) {
          waitUntilTasks.push(writeSharedCachedResponse(env, request, withEdgeCacheControl(originResponse.clone())))
        }
      } else {
        const responseForCache = withEdgeCacheControl(originResponse.clone())
        waitUntilTasks.push(createCacheKey(request).then((cacheKey) => getEdgeCache().put(cacheKey, responseForCache)))
      }

      ctx.waitUntil(Promise.all(waitUntilTasks))
      return addCorsHeaders(request, withCacheHeader(withBrowserCacheControl(originResponse, url.pathname, sharedContext?.authzStatus), 'MISS'))
    }

    if (originResponse.status === 200 && request.method === 'GET' && (getEventSubresource(url.pathname) || getPageDetailId(url.pathname))) {
      const tasks = [rememberEntityGroups(env, request, originResponse.clone())]
      if (getPageDetailId(url.pathname)) {
        tasks.push(writeSharedCachedResponse(env, request, withEdgeCacheControl(originResponse.clone())))
      }
      ctx.waitUntil(Promise.all(tasks))
    }

    const response = bypassEdgeCache ? withNoStore(originResponse) : originResponse
    return addCorsHeaders(request, withCacheHeader(withGroupAuthzHeader(response, sharedContext?.authzStatus), 'BYPASS'))
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

function shouldBypassEdgeCache(pathname: string, sharedContext?: SharedCacheContext | null) {
  if (pathname === '/images' || pathname.startsWith('/images/')) {
    return false
  }

  if (PUBLIC_CACHEABLE_API_PATHS.has(pathname)) {
    return false
  }

  if (sharedContext) {
    return false
  }

  return pathname.startsWith('/api/')
}

function getGroupDetailId(pathname: string) {
  return pathname.match(/^\/api\/groups\/([^/]+)$/)?.[1] ?? ''
}

function getGroupSubresource(pathname: string) {
  const match = pathname.match(/^\/api\/groups\/([^/]+)\/([^/]+)$/)
  if (!match || !GROUP_SHARED_SUBRESOURCES.has(match[2])) {
    return null
  }

  return { groupId: match[1], subresource: match[2] }
}

function getEventSubresource(pathname: string) {
  const match = pathname.match(/^\/api\/events\/([^/]+)\/([^/]+)$/)
  if (!match || !EVENT_SHARED_SUBRESOURCES.has(match[2])) {
    return null
  }

  return { eventId: match[1], subresource: match[2] }
}

function getPageDetailId(pathname: string) {
  return pathname.match(/^\/api\/pages\/([^/]+)$/)?.[1] ?? ''
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
    Boolean(getGroupDetailId(pathname)) ||
    Boolean(getGroupSubresource(pathname)) ||
    Boolean(getEventSubresource(pathname)) ||
    Boolean(getPageDetailId(pathname))
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

type SharedCacheContext = {
  groupId: string
  memberId: string
  authzStatus: GroupAuthzStatus
  authzRecord?: MembershipAuthzRecord
  pageMeta?: PageMeta
}

type StoredResponse = {
  status: number
  statusText?: string
  headers: Record<string, string>
  body: string
  storedAt: string
}

type MembershipAuthzRecord = {
  status: string
  role?: string
}

type PageMeta = {
  groupId: string
  ownerGroupId?: string
  visibility?: string
  createdByMemberId?: string
}

async function getSharedCacheContext(request: Request, env: Env): Promise<SharedCacheContext | null> {
  if (request.method !== 'GET') {
    return null
  }

  const url = new URL(request.url)
  const pageDetailId = getPageDetailId(url.pathname)
  const pageMeta = pageDetailId ? await readPageMeta(env, pageDetailId) : undefined
  const groupId = await getSharedCacheGroupId(url.pathname, env, pageMeta)
  if (!groupId) {
    return null
  }

  const memberId = extractMemberIdFromRequest(request)
  const authz = await getGroupAuthz(env, groupId, memberId)
  return { groupId, memberId, authzStatus: authz.status, authzRecord: authz.record, pageMeta }
}

async function getSharedCacheGroupId(pathname: string, env: Env, pageMeta?: PageMeta) {
  const groupDetailId = getGroupDetailId(pathname)
  if (groupDetailId) {
    return groupDetailId
  }

  const groupSubresource = getGroupSubresource(pathname)
  if (groupSubresource) {
    return groupSubresource.groupId
  }

  const eventSubresource = getEventSubresource(pathname)
  if (eventSubresource) {
    return await readEntityGroup(env, 'event', eventSubresource.eventId)
  }

  const pageDetailId = getPageDetailId(pathname)
  if (pageDetailId) {
    return pageMeta?.groupId ?? await readEntityGroup(env, 'page', pageDetailId)
  }

  return ''
}

async function readSharedCachedResponse(env: Env, request: Request, context: SharedCacheContext) {
  if (!canReadSharedCache(context) || !env.ALIFE_API_CACHE) {
    return undefined
  }

  const record = await env.ALIFE_API_CACHE.get(createApiCacheKey(request), { type: 'json' }) as StoredResponse | null
  if (!isStoredResponse(record)) {
    return undefined
  }

  return new Response(record.body, {
    status: record.status,
    statusText: record.statusText,
    headers: record.headers,
  })
}

function canReadSharedCache(context: SharedCacheContext) {
  if (context.authzStatus !== 'hit') {
    return false
  }

  if (!context.pageMeta || !isDraftVisibility(context.pageMeta.visibility)) {
    return true
  }

  return isPageAuthor(context.pageMeta, context.memberId) || hasDraftPageRole(context.authzRecord)
}

function isDraftVisibility(visibility: string | undefined) {
  return visibility?.toLowerCase() === 'draft'
}

function isPageAuthor(pageMeta: PageMeta, memberId: string) {
  return Boolean(memberId && pageMeta.createdByMemberId && pageMeta.createdByMemberId === memberId)
}

function hasDraftPageRole(record: MembershipAuthzRecord | undefined) {
  const role = record?.role?.toLowerCase().replace(/[^a-z]/g, '')
  return role === 'leader' || role === 'coleader'
}

async function writeSharedCachedResponse(env: Env, request: Request, response: Response) {
  if (!env.ALIFE_API_CACHE) {
    return
  }

  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  const record: StoredResponse = {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: await response.text(),
    storedAt: new Date().toISOString(),
  }

  await env.ALIFE_API_CACHE.put(
    createApiCacheKey(request),
    JSON.stringify(record),
    { expirationTtl: CACHE_TTL_SECONDS },
  )
}

function isStoredResponse(value: unknown): value is StoredResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.status === 'number' &&
    typeof record.headers === 'object' &&
    record.headers !== null &&
    typeof record.body === 'string'
}

function createApiCacheKey(requestOrPath: Request | string) {
  if (typeof requestOrPath === 'string') {
    return `api:${requestOrPath}`
  }

  const url = new URL(requestOrPath.url)
  url.hash = ''
  url.searchParams.sort()
  return `api:${url.pathname}${url.search}`
}

async function passivelyInvalidate(env: Env, request: Request, response: Response) {
  const paths = await getInvalidationPaths(env, request, response)
  const keys = getInvalidationKeys(request)
  const originalCacheKey = await createCacheKey(request)
  await Promise.all([
    getEdgeCache().delete(originalCacheKey),
    deleteApiCacheKey(env, createApiCacheKey(request)),
    ...keys.map((key) => deleteApiCacheKey(env, key)),
    ...paths.map(async (path) => {
      const cacheKey = await createCacheKey(request, path)
      await getEdgeCache().delete(cacheKey)
      await deleteApiCacheKey(env, createApiCacheKey(path))
    }),
  ])
}

async function deleteApiCacheKey(env: Env, key: string) {
  if (!env.ALIFE_API_CACHE) {
    return
  }

  await env.ALIFE_API_CACHE.delete(key)
}

async function getInvalidationPaths(env: Env, request: Request, response: Response) {
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
    const ownerGroupId = readString(body?.ownerGroupId) ?? await readEntityGroup(env, 'page', pageId)
    if (ownerGroupId) {
      paths.add(`/api/groups/${ownerGroupId}/pages`)
    }
  }

  const eventId = path.match(/^\/api\/events\/([^/]+)$/)?.[1]
  if (eventId) {
    const body = await readJsonObject(response)
    const groupId = readString(body?.groupId) ?? await readEntityGroup(env, 'event', eventId)
    if (groupId) {
      paths.add(`/api/groups/${groupId}/events`)
    }
  }

  const enrollmentMatch = path.match(/^\/api\/events\/([^/]+)\/enrollments(?:\/[^/]+)?$/)
  if (enrollmentMatch) {
    paths.add(`/api/events/${enrollmentMatch[1]}/enrollments`)
  }

  const reviewMatch = path.match(/^\/api\/events\/([^/]+)\/reviews(?:\/[^/]+)?$/)
  if (reviewMatch) {
    paths.add(`/api/events/${reviewMatch[1]}/reviews`)
  }

  if (path === '/api/admin/sermons/sync') {
    paths.add('/api/sermons')
  }

  paths.add(path)
  return Array.from(paths)
}

function getInvalidationKeys(request: Request) {
  const path = new URL(request.url).pathname
  const pageId = path.match(/^\/api\/pages\/([^/]+)(?:\/publish)?$/)?.[1]
  if (!pageId) {
    return []
  }

  return [
    createEntityGroupMapKey('page', pageId),
    createPageMetaMapKey(pageId),
  ]
}

async function rememberEntityGroups(env: Env, request: Request, response: Response) {
  const path = new URL(request.url).pathname
  const groupListMatch = path.match(/^\/api\/groups\/([^/]+)\/(pages|events)$/)
  const pageDetailMatch = path.match(/^\/api\/pages\/([^/]+)$/)
  const eventSubresourceMatch = path.match(/^\/api\/events\/([^/]+)\/(enrollments|reviews)$/)

  if (!groupListMatch && !pageDetailMatch && !eventSubresourceMatch) {
    return
  }

  const body = await readJson(response)
  if (Array.isArray(body)) {
    await Promise.all(body.map(async (item) => {
      const entityType = groupListMatch?.[2] === 'events' ? 'event' : 'page'
      const id = readString(item?.id)
      const groupId = readString(item?.groupId) ?? readString(item?.ownerGroupId) ?? groupListMatch?.[1]
      if (id && groupId) {
        await writeEntityGroup(env, entityType, id, groupId)
        if (entityType === 'page') {
          await writePageMeta(env, id, item as Record<string, unknown>, groupId)
        }
      }
    }))
    return
  }

  if (pageDetailMatch && body && typeof body === 'object') {
    const id = readString((body as Record<string, unknown>).id) ?? pageDetailMatch[1]
    const groupId = readString((body as Record<string, unknown>).ownerGroupId)
    if (id && groupId) {
      await writeEntityGroup(env, 'page', id, groupId)
      await writePageMeta(env, id, body as Record<string, unknown>, groupId)
    }
  }

  if (eventSubresourceMatch && Array.isArray(body)) {
    const groupId = body.map((item) => readString(item?.groupId)).find(Boolean)
    if (groupId) {
      await writeEntityGroup(env, 'event', eventSubresourceMatch[1], groupId)
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

async function getGroupAuthz(env: Env, groupId: string, memberId: string): Promise<{ status: GroupAuthzStatus; record?: MembershipAuthzRecord }> {
  if (!memberId) {
    return { status: 'no-principal' }
  }

  if (!env.ALIFE_AUTHZ) {
    return { status: 'unbound' }
  }

  const record = await env.ALIFE_AUTHZ.get(createMembershipKey(groupId, memberId), { type: 'json' })
  return isApprovedMembershipRecord(record) ? { status: 'hit', record } : { status: 'miss' }
}

function isApprovedMembershipRecord(record: unknown): record is MembershipAuthzRecord {
  if (!record || typeof record !== 'object') {
    return false
  }

  const status = (record as Record<string, unknown>).status
  return typeof status === 'string' && status.toLowerCase() === 'approved'
}

function createMembershipKey(groupId: string, memberId: string) {
  return `membership:${groupId}:${memberId}`
}

async function writePageMeta(env: Env, pageId: string, item: Record<string, unknown>, fallbackGroupId: string) {
  if (!env.ALIFE_API_CACHE) {
    return
  }

  const groupId = readString(item.ownerGroupId) ?? readString(item.groupId) ?? fallbackGroupId
  if (!groupId) {
    return
  }

  const meta: PageMeta = {
    groupId,
    ownerGroupId: groupId,
    visibility: readString(item.visibility) ?? undefined,
    createdByMemberId: readString(item.createdByMemberId) ?? undefined,
  }

  await env.ALIFE_API_CACHE.put(
    createPageMetaMapKey(pageId),
    JSON.stringify(meta),
    { expirationTtl: AUTHZ_MIRROR_TTL_SECONDS },
  )
}

async function readPageMeta(env: Env, pageId: string) {
  if (!env.ALIFE_API_CACHE) {
    return undefined
  }

  const record = await env.ALIFE_API_CACHE.get(createPageMetaMapKey(pageId), { type: 'json' })
  if (!record || typeof record !== 'object') {
    return undefined
  }

  const groupId = readString((record as Record<string, unknown>).groupId) ?? readString((record as Record<string, unknown>).ownerGroupId)
  if (!groupId) {
    return undefined
  }

  return {
    groupId,
    ownerGroupId: groupId,
    visibility: readString((record as Record<string, unknown>).visibility) ?? undefined,
    createdByMemberId: readString((record as Record<string, unknown>).createdByMemberId) ?? undefined,
  }
}

async function writeEntityGroup(env: Env, entityType: string, entityId: string, groupId: string) {
  if (env.ALIFE_API_CACHE) {
    await env.ALIFE_API_CACHE.put(
      createEntityGroupMapKey(entityType, entityId),
      JSON.stringify({ groupId }),
      { expirationTtl: AUTHZ_MIRROR_TTL_SECONDS },
    )
    return
  }

  await getEdgeCache().put(
    createLegacyEntityGroupMapRequest(entityType, entityId),
    Response.json({ groupId }),
  )
}

async function readEntityGroup(env: Env, entityType: string, entityId: string) {
  if (env.ALIFE_API_CACHE) {
    const record = await env.ALIFE_API_CACHE.get(createEntityGroupMapKey(entityType, entityId), { type: 'json' })
    const groupId = readString((record as Record<string, unknown> | null)?.groupId)
    if (groupId || entityType !== 'page') {
      return groupId
    }

    return (await readPageMeta(env, entityId))?.groupId ?? null
  }

  const response = await getEdgeCache().match(createLegacyEntityGroupMapRequest(entityType, entityId))
  if (!response) {
    return null
  }

  const body = await readJsonObject(response)
  return readString(body?.groupId)
}

function createEntityGroupMapKey(entityType: string, entityId: string) {
  return `map:${entityType}:${entityId}:group`
}

function createPageMetaMapKey(pageId: string) {
  return `map:page:${pageId}:meta`
}

function createLegacyEntityGroupMapRequest(entityType: string, entityId: string) {
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
