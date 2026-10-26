import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { createVirtualChurchReviewFault } from '../scripts/virtualChurchReviewFault.ts'

const body = Buffer.alloc(4096, 7)
body.write('glTF')

for (const mode of ['', '404-once', 'truncate-once']) {
  test(`local review fault ${mode || 'disabled'}: real HTTP failure, scoped once, then full recovery`, async () => {
    const inject = createVirtualChurchReviewFault(mode)
    const server = createServer((request, response) => {
      response.setHeader('Content-Length', body.length)
      const review = request.url === '/motion' ? 'male-v14-motion' : 'female-v14-low'
      if (inject(request.method, review, response, body.length, () => body)) return
      response.end(body)
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const base = `http://127.0.0.1:${address.port}`
    try {
      // Unrelated assets and HEAD cannot consume the pending fault.
      assert.deepEqual(Buffer.from(await (await fetch(`${base}/female`)).arrayBuffer()), body)
      assert.equal((await fetch(`${base}/motion`, { method: 'HEAD' })).status, 200)
      const first = await fetch(`${base}/motion`)
      if (mode) {
        assert.equal(first.headers.get('cache-control'), 'no-store, max-age=0')
        assert.equal(first.headers.get('x-alife-review-fault'), mode)
      }
      if (mode === '404-once') {
        assert.equal(first.status, 404)
        assert.match(await first.text(), /one-shot/)
      } else if (mode === 'truncate-once') {
        assert.equal(first.status, 200)
        assert.equal(first.headers.get('content-length'), String(body.length))
        await assert.rejects(first.arrayBuffer(), /terminated|abort|fetch/i)
      } else assert.deepEqual(Buffer.from(await first.arrayBuffer()), body)
      // Same URL on the same server must recover; no reset endpoint or restart.
      const recovered = await fetch(`${base}/motion`)
      assert.equal(recovered.status, 200)
      assert.equal(recovered.headers.get('x-alife-review-fault'), null)
      assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), body)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
}

test('invalid fault mode fails explicitly instead of silently running a happy-path test', () => {
  assert.throws(() => createVirtualChurchReviewFault('abort'), /must be empty/)
})
