import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import worker from '../dist/app_ccalc/index.js'

const ORIGIN = 'https://app.ccalc.live'

let fetchCalls
let originResponses
let cacheStore
let deletedCacheKeys
let waitUntilPromises

beforeEach(() => {
  fetchCalls = []
  originResponses = []
  cacheStore = new Map()
  deletedCacheKeys = []
  waitUntilPromises = []

  globalThis.fetch = async (request) => {
    fetchCalls.push(request)
    return originResponses.shift() ?? Response.json({ ok: true })
  }

  globalThis.caches = {
    default: {
      async match(request) {
        return cacheStore.get(cacheKey(request))?.clone()
      },
      async put(request, response) {
        cacheStore.set(cacheKey(request), response.clone())
      },
      async delete(request) {
        deletedCacheKeys.push(cacheKey(request))
        return cacheStore.delete(cacheKey(request))
      },
    },
  }
})

test('GET requests are served from cache on the second hit', async () => {
  originResponses.push(Response.json({ title: 'Fresh page' }))

  const first = await dispatch('https://app.ccalc.live/api/pages/home?lang=en')
  await flushWaitUntil()
  const second = await dispatch('https://app.ccalc.live/api/pages/home?lang=en')

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await second.json(), { title: 'Fresh page' })
  assert.equal(fetchCalls.length, 1)
})

test('matching If-None-Match is answered from edge cache with 304', async () => {
  const url = 'https://app.ccalc.live/api/pages/home?lang=en'
  cacheStore.set(cacheKey(new Request(url)), Response.json(
    { title: 'Fresh page' },
    { headers: { etag: '"638507"', 'cache-control': 'public, max-age=60' } },
  ))

  const response = await dispatch(url, {
    headers: { 'if-none-match': '"638507"' },
  })

  assert.equal(response.status, 304)
  assert.equal(response.headers.get('x-alife-cache'), 'REVALIDATED')
  assert.equal(await response.text(), '')
  assert.equal(fetchCalls.length, 0)
})

test('successful PUT evicts the corresponding GET cache entry', async () => {
  const url = 'https://app.ccalc.live/api/pages/home?lang=en'
  cacheStore.set(cacheKey(new Request(url)), Response.json({ title: 'Stale page' }))
  originResponses.push(Response.json({ title: 'Updated page' }))

  const response = await dispatch(url, { method: 'PUT', body: JSON.stringify({ title: 'Updated page' }) })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(cacheStore.has(cacheKey(new Request(url))), false)
  assert.deepEqual(deletedCacheKeys, [url])
})

test('failed writes do not evict cache', async () => {
  const url = 'https://app.ccalc.live/api/pages/home?lang=en'
  cacheStore.set(cacheKey(new Request(url)), Response.json({ title: 'Stale page' }))
  originResponses.push(Response.json({ message: 'No' }, { status: 400 }))

  const response = await dispatch(url, { method: 'PUT', body: JSON.stringify({ title: 'Rejected' }) })
  await flushWaitUntil()

  assert.equal(response.status, 400)
  assert.equal(cacheStore.has(cacheKey(new Request(url))), true)
  assert.deepEqual(deletedCacheKeys, [])
})

test('OPTIONS preflight returns without reaching origin', async () => {
  const response = await dispatch('https://app.ccalc.live/api/pages/home', { method: 'OPTIONS' })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN)
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  assert.equal(response.headers.get('access-control-max-age'), '86400')
  assert.equal(fetchCalls.length, 0)
})

test('CORS headers are only added for authorized origins', async () => {
  originResponses.push(Response.json([]))
  const allowed = await dispatch('https://app.ccalc.live/api/pages/global?lang=en')

  originResponses.push(Response.json([]))
  const denied = await dispatch('https://app.ccalc.live/api/pages/global?lang=zh', {
    headers: { origin: 'https://evil.example' },
  })

  assert.equal(allowed.headers.get('access-control-allow-origin'), ORIGIN)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})

async function dispatch(url, init = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('origin')) {
    headers.set('origin', ORIGIN)
  }

  const request = new Request(url, { ...init, headers })
  return worker.fetch(request, createEnv(), createCtx())
}

function createEnv() {
  return {
    API_PROXY_TARGET: 'https://api.ccalc.live',
  }
}

function createCtx() {
  return {
    waitUntil(promise) {
      waitUntilPromises.push(promise)
    },
  }
}

async function flushWaitUntil() {
  await Promise.all(waitUntilPromises)
  waitUntilPromises = []
}

function cacheKey(request) {
  const url = new URL(request.url)
  url.hash = ''
  url.searchParams.sort()
  return url.toString()
}
