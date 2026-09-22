import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { QueryClient } from '@tanstack/react-query'

const require = createRequire(import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const adapters = ['@tanstack/query-db-collection', '@tanstack/react-db']

test('collection adapters retain exact pins matching the installed and npm-locked versions', () => {
  for (const name of adapters) {
    const installed = require(`${name}/package.json`)
    assert.equal(manifest.dependencies[name], installed.version, `${name} must use an exact pin`)
    assert.equal(lock.packages[''].dependencies[name], installed.version)
    assert.equal(lock.packages[`node_modules/${name}`].version, installed.version)
  }
})

test('React and query collection adapters resolve the same database core', () => {
  const corePaths = adapters.map((name) => {
    const adapterRequire = createRequire(require.resolve(`${name}/package.json`))
    return realpathSync(adapterRequire.resolve('@tanstack/db/package.json'))
  })
  assert.equal(corePaths[0], corePaths[1], 'separate database cores can expose incompatible SyncConfig contracts')
})

test('query-backed React collections load keyed bilingual records and release cleanly', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const rows = [{ id: 'adapter-fixture', name: { en: 'Test group', zh: '测试小组' } }]
  // Exercise the same adapter composition as groupCollection and sermonsCollection,
  // without contacting APIs or accessing real member data.
  const collection = createCollection(queryCollectionOptions({
    queryClient,
    queryKey: ['collection-adapter-test'],
    queryFn: async () => rows,
    getKey: (row) => row.id,
  }))
  try {
    await collection.preload()
    assert.equal(collection.toArray.length, 1)
    assert.deepEqual(collection.get('adapter-fixture')?.name, rows[0].name)
  } finally {
    await collection.cleanup()
    queryClient.clear()
  }
})
