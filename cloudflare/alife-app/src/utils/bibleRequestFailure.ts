import { getHttpStatus } from '@youversion/platform-core'

export class YouVersionConfigurationError extends Error {
  constructor() {
    super('YouVersion App Key is not configured.')
    this.name = 'YouVersionConfigurationError'
  }
}

export type BibleRequestFailure = 'not-configured' | 'rate-limited' | 'access-denied' | 'other'

export const bibleRequestFailure = (cause: unknown): BibleRequestFailure => {
  if (cause instanceof YouVersionConfigurationError) return 'not-configured'
  const status = getHttpStatus(cause)
  if (status === 429) return 'rate-limited'
  if (status === 401 || status === 403) return 'access-denied'
  return 'other'
}
