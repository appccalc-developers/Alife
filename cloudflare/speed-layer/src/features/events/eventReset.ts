import type { Env } from '../../index'
import { purgeEventResetCaches } from '../../middlewares/apiCache'
import { EVENT_SCHEMA_VERSION, eventDataEpoch, eventSchemaEpoch, isEventCachePath, isValidEventDataEpoch } from './eventEpoch'

const EVENT_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const RESET_RUN_ID = /^[A-Za-z0-9._-]{1,128}$/

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

export const eventWriteFreezeResponse = (request: Request, env: Env): Response | null => {
  const path = new URL(request.url).pathname
  const eventWrite = isEventWriteRequest(request)
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
  if (!authorized(request, env)) return Response.json({ ready: false, frozen: false, resetEpoch: null, schemaEpoch: null, dataEpoch: null }, { status: 403, headers: { 'cache-control': 'no-store' } })
  const state = resetRuntime(env)
  const ready = state.frozen && Boolean(env.API_CACHE)
  return Response.json({ ready, frozen: state.frozen, resetEpoch: state.resetEpoch, schemaEpoch: state.schemaEpoch, dataEpoch: state.dataEpoch }, {
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
