import { createStore, del, get, set } from 'idb-keyval'

type CacheRecord<TData> = {
  etag: string
  data: TData
  storedAt: number
}

const STORAGE_PREFIX = 'alife:db:cache:etag:'
const idbStore = createStore('alife-cache-db', 'http-cache')
const inFlightGets = new Map<string, Promise<unknown>>()

const getStorageKey = (queryKey: readonly unknown[]) => `${STORAGE_PREFIX}${JSON.stringify(queryKey)}`
const getInFlightKey = (queryKey: readonly unknown[], path: string) => `${JSON.stringify(queryKey)}:${path}`

const readRecord = async <TData>(queryKey: readonly unknown[]): Promise<CacheRecord<TData> | null> => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = await get<string | null>(getStorageKey(queryKey), idbStore)
  if (typeof raw !== 'string' || raw.length === 0) {
    return null
  }

  try {
    return JSON.parse(raw) as CacheRecord<TData>
  } catch {
    return null
  }
}

const writeRecord = async <TData>(queryKey: readonly unknown[], record: CacheRecord<TData>) => {
  if (typeof window === 'undefined') {
    return
  }

  await set(getStorageKey(queryKey), JSON.stringify(record), idbStore)
}

type ConditionalGetOptions<TData> = {
  queryKey: readonly unknown[]
  path: string
  parser?: (input: unknown) => TData
}

const productionBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const apiBaseUrl = import.meta.env.DEV ? '' : productionBaseUrl

const toAbsoluteUrl = (path: string) => {
  if (!apiBaseUrl) {
    return path
  }

  return `${apiBaseUrl}${path}`
}

export const conditionalGet = async <TData>({ queryKey, path, parser }: ConditionalGetOptions<TData>): Promise<TData> => {
  const inFlightKey = getInFlightKey(queryKey, path)
  const existing = inFlightGets.get(inFlightKey)
  if (existing) {
    return existing as Promise<TData>
  }

  const request = executeConditionalGet<TData>({ queryKey, path, parser })
  inFlightGets.set(inFlightKey, request)

  try {
    return await request
  } finally {
    inFlightGets.delete(inFlightKey)
  }
}

const executeConditionalGet = async <TData>({ queryKey, path, parser }: ConditionalGetOptions<TData>): Promise<TData> => {
  const previous = await readRecord<TData>(queryKey)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // If a cached ETag exists, include it in the If-None-Match request header
  if (previous?.etag) {
    headers['If-None-Match'] = previous.etag
  }

  const response = await fetch(toAbsoluteUrl(path), {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  // 304 Not Modified — return cached data
  if (response.status === 304 && previous?.data !== undefined) {
    await writeRecord<TData>(queryKey, {
      etag: previous.etag,
      data: previous.data,
      storedAt: Date.now(),
    })

    return previous.data
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  // Extract ETag from response headers
  const etag = response.headers.get('ETag')
  if (!etag) {
    // No ETag from backend — return data directly without 304 caching support
    const rawData = (await response.json()) as unknown
    return parser ? parser(rawData) : (rawData as TData)
  }

  const rawData = (await response.json()) as unknown
  const data = parser ? parser(rawData) : (rawData as TData)

  // Store data in DB keyed by ETag
  await writeRecord<TData>(queryKey, { etag, data, storedAt: Date.now() })

  return data
}

export const getCachedRecord = <TData>(queryKey: readonly unknown[]) => readRecord<TData>(queryKey)

export const removeCachedRecord = (queryKey: readonly unknown[]) => {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  return del(getStorageKey(queryKey), idbStore)
}

