import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { loadConfigFromFile } from 'vite'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { once } from 'node:events'

const appRoot = fileURLToPath(new URL('..', import.meta.url))

test('local production preview does not return the SPA shell for missing 3D assets', async () => {
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'test' },
    resolve(appRoot, 'vite.config.ts'),
    appRoot,
  )
  assert.ok(loaded)
  const boundary = loaded.config.plugins.flat(Infinity)
    .find(plugin => plugin?.name === 'alife-preview-static-asset-boundary')
  assert.ok(boundary)

  let middleware
  boundary.configurePreviewServer({
    config: { root: appRoot, build: { outDir: 'public' } },
    middlewares: { use: handler => { middleware = handler } },
  })
  assert.equal(typeof middleware, 'function')

  const request = (method, url) => {
    const headers = new Map()
    let nextCalled = false
    let ended = false
    let body
    const response = {
      statusCode: 200,
      setHeader(name, value) { headers.set(name.toLowerCase(), value) },
      end(value) { ended = true; body = value },
    }
    middleware({ method, url }, response, () => { nextCalled = true })
    return { status: response.statusCode, headers, nextCalled, ended, body }
  }

  for (const [method, url] of [
    ['GET', '/assets/VirtualChurchView-missing.js'],
    ['GET', '/assets/VirtualChurchView-missing.css'],
    ['HEAD', '/virtual-church-assets/v3/releases/missing.glb'],
    ['GET', '/assets/%2e%2e%2fprivate.json'],
  ]) {
    const result = request(method, url)
    assert.equal(result.status, 404, `${method} ${url}`)
    assert.equal(result.nextCalled, false)
    assert.equal(result.headers.get('cache-control'), 'no-store, max-age=0')
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
    assert.match(result.headers.get('content-type'), /^text\/plain\b/)
    assert.equal(result.ended, true)
    assert.equal(result.body, method === 'HEAD' ? undefined : 'Static asset not found.')
  }

  assert.equal(request('GET', '/virtual-church-assets/ASSET-LICENSES.md').nextCalled, true)
  assert.equal(request('GET', '/virtual-church/study-room').nextCalled, true)
})

test('one-shot church CSS fault preserves HEAD and unrelated requests and then serves the original file', async (t) => {
  const dataRoot = 'C:/Data/Alife/Temp/vc-css-recovery-20261006'
  await mkdir(dataRoot, { recursive: true })
  const root = await mkdtemp(resolve(dataRoot, 'http-fixture-'))
  await mkdir(resolve(root, 'assets'))
  const cssPath = '/assets/VirtualChurchView-test.css'
  const stylesheet = 'body { color: white; }'
  await writeFile(resolve(root, `.${cssPath}`), stylesheet)
  const server = spawn(process.execPath, [
    fileURLToPath(new URL('../../../tools/virtual-church/slow-preview-server.mjs', import.meta.url)),
    `--root=${root}`, '--host=127.0.0.1', '--port=0', '--latency-ms=0', '--kbps=1000000',
    `--fail-css-once=${cssPath}`,
    '--log-static-requests=true',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  const serverClosed = once(server, 'exit')
  t.after(async () => {
    if (server.exitCode === null) server.kill()
    await serverClosed
    await rm(root, { recursive: true, force: true })
  })
  let output = ''
  const origin = await new Promise((resolveOrigin, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 5000)
    server.once('error', reject)
    server.stdout.on('data', chunk => {
      output += chunk
      const match = output.match(/Alife slow preview: (http:\/\/127\.0\.0\.1:\d+)/)
      if (match) { clearTimeout(timer); resolveOrigin(match[1]) }
    })
  })
  assert.equal((await fetch(`${origin}${cssPath}`, { method: 'HEAD' })).status, 200)
  assert.equal((await fetch(`${origin}/assets/Other-missing.css`)).status, 404)
  for (const path of ['/assets/VirtualChurchView-missing.js', '/virtual-church-assets/missing.glb']) {
    for (const method of ['GET', 'HEAD']) {
      const missing = await fetch(`${origin}${path}`, { method, headers: { Accept: 'text/html' } })
      assert.equal(missing.status, 404, `${method} ${path} must not receive the SPA fallback`)
      assert.equal(missing.headers.get('cache-control'), 'no-store')
      assert.equal(missing.headers.get('x-content-type-options'), 'nosniff')
      assert.match(missing.headers.get('content-type'), /^text\/plain\b/)
      if (method === 'HEAD') assert.equal(await missing.text(), '')
      else assert.equal(await missing.text(), 'Not found')
    }
  }
  const failed = await fetch(`${origin}${cssPath}`)
  assert.equal(failed.status, 404)
  assert.equal(failed.headers.get('cache-control'), 'no-store')
  assert.equal(failed.headers.get('x-content-type-options'), 'nosniff')
  assert.match(failed.headers.get('content-type'), /^text\/plain\b/)
  const recovered = await fetch(`${origin}${cssPath}`)
  assert.equal(recovered.status, 200)
  assert.match(recovered.headers.get('content-type'), /^text\/css\b/)
  assert.equal(await recovered.text(), stylesheet)
  assert.equal((output.match(/Injected one-shot missing asset:/g) ?? []).length, 1)
  await fetch(`${origin}${cssPath}?token=do-not-retain`)
  await fetch(`${origin}/api/private?member=do-not-retain`)
  // A final response may close after fetch resolves; a subsequent request
  // completes the previous request's close observation before inspection.
  await fetch(`${origin}/__alife_profile_network.json`)
  const requests = output.split('\n').filter(line => line.startsWith('Static request: '))
    .map(line => JSON.parse(line.slice('Static request: '.length)))
  assert.ok(requests.some(row => row.path === cssPath && row.method === 'HEAD' && row.status === 200))
  assert.ok(requests.some(row => row.path === cssPath && row.status === 404))
  assert.ok(requests.some(row => row.path === cssPath && row.method === 'GET'
    && row.status === 200 && row.completed && row.contentLength === Buffer.byteLength(stylesheet)))
  assert.ok(requests.every(row => !row.path.includes('?') && !row.path.startsWith('/api/')))
  assert.doesNotMatch(output, /do-not-retain/)
})
