import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServiceWorkerControllerChangeHandler, prepareDevelopmentServiceWorker } from '../src/serviceWorkerControllerChange.ts'

test('a first service worker claim leaves an already-open page in place', () => {
  let reloads = 0
  const onChange = createServiceWorkerControllerChangeHandler(null, () => { reloads += 1 })
  const firstController = {}
  const updatedController = {}

  onChange(firstController)
  assert.equal(reloads, 0)
  onChange(firstController)
  assert.equal(reloads, 0)
  onChange(updatedController)
  assert.equal(reloads, 1)
  onChange({})
  assert.equal(reloads, 1)
})

test('replacing an existing controller reloads once', () => {
  let reloads = 0
  const onChange = createServiceWorkerControllerChangeHandler({}, () => { reloads += 1 })

  onChange({})
  onChange({})
  assert.equal(reloads, 1)
})

test('losing control does not reload until a later controlled update', () => {
  let reloads = 0
  const onChange = createServiceWorkerControllerChangeHandler({}, () => { reloads += 1 })

  onChange(null)
  onChange({})
  assert.equal(reloads, 0)
  onChange({})
  assert.equal(reloads, 1)
})

test('a reused dev origin schedules a clean reload before mounting the app', async () => {
  const events: string[] = []
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const inputs = {
    wasControlled: true,
    cleanup: async () => { events.push('cleanup') },
    storage,
    reload: () => { events.push('reload') },
    onError: (_error: unknown) => { events.push('error') },
  }
  assert.equal(await prepareDevelopmentServiceWorker(inputs), false)
  assert.deepEqual(events, ['cleanup', 'reload'])
  assert.equal(await prepareDevelopmentServiceWorker(inputs), true)
  assert.equal(storage.getItem('alife:dev-service-worker-cleanup-reload'), null)
})

test('development cleanup failure does not prevent the app from opening', async () => {
  const errors: unknown[] = []
  const ready = await prepareDevelopmentServiceWorker({
    wasControlled: false,
    cleanup: async () => { throw new Error('cache unavailable') },
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    reload: () => { throw new Error('unexpected reload') },
    onError: (error) => { errors.push(error) },
  })
  assert.equal(ready, true)
  assert.equal(errors.length, 1)
})

test('restricted session storage cannot strand a development page blank', async () => {
  const errors: unknown[] = []
  const ready = await prepareDevelopmentServiceWorker({
    wasControlled: true,
    cleanup: async () => {},
    storage: {
      getItem: () => { throw new Error('storage denied') },
      setItem: () => {},
      removeItem: () => {},
    },
    reload: () => { throw new Error('unexpected reload') },
    onError: (error) => { errors.push(error) },
  })
  assert.equal(ready, true)
  assert.equal(errors.length, 1)
})

test('Vite serves a JavaScript retirement worker on reused preview origins', async () => {
  const config = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(config, /pathname === '\/sw\.js'/)
  assert.match(config, /Content-Type', 'text\/javascript; charset=utf-8'/)
  assert.match(config, /self\.registration\.unregister\(\)/)
  assert.doesNotMatch(config, /self\.clients\.claim\(\)/,
    'retiring a dev worker must not claim and refresh unrelated open tabs')
  assert.match(config, /client\.navigate\(client\.url\)/)
})
