import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const from = name => import(pathToFileURL(`${process.env.ALIFE_CONTENT_TEST_OUTPUT}/${name}.mjs`).href)
const { handleRamAssistance } = await from('ramAssistance')
const { handleFormAssistance } = await from('formAssistance')
const { handleRamGuidance } = await from('ramGuidance')
const id = '11111111-1111-1111-1111-111111111111'
const bi = text => ({ en: text, zh: text })
const env = { API_PROXY_TARGET: 'https://origin.test', GEMINI_API_KEY: 'fixture-only' }
const req = body => new Request('https://app.test/api/fixture', { method: 'POST', headers: { cookie: 'fixture' }, body: JSON.stringify(body) })

test('RAM drafting uses fixed attributes and authorizes the origin before calling the provider', async () => {
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async url => {
    if (String(url).startsWith(env.API_PROXY_TARGET)) return Response.json({ sourceVersion: 'fixture' })
    calls++; return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: { hazard: 'Possible tool injury' }, questions: ['Which tools?'] }) }] } }] })
  }
  const body = { eventId: id, language: 'en', mode: 'draft', activityType: 'meal', attributes: ['meal', 'outdoor'], category: 'activity', brief: 'Shared meal', selectedText: {}, sourceVersion: 'fixture' }
  try {
    assert.equal((await handleRamAssistance(req(body), env)).status, 200)
    assert.equal((await handleRamAssistance(req({ ...body, activityType: 'generic', attributes: [] }), env)).status, 200)
    assert.equal((await handleRamAssistance(req({ ...body, activityType: 'unknown' }), env)).status, 400)
    assert.equal((await handleRamAssistance(req({ ...body, activityType: 'water' }), env)).status, 400)
    assert.equal((await handleRamAssistance(req({ ...body, attributes: undefined }), env)).status, 400)
    assert.equal((await handleRamAssistance(req({ ...body, attributes: ['craft'] }), env)).status, 400)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})

test('activity form assistant requires independent fixed attributes with no historical type or directory', async () => {
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith(env.API_PROXY_TARGET)) return Response.json({ canEdit: true })
    calls++; const body = JSON.parse(options.body)
    const activity = body.generationConfig.responseSchema.properties.form.properties.activities.items
    assert.deepEqual(activity.properties.attributes.items.enum, ['hiking','water','sport','transport','camp','meal','outdoor'])
    assert.equal(activity.properties.type, undefined)
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ form: {}, evidence: [], assistantReply: bi('Please review') }) }] } }] })
  }
  const body = { eventId: id, scope: 'activityPlan', revision: 1, language: 'en', timeZone: 'Australia/Perth', message: 'Shared meal outdoors', history: [], form: { activities: [{ id: 'existing', attributes: ['meal','outdoor'], name: bi('Meal'), conditions: bi('Venue conditions'), occurrenceId: null }], participantCount: 10, isOuting: false, isOvernight: false, isHighRisk: false } }
  try {
    assert.equal((await handleFormAssistance(req(body), env)).status, 200)
    for (const activity of [{ ...body.form.activities[0], attributes: ['craft'] }, { ...body.form.activities[0], attributes: undefined }, { ...body.form.activities[0], type: 'meal' }]) {
      assert.equal((await handleFormAssistance(req({ ...body, form: { ...body.form, activities: [activity] } }), env)).status, 400)
    }
    assert.equal((await handleFormAssistance(req({ ...body, activityTypes: ['craft'] }), env)).status, 400)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('check-item guidance accepts only fixed scopes and verifies origin access', async () => {
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async url => {
    if (String(url).startsWith(env.API_PROXY_TARGET)) return Response.json({ policy: { data: { questions: [] } } })
    calls++; return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ explanation: 'Tools and supervision', questions: ['Which tools?'] }) }] } }] })
  }
  try {
    const body = { eventId: id, activityType: 'meal', attributes: ['meal'], category: 'activity', language: 'en' }
    assert.equal((await handleRamGuidance(req(body), env)).status, 200)
    assert.equal((await handleRamGuidance(req({ ...body, activityType: 'unknown' }), env)).status, 400)
    assert.equal((await handleRamGuidance(req({ ...body, activityType: 'craft' }), env)).status, 400)
    assert.equal((await handleRamGuidance(req({ ...body, attributes: undefined }), env)).status, 400)
    assert.equal((await handleRamGuidance(req({ ...body, attributes: ['outdoor'] }), env)).status, 400)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})
