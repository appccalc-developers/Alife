import extractor from './extractor'
import proxy from './proxy'

export type Env = {
  API_PROXY_TARGET?: string
  /** Gemini API key stored as a Cloudflare Worker secret. */
  GEMINI_API_KEY?: string
}

export type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/events/extract' && request.method === 'POST') {
        return await extractor.fetch(request, env)
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
