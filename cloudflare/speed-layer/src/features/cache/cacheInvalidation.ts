import type { Env, ExecutionContext } from '../../index'
import { purgeApiPathCache, warmPublicPagesCache } from '../../middlewares/apiCache'

const ALLOWED_PURGE_PATHS = new Set(['/api/sermons', '/api/pages/public'])
const GROUP_MEMBER_PATH =
  /^\/api\/groups\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/(?:memberships|members)$/
const PUBLIC_CONTENT_POST_PATH =
  /^\/api\/public\/groups\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/posts(?:\/[a-z0-9-]{1,180})?$/

export async function handleInternalCacheInvalidate(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  if (!env.CACHE_SYNC_API_TOKEN) {
    return createNoStoreJsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
  if (!isTimingSafeEqual(token, env.CACHE_SYNC_API_TOKEN)) {
    return createNoStoreJsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return createNoStoreJsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const paths = readAllowedPaths(body)
  if (paths.length === 0) {
    return createNoStoreJsonResponse({ ok: false, error: 'No allowed paths to purge' }, 400)
  }

  await Promise.all(paths.map((path) => purgeApiPathCache(env, request, path)))
  if (paths.includes('/api/pages/public') && ctx) {
    ctx.waitUntil(warmPublicPagesCache(env, request))
  }
  return createNoStoreJsonResponse({ ok: true, purged: paths })
}

function readAllowedPaths(value: unknown) {
  if (!value || typeof value !== 'object') {
    return []
  }

  const paths = (value as Record<string, unknown>).paths
  if (!Array.isArray(paths)) {
    return []
  }

  const allowed = new Set<string>()
  for (const path of paths) {
    if (
      typeof path === 'string' &&
      (ALLOWED_PURGE_PATHS.has(path) || GROUP_MEMBER_PATH.test(path) || PUBLIC_CONTENT_POST_PATH.test(path))
    ) {
      allowed.add(path)
    }
  }

  return Array.from(allowed)
}

function isTimingSafeEqual(actual: string, expected: string) {
  const actualBytes = new TextEncoder().encode(actual)
  const expectedBytes = new TextEncoder().encode(expected)
  if (actualBytes.length !== expectedBytes.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < expectedBytes.length; index += 1) {
    mismatch |= actualBytes[index] ^ expectedBytes[index]
  }

  return mismatch === 0
}

function createNoStoreJsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}
