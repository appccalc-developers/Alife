import { createStore, get, set } from 'idb-keyval'

type CacheMeta = {
  lastModified?: string
  lastSuccessAt?: number
}

type CacheRecord<TData> = {
  meta: CacheMeta
  data?: TData
}

const STORAGE_PREFIX = 'alife:db:cache:'
const idbStore = createStore('alife-cache-db', 'http-cache')

const getStorageKey = (queryKey: readonly unknown[]) => `${STORAGE_PREFIX}${JSON.stringify(queryKey)}`

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
  const previous = await readRecord<TData>(queryKey)
  const headers = new Headers()

  if (previous?.meta.lastModified) {
    headers.set('If-Modified-Since', previous.meta.lastModified)
  }

  const response = await fetch(toAbsoluteUrl(path), {
    method: 'GET',
    credentials: 'include',
    headers,
  })

  if (response.status === 304 && previous?.data !== undefined) {
    return previous.data
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  const rawData = (await response.json()) as unknown
  const data = parser ? parser(rawData) : (rawData as TData)
  const lastModified = response.headers.get('Last-Modified') ?? previous?.meta.lastModified

  await writeRecord<TData>(queryKey, {
    meta: {
      lastModified: lastModified ?? undefined,
      lastSuccessAt: Date.now(),
    },
    data,
  })

  return data
}

export const getCachedRecord = <TData>(queryKey: readonly unknown[]) => readRecord<TData>(queryKey)
