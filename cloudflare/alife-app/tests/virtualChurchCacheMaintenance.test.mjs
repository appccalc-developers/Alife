import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const maintenancePath = new URL('../public/virtual-church-cache-maintenance.js', import.meta.url)
const assetCacheName = 'alife-virtual-church-assets-gate-a-baseline-r9'
const codeCacheName = 'alife-virtual-church-code-gate-a-baseline-r9'

const cachedResponse = (contentType) => ({
  headers: { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null },
})

test('activation removes cached HTML at 3D URLs without touching valid or unrelated caches', async () => {
  const cacheStores = new Map([
    [assetCacheName, new Map([
      ['https://app.example/virtual-church-assets/v3/missing.glb', cachedResponse('text/html; charset=utf-8')],
      ['https://app.example/virtual-church-assets/v3/church.glb', cachedResponse('model/gltf-binary')],
    ])],
    [codeCacheName, new Map([
      ['https://app.example/assets/VirtualChurchView-old.js', cachedResponse('text/html')],
      ['https://app.example/assets/VirtualChurchView-good.js', cachedResponse('application/javascript')],
    ])],
    ['alife-virtual-church-assets-gate-a-baseline-r8', new Map()],
    ['alife-app-cache', new Map([
      ['https://app.example/assets/index-old.js', cachedResponse('text/html')],
      ['https://app.example/assets/index-good.js', cachedResponse('application/javascript')],
      ['https://app.example/assets/index-old.css', cachedResponse('text/html')],
      ['https://app.example/assets/index-good.css', cachedResponse('text/css')],
      ['https://app.example/private', cachedResponse('text/html')],
    ])],
  ])
  let activate
  const caches = {
    keys: async () => [...cacheStores.keys()],
    delete: async (name) => cacheStores.delete(name),
    open: async (name) => {
      const entries = cacheStores.get(name)
      assert.ok(entries, `Unexpected cache opened: ${name}`)
      return {
        keys: async () => [...entries.keys()].map((url) => ({ url })),
        match: async (request) => entries.get(request.url),
        delete: async (request) => entries.delete(request.url),
      }
    },
  }
  const self = {
    addEventListener: (eventName, callback) => {
      assert.equal(eventName, 'activate')
      activate = callback
    },
  }

  runInNewContext(await readFile(maintenancePath, 'utf8'), { caches, self, URL })
  assert.equal(typeof activate, 'function')
  let activationWork
  activate({ waitUntil: (promise) => { activationWork = promise } })
  await activationWork

  assert.equal(cacheStores.has('alife-virtual-church-assets-gate-a-baseline-r8'), false)
  assert.deepEqual([...cacheStores.get(assetCacheName).keys()], [
    'https://app.example/virtual-church-assets/v3/church.glb',
  ])
  assert.deepEqual([...cacheStores.get(codeCacheName).keys()], [
    'https://app.example/assets/VirtualChurchView-good.js',
  ])
  assert.deepEqual([...cacheStores.get('alife-app-cache').keys()], [
    'https://app.example/assets/index-good.js',
    'https://app.example/assets/index-good.css',
    'https://app.example/private',
  ])
})
