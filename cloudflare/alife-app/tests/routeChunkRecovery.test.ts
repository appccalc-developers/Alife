import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFailedRouteModuleUrl,
  isRouteChunkLoadError,
  refreshFailedRouteModule,
} from '../src/app/routing/routeChunkRecovery.ts'

const origin = 'https://ccalc.live'
const failedModuleUrl = `${origin}/assets/OnboardingView-old.js`

test('recognizes Chromium and Firefox dynamic import failures', () => {
  const chromiumError = new TypeError(`Failed to fetch dynamically imported module: ${failedModuleUrl}`)
  const firefoxError = new TypeError(`error loading dynamically imported module: ${failedModuleUrl}`)

  assert.equal(isRouteChunkLoadError(chromiumError), true)
  assert.equal(isRouteChunkLoadError(firefoxError), true)
  assert.equal(getFailedRouteModuleUrl(chromiumError), failedModuleUrl)
  assert.equal(getFailedRouteModuleUrl(firefoxError), failedModuleUrl)
})

test('reloads a failed same-origin JavaScript module through the network', async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = []
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ input: String(input), init })
    return new Response('export default {}', {
      headers: { 'content-type': 'text/javascript; charset=utf-8' },
    })
  }

  const refreshed = await refreshFailedRouteModule(
    new TypeError(`Failed to fetch dynamically imported module: ${failedModuleUrl}`),
    { fetcher, origin },
  )

  assert.equal(refreshed, true)
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.input, failedModuleUrl)
  assert.equal(requests[0]?.init?.cache, 'reload')
  assert.equal(requests[0]?.init?.credentials, 'same-origin')
})

test('rejects HTML fallbacks and cross-origin module URLs', async () => {
  let fetchCalls = 0
  const fetcher: typeof fetch = async () => {
    fetchCalls += 1
    return new Response('<!doctype html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  const htmlFallback = await refreshFailedRouteModule(
    new TypeError(`Failed to fetch dynamically imported module: ${failedModuleUrl}`),
    { fetcher, origin },
  )
  const crossOrigin = await refreshFailedRouteModule(
    new TypeError('Failed to fetch dynamically imported module: https://example.com/chunk.js'),
    { fetcher, origin },
  )

  assert.equal(htmlFallback, false)
  assert.equal(crossOrigin, false)
  assert.equal(fetchCalls, 1)
})
