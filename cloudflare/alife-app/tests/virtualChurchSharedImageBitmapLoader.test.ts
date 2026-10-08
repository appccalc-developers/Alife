import assert from 'node:assert/strict'
import test from 'node:test'
import { LoadingManager } from 'three'
import { VirtualChurchSharedImageBitmapLoader } from '../src/views/virtualChurchSharedImageBitmapLoader.ts'

type TestBitmap = ImageBitmap & { closeCalls: number }

const createBitmap = () => ({
  closeCalls: 0,
  close() { this.closeCalls += 1 },
}) as TestBitmap

const load = (loader: VirtualChurchSharedImageBitmapLoader, url: string) =>
  new Promise<ImageBitmap>((resolve, reject) => loader.load(url, resolve, undefined, reject))

test('concurrent GLTF image requests share the actual bitmap promise', async () => {
  let requests = 0
  let resolveBitmap!: (bitmap: ImageBitmap) => void
  const bitmapPromise = new Promise<ImageBitmap>((resolve) => { resolveBitmap = resolve })
  const loader = new VirtualChurchSharedImageBitmapLoader(
    new LoadingManager(),
    async () => { requests += 1; return bitmapPromise },
  )
  const pending = [load(loader, 'Textures/colormap.png'), load(loader, 'Textures/colormap.png'), load(loader, 'Textures/colormap.png')]
  assert.equal(requests, 1)
  assert.equal(loader.cachedUrlCount, 1)
  const bitmap = createBitmap()
  resolveBitmap(bitmap)
  const results = await Promise.all(pending)
  assert.deepEqual(results, [bitmap, bitmap, bitmap])
  assert.ok(results.every(Boolean), 'no concurrent consumer receives Three r185\'s undefined cached promise value')
  loader.clear()
  assert.equal(bitmap.closeCalls, 1)
  assert.equal(loader.cachedUrlCount, 0)
})

test('failed loads are evicted and a later request can retry', async () => {
  let requests = 0
  const bitmap = createBitmap()
  const loader = new VirtualChurchSharedImageBitmapLoader(
    new LoadingManager(),
    async () => {
      requests += 1
      if (requests === 1) throw new Error('temporary failure')
      return bitmap
    },
  )
  await assert.rejects(load(loader, 'Textures/colormap.png'), /temporary failure/)
  assert.equal(loader.cachedUrlCount, 0)
  assert.equal(await load(loader, 'Textures/colormap.png'), bitmap)
  assert.equal(requests, 2)
  loader.clear()
})

test('clearing a pending entry closes its bitmap when it eventually resolves', async () => {
  let resolveBitmap!: (bitmap: ImageBitmap) => void
  const loader = new VirtualChurchSharedImageBitmapLoader(
    new LoadingManager(),
    async () => new Promise<ImageBitmap>((resolve) => { resolveBitmap = resolve }),
  )
  const pending = load(loader, 'Textures/colormap.png')
  loader.clear()
  const bitmap = createBitmap()
  resolveBitmap(bitmap)
  assert.equal(await pending, bitmap)
  assert.equal(bitmap.closeCalls, 1)
})
