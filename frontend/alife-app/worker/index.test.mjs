import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import worker from '../dist/app_ccalc/index.js'
import { EventPlanningSession } from '../dist/app_ccalc/index.js'

const ORIGIN = 'https://ccalc.live'

let fetchCalls
let fetchInits
let originResponses
let cacheStore
let authzStore
let deletedCacheKeys
let waitUntilPromises

beforeEach(() => {
  fetchCalls = []
  fetchInits = []
  originResponses = []
  cacheStore = new Map()
  authzStore = new Map()
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

test('approved group member can read shared group detail cache', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  cacheStore.set(cacheKey(new Request(url)), Response.json({ id: groupId, name: 'Shared group' }))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-alife-cache'), 'HIT')
  assert.equal(response.headers.get('x-alife-authz'), 'hit')
  assert.deepEqual(await response.json(), { id: groupId, name: 'Shared group' })
  assert.equal(fetchCalls.length, 0)
})

test('group detail cache is gated by KV authorization mirror before cache hit', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}`
  cacheStore.set(cacheKey(new Request(url)), Response.json({ id: groupId, name: 'Cached group' }))
  originResponses.push(Response.json({ id: groupId, name: 'Origin group' }))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-alife-cache'), 'MISS')
  assert.equal(response.headers.get('x-alife-authz'), 'miss')
  assert.deepEqual(await response.json(), { id: groupId, name: 'Origin group' })
  assert.equal(fetchCalls.length, 1)
  assert.equal(JSON.parse(authzStore.get(`membership:${groupId}:member-1`)).status, 'approved')
})

test('approved members share group detail edge cache entry', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}`
  authzStore.set(`membership:${groupId}:member-2`, JSON.stringify({ status: 'approved' }))
  originResponses.push(Response.json({ id: groupId, name: 'Origin group' }))

  const first = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()
  const second = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-2')}` },
  })

  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(first.headers.get('x-alife-authz'), 'miss')
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.equal(second.headers.get('x-alife-authz'), 'hit')
  assert.deepEqual(await second.json(), { id: groupId, name: 'Origin group' })
  assert.equal(fetchCalls.length, 1)
})

test('GET requests are served from cache on the second hit', async () => {
  originResponses.push(Response.json({ title: 'Fresh page' }))

  const first = await dispatch('https://ccalc.live/api/pages/global?lang=en')
  await flushWaitUntil()
  const second = await dispatch('https://ccalc.live/api/pages/global?lang=en')

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await second.json(), { title: 'Fresh page' })
  assert.match(first.headers.get('cache-control') ?? '', /s-maxage=86400/)
  assert.equal(fetchCalls.length, 1)
})

test('non-auth cookie churn does not fragment GET cache key', async () => {
  originResponses.push(Response.json([{ title: 'Public sermon' }]))

  const tokenA = createJwtWithSub('member-1')
  const first = await dispatch('https://ccalc.live/api/sermons?lang=en', {
    headers: { cookie: `alife_auth=${tokenA}; analytics_id=abc` },
  })
  await flushWaitUntil()

  const tokenB = createJwtWithSub('member-1')
  const second = await dispatch('https://ccalc.live/api/sermons?lang=en', {
    headers: { cookie: `alife_auth=${tokenB}; analytics_id=xyz` },
  })

  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.equal(fetchCalls.length, 1)
})

test('matching If-None-Match is answered from edge cache with 304', async () => {
  const url = 'https://app.ccalc.live/api/sermons?lang=en'
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

test('GET /api/me bypasses edge cache', async () => {
  originResponses.push(Response.json({ memberId: 'member-1' }))
  originResponses.push(Response.json({ memberId: 'member-2' }))

  const first = await dispatch('https://ccalc.live/api/me')
  await flushWaitUntil()
  const second = await dispatch('https://ccalc.live/api/me')
  await flushWaitUntil()

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'BYPASS')
  assert.deepEqual(await first.json(), { memberId: 'member-1' })
  assert.deepEqual(await second.json(), { memberId: 'member-2' })
  assert.equal(fetchCalls.length, 2)
  assert.equal(cacheStore.size, 0)
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
  assert.equal(deletedCacheKeys.includes(url), true)
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

test('successful POST to group pages evicts the group pages list cache', async () => {
  const groupId = 'group-1'
  const listUrl = `https://ccalc.live/api/groups/${groupId}/pages`
  cacheStore.set(cacheKey(new Request(listUrl)), Response.json([{ id: 'page-1', ownerGroupId: groupId }]))
  originResponses.push(Response.json({ id: 'page-2', ownerGroupId: groupId }))

  const response = await dispatch(listUrl, { method: 'POST', body: JSON.stringify({ title: 'New page' }) })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(cacheStore.has(cacheKey(new Request(listUrl))), false)
})

test('successful member action evicts only that group membership list cache', async () => {
  const groupId = 'group-1'
  const otherGroupId = 'group-2'
  const listUrl = `https://ccalc.live/api/groups/${groupId}/memberships`
  const otherListUrl = `https://ccalc.live/api/groups/${otherGroupId}/memberships`
  cacheStore.set(cacheKey(new Request(listUrl)), Response.json([{ memberId: 'member-1' }]))
  cacheStore.set(cacheKey(new Request(otherListUrl)), Response.json([{ memberId: 'member-2' }]))
  originResponses.push(Response.json({ ok: true }))

  const response = await dispatch(`https://ccalc.live/api/groups/${groupId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ memberId: 'member-1' }),
  })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(cacheStore.has(cacheKey(new Request(listUrl))), false)
  assert.equal(cacheStore.has(cacheKey(new Request(otherListUrl))), true)
})

test('successful event update evicts the group events list cache', async () => {
  const groupId = 'group-1'
  const eventId = 'event-1'
  const listUrl = `https://ccalc.live/api/groups/${groupId}/events`
  cacheStore.set(cacheKey(new Request(listUrl)), Response.json([{ id: eventId, groupId }]))
  originResponses.push(Response.json({ id: eventId, groupId, titleEn: 'Updated' }))

  const response = await dispatch(`https://ccalc.live/api/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify({ titleEn: 'Updated' }),
  })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(cacheStore.has(cacheKey(new Request(listUrl))), false)
})

test('private group event reads bypass edge cache', async () => {
  const groupId = 'group-1'
  const listUrl = `https://ccalc.live/api/groups/${groupId}/events`
  originResponses.push(Response.json([{ id: 'event-1', groupId }]))

  const first = await dispatch(listUrl)
  await flushWaitUntil()
  assert.equal(first.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.equal(cacheStore.has(cacheKey(new Request(listUrl))), false)

  originResponses.push(Response.json([{ id: 'event-2', groupId }]))
  const second = await dispatch(listUrl)
  await flushWaitUntil()

  assert.equal(second.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(fetchCalls.length, 2)
})

test('GET /images/... is proxied to images.ccalc.live without the /images prefix', async () => {
  originResponses.push(Response.json({ ok: true }))

  const response = await dispatch('https://ccalc.live/images/api/config?size=small', {
    env: { API_PROXY_TARGET: 'https://api.example.com' },
  })

  assert.equal(response.status, 200)
  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].url, 'https://images.ccalc.live/api/config?size=small')
})

test('GET /images object paths are proxied to images.ccalc.live object paths', async () => {
  originResponses.push(new Response('image-bytes', { status: 200 }))

  const response = await dispatch('https://ccalc.live/images/folder/hero.png')

  assert.equal(response.status, 200)
  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].url, 'https://images.ccalc.live/folder/hero.png')
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

test('POST /api/events/session/:id/message forwards known app context to Gemini', async () => {
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
            legacySummary: { zh: '已使用小組資料。', en: 'Used group context.' },
          }),
        }],
      },
    }],
  }))

  const appContextParams = new URLSearchParams({
    language: 'en',
    userId: 'user-1',
    userProfile: JSON.stringify({ displayName: 'Alice' }),
    groupId: 'group-1',
    groupProfile: JSON.stringify({ name: 'West Auckland Families' }),
  })
  const response = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/message?${appContextParams}`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Plan a family camp.',
    }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 200)
  const geminiBody = JSON.parse(fetchInits[0].body)
  const prompt = JSON.parse(geminiBody.contents[0].parts[0].text)
  assert.equal(prompt.appContext.userId, 'user-1')
  assert.equal(prompt.appContext.groupId, 'group-1')
  assert.equal(prompt.knownContextPolicy.includes('do not ask'), true)
})

test('POST /api/events/session/:id/message sends uploaded image as Gemini inline data', async () => {
  const sessionId = 'member-1-event-draft'
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            title: { zh: '海報活動', en: 'Poster Event' },
            description: { zh: '從海報讀取', en: 'Read from poster' },
            locationName: { zh: '教會', en: 'Church' },
            startDate: '2026-08-01T08:00:00Z',
            endDate: '2026-08-01T17:00:00Z',
            registrationDeadline: '2026-07-20T00:00:00Z',
            maxCapacity: 50,
            capacityUnit: 'People',
            hardConstraints: [],
            optionalActivities: [],
            currency: 'NZD',
            galleryUrls: [],
            legacySummary: { zh: '已讀取圖片。', en: 'Read the image.' },
          }),
        }],
      },
    }],
  }))

  const formData = new FormData()
  formData.set('message', 'Read this poster.')
  formData.append('attachments', new File(['fake-image'], 'poster.png', { type: 'image/png' }))

  const response = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/message`, {
    method: 'POST',
    body: formData,
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://ccalc.live' },
  })

  assert.equal(response.status, 200)
  const geminiBody = JSON.parse(fetchInits[0].body)
  assert.equal(geminiBody.contents[0].parts[1].inline_data.mime_type, 'image/png')
  assert.equal(typeof geminiBody.contents[0].parts[1].inline_data.data, 'string')
  const prompt = JSON.parse(geminiBody.contents[0].parts[0].text)
  assert.equal(prompt.attachments[0].name, 'poster.png')
})

test('POST /api/events/session/:id/message repairs legacy malformed attachment state', async () => {
  const durableState = createDurableState({
    'event-session-state': {
      sessionId: 'legacy-session',
      draft: null,
      context: null,
      appContext: {},
      attachments: {
        name: 'legacy-proof.png',
      },
      chatHistory: [],
      updatedAt: '2026-05-22T00:00:00.000Z',
    },
  })
  const session = new EventPlanningSession(durableState, {
    GEMINI_API_KEY: 'test-key',
    API_PROXY_TARGET: 'https://ccalc.live',
  })

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
            legacySummary: null,
          }),
        }],
      },
    }],
  }))

  const response = await session.fetch(new Request('https://ccalc.live/api/events/session/legacy-session/message', {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message: 'Plan a family camp in Hamilton.' }),
  }))

  assert.equal(response.status, 200)
  const storedState = await durableState.storage.get('event-session-state')
  assert.deepEqual(storedState.attachments, [])
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

  const appContextParams = new URLSearchParams({
    memberId: 'member-1',
    groupId: 'group-1',
    userProfile: JSON.stringify({ displayName: 'Alice C', name: 'Alice' }),
    eventData: JSON.stringify({ id: eventId, titleEn: 'Family Camp' }),
  })
  const response = await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/message?${appContextParams}`, {
    method: 'POST',
    body: JSON.stringify({ message: 'My name is Alice and I consent to submit this enrollment.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.applicantName, 'Alice')
  assert.equal(body.result.groupId, 'group-1')
  assert.equal(body.result.memberId, 'member-1')
  assert.equal(body.result.applicantDisplayName, 'Alice C')
  assert.equal(body.result.consentStatus, 'granted')
  assert.equal(body.context.en, 'I captured your name and consent. Please attach your payment proof.')
  assert.equal(fetchCalls.length, 1)
  assert.equal(new URL(String(fetchCalls[0])).hostname, 'generativelanguage.googleapis.com')
  const geminiBody = JSON.parse(fetchInits[0].body)
  const prompt = JSON.parse(geminiBody.contents[0].parts[0].text)
  assert.equal(prompt.appContext.eventData.titleEn, 'Family Camp')
})

test('POST /api/enrollments/session/:id/message uses provided eventId when AI omits it', async () => {
  const eventId = crypto.randomUUID()
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            applicantName: 'Alice',
            consentStatus: 'unknown',
            assistantReply: {
              zh: '我已記下你的姓名，請確認是否同意提交報名。',
              en: 'I captured your name. Please confirm whether you consent to submit the enrollment.',
            },
          }),
        }],
      },
    }],
  }))

  const response = await dispatch(`https://ccalc.live/api/enrollments/session/manual-enrollment/message?eventId=${encodeURIComponent(eventId)}&groupId=group-1`, {
    method: 'POST',
    body: JSON.stringify({ message: 'My name is Alice.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.eventId, eventId)
  assert.equal(body.result.groupId, 'group-1')
})

test('POST /api/enrollments/session/:id/message preserves non-uuid eventId from session id', async () => {
  const eventId = 'spring-retreat-2026'
  const sessionId = `member-1-event-${eventId}-enrollment`
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            applicantName: 'Alice',
            consentStatus: 'unknown',
            assistantReply: {
              zh: '我已記下你的姓名，請確認是否同意提交報名。',
              en: 'I captured your name. Please confirm whether you consent to submit the enrollment.',
            },
          }),
        }],
      },
    }],
  }))

  const response = await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message: 'My name is Alice.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.eventId, eventId)
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
  assert.equal(String(fetchCalls[2]), `https://api.ccalc.live/api/events/${eventId}/enrollments`)
  assert.equal(fetchInits[2].method, 'POST')
  assert.deepEqual(JSON.parse(fetchInits[2].body), {
    eventId,
    groupId,
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

  const stateResponse = await dispatch(`https://ccalc.live/api/enrollments/session/${sessionId}/state`, {
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })
  const state = await stateResponse.json()
  assert.equal(state.draft.applicantName, '')
  assert.equal(state.draft.consentStatus, 'unknown')
  assert.deepEqual(state.chatHistory, [])
})

test('POST /api/events/session/:id/close clears event session state', async () => {
  const sessionId = 'member-1-event-close-test'
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            title: { zh: 'ç‡Ÿæœƒ', en: 'Camp' },
            description: { zh: 'é€±æœ«ç‡Ÿæœƒ', en: 'Weekend camp' },
            locationName: { zh: 'å¥§å…‹è˜­', en: 'Auckland' },
            startDate: '2026-06-01T09:00:00.000Z',
            endDate: '2026-06-01T17:00:00.000Z',
            registrationDeadline: '2026-05-30T17:00:00.000Z',
            maxCapacity: 20,
            capacityUnit: 'People',
            hardConstraints: [],
            optionalActivities: [],
            currency: 'NZD',
            galleryUrls: [],
            legacySummary: { zh: 'è‰ç¨¿å·²å»ºç«‹ã€‚', en: 'Draft created.' },
          }),
        }],
      },
    }],
  }))

  await dispatch(`https://ccalc.live/api/events/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message: 'Create a camp.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key' },
  })

  const closeResponse = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/close`, {
    method: 'POST',
    env: { GEMINI_API_KEY: 'test-key' },
  })
  assert.equal(closeResponse.status, 200)
  assert.equal((await closeResponse.json()).status, 'closed')

  const stateResponse = await dispatch(`https://ccalc.live/api/events/session/${sessionId}/state`, {
    env: { GEMINI_API_KEY: 'test-key' },
  })
  const state = await stateResponse.json()
  assert.equal(state.draft.title.en, '')
  assert.deepEqual(state.chatHistory, [])
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
    ALIFE_AUTHZ: {
      async get(key, options) {
        const value = authzStore.get(key)
        if (value === undefined) {
          return null
        }

        return options?.type === 'json' ? JSON.parse(value) : value
      },
      async put(key, value) {
        authzStore.set(key, value)
      },
      async delete(key) {
        authzStore.delete(key)
      },
    },
  }
}

function createDurableState(initialState = {}) {
  const storage = new Map(Object.entries(initialState))

  return {
    storage: {
      async get(key) {
        return storage.get(key)
      },
      async put(key, value) {
        storage.set(key, value)
      },
    },
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
