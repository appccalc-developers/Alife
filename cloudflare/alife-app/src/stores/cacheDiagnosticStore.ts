import { clear, createStore } from 'idb-keyval'

export type CacheDiagnosticEntry = {
  id: string
  timestamp: number
  path: string
  status: number
  clientCache: 'HIT_304' | 'MISS_200' | 'NO_ETAG' | 'ERROR'
  edgeCache: string // HIT, MISS, REVALIDATED, BYPASS, UNKNOWN
  backendCache: string // HIT, MISS, UNKNOWN
  etag?: string
  rttMs: number
  bytesSaved?: number
  idbMs?: number
  networkMs?: number
  sqlSkipped?: boolean
}

export type InvalidationLogEntry = {
  id: string
  timestamp: number
  method: string
  path: string
  target?: string
}

type Listener = () => void

const MAX_ENTRIES = 50
const idbStore = createStore('alife-cache-db', 'http-cache')

let diagnostics: CacheDiagnosticEntry[] = []
let invalidationLogs: InvalidationLogEntry[] = []
const listeners: Set<Listener> = new Set()
let isInspectorEnabled = false
let isOfflineSimulated = false

// Initialize default inspector state
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('alife_cache_inspector_enabled')
  if (stored !== null) {
    isInspectorEnabled = stored === 'true'
  } else {
    isInspectorEnabled = import.meta.env.DEV
  }
}

const notify = () => {
  listeners.forEach((l) => l())
}

export const cacheDiagnosticStore = {
  getDiagnostics: () => diagnostics,
  getInvalidationLogs: () => invalidationLogs,
  isInspectorEnabled: () => isInspectorEnabled,
  isOfflineSimulated: () => isOfflineSimulated,

  setInspectorEnabled: (enabled: boolean) => {
    isInspectorEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('alife_cache_inspector_enabled', String(enabled))
    }
    notify()
  },

  toggleInspector: () => {
    cacheDiagnosticStore.setInspectorEnabled(!isInspectorEnabled)
  },

  toggleOfflineSimulation: () => {
    isOfflineSimulated = !isOfflineSimulated
    cacheDiagnosticStore.recordInvalidation({
      method: 'NETWORK',
      path: isOfflineSimulated ? 'Simulated Offline Mode ENABLED' : 'Simulated Offline Mode DISABLED',
      target: isOfflineSimulated ? 'Intercepting fetch — serving purely from IndexedDB ETag cache' : 'Restored live network pipeline',
    })
    notify()
  },

  triggerPurgeTest: async () => {
    // 1. Record invalidation cascade event
    cacheDiagnosticStore.recordInvalidation({
      method: 'MUTATION',
      path: '/api/internal/cache/invalidate',
      target: 'Triggered Purge Cascade: Backend Tag Remove -> Cloudflare Edge Purge -> Client ETag Evict',
    })

    // 2. Evict local client IndexedDB cache
    if (typeof window !== 'undefined') {
      await clear(idbStore)
    }

    notify()
  },

  recordDiagnostic: (entry: Omit<CacheDiagnosticEntry, 'id' | 'timestamp'>) => {
    const fullEntry: CacheDiagnosticEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    }

    diagnostics = [fullEntry, ...diagnostics].slice(0, MAX_ENTRIES)
    notify()
  },

  recordInvalidation: (log: Omit<InvalidationLogEntry, 'id' | 'timestamp'>) => {
    const fullLog: InvalidationLogEntry = {
      ...log,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    }

    invalidationLogs = [fullLog, ...invalidationLogs].slice(0, MAX_ENTRIES)
    notify()
  },

  clearDiagnostics: () => {
    diagnostics = []
    invalidationLogs = []
    notify()
  },

  clearClientDbCache: async () => {
    if (typeof window !== 'undefined') {
      await clear(idbStore)
      cacheDiagnosticStore.recordInvalidation({
        method: 'LOCAL',
        path: 'IndexedDB (http-cache)',
        target: 'Cleared all cached ETags & responses',
      })
    }
  },

  /**
   * Calculates total bandwidth saved (in Bytes) across 304 hits
   */
  getTotalBytesSaved: () => {
    return diagnostics.reduce((sum, d) => sum + (d.bytesSaved ?? 0), 0)
  },

  /**
   * Calculates latency statistics (Hit vs Miss average latency & speedup %)
   */
  getLatencyStats: () => {
    const hits = diagnostics.filter((d) => d.clientCache === 'HIT_304' || d.edgeCache === 'HIT')
    const misses = diagnostics.filter((d) => d.clientCache === 'MISS_200' && d.edgeCache === 'MISS')

    const avgHitMs = hits.length > 0 ? Math.round(hits.reduce((s, d) => s + d.rttMs, 0) / hits.length) : 0
    const avgMissMs = misses.length > 0 ? Math.round(misses.reduce((s, d) => s + d.rttMs, 0) / misses.length) : 0

    let speedupPct = 0
    if (avgMissMs > 0 && avgHitMs > 0 && avgHitMs < avgMissMs) {
      speedupPct = Math.round(((avgMissMs - avgHitMs) / avgMissMs) * 100)
    }

    return { avgHitMs, avgMissMs, speedupPct }
  },

  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
