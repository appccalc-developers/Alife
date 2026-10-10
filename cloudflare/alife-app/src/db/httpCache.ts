import { HttpStatusError } from './httpError'
import { cacheDiagnosticStore } from '../stores/cacheDiagnosticStore'
import { clear, createStore, delMany, get, keys, set } from 'idb-keyval'

const idbStore = createStore('alife-cache-db', 'http-cache')
const inFlightGets = new Map<string, { request: Promise<unknown>; controller: AbortController }>()
// Serialize writes and removals so an already-started IDB write cannot finish
// after an invalidation and resurrect the removed response.
let cacheWrites: Promise<unknown> = Promise.resolve()
const queueCacheWrite = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = cacheWrites.then(operation)
  cacheWrites = next.catch(() => undefined)
  return next
}

export type CachedHttpResponse<TData> = {
  etag: string
  data: TData
  storedAt: number
}

export type ConditionalGetOptions<TData> = {
  queryKey: readonly unknown[]
  path: string
  parser?: (data: unknown) => TData
  signal?: AbortSignal
}

const buildStorageKey = (queryKey: readonly unknown[]) => {
  return JSON.stringify(queryKey)
}

const readRecord = async <TData>(queryKey: readonly unknown[]): Promise<CachedHttpResponse<TData> | undefined> => {
  try {
    return await get<CachedHttpResponse<TData>>(buildStorageKey(queryKey), idbStore)
  } catch (error) {
    console.warn('[httpCache] Failed to read from IndexedDB:', error)
    return undefined
  }
}

const writeRecord = async <TData>(queryKey: readonly unknown[], record: CachedHttpResponse<TData>, signal: AbortSignal): Promise<void> => {
  try {
    await queueCacheWrite(async () => {
      signal.throwIfAborted()
      await set(buildStorageKey(queryKey), record, idbStore)
    })
  } catch (error) {
    signal.throwIfAborted()
    console.warn('[httpCache] Failed to write to IndexedDB:', error)
  }
}

export const getCachedRecord = async <TData>(queryKey: readonly unknown[]): Promise<CachedHttpResponse<TData> | undefined> => {
  return readRecord<TData>(queryKey)
}

export const removeCachedRecord = async (queryKey: readonly unknown[]): Promise<void> => {
  await removeCachedRecords(queryKey, true)
}

const matchesKey = (key: unknown, prefix: readonly unknown[], exact: boolean) => {
  if (typeof key !== 'string') return false
  try {
    const parsed: unknown = JSON.parse(key)
    return Array.isArray(parsed) && (!exact || parsed.length === prefix.length) &&
      prefix.every((part, index) => JSON.stringify(part) === JSON.stringify(parsed[index]))
  } catch { return false }
}

export const removeCachedRecords = async (prefix: readonly unknown[], exact = false): Promise<void> => {
  for (const [key, entry] of inFlightGets) {
    if (!matchesKey(key, prefix, exact)) continue
    entry.controller.abort()
    inFlightGets.delete(key)
  }
  try {
    await queueCacheWrite(async () => {
      const matchingKeys = (await keys(idbStore)).filter(key => matchesKey(key, prefix, exact))
      await delMany(matchingKeys, idbStore)
    })
  } catch (error) {
    console.warn('[httpCache] Failed to remove records from IndexedDB:', error)
  }
}

export const clearHttpCacheStore = async (): Promise<void> => {
  for (const entry of inFlightGets.values()) entry.controller.abort()
  inFlightGets.clear()
  try {
    await queueCacheWrite(() => clear(idbStore))
  } catch (error) {
    console.warn('[httpCache] Failed to clear IndexedDB:', error)
  }
}

const toAbsoluteUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Keep development requests same-origin so Vite can proxy `/api/*`.
  // This also preserves credentialed cookie behavior without requiring local CORS.
  const apiBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (apiBase) {
    const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase
    const relative = path.startsWith('/') ? path : `/${path}`
    return `${base}${relative}`
  }

  return path
}

export const conditionalGet = async <TData>(options: ConditionalGetOptions<TData>): Promise<TData> => {
  const inFlightKey = buildStorageKey(options.queryKey)

  if (inFlightGets.has(inFlightKey)) {
    const data = await inFlightGets.get(inFlightKey)!.request
    options.signal?.throwIfAborted()
    return data as TData
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.throwIfAborted()
  options.signal?.addEventListener('abort', abort, { once: true })
  const request = executeConditionalGet({ ...options, signal: controller.signal })
  inFlightGets.set(inFlightKey, { request, controller })

  try {
    return await request
  } finally {
    options.signal?.removeEventListener('abort', abort)
    if (inFlightGets.get(inFlightKey)?.request === request) inFlightGets.delete(inFlightKey)
  }
}

const executeConditionalGet = async <TData>({ queryKey, path, parser, signal }: ConditionalGetOptions<TData> & { signal: AbortSignal }): Promise<TData> => {
  const idbStart = performance.now()
  const previous = await readRecord<TData>(queryKey)
  signal.throwIfAborted()
  const idbMs = Math.max(1, Math.round(performance.now() - idbStart))

  // 0. Handle Simulated Offline Mode
  if (cacheDiagnosticStore.isOfflineSimulated()) {
    if (previous?.data !== undefined) {
      const estimatedBytes = JSON.stringify(previous.data).length
      cacheDiagnosticStore.recordDiagnostic({
        path,
        status: 304,
        clientCache: 'HIT_304',
        edgeCache: 'OFFLINE_SIMULATED',
        backendCache: 'OFFLINE_SIMULATED',
        etag: previous.etag,
        rttMs: idbMs + 1,
        idbMs,
        networkMs: 1,
        sqlSkipped: true,
        bytesSaved: estimatedBytes,
      })
      return previous.data
    }

    cacheDiagnosticStore.recordDiagnostic({
      path,
      status: 0,
      clientCache: 'ERROR',
      edgeCache: 'OFFLINE_SIMULATED',
      backendCache: 'OFFLINE_SIMULATED',
      rttMs: idbMs,
      idbMs,
      networkMs: 0,
      sqlSkipped: false,
    })
    throw new Error(`Simulated Offline: GET ${path} failed (no IndexedDB cache entry)`)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (previous?.etag) {
    headers['If-None-Match'] = previous.etag
  }

  const networkStart = performance.now()

  let response: Response
  try {
    response = await fetch(toAbsoluteUrl(path), {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    const networkMs = Math.round(performance.now() - networkStart)
    cacheDiagnosticStore.recordDiagnostic({
      path,
      status: 0,
      clientCache: 'ERROR',
      edgeCache: 'UNKNOWN',
      backendCache: 'UNKNOWN',
      rttMs: idbMs + networkMs,
      idbMs,
      networkMs,
      sqlSkipped: false,
    })
    throw error
  }

  const networkMs = Math.round(performance.now() - networkStart)
  signal.throwIfAborted()
  const totalRtt = idbMs + networkMs
  const edgeCache = response.headers.get('x-alife-cache') ?? 'UNKNOWN'
  const backendCache = response.headers.get('x-alife-backend-cache') ?? 'UNKNOWN'
  const sqlSkipped = edgeCache === 'HIT' || edgeCache === 'REVALIDATED' || backendCache === 'HIT'

  // 304 Not Modified — return cached data
  if (response.status === 304 && previous?.data !== undefined) {
    await writeRecord<TData>(queryKey, {
      etag: previous.etag,
      data: previous.data,
      storedAt: Date.now(),
    }, signal)

    const estimatedBytes = JSON.stringify(previous.data).length

    cacheDiagnosticStore.recordDiagnostic({
      path,
      status: 304,
      clientCache: 'HIT_304',
      edgeCache,
      backendCache,
      etag: previous.etag,
      rttMs: totalRtt,
      idbMs,
      networkMs,
      sqlSkipped,
      bytesSaved: estimatedBytes,
    })

    signal.throwIfAborted()
    return previous.data
  }

  if (!response.ok) {
    cacheDiagnosticStore.recordDiagnostic({
      path,
      status: response.status,
      clientCache: 'ERROR',
      edgeCache,
      backendCache,
      rttMs: totalRtt,
      idbMs,
      networkMs,
      sqlSkipped,
    })
    throw new HttpStatusError(path, response.status)
  }

  // Extract ETag from response headers
  const etag = response.headers.get('ETag') ?? undefined
  const rawData = (await response.json()) as unknown
  signal.throwIfAborted()
  const data = parser ? parser(rawData) : (rawData as TData)

  if (etag) {
    await writeRecord<TData>(queryKey, { etag, data, storedAt: Date.now() }, signal)
  }

  cacheDiagnosticStore.recordDiagnostic({
    path,
    status: response.status,
    clientCache: etag ? 'MISS_200' : 'NO_ETAG',
    edgeCache,
    backendCache,
    etag,
    rttMs: totalRtt,
    idbMs,
    networkMs,
    sqlSkipped,
  })

  signal.throwIfAborted()
  return data
}
