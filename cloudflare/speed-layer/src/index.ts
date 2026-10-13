import { Router } from './shared/router'
import { authMiddleware } from './middlewares/authCache'
import { apiCacheMiddleware } from './middlewares/apiCache'
import { proxyHandler } from './middlewares/proxyHandler'
import aiRouter from './features/ai/aiRouter'
import { handleInternalCacheInvalidate } from './features/cache/cacheInvalidation'
import eventRouter from './features/events/eventRouter'
import { handleRamSync } from './features/events/ramSync'
import { eventWriteFreezeResponse, handleEventResetCache, handleEventResetDurableObjects, handleEventResetStatus } from './features/events/eventReset'

import { EventPlanningSession } from './features/events/planner'
import { EnrollmentSession } from './features/events/enrolmentCleanup'
import { ReviewSession } from './features/events/reviewer'

export type Env = {
  API_PROXY_TARGET?: string
  /** Optional images API origin override for local development. */
  IMAGES_API_PROXY_TARGET?: string
  /** Frontend build output exposed through the Workers Static Assets binding. */
  ASSETS?: Fetcher
  /** Global second-level cache for public API responses and public page metadata. */
  API_CACHE?: KVNamespace
  /** Comma-separated frontend origins allowed for credentialed CORS. */
  CORS_ALLOWED_ORIGINS?: string
  /** Gemini API key stored as a Cloudflare Worker secret. */
  GEMINI_API_KEY?: string
  /** Optional Gemini model override. Defaults to Gemini 3 Pro. */
  GEMINI_MODEL?: string
  /** Optional Gemini image model override for event poster generation. */
  GEMINI_IMAGE_MODEL?: string
  /** Bearer token for backend-triggered speed-layer cache invalidation. */
  CACHE_SYNC_API_TOKEN?: string
  /** Reset-only HMAC key for destructive Event Durable Object cleanup. */
  EVENT_RESET_DO_TOKEN?: string
  /** Fingerprint approved for the currently frozen Durable Object reset run. */
  EVENT_RESET_DO_APPROVED_FINGERPRINT?: string
  /** Dedicated backend credential for bounded RAM synchronization requests. */
  RAM_SYNC_API_TOKEN?: string
  /** Durable Object namespace for live event-details assistant sessions. */
  EVENT_SESSIONS?: DurableObjectNamespace
  /** Cleanup-only binding for retired Event enrollment assistant sessions. */
  ENROLLMENT_SESSIONS?: DurableObjectNamespace
  /** Durable Object namespace for live event review sessions. */
  REVIEW_SESSIONS?: DurableObjectNamespace
  /** Namespace epoch for Event Durable Object identities. Defaults to Event 2.0. */
  EVENT_SCHEMA_EPOCH?: string
  /** Persistent Event instance/cache epoch. Production requires it across freeze and unfreeze. */
  EVENT_DATA_EPOCH?: string
  /** When set, Event-mutating requests return 503 until this freeze epoch is removed. */
  EVENT_WRITE_FREEZE_EPOCH?: string
  /** Retry-After value in seconds while Event writes are frozen. */
  EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS?: string
  /** Production requires an explicit Event write mode so missing reset bindings fail closed. */
  EVENT_RUNTIME_ENVIRONMENT?: string
  EVENT_WRITE_MODE?: string
}

export type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

export type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId
  idFromString(id: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

export type DurableObjectId = unknown

export type DurableObjectStub = {
  fetch(request: Request): Promise<Response>
}

export { EventPlanningSession, EnrollmentSession, ReviewSession }

const app = new Router()

const serveStaticAssetWithoutSpaFallback = async (request: Request, env: Env) => {
  if (!env.ASSETS) {
    return new Response('Static asset service unavailable.', {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/plain; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  const response = await env.ASSETS.fetch(request)
  const contentType = response.headers.get('content-type') ?? ''
  if (response.status !== 200 || !contentType.toLowerCase().startsWith('text/html')) {
    return response
  }

  return new Response('Static asset not found.', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  })
}

// Outermost priority routing (bypasses middleware entirely)
app.all('/assets/*', async (req, env) => serveStaticAssetWithoutSpaFallback(req, env))
app.all('/images', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))
app.all('/images/*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))
app.all('/proxy/*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))
app.post('/api/internal/cache/invalidate', async (req, env, ctx) => handleInternalCacheInvalidate(req, env, ctx))
app.post('/api/internal/event-reset/cache', async (req, env) => handleEventResetCache(req, env))
app.post('/api/internal/event-reset/durable-objects', async (req, env) => handleEventResetDurableObjects(req, env))
app.get('/api/internal/event-reset/status', async (req, env) => handleEventResetStatus(req, env))
app.post('/api/internal/ram/identify', async (req, env) => handleRamSync(req, env))

// Setup pipeline middleware
const apiPipeline = new Router()
apiPipeline.use(authMiddleware)
apiPipeline.use(apiCacheMiddleware)

// Mount sub-routers on the pipeline
apiPipeline.mount('/api/ai', aiRouter)
apiPipeline.mount('/api/events', eventRouter)
apiPipeline.mount('/api/reviews', eventRouter)

// Fallback inside the pipeline (runs after auth/cache middleware!)
apiPipeline.all('*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))

// Mount pipeline to main router
app.mount('/api', apiPipeline)

// Outermost fallback for non-API requests (if any)
app.all('*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const freezeResponse = eventWriteFreezeResponse(request, env)
      if (freezeResponse) return freezeResponse
      return await app.handle(request, env, ctx)
    } catch (error) {
      console.error('API proxy failed.', error)
      return new Response('API proxy failed.', {
        status: 502,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-alife-cache': 'BYPASS',
        },
      })
    }
  },
}
