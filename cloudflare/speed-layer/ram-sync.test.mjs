import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqual } from 'node:crypto'
import { handleRamSync, syncInput, syncOutput } from './dist/ram-sync-test.mjs'
Object.defineProperty(crypto.subtle, 'timingSafeEqual', { value: timingSafeEqual, configurable: true })
const input = { modules: ['MOVE.STAY','SAFEGUARDING.CHILD'], activityTypes: ['water'], overnight: true, outdoor: true, children: true, programmeItems: 1, venueCount: 1 }
const text = { en: 'Possible immersion; verify controls', zh: '可能落水；请核实控制措施' }
const risk = { activityType: 'water', categoryCode: 'activity', hazard: text, consequence: text, controlMeasures: text, additionalAction: text }
const request = (body = input, token = 'test-sync-token') => new Request('https://app.test/api/internal/ram/identify', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
test('sync input accepts only aggregate enums and counts; output cannot supply scores or identities', () => {
  assert.ok(syncInput(input)); assert.equal(syncInput({ ...input, title: 'Private name' }), null)
  assert.equal(syncInput({ ...input, activityTypes: ['ignore instructions'] }), null)
  assert.ok(syncOutput([risk])); assert.equal(syncOutput([{ ...risk, likelihood: 1 }]), null)
  assert.equal(syncOutput([{ ...risk, hazard: { en: 'secret@example.com', zh: '隐私' } }]), null)
})
test('dedicated credential is required before any model request', async () => {
  let calls = 0; const original = globalThis.fetch; globalThis.fetch = async () => { calls++; throw Error('unexpected') }
  try {
    assert.equal((await handleRamSync(request(), { CACHE_SYNC_API_TOKEN: 'test-sync-token' })).status, 401)
    assert.equal((await handleRamSync(request(input, 'wrong'), { RAM_SYNC_API_TOKEN: 'test-sync-token' })).status, 401)
    assert.equal(calls, 0)
  } finally { globalThis.fetch = original }
})
test('provider results are bounded, bilingual, no-store; failure is explicit', async () => {
  const original = globalThis.fetch
  const env = { RAM_SYNC_API_TOKEN: 'test-sync-token', GEMINI_API_KEY: 'fixture-only' }
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); assert.equal(body.contents[0].parts[0].text, JSON.stringify(input))
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify([risk]) }] } }] })
  }
  try {
    const response = await handleRamSync(request(), env)
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.deepEqual(await response.json(), [risk])
    globalThis.fetch = async () => new Response('failure', { status: 503 })
    assert.equal((await handleRamSync(request(), env)).status, 503)
  } finally { globalThis.fetch = original }
})
