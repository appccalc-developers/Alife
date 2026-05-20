import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import worker from '../dist/app_ccalc/index.js'

const ORIGIN = 'https://ccalc.live'

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

  const first = await dispatch('https://ccalc.live/api/pages/home?lang=en')
  await flushWaitUntil()
  const second = await dispatch('https://ccalc.live/api/pages/home?lang=en')

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await second.json(), { title: 'Fresh page' })
  assert.match(first.headers.get('cache-control') ?? '', /s-maxage=86400/)
  assert.equal(fetchCalls.length, 1)
})

test('non-auth cookie churn does not fragment GET cache key', async () => {
  originResponses.push(Response.json({ title: 'Scoped page' }))

  const tokenA = createJwtWithSub('member-1')
  const first = await dispatch('https://ccalc.live/api/pages/home?lang=en', {
    headers: { cookie: `alife_auth=${tokenA}; analytics_id=abc` },
  })
  await flushWaitUntil()

  const tokenB = createJwtWithSub('member-1')
  const second = await dispatch('https://ccalc.live/api/pages/home?lang=en', {
    headers: { cookie: `alife_auth=${tokenB}; analytics_id=xyz` },
  })

  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
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
  const url = 'https://ccalc.live/api/pages/home?lang=en'
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
  const url = 'https://ccalc.live/api/pages/home?lang=en'
  cacheStore.set(cacheKey(new Request(url)), Response.json({ title: 'Stale page' }))
  originResponses.push(Response.json({ message: 'No' }, { status: 400 }))

  const response = await dispatch(url, { method: 'PUT', body: JSON.stringify({ title: 'Rejected' }) })
  await flushWaitUntil()

  assert.equal(response.status, 400)
  assert.equal(cacheStore.has(cacheKey(new Request(url))), true)
  assert.deepEqual(deletedCacheKeys, [])
})

test('GET /images/api/... is proxied to images.ccalc.live', async () => {
  originResponses.push(Response.json({ ok: true }))

  const response = await dispatch('https://ccalc.live/images/api/config?size=small', {
    env: { API_PROXY_TARGET: 'https://api.example.com' },
  })

  assert.equal(response.status, 200)
  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].url, 'https://images.ccalc.live/images/api/config?size=small')
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

  const response = await dispatch('https://ccalc.live/api/events/extract', {
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
  assert.equal(new URL(String(fetchCalls[0])).hostname, 'generativelanguage.googleapis.com')
  assert.equal(fetchInits[0].headers['x-goog-api-key'], 'test-key')
})

test('POST /api/events/extract returns 503 when GEMINI_API_KEY is not set', async () => {
  const response = await dispatch('https://ccalc.live/api/events/extract', {
    method: 'POST',
    body: JSON.stringify({ message: 'Some event' }),
    headers: { 'content-type': 'application/json' },
    env: { API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 503)
  assert.equal(fetchCalls.length, 0)
})

test('POST /api/events/extract returns 400 for empty message', async () => {
  const response = await dispatch('https://ccalc.live/api/events/extract', {
    method: 'POST',
    body: JSON.stringify({ message: '   ' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 400)
  assert.equal(fetchCalls.length, 0)
})

test('POST /api/events/session/:id/message persists event draft state', async () => {
  const sessionId = 'member-1-event-draft'
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            title: { zh: '家庭營', en: 'Family Camp' },
            description: { zh: '兩天一夜', en: 'Two-day retreat' },
            locationName: { zh: '漢密爾頓', en: 'Hamilton' },
            startDate: '2026-07-01T08:00:00Z',
            endDate: '2026-07-02T17:00:00Z',
            registrationDeadline: '2026-06-20T00:00:00Z',
            maxCapacity: 20,
            capacityUnit: 'Families',
            hardConstraints: [],
            optionalActivities: [],
            currency: 'NZD',
            galleryUrls: [],
            legacySummary: { zh: '安排共乘。', en: 'Arrange carpooling.' },
          }),
        }],
      },
    }],
  }))

  const messageResponse = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message: 'Plan a family camp in Hamilton.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })
  const stateResponse = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/state`, {
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(messageResponse.status, 200)
  assert.equal(stateResponse.status, 200)
  const state = await stateResponse.json()
  assert.equal(state.draft.title.en, 'Family Camp')
  assert.equal(state.context.en, 'Arrange carpooling.')
})

test('POST /api/enrollments/session/:id/message returns enrollment draft', async () => {
  const eventId = crypto.randomUUID()
  const sessionId = `member-1-event-${eventId}-enrollment`
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            eventId,
            applicantName: 'Alice',
            consentStatus: 'granted',
            assistantReply: {
              zh: '我已記下你的姓名與同意，請附上付款憑證。',
              en: 'I captured your name and consent. Please attach your payment proof.',
            },
          }),
        }],
      },
    }],
  }))

  const response = await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message: 'My name is Alice and I consent to submit this enrollment.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.applicantName, 'Alice')
  assert.equal(body.result.consentStatus, 'granted')
  assert.equal(body.context.en, 'I captured your name and consent. Please attach your payment proof.')
  assert.equal(fetchCalls.length, 1)
  assert.equal(new URL(String(fetchCalls[0])).hostname, 'generativelanguage.googleapis.com')
})

test('POST /api/enrollments/session/:id/commit uploads files and commits backend enrollment JSON', async () => {
  const eventId = crypto.randomUUID()
  const groupId = crypto.randomUUID()
  const sessionId = `member-1-event-${eventId}-enrollment`
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            eventId,
            applicantName: 'Alice',
            consentStatus: 'granted',
            assistantReply: {
              zh: '請附上付款憑證。',
              en: 'Please attach your payment proof.',
            },
          }),
        }],
      },
    }],
  }))
  originResponses.push(
    Response.json({
      image: { url: `https://images.ccalc.live/enrollments/${eventId}/proof.png` },
    }, { status: 201 }),
  )
  originResponses.push(Response.json({ ok: true }, { status: 200 }))

  await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message: 'My name is Alice and I consent to submit this enrollment.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  const formData = new FormData()
  formData.set('groupId', groupId)
  formData.append('paymentFiles', new File(['dummy'], 'proof.png', { type: 'image/png' }))

  const response = await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/commit`, {
    method: 'POST',
    body: formData,
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.status, 'completed')
  assert.equal(fetchCalls.length, 3)
  assert.equal(new URL(String(fetchCalls[0])).hostname, 'generativelanguage.googleapis.com')
  assert.equal(String(fetchCalls[1]), `https://images.ccalc.live/api/images/enrollments/${eventId}`)
  assert.equal(String(fetchCalls[2]), `https://api.ccalc.live/api/group/${groupId}/enroll`)
  assert.equal(fetchInits[2].method, 'POST')
  assert.deepEqual(JSON.parse(fetchInits[2].body), {
    eventId,
    applicantName: 'Alice',
    consent: true,
    paymentFiles: [{
      fileName: 'proof.png',
      contentType: 'image/png',
      size: 5,
      url: `https://images.ccalc.live/enrollments/${eventId}/proof.png`,
    }],
    submittedAtUtc: JSON.parse(fetchInits[2].body).submittedAtUtc,
  })
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

function createJwtWithSub(sub) {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({ sub, exp: 4700000000 }))
  return `${header}.${payload}.sig`
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
