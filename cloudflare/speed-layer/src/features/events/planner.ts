import type { Env } from '../../index'
import {
  createAiSessionObjectName,
  createAiSessionObjectRequest,
  createMemoryDurableObjectState,
  getSessionIdFromPath,
  resolveAiSessionObjectPath,
  type DurableObjectStateLike,
} from '../ai/aiSession'
import { EventDetailsSession } from './details'

const DETAILS_ROUTE = '/api/events/details-session'
const DETAILS_OBJECT_PREFIX = 'details-v1:'
const fallbackStates = new Map<string, ReturnType<typeof createMemoryDurableObjectState>>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const sessionId = getSessionIdFromPath(request, DETAILS_ROUTE)
    const targetPath = resolveAiSessionObjectPath(url, request, { extraRoutes: ['/close'] })
    const objectName = `${DETAILS_OBJECT_PREFIX}${createAiSessionObjectName(request, sessionId)}`

    if (env.EVENT_SESSIONS) {
      const objectId = env.EVENT_SESSIONS.idFromName(objectName)
      const object = env.EVENT_SESSIONS.get(objectId)
      return object.fetch(createAiSessionObjectRequest(`/details${targetPath}`, url, request, sessionId))
    }

    let state = fallbackStates.get(objectName)
    if (!state) {
      state = createMemoryDurableObjectState()
      fallbackStates.set(objectName, state)
    }
    return new EventPlanningSession(state, env)
      .fetch(createAiSessionObjectRequest(`/details${targetPath}`, url, request, sessionId))
  },
}

// Cloudflare migrations and the EVENT_SESSIONS binding use this historical
// class name. Keep it as a thin adapter so the current Details Assistant does
// not require a Durable Object class migration.
export class EventPlanningSession {
  private detailsSession?: EventDetailsSession
  private detailsQueue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly durableState: DurableObjectStateLike,
    private readonly env: Env,
  ) {}

  private getDetails() {
    return this.detailsSession ??= new EventDetailsSession(this.durableState, this.env)
  }

  async alarm() {
    await this.getDetails().alarm()
  }

  async fetch(request: Request): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/details/')) {
      return Response.json(
        { message: 'Event details session route not found.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    const response = this.detailsQueue.then(() => this.getDetails().fetch(request))
    this.detailsQueue = response.catch(() => undefined)
    return response
  }
}
