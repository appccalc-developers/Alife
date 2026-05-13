import { createStore, get, set } from 'idb-keyval'

type CacheRecord<TData> = {
  etag: string
  data: TData
}

const STORAGE_PREFIX = 'alife:db:cache:etag:'
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 如果有缓存的 etag，放到 If-None-Match 请求头
  if (previous?.etag) {
    headers['If-None-Match'] = previous.etag
  }

  const response = await fetch(toAbsoluteUrl(path), {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  // 304 Not Modified — 返回缓存数据
  if (response.status === 304 && previous?.data !== undefined) {
    return previous.data
  }

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  // 从响应头中获取 etag
  const etag = response.headers.get('ETag')
  if (!etag) {
    throw new Error(`GET ${path} response missing ETag header`)
  }

  const rawData = (await response.json()) as unknown
  const data = parser ? parser(rawData) : (rawData as TData)

  // 以 etag 作为缓存 key 存入 DB
  await writeRecord<TData>(queryKey, { etag, data })

  return data
}

export const getCachedRecord = <TData>(queryKey: readonly unknown[]) => readRecord<TData>(queryKey)

