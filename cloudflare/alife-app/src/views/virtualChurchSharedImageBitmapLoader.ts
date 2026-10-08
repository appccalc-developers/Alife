import { Loader, type LoadingManager } from 'three'

type SharedBitmapEntry = {
  promise: Promise<ImageBitmap>
  bitmap?: ImageBitmap
  closeWhenReady: boolean
}

type LoadBitmap = (url: string, init: RequestInit) => Promise<ImageBitmap>

const loadBitmapFromNetwork: LoadBitmap = async (url, init) => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Unable to load shared image ${url}: HTTP ${response.status}`)
  return createImageBitmap(await response.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  })
}

/**
 * Deduplicates concurrent ImageBitmap requests without enabling Three.Cache.
 * Three r185 caches the final callback promise while a request is pending; that
 * promise resolves to undefined, so a concurrent GLTF can receive no image.
 * This loader keeps the actual ImageBitmap promise and fans it out safely.
 */
export class VirtualChurchSharedImageBitmapLoader extends Loader<ImageBitmap> {
  readonly isImageBitmapLoader = true
  private readonly entries = new Map<string, SharedBitmapEntry>()
  private readonly loadBitmap: LoadBitmap

  constructor(manager?: LoadingManager, loadBitmap: LoadBitmap = loadBitmapFromNetwork) {
    super(manager)
    this.loadBitmap = loadBitmap
  }

  load(
    inputUrl: string,
    onLoad: (bitmap: ImageBitmap) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    const url = this.manager.resolveURL(`${this.path ?? ''}${inputUrl ?? ''}`)
    this.manager.itemStart(url)
    let entry = this.entries.get(url)
    if (!entry) {
      const requestInit: RequestInit = {
        credentials: this.crossOrigin === 'anonymous' ? 'same-origin' : 'include',
        headers: this.requestHeader,
      }
      entry = {
        promise: this.loadBitmap(url, requestInit),
        closeWhenReady: false,
      }
      const ownedEntry = entry
      ownedEntry.promise = ownedEntry.promise.then((bitmap) => {
        ownedEntry.bitmap = bitmap
        if (ownedEntry.closeWhenReady) bitmap.close()
        return bitmap
      }).catch((error) => {
        if (this.entries.get(url) === ownedEntry) this.entries.delete(url)
        throw error
      })
      this.entries.set(url, ownedEntry)
    }

    entry.promise.then((bitmap) => {
      onLoad(bitmap)
      this.manager.itemEnd(url)
    }, (error) => {
      onError?.(error)
      this.manager.itemError(url)
      this.manager.itemEnd(url)
    })
  }

  clear() {
    for (const entry of this.entries.values()) {
      if (entry.bitmap) entry.bitmap.close()
      else entry.closeWhenReady = true
    }
    this.entries.clear()
  }

  get cachedUrlCount() {
    return this.entries.size
  }
}
