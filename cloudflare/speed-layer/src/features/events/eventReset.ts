import type { Env } from '../../index'
import { purgeEventResetCaches } from '../../middlewares/apiCache'
import { EVENT_SCHEMA_VERSION, eventDataEpoch, eventSchemaEpoch, isEventCachePath, isValidEventDataEpoch } from './eventEpoch'

const EVENT_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const RESET_RUN_ID = /^[A-Za-z0-9._-]{1,128}$/
const DURABLE_OBJECT_ID = /^[0-9a-f]{64}$/i
const HEX_32 = /^[0-9a-f]{32}$/
const HEX_64 = /^[0-9a-f]{64}$/
const MAX_DURABLE_OBJECT_PURGE_BATCH = 50
const MAX_DURABLE_OBJECT_PURGE_BODY_BYTES = 32 * 1024
const EVENT_RESET_WORKER_SCRIPT = 'app-ccalc'
const EVENT_RESET_DO_SIGNATURE_HEADER = 'x-alife-event-reset-do-signature'
export const EVENT_DURABLE_OBJECT_PURGE_PATH = '/_internal/event-reset/purge'

type EventDurableObjectClass = 'EventPlanningSession' | 'EnrollmentSession' | 'ReviewSession'
type EventDurableObjectNamespace = 'EVENT_SESSIONS' | 'ENROLLMENT_SESSIONS' | 'REVIEW_SESSIONS'

export const eventSessionObjectName = (env: Env, value: string) =>
  `${eventSchemaEpoch(env)}:${eventDataEpoch(env)}:${value}`

export const isEventWriteRequest = (request: Request) => {
  if (!EVENT_WRITE_METHODS.has(request.method.toUpperCase())) return false
  const path = new URL(request.url).pathname
  return isEventCachePath(path) ||
    path.startsWith('/api/admin/event-templates') || path.startsWith('/api/admin/event-package-policies') ||
    /^\/api\/admin\/churches\/[^/]+\/ram-policies(?:\/|$)/.test(path) ||
    path === '/api/ai/event-poster' || path === '/api/internal/ram/identify' ||
    path === '/api/events/ram-authoring/check'
}

export const isEventSessionRequest = (request: Request) => {
  const path = new URL(request.url).pathname
  return /^\/api\/events\/(?:details-session|session)(?:\/|$)/.test(path) ||
    /^\/api\/(?:enrollments|reviews)\/session(?:\/|$)/.test(path)
}

export const eventWriteFreezeResponse = (request: Request, env: Env): Response | null => {
  const path = new URL(request.url).pathname
  const eventWrite = isEventWriteRequest(request) || isEventSessionRequest(request)
  const production = env.EVENT_RUNTIME_ENVIRONMENT?.trim().toLowerCase() === 'production'
  const mode = env.EVENT_WRITE_MODE?.trim().toLowerCase()
  const schemaEpoch = env.EVENT_SCHEMA_EPOCH?.trim()
  const dataEpoch = env.EVENT_DATA_EPOCH?.trim()
  const frozenEpoch = env.EVENT_WRITE_FREEZE_EPOCH?.trim()
  const invalidConfiguration = production && (schemaEpoch !== EVENT_SCHEMA_VERSION || !isValidEventDataEpoch(dataEpoch) ||
    !['open', 'frozen'].includes(mode ?? '') || mode === 'frozen' && (!frozenEpoch || dataEpoch !== frozenEpoch))
  if (!eventWrite && !(invalidConfiguration && isEventCachePath(path))) return null
  if (!invalidConfiguration && mode !== 'frozen' && !frozenEpoch) return null
  const retryAfter = /^\d+$/.test(env.EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS ?? '')
    ? env.EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS!
    : '60'
  return Response.json({
    code: invalidConfiguration ? 'event.reset.configuration' : 'event.reset.frozen',
    message: invalidConfiguration
      ? 'Event changes are unavailable because the production Event runtime epoch is not configured.'
      : 'Event changes are temporarily unavailable while Event data maintenance is in progress.',
    epoch: frozenEpoch || null,
  }, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'retry-after': retryAfter,
      ...(frozenEpoch ? { 'x-alife-event-reset-epoch': frozenEpoch } : {}),
      'x-alife-event-schema-epoch': eventSchemaEpoch(env),
      'x-alife-event-data-epoch': eventDataEpoch(env),
    },
  })
}

const authorized = (request: Request, env: Env) => {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
  const expected = env.CACHE_SYNC_API_TOKEN ?? ''
  const left = new TextEncoder().encode(token)
  const right = new TextEncoder().encode(expected)
  if (!expected || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

const resetRuntime = (env: Env) => {
  const schemaEpoch = env.EVENT_SCHEMA_EPOCH?.trim() || null
  const dataEpoch = env.EVENT_DATA_EPOCH?.trim() || null
  const resetEpoch = env.EVENT_WRITE_FREEZE_EPOCH?.trim() || null
  const mode = env.EVENT_WRITE_MODE?.trim().toLowerCase()
  const environment = env.EVENT_RUNTIME_ENVIRONMENT?.trim().toLowerCase()
  const configured = schemaEpoch === EVENT_SCHEMA_VERSION && isValidEventDataEpoch(dataEpoch) &&
    environment === 'production' && ['open', 'frozen'].includes(mode ?? '')
  const frozen = configured && mode === 'frozen' && Boolean(resetEpoch) && dataEpoch === resetEpoch
  return { schemaEpoch, dataEpoch, resetEpoch, frozen, configured }
}

export const handleEventResetStatus = (request: Request, env: Env) => {
  if (!authorized(request, env)) return Response.json({ ready: false, durableObjectResetReady: false, frozen: false, resetEpoch: null, schemaEpoch: null, dataEpoch: null }, { status: 403, headers: { 'cache-control': 'no-store' } })
  const state = resetRuntime(env)
  const durableObjectResetReady = validDurableObjectResetSecret(env.EVENT_RESET_DO_TOKEN, env.CACHE_SYNC_API_TOKEN) &&
    Boolean(env.EVENT_SESSIONS && env.ENROLLMENT_SESSIONS && env.REVIEW_SESSIONS)
  const ready = state.frozen && Boolean(env.API_CACHE) && durableObjectResetReady
  return Response.json({ ready, durableObjectResetReady, frozen: state.frozen, resetEpoch: state.resetEpoch, schemaEpoch: state.schemaEpoch, dataEpoch: state.dataEpoch }, {
    status: ready ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}

export const handleEventResetCache = async (request: Request, env: Env) => {
  if (!authorized(request, env)) return Response.json({ verified: false, resetRunId: '', resetEpoch: '', schemaEpoch: '', dataEpoch: '', failures: ['Forbidden.'] }, { status: 403, headers: { 'cache-control': 'no-store' } })
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> }
  catch { return Response.json({ verified: false, resetRunId: '', resetEpoch: '', schemaEpoch: '', failures: ['Invalid JSON.'] }, { status: 400, headers: { 'cache-control': 'no-store' } }) }
  const resetRunId = typeof body.resetRunId === 'string' ? body.resetRunId : ''
  const resetEpoch = typeof body.resetEpoch === 'string' ? body.resetEpoch : ''
  const schemaEpoch = typeof body.schemaEpoch === 'string' ? body.schemaEpoch : ''
  const dataEpoch = typeof body.dataEpoch === 'string' ? body.dataEpoch : ''
  const state = resetRuntime(env)
  const failures: string[] = []
  if (!RESET_RUN_ID.test(resetRunId)) failures.push('Invalid reset run ID.')
  if (!state.frozen || resetEpoch !== state.resetEpoch || schemaEpoch !== state.schemaEpoch ||
    dataEpoch !== state.dataEpoch || dataEpoch !== resetEpoch) failures.push('Event reset epoch is not frozen at the requested schema/data/reset epoch.')
  if (!env.API_CACHE) failures.push('API_CACHE binding is unavailable.')
  if (failures.length === 0) {
    try { await purgeEventResetCaches(env, request) }
    catch (error) { failures.push(error instanceof Error ? error.message : 'Event cache invalidation failed.') }
  }
  return Response.json({ verified: failures.length === 0, resetRunId, resetEpoch, schemaEpoch, dataEpoch, failures }, {
    status: failures.length === 0 ? 200 : 409,
    headers: { 'cache-control': 'no-store' },
  })
}

const durableObjectTarget = (env: Env, className: string) => {
  switch (className) {
    case 'EventPlanningSession':
      return { namespace: 'EVENT_SESSIONS' as const, binding: env.EVENT_SESSIONS }
    case 'EnrollmentSession':
      return { namespace: 'ENROLLMENT_SESSIONS' as const, binding: env.ENROLLMENT_SESSIONS }
    case 'ReviewSession':
      return { namespace: 'REVIEW_SESSIONS' as const, binding: env.REVIEW_SESSIONS }
    default:
      return null
  }
}

type DurableObjectResetBody = {
  operation?: unknown
  resetRunId?: unknown
  resetEpoch?: unknown
  schemaEpoch?: unknown
  dataEpoch?: unknown
  namespace?: unknown
  className?: unknown
  workerScript?: unknown
  namespaceId?: unknown
  approvedFingerprint?: unknown
  batchIndex?: unknown
  batchHash?: unknown
  objectIds?: unknown
}

const durableObjectResetMetadata = (body: DurableObjectResetBody) => ({
  operation: typeof body.operation === 'string' ? body.operation : '',
  resetRunId: typeof body.resetRunId === 'string' ? body.resetRunId : '',
  resetEpoch: typeof body.resetEpoch === 'string' ? body.resetEpoch : '',
  schemaEpoch: typeof body.schemaEpoch === 'string' ? body.schemaEpoch : '',
  dataEpoch: typeof body.dataEpoch === 'string'
    ? body.dataEpoch
    : typeof body.resetEpoch === 'string' ? body.resetEpoch : '',
  namespace: typeof body.namespace === 'string' ? body.namespace : '',
  className: typeof body.className === 'string' ? body.className : '',
  workerScript: typeof body.workerScript === 'string' ? body.workerScript : '',
  namespaceId: typeof body.namespaceId === 'string' ? body.namespaceId : '',
  approvedFingerprint: typeof body.approvedFingerprint === 'string' ? body.approvedFingerprint : '',
  batchIndex: typeof body.batchIndex === 'number' ? body.batchIndex : -1,
  batchHash: typeof body.batchHash === 'string' ? body.batchHash : '',
})

const validateDurableObjectReset = (body: DurableObjectResetBody, env: Env) => {
  const metadata = durableObjectResetMetadata(body)
  const failures: string[] = []
  const state = resetRuntime(env)
  const target = durableObjectTarget(env, metadata.className)
  if (metadata.operation !== 'purge') failures.push('Operation must be purge.')
  if (!RESET_RUN_ID.test(metadata.resetRunId)) failures.push('Invalid reset run ID.')
  if (metadata.workerScript !== EVENT_RESET_WORKER_SCRIPT) failures.push('Unexpected Worker script.')
  if (!HEX_32.test(metadata.namespaceId)) failures.push('Invalid Durable Object namespace ID.')
  if (!HEX_64.test(metadata.approvedFingerprint)) failures.push('Invalid approved fingerprint.')
  if (!HEX_64.test(env.EVENT_RESET_DO_APPROVED_FINGERPRINT ?? '') ||
    metadata.approvedFingerprint !== env.EVENT_RESET_DO_APPROVED_FINGERPRINT) {
    failures.push('Durable Object reset fingerprint is not the approved runtime fingerprint.')
  }
  if (!Number.isSafeInteger(metadata.batchIndex) || metadata.batchIndex < 0) failures.push('Invalid purge batch index.')
  if (!HEX_64.test(metadata.batchHash)) failures.push('Invalid purge batch hash.')
  if (!state.frozen || metadata.resetEpoch !== state.resetEpoch || metadata.schemaEpoch !== state.schemaEpoch ||
    metadata.dataEpoch !== state.dataEpoch || metadata.dataEpoch !== metadata.resetEpoch) {
    failures.push('Event reset epoch is not frozen at the requested schema/data/reset epoch.')
  }
  if (!target) failures.push('Unsupported Durable Object class.')
  else if (metadata.namespace !== target.namespace) failures.push('Durable Object namespace and class do not match.')
  return { metadata, failures, target }
}

const durableObjectResetResponse = (
  metadata: ReturnType<typeof durableObjectResetMetadata>,
  requested: number,
  purged: number,
  failures: string[],
  status: number,
) => Response.json({
  verified: failures.length === 0,
  ...metadata,
  requestedCount: requested,
  purgedCount: purged,
  counts: { requested, purged, failed: Math.max(0, requested - purged) },
  failures,
}, { status, headers: { 'cache-control': 'no-store' } })

export const handleEventResetDurableObjects = async (request: Request, env: Env) => {
  const emptyMetadata = durableObjectResetMetadata({})
  let rawBody: Uint8Array
  try { rawBody = await readBoundedResetBody(request) }
  catch { return durableObjectResetResponse(emptyMetadata, 0, 0, ['Invalid or oversized request body.'], 400) }
  if (!await authorizedDurableObjectReset(request, env, rawBody)) {
    return durableObjectResetResponse(emptyMetadata, 0, 0, ['Forbidden.'], 403)
  }

  let body: DurableObjectResetBody
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) as DurableObjectResetBody }
  catch { return durableObjectResetResponse(emptyMetadata, 0, 0, ['Invalid JSON.'], 400) }

  const { metadata, failures, target } = validateDurableObjectReset(body, env)
  const objectIds = Array.isArray(body.objectIds) ? body.objectIds : []
  if (!Array.isArray(body.objectIds) || objectIds.length === 0 || objectIds.length > MAX_DURABLE_OBJECT_PURGE_BATCH ||
    objectIds.some((value) => typeof value !== 'string' || !DURABLE_OBJECT_ID.test(value)) ||
    new Set(objectIds).size !== objectIds.length) {
    failures.push(`objectIds must contain 1-${MAX_DURABLE_OBJECT_PURGE_BATCH} unique Durable Object IDs.`)
  }
  if (objectIds.length > 0 && objectIds.every((value): value is string => typeof value === 'string')) {
    const actualBatchHash = await sha256Json(objectIds)
    if (actualBatchHash !== metadata.batchHash) failures.push('Durable Object purge batch hash does not match objectIds.')
  }
  if (target && !target.binding) failures.push(`${target.namespace} binding is unavailable.`)
  if (failures.length > 0 || !target?.binding) {
    return durableObjectResetResponse(metadata, objectIds.length, 0, failures, 400)
  }

  const purgeBody = JSON.stringify(metadata)
  const purgeSignature = await durableObjectResetSignature(env.EVENT_RESET_DO_TOKEN!, new TextEncoder().encode(purgeBody))
  const results = await Promise.all(objectIds.map(async (objectId) => {
    try {
      const id = target.binding!.idFromString(objectId as string)
      const response = await target.binding!.get(id).fetch(new Request(`https://event-reset.invalid${EVENT_DURABLE_OBJECT_PURGE_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [EVENT_RESET_DO_SIGNATURE_HEADER]: purgeSignature,
        },
        body: purgeBody,
      }))
      if (!response.ok) return `purge returned ${response.status}`
      const result = await response.json() as { verified?: unknown }
      return result.verified === true ? null : 'purge was not verified'
    } catch (error) {
      return error instanceof Error ? error.message : 'purge failed'
    }
  }))
  const failedCount = results.filter((value) => value !== null).length
  const purged = objectIds.length - failedCount
  const purgeFailures = failedCount === 0
    ? []
    : [`${failedCount} Durable Object purge request(s) failed in batch ${metadata.batchIndex}.`]
  return durableObjectResetResponse(metadata, objectIds.length, purged, purgeFailures, failedCount === 0 ? 200 : 409)
}

const sha256Json = async (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export const handleEventDurableObjectPurgeRequest = async (
  request: Request,
  env: Env,
  expectedNamespace: EventDurableObjectNamespace,
  expectedClassName: EventDurableObjectClass,
  purge: () => Promise<void>,
) => {
  if (request.method !== 'POST' || new URL(request.url).pathname !== EVENT_DURABLE_OBJECT_PURGE_PATH) {
    return Response.json({ message: 'Durable Object cleanup route not found.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  let rawBody: Uint8Array
  try { rawBody = await readBoundedResetBody(request) }
  catch { return Response.json({ verified: false, purged: false, failures: ['Invalid or oversized request body.'] }, { status: 400, headers: { 'cache-control': 'no-store' } }) }
  if (!await authorizedDurableObjectReset(request, env, rawBody)) {
    return Response.json({ verified: false, purged: false, failures: ['Forbidden.'] }, { status: 403, headers: { 'cache-control': 'no-store' } })
  }

  let body: DurableObjectResetBody
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) as DurableObjectResetBody }
  catch { return Response.json({ verified: false, purged: false, failures: ['Invalid JSON.'] }, { status: 400, headers: { 'cache-control': 'no-store' } }) }
  const { metadata, failures } = validateDurableObjectReset(body, env)
  if (metadata.namespace !== expectedNamespace || metadata.className !== expectedClassName) {
    failures.push('Durable Object cleanup target does not match this class.')
  }
  if (failures.length > 0) {
    return Response.json({ verified: false, purged: false, ...metadata, failures }, { status: 409, headers: { 'cache-control': 'no-store' } })
  }

  try {
    await purge()
    return Response.json({ verified: true, purged: true, ...metadata, failures: [] }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return Response.json({
      verified: false,
      purged: false,
      ...metadata,
      failures: [error instanceof Error ? error.message : 'Durable Object cleanup failed.'],
    }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}

const validDurableObjectResetSecret = (value: string | undefined, cacheSyncToken: string | undefined) =>
  typeof value === 'string' && value.length >= 32 && value.length <= 4096 && value !== cacheSyncToken

const readBoundedResetBody = async (request: Request) => {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DURABLE_OBJECT_PURGE_BODY_BYTES) {
    throw new Error('Request body is too large.')
  }
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength === 0 || body.byteLength > MAX_DURABLE_OBJECT_PURGE_BODY_BYTES) {
    throw new Error('Request body is empty or too large.')
  }
  return body
}

const durableObjectResetSignature = async (secret: string, rawBody: Uint8Array) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, rawBody)
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const authorizedDurableObjectReset = async (request: Request, env: Env, rawBody: Uint8Array) => {
  if (!validDurableObjectResetSecret(env.EVENT_RESET_DO_TOKEN, env.CACHE_SYNC_API_TOKEN)) return false
  const signature = request.headers.get(EVENT_RESET_DO_SIGNATURE_HEADER) ?? ''
  if (!HEX_64.test(signature)) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.EVENT_RESET_DO_TOKEN!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], value => Number.parseInt(value, 16))
  return crypto.subtle.verify('HMAC', key, signatureBytes, rawBody)
}
