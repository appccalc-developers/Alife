import type { Env, ExecutionContext } from '../index'
import { addCorsHeaders } from './apiCache'
import { shouldBypassEdgeCache } from './authCache'

const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'
const DEFAULT_IMAGES_API_PROXY_TARGET = 'https://images.ccalc.live'
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, If-None-Match'
const PREFLIGHT_MAX_AGE_SECONDS = '86400'

export const proxyHandler = {
  async handle(request: any, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle priority route /proxy/* rewrite if matched
    if (url.pathname.startsWith('/proxy/')) {
      const remaining = url.pathname.slice('/proxy'.length) || '/'
      url.pathname = remaining
    }

    if (!isProxyPath(url.pathname)) {
      return addCorsHeaders(request, new Response('Not found', { status: 404 }))
    }

    if (request.method === 'OPTIONS') {
      return handleOptions(request)
    }

    const bypassEdgeCache = request.bypassEdgeCache ?? shouldBypassEdgeCache(url.pathname, request.sharedContext)

    const originRequest = createOriginRequest(request, env, {
      stripConditionalHeaders: request.method === 'GET' && !bypassEdgeCache,
    })
    console.log('Proxying request to origin:', originRequest.url)

    const originResponse = await fetch(originRequest)
    return originResponse
  }
}

function handleOptions(request: Request) {
  return addCorsHeaders(
    request,
    new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': ALLOWED_METHODS,
        'access-control-allow-headers': ALLOWED_HEADERS,
        'access-control-max-age': PREFLIGHT_MAX_AGE_SECONDS,
      },
    }),
  )
}

function createOriginRequest(
  request: Request,
  env: Env,
  options?: { stripConditionalHeaders?: boolean },
) {
  const incomingUrl = new URL(request.url)

  // Handle priority route /proxy/* rewrite if matched
  if (incomingUrl.pathname.startsWith('/proxy/')) {
    incomingUrl.pathname = incomingUrl.pathname.slice('/proxy'.length) || '/'
  }

  const targetBase = new URL(getProxyTargetForPath(incomingUrl.pathname, env).replace(/\/$/, ''))
  const targetPath = getProxyTargetPath(incomingUrl.pathname)
  const targetUrl = new URL(targetPath + incomingUrl.search, targetBase)
  const headers = new Headers(request.headers)

  if (options?.stripConditionalHeaders) {
    headers.delete('if-none-match')
    headers.delete('if-modified-since')
  }

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.body) {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(targetUrl, init)
}

function isProxyPath(pathname: string) {
  return pathname.startsWith('/api/') || pathname === '/images' || pathname.startsWith('/images/')
}

function getProxyTargetForPath(pathname: string, env: Env) {
  if (pathname === '/images' || pathname.startsWith('/images/')) {
    return DEFAULT_IMAGES_API_PROXY_TARGET
  }

  return env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET
}

function getProxyTargetPath(pathname: string) {
  if (pathname === '/images') {
    return '/'
  }

  if (pathname.startsWith('/images/')) {
    return pathname.slice('/images'.length) || '/'
  }

  return pathname
}
