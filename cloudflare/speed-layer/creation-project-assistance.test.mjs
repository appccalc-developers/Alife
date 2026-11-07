import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { tmpdir } from 'node:os'
const appRequire = createRequire(new URL('../alife-app/package.json', import.meta.url))
const { build } = createRequire(appRequire.resolve('vite'))('esbuild')
const tempRoot = path.resolve(process.env.ALIFE_TEST_TEMP || (process.platform === 'win32' ? 'C:/Data/Alife/Temp/' : tmpdir()))
const temp = await mkdtemp(path.join(tempRoot, 'creation-assistant-'))
await build({ entryPoints: [new URL('./src/features/events/formAssistance.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], outfile: `${temp}/handler.mjs`, bundle: true, platform: 'neutral', format: 'esm' })
const { handleFormAssistance } = await import(pathToFileURL(`${temp}/handler.mjs`))
const input = () => ({ groupId: '11111111-1111-1111-1111-111111111111', revision: 1, language: 'zh', timeZone: 'Pacific/Auckland', message: '12 people', history: [], form: { activities: [], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false } })
const env = { API_PROXY_TARGET: 'https://backend.example', GEMINI_API_KEY: 'fixture' }
const send = (value = input(), cookie = 'fixture') => handleFormAssistance(new Request('https://app.example/api/events/creation-project-assistance', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(value) }), env, true)
const provider = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ form: { participantCount: 12 }, evidence: [{ field: 'participantCount', quote: '12 people' }], assistantReply: { en: 'Review the draft', zh: '请核对草稿' } }) }] } }] })
test('creation assistance checks group authority on every call, isolates viewers and never writes backend records', async () => {
  const original = globalThis.fetch, calls = [], responses = []
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); const response = responses.shift(); assert.ok(response, 'unexpected network request'); return response }
  try {
    assert.equal((await send(input(), '')).status, 401); assert.equal(calls.length, 0)
    for (const invalid of [{ ...input(), scope: 'tasks' }, { ...input(), eventId: input().groupId }, { ...input(), members: [] }]) assert.equal((await send(invalid)).status, 400)
    assert.equal(calls.length, 0)
    for (const status of [401, 403, 404, 409]) { responses.push(new Response('', { status })); const denied = await send(); assert.equal(denied.status, status); assert.equal(denied.headers.get('cache-control'), 'private, no-store') }
    for (const malformed of [{}, { sourceVersion: 7 }]) { responses.push(Response.json(malformed)); assert.equal((await send()).status, 403) }
    assert.ok(calls.every(c => c.url.startsWith('https://backend.example/')))
    const offset = calls.length
    responses.push(Response.json({ sourceVersion: 'new:1', members: ['PRIVATE PERSON'], policy: 'PRIVATE RECORD' }), provider())
    const good = await send(); assert.equal(good.status, 200); assert.equal((await good.json()).form.participantCount, 12)
    assert.equal(good.headers.get('cache-control'), 'private, no-store'); assert.match(good.headers.get('vary'), /Cookie, Authorization/)
    assert.equal(calls[offset].url, `https://backend.example/api/events/ram-authoring/access?groupId=${input().groupId}`)
    assert.equal(calls[offset].init.method, undefined); assert.equal(calls[offset].init.headers.get('cookie'), 'fixture')
    assert.doesNotMatch(calls[offset + 1].init.body, /PRIVATE|11111111|groupId|eventId|revision|members/)
    responses.push(new Response('', { status: 403 })); assert.equal((await send(input(), 'other-viewer')).status, 403)
    assert.equal(calls.at(-1).init.headers.get('cookie'), 'other-viewer')
    for (const invalidProvider of [new Response('', { status: 503 }), Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] })]) { responses.push(Response.json({ sourceVersion: 'new:1' }), invalidProvider); const response = await send(); assert.equal(response.status, 503); assert.equal((await response.json()).form, undefined) }
  } finally {
    globalThis.fetch = original
    assert.equal(path.dirname(path.resolve(temp)), tempRoot)
    assert.ok(path.basename(temp).startsWith('creation-assistant-'))
    await rm(temp, { recursive: true, force: true })
  }
})
