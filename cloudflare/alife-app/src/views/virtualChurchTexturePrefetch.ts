import { ImageBitmapLoader } from 'three'

export const virtualChurchAtlasUrls = (assetPath: string, baseUrl: string) =>
  ['normal', 'basecolor', 'orm'].map(slot => new URL(
    `../textures/church-material-atlas-${slot}.png`, new URL(assetPath, baseUrl),
  ).href)

// Match the installed GLTFLoader's ImageBitmap compatibility branch.
export const virtualChurchCanPrefetchTextures = (ua: string) => {
  if (/^((?!chrome|android).)*safari/i.test(ua)) {
    if (Number(ua.match(/Version\/(\d+)/)?.[1] ?? -1) < 17) return false
  }
  if (ua.includes('Firefox') && Number(ua.match(/Firefox\/(\d+)/)?.[1] ?? -1) < 98) return false
  return true
}

type FetchBlob = (url: string, signal: AbortSignal) => Promise<Blob>
type Entry = { promise: Promise<Blob>; controller: AbortController; consumers: number }
const fetchBlob: FetchBlob = async (url, signal) => {
  const response = await fetch(url, { signal, credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Church image HTTP ${response.status}`)
  return response.blob()
}

/** Only three immutable public image byte streams are shared, never bitmaps.
 * Unused speculative requests stop on exit. Requests acquired by a parser keep
 * their ownership until decode finishes, including exit/re-entry overlap.
 */
export class VirtualChurchTexturePrefetch {
  private readonly entries = new Map<string, Entry>()
  private readonly approved: Set<string>
  private readonly baseUrl: string
  private readonly request: FetchBlob
  private users = 0
  private generation = 0

  constructor(urls: string[], baseUrl: string, request: FetchBlob = fetchBlob) {
    this.baseUrl = baseUrl
    this.request = request
    this.approved = new Set(urls.map(url => new URL(url, baseUrl).href))
  }

  retain() {
    this.users++
    this.generation++
    let released = false
    return () => {
      if (released) return
      released = true
      this.users--
      const generation = ++this.generation
      queueMicrotask(() => {
        if (this.users || generation !== this.generation) return
        for (const [url, entry] of this.entries) this.retire(url, entry)
      })
    }
  }

  private retire(url: string, entry: Entry) {
    if (!this.users && !entry.consumers && this.entries.get(url) === entry) {
      this.entries.delete(url)
      entry.controller.abort()
    }
  }

  private get(url: string) {
    if (!this.users || !this.approved.has(url)) return null
    let entry = this.entries.get(url)
    if (!entry) {
      const controller = new AbortController()
      entry = { controller, consumers: 0, promise: Promise.resolve().then(() => this.request(url, controller.signal)) }
      const owned = entry
      owned.promise = owned.promise.catch(error => {
        if (this.entries.get(url) === owned) this.entries.delete(url)
        throw error
      })
      // Cancellation can happen before any parser attaches its callback.
      void owned.promise.catch(() => {})
      this.entries.set(url, owned)
    }
    return entry
  }

  prime() {
    for (const url of this.approved) void this.get(url)?.promise.catch(() => {})
  }

  acquire(inputUrl: string) {
    const url = new URL(inputUrl, this.baseUrl).href
    const entry = this.get(url)
    if (!entry) return null
    entry.consumers++
    let released = false
    return {
      promise: entry.promise,
      release: () => {
        if (released) return
        released = true
        entry.consumers--
        this.retire(url, entry)
      },
      evict: () => {
        if (this.entries.get(url) === entry) this.entries.delete(url)
      },
    }
  }

  get cachedUrlCount() { return this.entries.size }
}

export class VirtualChurchPrefetchedImageBitmapLoader extends ImageBitmapLoader {
  private readonly original: ImageBitmapLoader
  private readonly cache: VirtualChurchTexturePrefetch
  private readonly decode: (blob: Blob, options: ImageBitmapOptions) => Promise<ImageBitmap>
  private consumerAbort = new AbortController()

  constructor(original: ImageBitmapLoader, cache: VirtualChurchTexturePrefetch,
    decode: (blob: Blob, options: ImageBitmapOptions) => Promise<ImageBitmap> = (blob, options) => createImageBitmap(blob, options)) {
    super(original.manager)
    this.original = original
    this.cache = cache
    this.decode = decode
  }

  override load(inputUrl: string, onLoad?: (bitmap: ImageBitmap) => void,
    onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
    const url = this.manager.resolveURL(`${this.original.path ?? ''}${inputUrl}`)
    const entry = this.original.crossOrigin === 'anonymous'
      && !Object.keys(this.original.requestHeader).length ? this.cache.acquire(url) : null
    if (!entry) { this.original.load(inputUrl, onLoad, onProgress, onError); return }
    this.manager.itemStart(url)
    let finished = false
    const signals = [this.consumerAbort.signal, this.manager.abortController.signal]
    const finish = () => {
      if (finished) return
      finished = true
      signals.forEach(signal => signal.removeEventListener('abort', cancel))
      entry.release()
      this.manager.itemEnd(url)
    }
    const fail = (error: unknown) => {
      if (finished) return
      try { onError?.(error); this.manager.itemError(url) } finally { finish() }
    }
    const cancel = () => fail(new DOMException('Image consumer aborted', 'AbortError'))
    signals.forEach(signal => signal.addEventListener('abort', cancel, { once: true }))
    if (signals.some(signal => signal.aborted)) { cancel(); return }
    entry.promise.then(blob => finished ? null : this.decode(blob, {
      ...this.original.options, colorSpaceConversion: 'none',
    })).then(bitmap => {
      if (!bitmap) return
      if (finished) { bitmap.close(); return }
      try { if (onLoad) onLoad(bitmap); else bitmap.close() }
      catch (error) { entry.evict(); fail(error) }
      finally { finish() }
    }).catch(error => {
      // An old cancelled consumer must not evict another parser's live bytes.
      if (finished) return
      entry.evict()
      fail(error)
    })
  }

  override abort() {
    this.consumerAbort.abort()
    this.consumerAbort = new AbortController()
    this.original.abort()
    return this
  }
}
