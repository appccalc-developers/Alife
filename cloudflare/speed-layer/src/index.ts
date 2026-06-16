import { Router } from './shared/router'
import { authMiddleware } from './middlewares/authCache'
import { apiCacheMiddleware } from './middlewares/apiCache'
import { proxyHandler } from './middlewares/proxyHandler'
import aiRouter from './features/ai/aiRouter'
import eventRouter from './features/events/eventRouter'

import { EventPlanningSession } from './features/events/planner'
import { EnrollmentSession } from './features/events/enrolment'
import { ReviewSession } from './features/events/reviewer'

export type Env = {
  API_PROXY_TARGET?: string
  /** Comma-separated frontend origins allowed for credentialed CORS. */
  CORS_ALLOWED_ORIGINS?: string
  /** Gemini API key stored as a Cloudflare Worker secret. */
  GEMINI_API_KEY?: string
  /** Optional Gemini model override. Defaults to Gemini 3 Pro. */
  GEMINI_MODEL?: string
  /** Durable Object namespace for live event-planning sessions. */
  EVENT_SESSIONS?: DurableObjectNamespace
  /** Durable Object namespace for live enrollment sessions. */
  ENROLLMENT_SESSIONS?: DurableObjectNamespace
  /** Durable Object namespace for live event review sessions. */
  REVIEW_SESSIONS?: DurableObjectNamespace
}

export type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

export type DurableObjectNamespace = {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

export type DurableObjectId = unknown

export type DurableObjectStub = {
  fetch(request: Request): Promise<Response>
}

export { EventPlanningSession, EnrollmentSession, ReviewSession }

const app = new Router()

// Outermost priority routing (bypasses middleware entirely)
app.all('/images', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))
app.all('/images/*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))
app.all('/proxy/*', async (req, env, ctx) => proxyHandler.handle(req, env, ctx))

// Setup pipeline middleware
const apiPipeline = new Router()
apiPipeline.use(authMiddleware)
apiPipeline.use(apiCacheMiddleware)

// Mount sub-routers on the pipeline
apiPipeline.mount('/api/ai', aiRouter)
apiPipeline.mount('/api/events', eventRouter)
apiPipeline.mount('/api/enrollments', eventRouter)
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
