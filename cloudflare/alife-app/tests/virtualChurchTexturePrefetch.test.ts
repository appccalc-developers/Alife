import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { ImageBitmapLoader, LoadingManager } from 'three'
import { VirtualChurchTexturePrefetch, VirtualChurchPrefetchedImageBitmapLoader, virtualChurchAtlasUrls, virtualChurchCanPrefetchTextures } from '../src/views/virtualChurchTexturePrefetch.ts'

const url = 'https://local.test/v3/textures/atlas.png'
const tick = () => new Promise<void>(resolve => setImmediate(resolve))
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const bitmap = () => {
  let closed = 0
  return { image: { width: 2, height: 2, close: () => { closed++ } } as ImageBitmap,
    closed: () => closed }
}

test('URLs stay in the selected immutable release, including a CDN origin', () => {
  assert.deepEqual(virtualChurchAtlasUrls('https://cdn.test/v3/releases/r9/buildings/church.glb', 'https://local.test/'),
    ['normal', 'basecolor', 'orm'].map(slot => `https://cdn.test/v3/releases/r9/textures/church-material-atlas-${slot}.png`))
})
test('older/unknown Safari and Firefox skip prefetch; modern supported branches stay enabled', () => {
  for (const ua of ['Safari', 'Version/16.6 Safari', 'Firefox', 'Firefox/97.0']) assert.equal(virtualChurchCanPrefetchTextures(ua), false)
  for (const ua of ['Chrome/154 Safari', 'Android Safari', 'Version/17.0 Safari', 'Firefox/98.0']) assert.equal(virtualChurchCanPrefetchTextures(ua), true)
})
test('inactive/unapproved requests are untouched; prime and parser consumers share one Blob promise', async () => {
  let calls = 0
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => { calls++; return new Blob(['image']) })
  assert.equal(cache.acquire(url), null)
  const release = cache.retain()
  cache.prime()
  assert.equal(cache.acquire('https://other.test/atlas.png'), null)
  const a = cache.acquire(url)!, b = cache.acquire('./atlas.png')!
  assert.equal(a.promise, b.promise)
  await a.promise
  assert.equal(calls, 1)
  a.release(); b.release(); release()
  await tick()
  assert.equal(cache.cachedUrlCount, 0)
})
test('exit aborts unused prefetch but does not abort a parser-owned stream; rapid re-entry reuses it', async () => {
  const requests: Array<{ signal: AbortSignal; pending: ReturnType<typeof deferred<Blob>> }> = []
  const other = url.replace('atlas', 'unused')
  const cache = new VirtualChurchTexturePrefetch([url, other], url, async (_url, signal) => {
    const pending = deferred<Blob>(); requests.push({ signal, pending }); return pending.promise
  })
  const exit = cache.retain(); cache.prime()
  const a = cache.acquire(url)!
  await tick(); exit(); await tick()
  assert.equal(requests[0].signal.aborted, false)
  assert.equal(requests[1].signal.aborted, true)
  const exitAgain = cache.retain()
  const b = cache.acquire(url)!
  assert.equal(a.promise, b.promise)
  assert.equal(requests.length, 2)
  requests[0].pending.resolve(new Blob(['image']))
  await b.promise
  a.release(); exitAgain(); await tick()
  assert.equal(cache.cachedUrlCount, 1)
  b.release(); b.release()
  assert.equal(cache.cachedUrlCount, 0)
  requests[1].pending.reject(new Error('unused aborted'))
  await tick()
})
test('StrictMode replay and overlapping scopes preserve bytes until final release', async () => {
  let signal!: AbortSignal
  const cache = new VirtualChurchTexturePrefetch([url], url, async (_url, s) => { signal = s; return new Blob() })
  const replay = cache.retain(); cache.prime(); replay()
  const current = cache.retain(), overlap = cache.retain()
  await tick()
  assert.equal(signal.aborted, false)
  current(); current(); await tick()
  assert.equal(signal.aborted, false)
  overlap(); await tick()
  assert.equal(signal.aborted, true)
  assert.equal(cache.cachedUrlCount, 0)
})
test('late failure/eviction of an old entry cannot remove a fresh visit', async () => {
  const requests: Array<ReturnType<typeof deferred<Blob>>> = []
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => {
    const pending = deferred<Blob>(); requests.push(pending); return pending.promise
  })
  const exit = cache.retain(), a = cache.acquire(url)!
  await tick(); a.evict(); a.release(); exit(); await tick()
  const exitAgain = cache.retain(), b = cache.acquire(url)!
  await tick()
  requests[0].reject(new Error('old'))
  await assert.rejects(a.promise, /old/)
  a.evict()
  assert.equal(cache.cachedUrlCount, 1)
  requests[1].resolve(new Blob()); await b.promise
  b.release(); exitAgain(); await tick()
})
test('each parser owns a different bitmap, keeps decoder options, and completes after its scope exits', async () => {
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => new Blob())
  const exit = cache.retain()
  let ends = 0, errors = 0
  const manager = new LoadingManager(() => { ends++ }, undefined, () => { errors++ })
  const original = new ImageBitmapLoader(manager).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
  const a = bitmap(), b = bitmap(), images: ImageBitmap[] = []
  let index = 0
  const loader = new VirtualChurchPrefetchedImageBitmapLoader(original, cache, async (_blob, options) => {
    assert.equal(options.imageOrientation, 'flipY'); assert.equal(options.colorSpaceConversion, 'none')
    return [a.image, b.image][index++]
  })
  loader.load(url, image => images.push(image))
  loader.load(url, image => images.push(image))
  exit(); await tick()
  assert.deepEqual(images, [a.image, b.image])
  assert.equal(errors, 0); assert.equal(ends, 1)
  assert.equal(a.closed(), 0); assert.equal(b.closed(), 0)
  assert.equal(cache.cachedUrlCount, 0)
})
test('abort closes only the cancelled consumer late decode, leaves a second parser and shared bytes usable', async () => {
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => new Blob())
  const exit = cache.retain(), pending = deferred<ImageBitmap>(), image = bitmap(), valid = bitmap()
  const manager = new LoadingManager()
  let errors = 0, delivered = 0
  const cancelled = new VirtualChurchPrefetchedImageBitmapLoader(new ImageBitmapLoader(manager), cache, () => pending.promise)
  cancelled.load(url, () => { delivered++ }, undefined, () => { errors++ })
  await tick(); cancelled.abort()
  const current = new VirtualChurchPrefetchedImageBitmapLoader(new ImageBitmapLoader(), cache, async () => valid.image)
  current.load(url, () => { delivered++ })
  pending.resolve(image.image); await tick()
  assert.equal(errors, 1); assert.equal(delivered, 1)
  assert.equal(image.closed(), 1); assert.equal(valid.closed(), 0)
  exit(); await tick(); assert.equal(cache.cachedUrlCount, 0)
})
test('manager abort balances failure, including before callback registration, without unhandled fetch rejection', async () => {
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => { throw new Error('failed fetch') })
  const exit = cache.retain(), manager = new LoadingManager()
  manager.abortController.abort()
  let errors = 0, managerErrors = 0, ended = 0
  manager.onError = () => { managerErrors++ }; manager.onLoad = () => { ended++ }
  const loader = new VirtualChurchPrefetchedImageBitmapLoader(new ImageBitmapLoader(manager), cache)
  loader.load(url, () => assert.fail('must not deliver'), undefined, () => { errors++ })
  await tick()
  assert.equal(errors, 1); assert.equal(managerErrors, 1); assert.equal(ended, 1)
  exit(); await tick()
})
test('decode failure evicts corrupt bytes and balances manager; another load can fetch and decode afresh', async () => {
  let fetches = 0, decodes = 0, errors = 0
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => { fetches++; return new Blob() })
  const exit = cache.retain(), good = bitmap()
  const loader = new VirtualChurchPrefetchedImageBitmapLoader(new ImageBitmapLoader(), cache, async () => {
    if (++decodes === 1) throw new Error('bad decode'); return good.image
  })
  loader.load(url, () => assert.fail(), undefined, () => { errors++ }); await tick()
  assert.equal(cache.cachedUrlCount, 0)
  let delivered = 0; loader.load(url, () => { delivered++ }); await tick()
  assert.equal(fetches, 2); assert.equal(errors, 1); assert.equal(delivered, 1)
  exit(); await tick(); assert.equal(good.closed(), 0)
})
test('custom headers/credentials, unapproved and inactive loads delegate the original loader', () => {
  const cache = new VirtualChurchTexturePrefetch([url], url)
  const original = new ImageBitmapLoader()
  let delegated = 0
  original.load = () => { delegated++ }
  const loader = new VirtualChurchPrefetchedImageBitmapLoader(original, cache)
  loader.load(url)
  const exit = cache.retain()
  original.setRequestHeader({ 'X-Test': 'fixture' }); loader.load(url)
  original.setRequestHeader({}); original.setCrossOrigin('use-credentials'); loader.load(url)
  original.setCrossOrigin('anonymous'); loader.load('https://other.test/image.png')
  assert.equal(delegated, 4); exit()
})
test('default native decoder is called with a safe receiver, not the loader instance', async () => {
  const originalDecode = globalThis.createImageBitmap
  const image = bitmap()
  globalThis.createImageBitmap = async function () {
    assert.ok(this === undefined || this === globalThis)
    return image.image
  } as typeof createImageBitmap
  const cache = new VirtualChurchTexturePrefetch([url], url, async () => new Blob()), exit = cache.retain()
  try {
    let delivered = false
    new VirtualChurchPrefetchedImageBitmapLoader(new ImageBitmapLoader(), cache).load(url, () => { delivered = true })
    await tick(); assert.equal(delivered, true)
  } finally { globalThis.createImageBitmap = originalDecode; exit() }
})
test('live view primes only interactive V3, skips missing GLB and unsupported decoders, and keeps integrity guard', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const prime = source.slice(source.lastIndexOf('useLayoutEffect', source.indexOf('VIRTUAL_CHURCH_TEXTURE_PREFETCH.prime()')), source.indexOf('VIRTUAL_CHURCH_TEXTURE_PREFETCH.prime()') + 100)
  assert.match(prime, /!interactive3DEnabled/); assert.match(prime, /config3D.visualVersion !== 'v3'/)
  assert.match(prime, /profile3DFailureMode === 'church-glb'/); assert.match(prime, /typeof createImageBitmap === 'undefined'/)
  assert.match(prime, /virtualChurchCanPrefetchTextures\(navigator.userAgent\)/); assert.match(prime, /return release/)
  assert.match(source, /parser.textureLoader instanceof ImageBitmapLoader/)
  assert.match(source, /return createVirtualChurchGltfIntegrityPlugin\(parser/)
})
