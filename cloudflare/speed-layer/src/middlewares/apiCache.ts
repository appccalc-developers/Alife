import type { Env } from '../index'
import {
  type SharedCacheContext,
  type MembershipAuthzRecord,
  type PageMeta,
  type GroupAuthzStatus,
  createCredentialCacheKey,
  getEdgeCache,
  readJsonObject,
  readJson,
  readString,
  getPageDetailId,
  getEventSubresource,
  getGroupSubresource,
  createPageMetaMapKey,
  createEntityGroupMapKey,
  writePageMeta,
  writeEntityGroup,
  readEntityGroup,
  readLogicalCacheRecord,
  writeLogicalCacheRecord,
  deleteLogicalCacheRecord,
  createMembershipKey,
  createMemberProfileAuthzKey,
  extractMemberIdFromRequest,
} from './authCache'

const CACHE_TTL_SECONDS = 86400 // 24 hours
const CACHE_STALE_WHILE_REVALIDATE_SECONDS = 300
const CACHE_STALE_IF_ERROR_SECONDS = 86400
const AUTHZ_MIRROR_TTL_SECONDS = 7 * 24 * 60 * 60
const MEMBER_PROFILE_CACHE_TTL_SECONDS = 86400
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const PUBLIC_CACHEABLE_API_PATHS = new Set(['/api/sermons', '/api/pages/global'])
const GROUP_SHARED_CACHE_TTLS = {
  pages: CACHE_TTL_SECONDS,
  subgroups: CACHE_TTL_SECONDS,
  events: CACHE_TTL_SECONDS,
  members: CACHE_TTL_SECONDS,
} as const

export type AuthorizedGroupCacheKind = keyof typeof GROUP_SHARED_CACHE_TTLS
export type AuthorizedGroupCachePolicy = {
  groupId: string
  cacheKind: AuthorizedGroupCacheKind
  ttlSeconds: number
}

export type StoredResponse = {
  status: number
  statusText?: string
  headers: Record<string, string>
  body: string
  storedAt: string
}

const ALLOWED_ORIGINS = new Set(['https://ccalc.live', 'http://localhost:5173'])

export const apiCacheMiddleware = async (
  req: any,
  env: Env,
  ctx: any,
  next: () => Promise<Response>
) => {
  const url = new URL(req.url)
  const sharedContext = req.sharedContext
  const bypassEdgeCache = req.bypassEdgeCache
  const authorizedGroupCache = getAuthorizedGroupCachePolicy(url.pathname)
  const mutationTargetMemberId = MUTATING_METHODS.has(req.method)
    ? await getTargetMemberIdFromMutation(req)
    : ''
  const memberProfileCacheKey = req.method === 'GET' && url.pathname === '/api/me'
    ? createMemberProfileApiCacheKey(extractMemberIdFromRequest(req))
    : ''

  if (memberProfileCacheKey) {
    const memberId = extractMemberIdFromRequest(req)
    const rawCached = await readStoredResponse(env, memberProfileCacheKey)
    if (rawCached) {
      const cached = rawCached.headers.has('etag') ? rawCached : await withEtag(rawCached)
      ctx.waitUntil(rememberMemberProfileAuthorization(env, memberId, memberProfileCacheKey, cached.clone()))
      const clientEtag = req.headers.get('if-none-match')
      const cachedEtag = cached.headers.get('etag')
      if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
        return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(new Response(null, {
          status: 304,
          headers: cached.headers,
        }), url.pathname), 'REVALIDATED'))
      }

      return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(cached, url.pathname), 'HIT'))
    }

    const response = await next()
    if (response.status === 200) {
      const taggedResponse = await withEtag(response)
      ctx.waitUntil(Promise.all([
        writeStoredResponse(env, memberProfileCacheKey, withEdgeCacheControl(taggedResponse.clone()), MEMBER_PROFILE_CACHE_TTL_SECONDS),
        rememberMemberProfileAuthorization(env, memberId, memberProfileCacheKey, taggedResponse.clone()),
      ]))
      return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(taggedResponse, url.pathname), 'MISS'))
    }

    return addCorsHeaders(req, withCacheHeader(withNoStore(response), 'BYPASS'))
  }

  if (req.method === 'GET' && authorizedGroupCache && sharedContext) {
    if (sharedContext.authzStatus !== 'hit') {
      return addCorsHeaders(
        req,
        withCacheHeader(
          withBrowserCacheControl(createForbiddenGroupResponse(sharedContext.authzStatus), url.pathname, sharedContext.authzStatus),
          'BYPASS',
        ),
      )
    }

    const cached = await getAuthorizedGroupCachedResponse(
      env,
      req,
      authorizedGroupCache.groupId,
      authorizedGroupCache.cacheKind,
      () => next(),
      authorizedGroupCache.ttlSeconds,
    )

    if (cached.cacheStatus === 'MISS') {
      ctx.waitUntil(Promise.all([
        rememberEntityGroups(env, req, cached.response.clone()),
        rememberGroupAuthorization(env, sharedContext.groupId, sharedContext.memberId, cached.response.clone()),
      ]))
    }

    if (cached.cacheStatus === 'HIT') {
      const hitResponse = cached.response.headers.has('etag') ? cached.response : await withEtag(cached.response)
      const clientEtag = req.headers.get('if-none-match')
      const cachedEtag = hitResponse.headers.get('etag')
      if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
        return addCorsHeaders(
          req,
          withCacheHeader(
            withBrowserCacheControl(new Response(null, {
              status: 304,
              headers: hitResponse.headers,
            }), url.pathname, sharedContext.authzStatus),
            'REVALIDATED',
          ),
        )
      }

      return addCorsHeaders(
        req,
        withCacheHeader(
          withBrowserCacheControl(hitResponse, url.pathname, sharedContext.authzStatus),
          'HIT',
        ),
      )
    }

    return addCorsHeaders(
      req,
      withCacheHeader(
        withBrowserCacheControl(cached.response, url.pathname, sharedContext.authzStatus),
        cached.cacheStatus,
      ),
    )
  }

  if (req.method === 'GET' && !bypassEdgeCache) {
    const rawCached = sharedContext
      ? await readSharedCachedResponse(env, req, sharedContext)
      : await getEdgeCache().match(await createCacheKey(req))

    if (rawCached) {
      const cached = rawCached.headers.has('etag') ? rawCached : await withEtag(rawCached)
      const clientEtag = req.headers.get('if-none-match')
      const cachedEtag = cached.headers.get('etag')
      if (clientEtag && cachedEtag && matchesIfNoneMatch(clientEtag, cachedEtag)) {
        return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(new Response(null, {
          status: 304,
          headers: cached.headers,
        }), url.pathname, sharedContext?.authzStatus), 'REVALIDATED'))
      }

      return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(cached, url.pathname, sharedContext?.authzStatus), 'HIT'))
    }
  }

  const response = await next()

  if (response.status === 200 && req.method === 'GET' && !bypassEdgeCache) {
    const taggedResponse = await withEtag(response)

    const waitUntilTasks = [
      rememberEntityGroups(env, req, taggedResponse.clone()),
      rememberGroupAuthorization(env, sharedContext?.groupId ?? '', sharedContext?.memberId ?? '', taggedResponse.clone()),
    ]

    if (sharedContext) {
      if (sharedContext.memberId) {
        waitUntilTasks.push(writeSharedCachedResponse(env, req, withEdgeCacheControl(taggedResponse.clone())))
      }
    } else {
      const responseForCache = withEdgeCacheControl(taggedResponse.clone())
      waitUntilTasks.push(createCacheKey(req).then((cacheKey) => getEdgeCache().put(cacheKey, responseForCache)))
    }

    ctx.waitUntil(Promise.all(waitUntilTasks))
    return addCorsHeaders(req, withCacheHeader(withBrowserCacheControl(taggedResponse, url.pathname, sharedContext?.authzStatus), 'MISS'))
  }

  if (response.status === 200 && req.method === 'GET' && (getEventSubresource(url.pathname) || getPageDetailId(url.pathname))) {
    const taggedResponse = getPageDetailId(url.pathname) ? await withEtag(response) : response
    const tasks = [rememberEntityGroups(env, req, taggedResponse.clone())]
    if (getPageDetailId(url.pathname)) {
      tasks.push(writeSharedCachedResponse(env, req, withEdgeCacheControl(taggedResponse.clone())))
    }
    ctx.waitUntil(Promise.all(tasks))

    const finalResponse = bypassEdgeCache ? withNoStore(taggedResponse) : taggedResponse
    return addCorsHeaders(req, withCacheHeader(withGroupAuthzHeader(finalResponse, sharedContext?.authzStatus), 'BYPASS'))
  }

  if (response.ok && MUTATING_METHODS.has(req.method)) {
    ctx.waitUntil(passivelyInvalidate(env, req, response.clone(), mutationTargetMemberId))
  }

  const finalResponse = bypassEdgeCache ? withNoStore(response) : response
  return addCorsHeaders(req, withCacheHeader(withGroupAuthzHeader(finalResponse, sharedContext?.authzStatus), 'BYPASS'))
}

export async function readSharedCachedResponse(env: Env, request: Request, context: SharedCacheContext) {
  if (!canReadSharedCache(context)) {
    return undefined
  }

  const record = context.cachedResponse ?? await readLogicalCacheRecord(createApiCacheKey(request))
  if (!isStoredResponse(record)) {
    return undefined
  }

  return new Response(record.body, {
    status: record.status,
    statusText: record.statusText,
    headers: record.headers,
  })
}

export function canReadSharedCache(context: SharedCacheContext) {
  if (context.authzStatus !== 'hit') {
    return false
  }

  if (!context.pageMeta || !isDraftVisibility(context.pageMeta.visibility)) {
    return true
  }

  return isPageAuthor(context.pageMeta, context.memberId) || hasDraftPageRole(context.authzRecord)
}

export async function getAuthorizedGroupCachedResponse(
  env: Env,
  request: Request,
  groupId: string,
  cacheKind: AuthorizedGroupCacheKind,
  fetchFromOrigin: () => Promise<Response>,
  ttlSeconds: number,
): Promise<{ response: Response; cacheStatus: 'HIT' | 'MISS' | 'BYPASS' }> {
  const cached = await readStoredResponse(env, createAuthorizedGroupCacheKey(groupId, cacheKind))
  if (cached) {
    return { response: cached, cacheStatus: 'HIT' }
  }

  const originResponse = await fetchFromOrigin()
  if (!originResponse.ok) {
    return { response: originResponse, cacheStatus: 'BYPASS' }
  }

  const taggedResponse = await withEtag(originResponse)

  await writeStoredResponse(
    env,
    createAuthorizedGroupCacheKey(groupId, cacheKind),
    withEdgeCacheControl(taggedResponse.clone()),
    ttlSeconds,
  )

  return { response: taggedResponse, cacheStatus: 'MISS' }
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

export async function writeSharedCachedResponse(env: Env, request: Request, response: Response) {
  await writeStoredResponse(env, createApiCacheKey(request), response, getApiCacheTtlSeconds(request))
}

export async function writeStoredResponse(env: Env, key: string, response: Response, ttlSeconds: number) {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  const body = await response.text()

  if (!headers['etag']) {
    headers['etag'] = await generateEtag(body)
  }

  const record: StoredResponse = {
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
    storedAt: new Date().toISOString(),
  }

  await writeLogicalCacheRecord(key, record, ttlSeconds)
}

export async function readStoredResponse(env: Env, key: string) {
  const record = await readLogicalCacheRecord(key)
  if (!isStoredResponse(record)) {
    return undefined
  }

  return new Response(record.body, {
    status: record.status,
    statusText: record.statusText,
    headers: record.headers,
  })
}

export function isStoredResponse(value: unknown): value is StoredResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.status === 'number' &&
    typeof record.headers === 'object' &&
    record.headers !== null &&
    typeof record.body === 'string'
}

export function createApiCacheKey(requestOrPath: Request | string) {
  const url = typeof requestOrPath === 'string'
    ? new URL(requestOrPath, 'https://alife.local')
    : new URL(requestOrPath.url)

  const groupPolicy = getAuthorizedGroupCachePolicy(url.pathname)
  if (groupPolicy) {
    return createAuthorizedGroupCacheKey(groupPolicy.groupId, groupPolicy.cacheKind)
  }

  url.hash = ''
  url.searchParams.sort()
  return `api:${url.pathname}${url.search}`
}

export function createMemberProfileApiCacheKey(memberId: string) {
  return memberId ? `member:${memberId}:me` : ''
}

export function createAuthorizedGroupCacheKey(groupId: string, cacheKind: AuthorizedGroupCacheKind) {
  return `group:${groupId}:${cacheKind}`
}

export function getAuthorizedGroupCachePolicy(pathname: string): AuthorizedGroupCachePolicy | null {
  const match = pathname.match(/^\/api\/groups\/([^/]+)\/(pages|subgroups|events|memberships|members)$/)
  if (!match) {
    return null
  }

  const cacheKind: AuthorizedGroupCacheKind = match[2] === 'memberships' || match[2] === 'members'
    ? 'members'
    : match[2] as Exclude<AuthorizedGroupCacheKind, 'members'>

  return {
    groupId: match[1],
    cacheKind,
    ttlSeconds: GROUP_SHARED_CACHE_TTLS[cacheKind],
  }
}

export function getApiCacheTtlSeconds(requestOrPath: Request | string) {
  const pathname = typeof requestOrPath === 'string'
    ? new URL(requestOrPath, 'https://alife.local').pathname
    : new URL(requestOrPath.url).pathname
  return getAuthorizedGroupCachePolicy(pathname)?.ttlSeconds ?? CACHE_TTL_SECONDS
}

export async function passivelyInvalidate(env: Env, request: Request, response: Response, targetMemberId = '') {
  const paths = await getInvalidationPaths(env, request, response)
  const keys = getInvalidationKeys(request, targetMemberId)
  const originalCacheKey = await createCacheKey(request)
  await Promise.all([
    getEdgeCache().delete(originalCacheKey),
    deleteApiCacheKey(env, createApiCacheKey(request)),
    ...keys.api.map((key) => deleteApiCacheKey(env, key)),
    ...keys.authz.map((key) => deleteAuthzKey(env, key)),
    ...paths.map(async (path) => {
      const cacheKey = await createCacheKey(request, path)
      await getEdgeCache().delete(cacheKey)
      await deleteApiCacheKey(env, createApiCacheKey(path))
    }),
  ])
}

export async function deleteApiCacheKey(env: Env, key: string) {
  await deleteLogicalCacheRecord(key)
}

export async function deleteAuthzKey(env: Env, key: string) {
  if (!env.ALIFE_AUTHZ) {
    return
  }

  await env.ALIFE_AUTHZ.delete(key)
}

export async function getInvalidationPaths(env: Env, request: Request, response: Response) {
  const url = new URL(request.url)
  const path = url.pathname
  const paths = new Set<string>()

  const groupSubresourceMatch = path.match(/^\/api\/groups\/([^/]+)\/(subgroups|pages|events|memberships|members)$/)
  if (groupSubresourceMatch) {
    paths.add(`/api/groups/${groupSubresourceMatch[1]}/${groupSubresourceMatch[2]}`)
  }

  const groupActionMatch = path.match(/^\/api\/groups\/([^/]+)\/(join-request|invite|invite\/accept|approve|reject|set-coleader|kick)$/)
  if (groupActionMatch) {
    paths.add(`/api/groups/${groupActionMatch[1]}/memberships`)
    paths.add(`/api/groups/${groupActionMatch[1]}/members`)
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

export function getInvalidationKeys(request: Request, targetMemberId = '') {
  const path = new URL(request.url).pathname
  const keys = {
    api: new Set<string>(),
    authz: new Set<string>(),
  }
  const pageId = path.match(/^\/api\/pages\/([^/]+)(?:\/publish)?$/)?.[1]
  if (pageId) {
    keys.api.add(createEntityGroupMapKey('page', pageId))
    keys.api.add(createPageMetaMapKey(pageId))
  }

  const currentMemberId = extractMemberIdFromRequest(request)
  if (path === '/api/me/profile' && currentMemberId) {
    keys.api.add(createMemberProfileApiCacheKey(currentMemberId))
    keys.authz.add(createMemberProfileAuthzKey(currentMemberId))
  }

  const groupActionMatch = path.match(/^\/api\/groups\/([^/]+)\/(join-request|invite\/accept|approve|reject|set-coleader|kick)$/)
  if (groupActionMatch) {
    const affectedMemberId = targetMemberId || currentMemberId
    if (affectedMemberId) {
      keys.api.add(createMemberProfileApiCacheKey(affectedMemberId))
      keys.authz.add(createMemberProfileAuthzKey(affectedMemberId))
      keys.authz.add(createMembershipKey(groupActionMatch[1], affectedMemberId))
    }
  }

  return {
    api: Array.from(keys.api),
    authz: Array.from(keys.authz),
  }
}

export async function rememberEntityGroups(env: Env, request: Request, response: Response) {
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

export async function rememberGroupAuthorization(
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

export async function rememberMemberProfileAuthorization(
  env: Env,
  memberId: string,
  cacheKey: string,
  response: Response,
) {
  if (!memberId || !cacheKey || response.status !== 200 || !env.ALIFE_AUTHZ) {
    return
  }

  const body = await readJsonObject(response)
  if (!body) {
    return
  }

  const now = new Date().toISOString()
  const memberships = readMemberships(body.memberships)
  await Promise.all([
    env.ALIFE_AUTHZ.put(
      createMemberProfileAuthzKey(memberId),
      JSON.stringify({
        status: 'cached',
        memberId: readString(body.id) ?? readString(body.memberId) ?? memberId,
        cacheKey,
        isGuest: readBoolean(body.isGuest),
        isRegistered: readBoolean(body.isRegistered),
        isAdmin: readBoolean(body.isAdmin),
        language: readString(body.language) ?? undefined,
        memberships,
        source: 'api-me',
        updatedUtc: now,
      }),
      { expirationTtl: MEMBER_PROFILE_CACHE_TTL_SECONDS },
    ),
    ...memberships.map((membership) => env.ALIFE_AUTHZ!.put(
      createMembershipKey(membership.groupId, memberId),
      JSON.stringify({
        status: membership.status,
        role: membership.role,
        source: 'api-me',
        updatedUtc: now,
      }),
      { expirationTtl: AUTHZ_MIRROR_TTL_SECONDS },
    )),
  ])
}

export function createForbiddenGroupResponse(status?: GroupAuthzStatus) {
  return Response.json(
    { message: 'Forbidden' },
    {
      status: 403,
      headers: withGroupAuthzHeaders(new Headers({ 'content-type': 'application/json' }), status),
    },
  )
}

export async function createCacheKey(request: Request, pathname?: string) {
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

export function shouldUseSharedCacheKey(pathname: string) {
  return pathname === '/images' ||
    pathname.startsWith('/images/') ||
    PUBLIC_CACHEABLE_API_PATHS.has(pathname) ||
    Boolean(getGroupDetailId(pathname)) ||
    Boolean(getGroupSubresource(pathname)) ||
    Boolean(getEventSubresource(pathname)) ||
    Boolean(getPageDetailId(pathname))
}

export function getGroupDetailId(pathname: string) {
  return pathname.match(/^\/api\/groups\/([^/]+)$/)?.[1] ?? ''
}



export function withCacheHeader(response: Response, value: 'HIT' | 'MISS' | 'BYPASS' | 'REVALIDATED') {
  const headers = new Headers(response.headers)
  headers.set('x-alife-cache', value)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function withEdgeCacheControl(response: Response) {
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

export async function withEtag(response: Response) {
  const body = await response.text()
  const headers = new Headers(response.headers)
  if (!headers.has('etag')) {
    headers.set('etag', await generateEtag(body))
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function generateEtag(body: string) {
  const data = new TextEncoder().encode(body)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `W/"${hashHex}"`
}

export function withBrowserCacheControl(response: Response, pathname: string, groupAuthzStatus?: GroupAuthzStatus) {
  const headers = new Headers(response.headers)

  if (pathname === '/images' || pathname.startsWith('/images/')) {
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

export function withNoStore(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function withGroupAuthzHeader(response: Response, status?: GroupAuthzStatus) {
  const headers = new Headers(response.headers)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withGroupAuthzHeaders(headers, status),
  })
}

export function withGroupAuthzHeaders(headers: Headers, status?: GroupAuthzStatus) {
  if (status && status !== 'not-applicable') {
    headers.set('x-alife-authz', status)
  }

  return headers
}

export function matchesIfNoneMatch(ifNoneMatch: string, etag: string) {
  if (ifNoneMatch === etag) {
    return true
  }

  if (ifNoneMatch === `W/${etag}`) {
    return true
  }

  const values = ifNoneMatch.split(',')
  for (let i = 0; i < values.length; i++) {
    const trimmed = values[i].trim()
    if (trimmed === etag || trimmed === `W/${etag}`) {
      return true
    }
  }

  return false
}

export function appendVary(vary: string | null, value: string) {
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

export function addCorsHeaders(request: Request, response: Response) {
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

export function getAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined
}

export function appendVaryOrigin(vary: string | null) {
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

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

type MemberProfileMembership = {
  groupId: string
  status: string
  role: string | undefined
}

function readMemberships(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as MemberProfileMembership[]
  }

  return value
    .map((membership) => {
      if (!membership || typeof membership !== 'object') {
        return null
      }

      const record = membership as Record<string, unknown>
      const groupId = readString(record.groupId)
      const status = readString(record.status)
      if (!groupId || !status) {
        return null
      }

      return {
        groupId,
        status,
        role: readString(record.role) ?? undefined,
      }
    })
    .filter((membership): membership is MemberProfileMembership => membership !== null)
}

async function getTargetMemberIdFromMutation(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType && !contentType.includes('application/json')) {
    return ''
  }

  try {
    const rawBody = await request.clone().text()
    if (!rawBody) {
      return ''
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>
    return readString(body.memberId) ?? readString(body.targetMemberId) ?? ''
  } catch {
    return ''
  }
}
