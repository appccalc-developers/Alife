import type { Env } from '../index'

export type GroupAuthzStatus = 'hit' | 'miss' | 'unbound' | 'no-principal' | 'not-applicable'

export type MembershipAuthzRecord = {
  status: string
  role?: string
}

export type MemberProfileAuthzRecord = {
  status: string
  memberId: string
  cacheKey: string
  isGuest?: boolean
  isRegistered?: boolean
  isAdmin?: boolean
  language?: string
  memberships?: MembershipAuthzRecord[]
  source?: string
  updatedUtc?: string
}

export type PageMeta = {
  groupId: string
  ownerGroupId?: string
  visibility?: string
  createdByMemberId?: string
}

export type SharedCacheContext = {
  groupId: string
  memberId: string
  authzStatus: GroupAuthzStatus
  authzRecord?: MembershipAuthzRecord
  pageMeta?: PageMeta
}

const AUTHZ_MIRROR_TTL_SECONDS = 7 * 24 * 60 * 60
const PUBLIC_CACHEABLE_API_PATHS = new Set(['/api/sermons', '/api/pages/global'])
const GROUP_SHARED_SUBRESOURCES = new Set(['pages', 'events', 'memberships', 'members', 'subgroups'])
const EVENT_SHARED_SUBRESOURCES = new Set(['enrollments', 'reviews'])
const LOGICAL_CACHE_RECORD_URL = 'https://alife.local/__alife-cache-record'

export const authMiddleware = async (
  req: any,
  env: Env,
  ctx: any,
  next: () => Promise<Response>
) => {
  const url = new URL(req.url)
  const sharedContext = await getSharedCacheContext(req, env)
  req.sharedContext = sharedContext
  req.bypassEdgeCache = shouldBypassEdgeCache(url.pathname, sharedContext)
  return next()
}

export function shouldBypassEdgeCache(pathname: string, sharedContext?: SharedCacheContext | null) {
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

export async function getSharedCacheContext(request: Request, env: Env): Promise<SharedCacheContext | null> {
  if (request.method !== 'GET') {
    return null
  }

  const url = new URL(request.url)
  const pageDetailId = getPageDetailId(url.pathname)
  const pageMeta = pageDetailId
    ? await readPageMeta(env, pageDetailId)
    : undefined
  const groupId = await getSharedCacheGroupId(url.pathname, env, pageMeta)
  if (!groupId) {
    return null
  }

  const memberId = extractMemberIdFromRequest(request)
  const authz = await authorizeGroupMember(env, groupId, memberId)
  return { groupId, memberId, authzStatus: authz.status, authzRecord: authz.record, pageMeta }
}

export async function getSharedCacheGroupId(pathname: string, env: Env, pageMeta?: PageMeta) {
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

export async function readPageMeta(env: Env, pageId: string) {
  const record = await readLogicalCacheRecord(createPageMetaMapKey(pageId))
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

export async function writePageMeta(env: Env, pageId: string, item: Record<string, unknown>, fallbackGroupId: string) {
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

  await writeLogicalCacheRecord(createPageMetaMapKey(pageId), meta, AUTHZ_MIRROR_TTL_SECONDS)
}

export async function readEntityGroup(env: Env, entityType: string, entityId: string) {
  const record = await readLogicalCacheRecord(createEntityGroupMapKey(entityType, entityId))
  const groupId = readString((record as Record<string, unknown> | null)?.groupId)
  if (groupId || entityType !== 'page') {
    return groupId
  }

  const pageMetaGroupId = (await readPageMeta(env, entityId))?.groupId
  if (pageMetaGroupId) {
    return pageMetaGroupId
  }

  const response = await getEdgeCache().match(createLegacyEntityGroupMapRequest(entityType, entityId))
  if (!response) {
    return null
  }

  const body = await readJsonObject(response)
  return readString(body?.groupId)
}

export async function writeEntityGroup(env: Env, entityType: string, entityId: string, groupId: string) {
  await writeLogicalCacheRecord(
    createEntityGroupMapKey(entityType, entityId),
    { groupId },
    AUTHZ_MIRROR_TTL_SECONDS,
  )
}

export function extractMemberIdFromRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const cookies = parseCookies(request.headers.get('cookie') ?? '')

  return extractSubjectFromAuthorization(authorization) || extractSubjectFromJwt(cookies.alife_auth)
}

export async function getGroupAuthz(env: Env, groupId: string, memberId: string): Promise<{ status: GroupAuthzStatus; record?: MembershipAuthzRecord }> {
  if (!memberId) {
    return { status: 'no-principal' }
  }

  const record = await readLogicalCacheRecord(createMembershipKey(groupId, memberId))
  return isApprovedMembershipRecord(record) ? { status: 'hit', record } : { status: 'miss' }
}

export async function authorizeGroupMember(env: Env, groupId: string, memberId: string) {
  return getGroupAuthz(env, groupId, memberId)
}

export function isApprovedMembershipRecord(record: unknown): record is MembershipAuthzRecord {
  if (!record || typeof record !== 'object') {
    return false
  }

  const status = (record as Record<string, unknown>).status
  return typeof status === 'string' && status.toLowerCase() === 'approved'
}

export function createMembershipKey(groupId: string, memberId: string) {
  return `membership:${groupId}:${memberId}`
}

export function createMemberProfileAuthzKey(memberId: string) {
  return `member:${memberId}:profile`
}

export function createApiCacheKey(requestOrPath: Request | string) {
  const url = typeof requestOrPath === 'string'
    ? new URL(requestOrPath, 'https://alife.local')
    : new URL(requestOrPath.url)

  url.hash = ''
  url.searchParams.sort()
  return `api:${url.pathname}${url.search}`
}

export function getPageDetailId(pathname: string) {
  return pathname.match(/^\/api\/pages\/([^/]+)$/)?.[1] ?? ''
}

export function getGroupDetailId(pathname: string) {
  return pathname.match(/^\/api\/groups\/([^/]+)$/)?.[1] ?? ''
}

export function getGroupSubresource(pathname: string) {
  const match = pathname.match(/^\/api\/groups\/([^/]+)\/([^/]+)$/)
  if (!match || !GROUP_SHARED_SUBRESOURCES.has(match[2])) {
    return null
  }

  return { groupId: match[1], subresource: match[2] }
}

export function getEventSubresource(pathname: string) {
  const match = pathname.match(/^\/api\/events\/([^/]+)\/([^/]+)$/)
  if (!match || !EVENT_SHARED_SUBRESOURCES.has(match[2])) {
    return null
  }

  return { eventId: match[1], subresource: match[2] }
}

export function createPageMetaMapKey(pageId: string) {
  return `map:page:${pageId}:meta`
}

export function createEntityGroupMapKey(entityType: string, entityId: string) {
  return `map:${entityType}:${entityId}:group`
}

export function createLegacyEntityGroupMapRequest(entityType: string, entityId: string) {
  return new Request(`https://alife.local/__cache-map/${entityType}/${entityId}`, { method: 'GET' })
}

export function createLogicalCacheRecordRequest(key: string) {
  const url = new URL(LOGICAL_CACHE_RECORD_URL)
  url.searchParams.set('key', key)
  return new Request(url.toString(), { method: 'GET' })
}

export async function readLogicalCacheRecord(key: string) {
  const response = await getEdgeCache().match(createLogicalCacheRecordRequest(key))
  if (!response) {
    return undefined
  }

  return readJson(response)
}

export async function writeLogicalCacheRecord(key: string, value: unknown, ttlSeconds: number) {
  await getEdgeCache().put(
    createLogicalCacheRecordRequest(key),
    Response.json(value, {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${ttlSeconds}`,
      },
    }),
  )
}

export async function deleteLogicalCacheRecord(key: string) {
  await getEdgeCache().delete(createLogicalCacheRecordRequest(key))
}

export function parseCookies(cookieHeader: string) {
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

export function extractSubjectFromAuthorization(authorizationHeader: string) {
  if (!authorizationHeader) {
    return ''
  }

  const parts = authorizationHeader.trim().split(/\s+/)
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return ''
  }

  return extractSubjectFromJwt(parts[1])
}

export function extractPrincipalFromJwt(token: string | undefined) {
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

export function extractSubjectFromJwt(token: string | undefined) {
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

export async function createCredentialCacheKey(request: Request) {
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

export function getEdgeCache() {
  const cacheStorage = globalThis.caches as unknown as {
    default?: Cache
  } | undefined

  if (!cacheStorage?.default) {
    throw new Error('Cache storage is not available in this runtime.')
  }

  return cacheStorage.default
}

export async function readJsonObject(response: Response) {
  const value = await readJson(response)
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function readJson(response: Response) {
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

export function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}
