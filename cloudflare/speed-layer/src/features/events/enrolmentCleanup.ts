import type { Env } from '../../index'
import type { DurableObjectStateLike } from '../ai/aiSession'
import { handleEventDurableObjectPurgeRequest } from './eventReset'

/**
 * Cleanup-only adapter for the retired Event 1.x enrollment session namespace.
 * It deliberately exposes no enrollment behavior; the protected reset endpoint
 * is its only accepted request.
 */
export class EnrollmentSession {
  constructor(
    private readonly durableState: DurableObjectStateLike,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    return handleEventDurableObjectPurgeRequest(
      request,
      this.env,
      'ENROLLMENT_SESSIONS',
      'EnrollmentSession',
      async () => {
        await this.durableState.storage.deleteAlarm?.()
        if (!this.durableState.storage.deleteAll) {
          throw new Error('Durable Object storage does not support deleteAll().')
        }
        await this.durableState.storage.deleteAll()
      },
    )
  }
}
