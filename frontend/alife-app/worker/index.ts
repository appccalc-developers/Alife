import planner from './eventplanner'
import { EventPlanningSession } from './eventplanner'
import enrollment from './enrollment'
import { EnrollmentSession } from './enrollment'
import proxy from './proxy'

export type Env = {
  API_PROXY_TARGET?: string
  /** Gemini API key stored as a Cloudflare Worker secret. */
  GEMINI_API_KEY?: string
  /** Optional Gemini model override. Defaults to Gemini 3 Pro. */
  GEMINI_MODEL?: string
  /** Durable Object namespace for live event-planning sessions. */
  EVENT_SESSIONS?: DurableObjectNamespace
  /** Durable Object namespace for live enrollment sessions. */
  ENROLLMENT_SESSIONS?: DurableObjectNamespace
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

export { EventPlanningSession }
export { EnrollmentSession }

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/events/extract' && request.method === 'POST') {
        return await planner.fetch(request, env)
      }

      if (url.pathname.startsWith('/api/events/session/')) {
        return await planner.fetch(request, env)
      }

      if (url.pathname.startsWith('/api/enrollments/session/')) {
        return await enrollment.fetch(request, env)
      }

      return await proxy.fetch(request, env, ctx)
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
