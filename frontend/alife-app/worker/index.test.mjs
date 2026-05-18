import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import worker from '../dist/app_ccalc/index.js'

const ORIGIN = 'https://app.ccalc.live'

let fetchCalls
let fetchInits
let originResponses
let cacheStore
let deletedCacheKeys
let waitUntilPromises

beforeEach(() => {
  fetchCalls = []
  fetchInits = []
  originResponses = []
  cacheStore = new Map()
  deletedCacheKeys = []
  waitUntilPromises = []

  globalThis.fetch = async (request, init) => {
    fetchCalls.push(request)
    fetchInits.push(init)
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

test('POST /api/events/extract calls Gemini at the edge and returns EventDto', async () => {
  const eventDto = {
    id: '',
    organizerId: '',
    title: { zh: '西海岸之旅', en: 'West Coast Trip' },
    description: { zh: '家庭出游', en: 'A family outing' },
    locationName: { zh: '西海岸', en: 'West Coast' },
    startDate: '2026-12-01T08:00:00Z',
    endDate: '2026-12-03T18:00:00Z',
    registrationDeadline: '2026-11-20T00:00:00Z',
    maxCapacity: 15,
    capacityUnit: 'Families',
    hardConstraints: [
      { ruleKey: 'Transport', displayMessage: { zh: '必须乘坐包车', en: 'Must take the chartered bus' }, isMandatory: true },
    ],
    optionalActivities: [{ id: '', name: { zh: '皮划艇', en: 'Kayaking' }, extraFee: 30 }],
    baseFeePerAdult: 150,
    baseFeePerChild: 80,
    currency: 'NZD',
    posterImageUrl: null,
    galleryUrls: [],
    legacySummary: null,
  }

  // Gemini API response
  originResponses.push(
    Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(eventDto) }] } }],
    }),
  )

  const response = await dispatch('https://app.ccalc.live/api/events/extract', {
    method: 'POST',
    body: JSON.stringify({ message: 'West Coast trip 15 families Dec 1-3. Must take bus. Kayaking $30. $150/adult $80/child.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.title.en, 'West Coast Trip')
  assert.equal(body.result.hardConstraints.length, 1)
  assert.equal(body.result.hardConstraints[0].ruleKey, 'Transport')
  // Must NOT have been proxied to origin
  assert.equal(fetchCalls.length, 1)
  assert.ok(String(fetchCalls[0]).includes('generativelanguage.googleapis.com'))
  assert.equal(fetchInits[0].headers['x-goog-api-key'], 'test-key')
})

test('POST /api/events/extract returns 503 when GEMINI_API_KEY is not set', async () => {
  const response = await dispatch('https://app.ccalc.live/api/events/extract', {
    method: 'POST',
    body: JSON.stringify({ message: 'Some event' }),
    headers: { 'content-type': 'application/json' },
    env: { API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 503)
  assert.equal(fetchCalls.length, 0)
})

test('POST /api/events/extract returns 400 for empty message', async () => {
  const response = await dispatch('https://app.ccalc.live/api/events/extract', {
    method: 'POST',
    body: JSON.stringify({ message: '   ' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 400)
  assert.equal(fetchCalls.length, 0)
})

async function dispatch(url, init = {}) {
  const { env: envOverride, ...requestInit } = init
  const headers = new Headers(requestInit.headers)
  if (!headers.has('origin')) {
    headers.set('origin', ORIGIN)
  }

  const request = new Request(url, { ...requestInit, headers })
  return worker.fetch(request, envOverride ?? createEnv(), createCtx())
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
