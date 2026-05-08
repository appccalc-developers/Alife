import { createStore, get, set } from 'idb-keyval'

type CacheMeta = {
  timestamp?: number
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

  // 拼接 timestamp query 参数
  const url = new URL(toAbsoluteUrl(path), window.location.origin)
  if (previous?.meta.timestamp) {
    url.searchParams.set('timestamp', String(previous.meta.timestamp))
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
  })

  if (response.status === 304 && previous?.data !== undefined) {
    return previous.data
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  const rawData = (await response.json()) as unknown
  const data = parser ? parser(rawData) : (rawData as TData)

  await writeRecord<TData>(queryKey, {
    meta: {
      timestamp: Date.now(), // 可以根据需要改为服务器返回的时间戳!!
    },
    data,
  })

  return data
}

export const getCachedRecord = <TData>(queryKey: readonly unknown[]) => readRecord<TData>(queryKey)
