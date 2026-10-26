import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createDeploymentConfig } from './create-deploy-config.mjs'

const source = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
const namespaceId = '0123456789abcdef0123456789abcdef'

test('ordinary deployment preserves canonical settings and adds only the API cache binding', () => {
  const original = structuredClone(source)
  const generated = createDeploymentConfig(source, ` ${namespaceId} `, { requireEventResetSecret: false })
  assert.deepEqual(generated, {
    ...original,
    kv_namespaces: [{ binding: 'API_CACHE', id: namespaceId }],
  })
  assert.deepEqual(source, original, 'generation must not mutate its input')
  assert.equal(generated.assets.binding, 'ASSETS')
  assert.deepEqual(generated.assets.run_worker_first, source.assets.run_worker_first)
})

test('deployment retains the shared reset-secret policy while enforcing static asset boundaries', () => {
  const protectedConfig = createDeploymentConfig(source, namespaceId)
  assert.ok(protectedConfig.secrets.required.includes('EVENT_RESET_DO_TOKEN'))
  const ordinaryConfig = createDeploymentConfig(protectedConfig, namespaceId, { requireEventResetSecret: false })
  assert.ok(!ordinaryConfig.secrets.required.includes('EVENT_RESET_DO_TOKEN'))
  assert.ok(ordinaryConfig.secrets.required.includes('GEMINI_API_KEY'))
  assert.ok(ordinaryConfig.secrets.required.includes('CACHE_SYNC_API_TOKEN'))
  assert.deepEqual(ordinaryConfig.assets, source.assets)
})

test('deployment rejects missing or misnamed static asset bindings', () => {
  for (const binding of [undefined, 'OTHER_ASSETS']) {
    const config = structuredClone(source)
    config.assets.binding = binding
    assert.throws(() => createDeploymentConfig(config, namespaceId), /assets\.binding must be ASSETS/)
  }
})

test('deployment rejects an absent static asset configuration', () => {
  const config = structuredClone(source)
  delete config.assets
  assert.throws(() => createDeploymentConfig(config, namespaceId), /assets\.binding must be ASSETS/)
})

test('deployment rejects each omitted Worker-first boundary, including church models', () => {
  for (const path of ['/api/*', '/images/*', '/assets/*', '/virtual-church-assets/*']) {
    const config = structuredClone(source)
    config.assets.run_worker_first = config.assets.run_worker_first.filter(value => value !== path)
    assert.throws(() => createDeploymentConfig(config, namespaceId), {
      message: `assets.run_worker_first must include ${path}.`,
    })
  }
})

test('deployment rejects global Worker-first routing rather than broadening its scope', () => {
  for (const routing of [true, ['*', ...source.assets.run_worker_first], ['/*', ...source.assets.run_worker_first]]) {
    const config = structuredClone(source)
    config.assets.run_worker_first = routing
    assert.throws(() => createDeploymentConfig(config, namespaceId), /run_worker_first must be a scoped array/)
  }
})

test('deployment retains SPA navigation while requiring explicit static boundaries', () => {
  assert.equal(createDeploymentConfig(source, namespaceId).assets.not_found_handling, 'single-page-application')
})

test('deployment rejects invalid cache namespace ids without including their values in errors', () => {
  for (const value of [undefined, '', 'private-invalid-value', 'a'.repeat(31), 'g'.repeat(32)]) {
    assert.throws(() => createDeploymentConfig(source, value), {
      message: 'CLOUDFLARE_API_CACHE_NAMESPACE_ID must be a 32-character Cloudflare KV namespace id.',
    })
  }
})
