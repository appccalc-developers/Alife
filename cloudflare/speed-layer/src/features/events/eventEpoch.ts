import type { Env } from '../../index'

export const EVENT_SCHEMA_VERSION = '2.0.0'
export const DEVELOPMENT_EVENT_DATA_EPOCH = 'local-event-data'
const EPOCH = /^[A-Za-z0-9._-]{1,128}$/

export const eventSchemaEpoch = (env: Env) => env.EVENT_SCHEMA_EPOCH?.trim() || EVENT_SCHEMA_VERSION

export const eventDataEpoch = (env: Env) => env.EVENT_DATA_EPOCH?.trim() || DEVELOPMENT_EVENT_DATA_EPOCH

export const isValidEventDataEpoch = (value: string | undefined | null) =>
  Boolean(value && EPOCH.test(value))

export const isEventCachePath = (pathname: string) =>
  pathname === '/api/events' || pathname.startsWith('/api/events/') ||
  pathname === '/api/event-series' || pathname.startsWith('/api/event-series/') ||
  pathname === '/api/enrollments' || pathname.startsWith('/api/enrollments/') ||
  pathname === '/api/reviews' || pathname.startsWith('/api/reviews/') ||
  pathname === '/api/event-package-delegations' || pathname.startsWith('/api/event-package-delegations/') ||
  pathname === '/api/church-life/events' ||
  /^\/api\/groups\/[^/]+\/(?:events|event-series|event-plans|event-venues|venues)(?:\/|$)/.test(pathname)

export const scopeEventCacheKey = (env: Env, pathname: string, key: string) =>
  isEventCachePath(pathname) ? `event-data:${eventDataEpoch(env)}:${key}` : key

export const scopeEventLogicalKey = (env: Env, entityType: string, key: string) =>
  entityType === 'event' ? `event-data:${eventDataEpoch(env)}:${key}` : key
