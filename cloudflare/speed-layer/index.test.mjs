import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import worker from './dist/app_ccalc/index.js'
import { EventPlanningSession } from './dist/app_ccalc/index.js'

const ORIGIN = 'https://ccalc.live'

let fetchCalls
let fetchInits
let originResponses
let cacheStore
let authzStore
let authzRawStore
let apiCacheStore
let apiCacheRawStore
let apiCacheGetKeys
let apiCachePutOptions
let storedResponseBodyReadCallbacks
let deletedCacheKeys
let waitUntilPromises

beforeEach(() => {
  fetchCalls = []
  fetchInits = []
  originResponses = []
  cacheStore = new Map()
  authzRawStore = new Map()
  authzStore = createLogicalRecordStore(authzRawStore)
  apiCacheRawStore = new Map()
  apiCacheStore = createApiCacheStore(apiCacheRawStore)
  apiCacheGetKeys = []
  apiCachePutOptions = new Map()
  storedResponseBodyReadCallbacks = new Map()
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
        const storedResponseKey = readStoredResponseCacheKey(request)
        if (storedResponseKey) {
          apiCacheGetKeys.push(storedResponseKey)
        }

        const response = cacheStore.get(cacheKey(request))?.clone()
        const bodyReadCallback = storedResponseBodyReadCallbacks.get(storedResponseKey)
        if (response && bodyReadCallback) {
          instrumentBodyReaders(response, bodyReadCallback)
        }

        return response
      },
      async put(request, response) {
        const storedResponseKey = readStoredResponseCacheKey(request)
        if (storedResponseKey) {
          apiCacheRawStore.set(storedResponseKey, await serializeStoredResponse(response.clone()))
          apiCachePutOptions.set(storedResponseKey, readCachePutOptions(response))
        }

        const logicalKey = readLogicalCacheKey(request)
        if (logicalKey) {
          const body = await response.clone().text()
          if (isAuthzKey(logicalKey)) {
            authzRawStore.set(logicalKey, body)
          }

          if (isLogicalApiCacheKey(logicalKey)) {
            apiCacheRawStore.set(logicalKey, body)
            apiCachePutOptions.set(logicalKey, readCachePutOptions(response))
          }
        }

        cacheStore.set(cacheKey(request), response.clone())
      },
      async delete(request) {
        const storedResponseKey = readStoredResponseCacheKey(request)
        if (storedResponseKey) {
          apiCacheRawStore.delete(storedResponseKey)
        }

        const logicalKey = readLogicalCacheKey(request)
        if (logicalKey) {
          if (isAuthzKey(logicalKey)) {
            authzRawStore.delete(logicalKey)
          }

          if (isLogicalApiCacheKey(logicalKey)) {
            apiCacheRawStore.delete(logicalKey)
          }
        }

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
  apiCacheStore.set(createApiCacheKey(url), createStoredResponse({ id: groupId, name: 'Shared group' }))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-alife-cache'), 'HIT')
  assert.equal(response.headers.get('x-alife-authz'), 'hit')
  assert.deepEqual(await response.json(), { id: groupId, name: 'Shared group' })
  assert.equal(fetchCalls.length, 0)
})

test('group detail cache is gated by Cache API authorization mirror before cache hit', async () => {
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
  assert.equal(apiCachePutOptions.get(createApiCacheKey(url)).expirationTtl, 86400)
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

test('approved group member reads shared group pages and memberships from Cache API', async () => {
  const groupId = 'group-1'
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  apiCacheStore.set(
    `group:${groupId}:pages`,
    createStoredResponse([{ id: 'page-1', ownerGroupId: groupId, visibility: 'draft' }]),
  )
  apiCacheStore.set(
    `group:${groupId}:members`,
    createStoredResponse([{ memberId: 'member-1', status: 'approved' }]),
  )

  const headers = { cookie: `alife_auth=${createJwtWithSub('member-1')}` }
  const pages = await dispatch(`https://ccalc.live/api/groups/${groupId}/pages`, { headers })
  const memberships = await dispatch(`https://ccalc.live/api/groups/${groupId}/memberships`, { headers })

  assert.equal(pages.headers.get('x-alife-cache'), 'HIT')
  assert.equal(memberships.headers.get('x-alife-cache'), 'HIT')
  assert.equal(fetchCalls.length, 0)
})

test('approved group member reads shared group subgroups from Cache API', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}/subgroups`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  apiCacheStore.set(`group:${groupId}:subgroups`, createStoredResponse([{ id: 'child-1', parentGroupId: groupId }]))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await response.json(), [{ id: 'child-1', parentGroupId: groupId }])
  assert.equal(fetchCalls.length, 0)
})

test('approved group member reads non-draft page detail from shared Cache API', async () => {
  const groupId = 'group-1'
  const pageId = 'page-1'
  const url = `https://ccalc.live/api/pages/${pageId}`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved', role: 'Member' }))
  apiCacheStore.set(`map:page:${pageId}:meta`, JSON.stringify({
    groupId,
    visibility: 'Published',
    createdByMemberId: 'member-2',
  }))
  apiCacheStore.set(createApiCacheKey(url), createStoredResponse({
    id: pageId,
    ownerGroupId: groupId,
    visibility: 'Published',
    sections: [{ id: 'section-1' }],
  }))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await response.json(), {
    id: pageId,
    ownerGroupId: groupId,
    visibility: 'Published',
    sections: [{ id: 'section-1' }],
  })
  assert.equal(fetchCalls.length, 0)
  assert.deepEqual(apiCacheGetKeys, [createApiCacheKey(url)])
})

test('matching If-None-Match for page detail reuses preloaded shared cache with 304', async () => {
  const groupId = 'group-1'
  const pageId = 'page-1'
  const url = `https://ccalc.live/api/pages/${pageId}`
  let cachedBodyReads = 0
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved', role: 'Member' }))
  apiCacheStore.set(`map:page:${pageId}:meta`, JSON.stringify({
    groupId,
    visibility: 'Published',
    createdByMemberId: 'member-2',
  }))
  seedNativeStoredResponse(
    createApiCacheKey(url),
    Response.json({ id: pageId, ownerGroupId: groupId, visibility: 'Published', sections: [{ id: 'section-1' }] }, {
      headers: {
        etag: '"page-detail-v1"',
        'cache-control': 'public, max-age=86400',
      },
    }),
    () => { cachedBodyReads += 1 },
  )

  const response = await dispatch(url, {
    headers: {
      cookie: `alife_auth=${createJwtWithSub('member-1')}`,
      'if-none-match': '"page-detail-v1"',
    },
  })

  assert.equal(response.status, 304)
  assert.equal(response.headers.get('x-alife-cache'), 'REVALIDATED')
  assert.equal(await response.text(), '')
  assert.equal(fetchCalls.length, 0)
  assert.deepEqual(apiCacheGetKeys, [createApiCacheKey(url)])
  assert.equal(cachedBodyReads, 0)
})

test('draft page detail shared cache is available to leader and author only', async () => {
  const groupId = 'group-1'
  const pageId = 'page-1'
  const url = `https://ccalc.live/api/pages/${pageId}`
  apiCacheStore.set(`map:page:${pageId}:meta`, JSON.stringify({
    groupId,
    visibility: 'Draft',
    createdByMemberId: 'author-1',
  }))
  apiCacheStore.set(createApiCacheKey(url), createStoredResponse({ id: pageId, ownerGroupId: groupId, sections: [{ id: 'draft-section' }] }))
  authzStore.set(`membership:${groupId}:leader-1`, JSON.stringify({ status: 'approved', role: 'CoLeader' }))
  authzStore.set(`membership:${groupId}:author-1`, JSON.stringify({ status: 'approved', role: 'Member' }))

  const leader = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('leader-1')}` },
  })
  const author = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('author-1')}` },
  })

  assert.equal(leader.headers.get('x-alife-cache'), 'HIT')
  assert.equal(author.headers.get('x-alife-cache'), 'HIT')
  assert.equal(fetchCalls.length, 0)
})

test('draft page detail shared cache is bypassed for approved non-author members', async () => {
  const groupId = 'group-1'
  const pageId = 'page-1'
  const url = `https://ccalc.live/api/pages/${pageId}`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved', role: 'Member' }))
  apiCacheStore.set(`map:page:${pageId}:meta`, JSON.stringify({
    groupId,
    visibility: 'Draft',
    createdByMemberId: 'author-1',
  }))
  apiCacheStore.set(createApiCacheKey(url), createStoredResponse({ id: pageId, ownerGroupId: groupId, sections: [{ id: 'secret' }] }))
  originResponses.push(Response.json({ message: 'Forbidden' }, { status: 403 }))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(fetchCalls.length, 1)
})

test('page detail missing metadata falls back to origin and records metadata and content cache', async () => {
  const groupId = 'group-1'
  const pageId = 'page-1'
  const url = `https://ccalc.live/api/pages/${pageId}`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved', role: 'Member' }))
  originResponses.push(Response.json({
    id: pageId,
    ownerGroupId: groupId,
    visibility: 'Published',
    createdByMemberId: 'member-2',
    sections: [{ id: 'section-1' }],
  }))

  const first = await dispatch(url, {
    headers: {
      cookie: `alife_auth=${createJwtWithSub('member-1')}`,
      'if-none-match': 'W/"stale-browser-etag"',
    },
  })
  await flushWaitUntil()
  const second = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(first.headers.get('x-alife-cache'), 'BYPASS')
  assert.deepEqual(JSON.parse(apiCacheStore.get(`map:page:${pageId}:meta`)), {
    groupId,
    ownerGroupId: groupId,
    visibility: 'Published',
    createdByMemberId: 'member-2',
  })
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.equal(fetchCalls.length, 1)
  assert.equal(fetchCalls[0].headers.get('if-none-match'), null)
})

test('missing membership returns 403 before shared group cache is read', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}/pages`
  apiCacheStore.set(`group:${groupId}:pages`, createStoredResponse([{ id: 'page-1', ownerGroupId: groupId }]))

  const response = await dispatch(url)

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(response.headers.get('x-alife-authz'), 'no-principal')
  assert.deepEqual(await response.json(), { message: 'Forbidden' })
  assert.equal(fetchCalls.length, 0)
  assert.equal(apiCacheGetKeys.includes(`group:${groupId}:pages`), false)
})

test('non-approved membership returns 403 before shared group cache is read', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}/events`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'pending' }))
  apiCacheStore.set(`group:${groupId}:events`, createStoredResponse([{ id: 'event-1', groupId }]))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.status, 403)
  assert.equal(response.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(response.headers.get('x-alife-authz'), 'miss')
  assert.equal(fetchCalls.length, 0)
  assert.equal(apiCacheGetKeys.includes(`group:${groupId}:events`), false)
})

test('event enrollments cache is gated by event group mapping and membership mirror', async () => {
  const groupId = 'group-1'
  const eventId = 'event-1'
  const url = `https://ccalc.live/api/events/${eventId}/enrollments`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  apiCacheStore.set(`map:event:${eventId}:group`, JSON.stringify({ groupId }))
  apiCacheStore.set(createApiCacheKey(url), createStoredResponse([{ id: 'enrollment-1', groupId, eventId }]))

  const response = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(response.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await response.json(), [{ id: 'enrollment-1', groupId, eventId }])
  assert.equal(fetchCalls.length, 0)
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
  assert.equal(first.headers.get('cache-control'), 'private, no-cache')
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

test('GET /api/sermons generates ETag on MISS and returns 304 on matching If-None-Match', async () => {
  const url = 'https://ccalc.live/api/sermons?lang=en'
  originResponses.push(Response.json([{ title: 'Sunday Sermon' }]))

  const first = await dispatch(url)
  await flushWaitUntil()

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  const etag = first.headers.get('etag')
  assert.ok(etag, 'MISS response should include an ETag')

  const second = await dispatch(url, {
    headers: { 'if-none-match': etag },
  })

  assert.equal(second.status, 304)
  assert.equal(second.headers.get('x-alife-cache'), 'REVALIDATED')
  assert.equal(await second.text(), '')
  assert.equal(fetchCalls.length, 1)
})

test('GET /api/me caches by member uid and mirrors profile authorization', async () => {
  originResponses.push(Response.json({
    id: 'member-1',
    displayName: 'Alice',
    language: 'en',
    isGuest: false,
    isRegistered: true,
    isAdmin: false,
    memberships: [{ groupId: 'group-1', status: 'approved', role: 'CoLeader' }],
  }))

  const headers = { cookie: `alife_auth=${createJwtWithSub('member-1')}` }
  const first = await dispatch('https://ccalc.live/api/me', { headers })
  await flushWaitUntil()
  authzStore.delete('member:member-1:profile')
  authzStore.delete('membership:group-1:member-1')
  const second = await dispatch('https://ccalc.live/api/me', { headers })
  await flushWaitUntil()

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(first.headers.get('cache-control'), 'private, no-cache')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.deepEqual(await second.json(), {
    id: 'member-1',
    displayName: 'Alice',
    language: 'en',
    isGuest: false,
    isRegistered: true,
    isAdmin: false,
    memberships: [{ groupId: 'group-1', status: 'approved', role: 'CoLeader' }],
  })
  assert.equal(fetchCalls.length, 1)
  assert.equal(apiCacheStore.has('member:member-1:me'), true)
  assert.equal(apiCachePutOptions.get('member:member-1:me').expirationTtl, 86400)

  const profileAuthz = JSON.parse(authzStore.get('member:member-1:profile'))
  assert.equal(profileAuthz.cacheKey, 'member:member-1:me')
  assert.equal(profileAuthz.language, 'en')
  assert.deepEqual(profileAuthz.memberships, [{ groupId: 'group-1', status: 'approved', role: 'CoLeader' }])
  assert.deepEqual(JSON.parse(authzStore.get('membership:group-1:member-1')), {
    status: 'approved',
    role: 'CoLeader',
    source: 'api-me',
    updatedUtc: JSON.parse(authzStore.get('membership:group-1:member-1')).updatedUtc,
  })
})

test('GET /api/me does not share the URL cache across members', async () => {
  originResponses.push(Response.json({ id: 'member-1', memberships: [] }))
  originResponses.push(Response.json({ id: 'member-2', memberships: [] }))

  const first = await dispatch('https://ccalc.live/api/me', {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()
  const second = await dispatch('https://ccalc.live/api/me', {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-2')}` },
  })
  await flushWaitUntil()

  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.headers.get('x-alife-cache'), 'MISS')
  assert.deepEqual(await first.json(), { id: 'member-1', memberships: [] })
  assert.deepEqual(await second.json(), { id: 'member-2', memberships: [] })
  assert.equal(apiCacheStore.has('member:member-1:me'), true)
  assert.equal(apiCacheStore.has('member:member-2:me'), true)
  assert.equal(apiCacheStore.has('api:/api/me'), false)
  assert.equal(fetchCalls.length, 2)
})

test('unauthenticated GET /api/me bypasses edge cache', async () => {
  originResponses.push(Response.json({ id: '00000000-0000-0000-0000-000000000000', isGuest: true }))
  originResponses.push(Response.json({ id: '00000000-0000-0000-0000-000000000000', isGuest: true }))

  const first = await dispatch('https://ccalc.live/api/me')
  await flushWaitUntil()
  const second = await dispatch('https://ccalc.live/api/me')
  await flushWaitUntil()

  assert.equal(first.status, 200)
  assert.equal(first.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(fetchCalls.length, 2)
  assert.equal(apiCacheStore.size, 0)
})

test('successful profile update evicts member-scoped /api/me cache and authz profile mirror', async () => {
  apiCacheStore.set('member:member-1:me', createStoredResponse({ id: 'member-1', language: 'zh' }))
  authzStore.set('member:member-1:profile', JSON.stringify({ status: 'cached', memberId: 'member-1' }))
  originResponses.push(Response.json({ ok: true, language: 'en' }))

  const response = await dispatch('https://ccalc.live/api/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ language: 'en' }),
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-alife-cache'), 'BYPASS')
  assert.equal(apiCacheStore.has('member:member-1:me'), false)
  assert.equal(authzStore.has('member:member-1:profile'), false)
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
  apiCacheStore.set('member:member-1:me', createStoredResponse({ id: 'member-1' }))
  authzStore.set('member:member-1:profile', JSON.stringify({ status: 'cached', memberId: 'member-1' }))
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  originResponses.push(Response.json({ ok: true }))

  const response = await dispatch(`https://ccalc.live/api/groups/${groupId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ memberId: 'member-1' }),
    headers: { 'content-type': 'application/json' },
  })
  await flushWaitUntil()

  assert.equal(response.status, 200)
  assert.equal(cacheStore.has(cacheKey(new Request(listUrl))), false)
  assert.equal(cacheStore.has(cacheKey(new Request(otherListUrl))), true)
  assert.equal(apiCacheStore.has('member:member-1:me'), false)
  assert.equal(authzStore.has('member:member-1:profile'), false)
  assert.equal(authzStore.has(`membership:${groupId}:member-1`), false)
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

test('approved group event reads use shared Cache API', async () => {
  const groupId = 'group-1'
  const listUrl = `https://ccalc.live/api/groups/${groupId}/events`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  originResponses.push(Response.json([{ id: 'event-1', groupId }]))

  const first = await dispatch(listUrl, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()
  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(first.headers.get('cache-control'), 'private, no-cache')
  assert.equal(apiCacheStore.has(createApiCacheKey(listUrl)), true)

  originResponses.push(Response.json([{ id: 'event-2', groupId }]))
  const second = await dispatch(listUrl, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()

  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.equal(fetchCalls.length, 1)
})

test('approved members in the same group share the same group pages cache key', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}/pages`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  authzStore.set(`membership:${groupId}:member-2`, JSON.stringify({ status: 'approved' }))
  originResponses.push(Response.json([{ id: 'page-1', ownerGroupId: groupId }]))

  const first = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await flushWaitUntil()
  const second = await dispatch(url, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-2')}` },
  })

  assert.equal(first.headers.get('x-alife-cache'), 'MISS')
  assert.equal(second.headers.get('x-alife-cache'), 'HIT')
  assert.equal(apiCacheStore.has(`group:${groupId}:pages`), true)
  assert.equal(apiCacheStore.has(`group:${groupId}:pages:member-1`), false)
  assert.equal(fetchCalls.length, 1)
})

test('matching If-None-Match for group pages is answered from shared Cache API with 304', async () => {
  const groupId = 'group-1'
  const url = `https://ccalc.live/api/groups/${groupId}/pages`
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  apiCacheStore.set(
    `group:${groupId}:pages`,
    createStoredResponse([{ id: 'page-1', ownerGroupId: groupId }], { etag: '"group-pages-v1"' }),
  )

  const response = await dispatch(url, {
    headers: {
      cookie: `alife_auth=${createJwtWithSub('member-1')}`,
      'if-none-match': '"group-pages-v1"',
    },
  })

  assert.equal(response.status, 304)
  assert.equal(response.headers.get('x-alife-cache'), 'REVALIDATED')
  assert.equal(await response.text(), '')
  assert.equal(fetchCalls.length, 0)
})

test('shared group subresource caches use 24 hour TTLs', async () => {
  const groupId = 'group-1'
  authzStore.set(`membership:${groupId}:member-1`, JSON.stringify({ status: 'approved' }))
  originResponses.push(Response.json([{ id: 'page-1', ownerGroupId: groupId }]))
  originResponses.push(Response.json([{ id: 'child-1', parentGroupId: groupId }]))
  originResponses.push(Response.json([{ id: 'event-1', groupId }]))
  originResponses.push(Response.json([{ memberId: 'member-1', status: 'approved' }]))

  await dispatch(`https://ccalc.live/api/groups/${groupId}/pages`, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await dispatch(`https://ccalc.live/api/groups/${groupId}/subgroups`, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await dispatch(`https://ccalc.live/api/groups/${groupId}/events`, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })
  await dispatch(`https://ccalc.live/api/groups/${groupId}/memberships`, {
    headers: { cookie: `alife_auth=${createJwtWithSub('member-1')}` },
  })

  assert.equal(apiCachePutOptions.get(`group:${groupId}:pages`).expirationTtl, 86400)
  assert.equal(apiCachePutOptions.get(`group:${groupId}:subgroups`).expirationTtl, 86400)
  assert.equal(apiCachePutOptions.get(`group:${groupId}:events`).expirationTtl, 86400)
  assert.equal(apiCachePutOptions.get(`group:${groupId}:members`).expirationTtl, 86400)
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
  const uploadUrl = String(fetchCalls[1])
  assert.match(
    uploadUrl,
    new RegExp(`^https://ccalc\\.live/images/api/images/groups/${groupId}/events/${eventId}/enrollments/[0-9a-f-]{36}$`),
  )
  const enrollmentId = uploadUrl.split('/').at(-1)
  assert.equal(String(fetchCalls[2]), `https://api.ccalc.live/api/events/${eventId}/enrollments`)
  assert.equal(fetchInits[2].method, 'POST')
  assert.deepEqual(JSON.parse(fetchInits[2].body), {
    id: enrollmentId,
    enrollmentId,
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

test('POST /api/reviews/session/:id/message returns review draft and preserves app context ids', async () => {
  const eventId = crypto.randomUUID()
  const sessionId = `member-1-event-${eventId}-review`
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reviewId: '',
            eventId: 'wrong-event',
            groupId: 'wrong-group',
            memberId: 'wrong-member',
            reflection: {
              zh: '這次活動讓大家有很好的連結。',
              en: 'This event helped everyone connect well.',
            },
            summary: {
              zh: '溫暖的團契時光。',
              en: 'A warm time of fellowship.',
            },
            recognizedPeople: [{ name: 'Alice', confidence: 0.8 }],
            recognizedActivities: [{ name: { zh: '分享', en: 'Sharing' }, evidence: 'User mentioned sharing.' }],
            photoFiles: [],
            assistantReply: {
              zh: '回顧草稿已準備好。',
              en: 'The review draft is ready.',
            },
            submittedAtUtc: '',
            updatedAtUtc: '2026-05-27T00:00:00.000Z',
          }),
        }],
      },
    }],
  }))

  const appContextParams = new URLSearchParams({
    memberId: 'member-1',
    groupId: 'group-1',
    eventId,
    eventData: JSON.stringify({ id: eventId, titleEn: 'Family Camp' }),
    knownFacts: JSON.stringify({
      enrollments: [{ applicantName: 'Alice' }],
    }),
  })
  const response = await dispatch(`https://ccalc.live/api/reviews/session/${sessionId}/message?${appContextParams}`, {
    method: 'POST',
    body: JSON.stringify({ message: 'Alice led a sharing time and everyone connected well.' }),
    headers: { 'content-type': 'application/json' },
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.responseMode, 'result')
  assert.equal(body.result.eventId, eventId)
  assert.equal(body.result.groupId, 'group-1')
  assert.equal(body.result.memberId, 'member-1')
  assert.match(body.result.reviewId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.equal(body.result.summary.en, 'A warm time of fellowship.')
  assert.equal(body.context.en, 'The review draft is ready.')
  const geminiBody = JSON.parse(fetchInits[0].body)
  const prompt = JSON.parse(geminiBody.contents[0].parts[0].text)
  assert.equal(prompt.task, 'event-review')
  assert.equal(prompt.appContext.knownFacts.enrollments[0].applicantName, 'Alice')
})

test('POST /api/reviews/session/:id/message sends review photo as Gemini inline data', async () => {
  const eventId = 'spring-retreat'
  const sessionId = `member-1-event-${eventId}-review`
  originResponses.push(Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reviewId: '',
            eventId,
            groupId: 'group-1',
            memberId: 'member-1',
            reflection: {
              zh: '照片顯示大家一起用餐和分享。',
              en: 'The photos show everyone eating and sharing together.',
            },
            summary: {
              zh: '用餐與分享。',
              en: 'Meal and sharing.',
            },
            recognizedPeople: [],
            recognizedActivities: [{ name: { zh: '用餐', en: 'Meal' }, evidence: 'Photo attachment.' }],
            photoFiles: [],
            assistantReply: {
              zh: '我已根據照片更新回顧。',
              en: 'I updated the review from the photos.',
            },
            submittedAtUtc: '',
            updatedAtUtc: '2026-05-27T00:00:00.000Z',
          }),
        }],
      },
    }],
  }))

  const formData = new FormData()
  formData.set('message', 'Please analyze these event photos.')
  formData.append('attachments', new File(['fake-image'], 'review.png', { type: 'image/png' }))

  const response = await dispatch(`https://ccalc.live/api/reviews/session/${sessionId}/message?groupId=group-1&memberId=member-1`, {
    method: 'POST',
    body: formData,
    env: { GEMINI_API_KEY: 'test-key', API_PROXY_TARGET: 'https://api.ccalc.live' },
  })

  assert.equal(response.status, 200)
  const geminiBody = JSON.parse(fetchInits[0].body)
  assert.equal(geminiBody.contents[0].parts[1].inline_data.mime_type, 'image/png')
  const prompt = JSON.parse(geminiBody.contents[0].parts[0].text)
  assert.equal(prompt.attachments[0].name, 'review.png')
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

function createLogicalRecordStore(rawStore) {
  return {
    set(key, value) {
      rawStore.set(key, value)
      cacheStore.set(logicalCacheStorageKey(key), new Response(value, {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=86400',
        },
      }))
      return this
    },
    get(key) {
      return rawStore.get(key)
    },
    has(key) {
      return rawStore.has(key)
    },
    delete(key) {
      cacheStore.delete(logicalCacheStorageKey(key))
      return rawStore.delete(key)
    },
    get size() {
      return rawStore.size
    },
  }
}

function createApiCacheStore(rawStore) {
  return {
    set(key, value) {
      rawStore.set(key, value)
      if (isStoredResponseKey(key)) {
        const record = JSON.parse(value)
        cacheStore.set(storedResponseCacheStorageKey(key), new Response(record.body, {
          status: record.status,
          statusText: record.statusText,
          headers: record.headers,
        }))
        return this
      }

      cacheStore.set(logicalCacheStorageKey(key), new Response(value, {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=86400',
        },
      }))
      return this
    },
    get(key) {
      return rawStore.get(key)
    },
    has(key) {
      return rawStore.has(key)
    },
    delete(key) {
      cacheStore.delete(isStoredResponseKey(key) ? storedResponseCacheStorageKey(key) : logicalCacheStorageKey(key))
      return rawStore.delete(key)
    },
    get size() {
      return rawStore.size
    },
  }
}

function logicalCacheStorageKey(key) {
  const url = new URL('https://alife.local/__alife-cache-record')
  url.searchParams.set('key', key)
  url.searchParams.sort()
  return url.toString()
}

function readLogicalCacheKey(request) {
  const url = new URL(request.url)
  return url.origin === 'https://alife.local' && url.pathname === '/__alife-cache-record'
    ? url.searchParams.get('key')
    : ''
}

function storedResponseCacheStorageKey(key) {
  return `https://alife.local/cache-v2/${encodeURIComponent(key)}`
}

function readStoredResponseCacheKey(request) {
  const url = new URL(request.url)
  if (url.origin !== 'https://alife.local' || !url.pathname.startsWith('/cache-v2/')) {
    return ''
  }

  return decodeURIComponent(url.pathname.slice('/cache-v2/'.length))
}

function seedNativeStoredResponse(key, response, onBodyRead) {
  apiCacheRawStore.set(key, null)
  cacheStore.set(storedResponseCacheStorageKey(key), response.clone())
  if (onBodyRead) {
    storedResponseBodyReadCallbacks.set(key, onBodyRead)
  }
}

function isAuthzKey(key) {
  return key.startsWith('membership:') || /^member:[^:]+:profile$/.test(key)
}

function isStoredResponseKey(key) {
  return key.startsWith('api:') ||
    key.startsWith('group:') ||
    /^member:[^:]+:me$/.test(key)
}

function isLogicalApiCacheKey(key) {
  return key.startsWith('map:')
}

function readCachePutOptions(response) {
  const cacheControl = response.headers.get('cache-control') ?? ''
  const maxAge = cacheControl.match(/(?:^|,\s*)max-age=(\d+)/)?.[1]
  return maxAge ? { expirationTtl: Number(maxAge) } : {}
}

async function serializeStoredResponse(response) {
  const headers = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  return JSON.stringify({
    status: response.status,
    statusText: response.statusText,
    headers,
    body: await response.text(),
    storedAt: new Date().toISOString(),
  })
}

function instrumentBodyReaders(response, onBodyRead) {
  const text = response.text.bind(response)
  response.text = async () => {
    onBodyRead()
    return text()
  }

  const json = response.json.bind(response)
  response.json = async () => {
    onBodyRead()
    return json()
  }

  const arrayBuffer = response.arrayBuffer.bind(response)
  response.arrayBuffer = async () => {
    onBodyRead()
    return arrayBuffer()
  }

  const blob = response.blob.bind(response)
  response.blob = async () => {
    onBodyRead()
    return blob()
  }

  const formData = response.formData.bind(response)
  response.formData = async () => {
    onBodyRead()
    return formData()
  }
}

function createApiCacheKey(url) {
  const parsed = new URL(url)
  const groupMatch = parsed.pathname.match(/^\/api\/groups\/([^/]+)\/(pages|subgroups|events|memberships|members)$/)
  if (groupMatch) {
    const cacheKind = groupMatch[2] === 'memberships' || groupMatch[2] === 'members'
      ? 'members'
      : groupMatch[2]
    return `group:${groupMatch[1]}:${cacheKind}`
  }

  parsed.hash = ''
  parsed.searchParams.sort()
  return `api:${parsed.pathname}${parsed.search}`
}

function createStoredResponse(body, headers = {}) {
  return JSON.stringify({
    status: 200,
    statusText: '',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    storedAt: new Date().toISOString(),
  })
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
