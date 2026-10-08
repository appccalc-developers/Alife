import type { ServerResponse } from 'node:http'

/** Opt-in, one-shot faults for the dev-only shared-motion route; never an HTTP control endpoint. */
export function createVirtualChurchReviewFault(value = '') {
  const mode = value.trim()
  if (mode && mode !== '404-once' && mode !== 'truncate-once') {
    throw new Error('ALIFE_VC_MOTION_REVIEW_FAULT must be empty, 404-once or truncate-once')
  }
  let pending = Boolean(mode)
  return (method: string | undefined, review: string, response: ServerResponse, size: number, prefix: () => Buffer) => {
    if (!pending || method !== 'GET' || review !== 'male-v14-motion') return false
    pending = false
    response.setHeader('Cache-Control', 'no-store, max-age=0')
    response.setHeader('X-Alife-Review-Fault', mode)
    if (mode === '404-once') {
      response.statusCode = 404
      response.removeHeader('Content-Length')
      response.end('Injected one-shot local motion review failure.')
      return true
    }
    // Advertise the complete file but terminate after a genuine prefix. This
    // exercises a failed body download, not a valid HTTP response with bad JSON.
    response.statusCode = 200
    response.setHeader('Content-Length', size)
    response.write(prefix().subarray(0, Math.min(1024, Math.max(0, size - 1))))
    const timer = setTimeout(() => response.destroy(), 30)
    response.once('close', () => clearTimeout(timer))
    return true
  }
}
