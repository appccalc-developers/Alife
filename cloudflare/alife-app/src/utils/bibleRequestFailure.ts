export class YouVersionConfigurationError extends Error {
  constructor() {
    super('YouVersion App Key is not configured.')
    this.name = 'YouVersionConfigurationError'
  }
}

export type BibleRequestFailure = 'not-configured' | 'rate-limited' | 'access-denied' | 'other'

export const bibleRequestFailure = (cause: unknown): BibleRequestFailure => {
  if (cause instanceof YouVersionConfigurationError) return 'not-configured'
  // The locked SDK 2.2 reports HTTP failures via Error.status; getHttpStatus is
  // only exported by newer SDKs. Keep classification compatible with both.
  const status = typeof cause === 'object' && cause !== null && 'status' in cause
    ? cause.status
    : undefined
  if (status === 429) return 'rate-limited'
  if (status === 401 || status === 403) return 'access-denied'
  return 'other'
}
