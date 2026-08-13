import { cacheDiagnosticStore } from '../stores/cacheDiagnosticStore'
import { clear, createStore, get, set } from 'idb-keyval'

const idbStore = createStore('alife-cache-db', 'http-cache')
const inFlightGets = new Map<string, Promise<unknown>>()

export type CachedHttpResponse<TData> = {
  etag: string
  data: TData
  storedAt: number
}

export type ConditionalGetOptions<TData> = {
  queryKey: readonly unknown[]
  path: string
  parser?: (data: unknown) => TData
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

const writeRecord = async <TData>(queryKey: readonly unknown[], record: CachedHttpResponse<TData>): Promise<void> => {
  try {
    await set(buildStorageKey(queryKey), record, idbStore)
  } catch (error) {
    console.warn('[httpCache] Failed to write to IndexedDB:', error)
  }
}

export const getCachedRecord = async <TData>(queryKey: readonly unknown[]): Promise<CachedHttpResponse<TData> | undefined> => {
  return readRecord<TData>(queryKey)
}

export const removeCachedRecord = async (queryKey: readonly unknown[]): Promise<void> => {
  try {
    const { del } = await import('idb-keyval')
    await del(buildStorageKey(queryKey), idbStore)
  } catch (error) {
    console.warn('[httpCache] Failed to remove record from IndexedDB:', error)
  }
}

export const clearHttpCacheStore = async (): Promise<void> => {
  try {
    await clear(idbStore)
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
    return (await inFlightGets.get(inFlightKey)) as TData
  }

  const request = executeConditionalGet(options)
  inFlightGets.set(inFlightKey, request)

  try {
    return await request
  } finally {
    inFlightGets.delete(inFlightKey)
  }
}

const executeConditionalGet = async <TData>({ queryKey, path, parser }: ConditionalGetOptions<TData>): Promise<TData> => {
  const idbStart = performance.now()
  const previous = await readRecord<TData>(queryKey)
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
    })

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
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  // Extract ETag from response headers
  const etag = response.headers.get('ETag') ?? undefined
  const rawData = (await response.json()) as unknown
  const data = parser ? parser(rawData) : (rawData as TData)

  if (etag) {
    await writeRecord<TData>(queryKey, { etag, data, storedAt: Date.now() })
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

  return data
}
