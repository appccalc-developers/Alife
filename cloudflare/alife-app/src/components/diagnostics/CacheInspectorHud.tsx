import React, { useEffect, useState } from 'react'
import { cacheDiagnosticStore, type CacheDiagnosticEntry, type InvalidationLogEntry } from '../../stores/cacheDiagnosticStore'
import { useAuthStore } from '../../stores/auth'
import { Activity, Wifi, Zap, Trash2, RefreshCw, X, ChevronRight, ChevronDown } from 'lucide-react'

export const useCacheInspectorAuth = () => {
  const auth = useAuthStore()
  return Boolean(
    import.meta.env.DEV ||
    auth.isAdmin ||
    auth.hasAdminPermission('admin.diagnostics.view') ||
    auth.hasAdminPermission('admin.cloudflareCache.refresh') ||
    auth.canReviewPages ||
    auth.me?.platformRole === 'superadmin' ||
    auth.me?.platformRole === 'admin'
  )
}

export const CacheInspectorToggleButton: React.FC<{ className?: string }> = ({ className }) => {
  const isAuthorized = useCacheInspectorAuth()
  const auth = useAuthStore()
  const [isEnabled, setIsEnabled] = useState(cacheDiagnosticStore.isInspectorEnabled())

  useEffect(() => {
    return cacheDiagnosticStore.subscribe(() => {
      setIsEnabled(cacheDiagnosticStore.isInspectorEnabled())
    })
  }, [])

  if (!isAuthorized) {
    return null
  }

  const isZh = auth.language === 'zh'

  return (
    <button
      type="button"
      onClick={() => cacheDiagnosticStore.toggleInspector()}
      className={
        className ??
        `alife-icon-button transition-colors ${
          isEnabled
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'
            : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
        }`
      }
      aria-label="Toggle Cache Inspector"
      title={isEnabled ? (isZh ? '关闭缓存诊断面板' : 'Close Cache Inspector') : (isZh ? '开启缓存诊断面板' : 'Open Cache Inspector')}
    >
      <Activity className={`h-4 w-4 ${isEnabled ? 'text-emerald-600 animate-pulse' : 'text-zinc-500'}`} />
    </button>
  )
}

const formatBytes = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const copyDict = {
  zh: {
    panelTitle: 'Alife 三层缓存全链路诊断面板',
    toggleTitle: '展开三层缓存诊断面板 (Ctrl+Shift+C)',
    inspectorTitle: '⚡ 缓存诊断面板',
    offlineBanner: '📶 模拟断网模式中',
    offlineBtnOn: '模拟断网 (已开启)',
    offlineBtnOff: '模拟断网体验',
    purgeTestBtn: '模拟缓存失效',
    clearL1Btn: '清空本地缓存',
    clearLogsBtn: '清空日志',
    cardHitRate: '🎯 缓存总命中率',
    cardSaved: '📦 累计节省网络流量',
    cardHitTime: '⚡ 缓存响应速度',
    cardSpeedup: '🚀 相比数据库加速',
    tabRequests: '实时 API 请求流水',
    tabInvalidations: '缓存失效与变更日志',
    emptyRequests: '尚无 API 请求记录，请在页面上进行操作...',
    emptyInvalidations: '尚无缓存失效记录。当发布活动、修改小组或触发数据更新时会在此处实时播报。',
    savedText: '省',
    fastText: '速捷',
    ultimateText: '极致',
    fasterText: '快',
    pills: {
      l1Hit: '🟢 L1 本地免网缓存 (304)',
      l2Hit: '🔵 L2 Cloudflare 边缘缓存',
      l3Hit: '🟣 L3 .NET 内存缓存',
      offlineSim: '📶 离线模拟数据',
      dbQuery: '⚙️ 直连数据库 (MISS)',
      serverError: '🔴 服务器异常',
    },
  },
  en: {
    panelTitle: 'Alife 3-Tier Cache Diagnostics',
    toggleTitle: 'Toggle 3-Tier Cache Inspector (Ctrl+Shift+C)',
    inspectorTitle: '⚡ Cache Inspector',
    offlineBanner: '📶 Simulated Offline Mode',
    offlineBtnOn: 'Offline (ON)',
    offlineBtnOff: 'Simulate Offline',
    purgeTestBtn: 'Purge Test',
    clearL1Btn: 'Clear L1 Cache',
    clearLogsBtn: 'Clear Logs',
    cardHitRate: '🎯 Cache Hit Rate',
    cardSaved: '📦 Bandwidth Saved',
    cardHitTime: '⚡ Hit Latency',
    cardSpeedup: '🚀 DB Speedup',
    tabRequests: 'API Request Stream',
    tabInvalidations: 'Cache Invalidation Stream',
    emptyRequests: 'No API requests recorded yet. Perform actions on the app...',
    emptyInvalidations: 'No cache invalidation events recorded yet. Invalidation triggers will stream here.',
    savedText: 'Saved',
    fastText: 'Fast',
    ultimateText: 'Optimal',
    fasterText: 'faster',
    pills: {
      l1Hit: '🟢 L1 Local ETag Cache (304)',
      l2Hit: '🔵 L2 Edge Cache (Cloudflare)',
      l3Hit: '🟣 L3 .NET Memory (HybridCache)',
      offlineSim: '📶 Simulated Offline',
      dbQuery: '⚙️ Direct DB Query (MISS)',
      serverError: '🔴 Server Error',
    },
  },
}

const ETagWaterfallPipeline: React.FC<{ d: CacheDiagnosticEntry; lang: 'zh' | 'en' }> = ({ d, lang }) => {
  const isZh = lang === 'zh'
  const idbMs = d.idbMs ?? 1
  const networkMs = d.networkMs ?? Math.max(1, d.rttMs - idbMs)
  const isSqlSkipped = d.sqlSkipped ?? (d.status === 304 || d.edgeCache === 'HIT' || d.backendCache === 'HIT')

  return (
    <div className="mt-2 p-2.5 bg-zinc-950/90 border border-zinc-800 rounded-xl space-y-2 font-sans select-none animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 border-b border-zinc-800/80 pb-1.5">
        <span className="flex items-center gap-1 text-emerald-400 font-mono">
          ⚡ {isZh ? 'ETag 缓存全路径耗时拆解 (Waterfall Breakdown)' : 'Visual ETag Waterfall Breakdown'}
        </span>
        <span className="font-mono text-[10px] text-zinc-400">Total: {d.rttMs} ms</span>
      </div>

      {/* 4-Step Pipeline Breakdown Bars */}
      <div className="space-y-1.5 text-[10px] font-mono">
        {/* Step 1: IndexedDB Lookup */}
        <div className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-zinc-400 font-sans truncate">
            1. {isZh ? 'IndexedDB 校验' : 'IndexedDB Lookup'}
          </span>
          <div className="flex-1 bg-zinc-900 h-3 rounded-full overflow-hidden flex items-center px-1 border border-zinc-800">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(8, (idbMs / d.rttMs) * 100))}%` }} />
          </div>
          <span className="w-12 text-right text-emerald-400 font-bold">{idbMs} ms</span>
        </div>

        {/* Step 2: Edge Network RTT */}
        <div className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-zinc-400 font-sans truncate">
            2. {isZh ? 'Cloudflare 304 校验' : 'Cloudflare 304 RTT'}
          </span>
          <div className="flex-1 bg-zinc-900 h-3 rounded-full overflow-hidden flex items-center px-1 border border-zinc-800">
            <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(8, (networkMs / d.rttMs) * 100))}%` }} />
          </div>
          <span className="w-12 text-right text-cyan-400 font-bold">{networkMs} ms</span>
        </div>

        {/* Step 3: .NET HybridCache */}
        <div className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-zinc-400 font-sans truncate">
            3. {isZh ? '.NET HybridCache' : '.NET HybridCache'}
          </span>
          <div className="flex-1 bg-zinc-900 h-3 rounded-full overflow-hidden flex items-center px-1 border border-zinc-800">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${d.backendCache === 'HIT' ? 'bg-purple-500 w-full' : 'bg-zinc-800 w-0'}`} />
          </div>
          <span className={`w-12 text-right font-bold ${d.backendCache === 'HIT' ? 'text-purple-400' : 'text-zinc-500'}`}>
            {d.backendCache === 'HIT' ? 'HIT' : '0 ms'}
          </span>
        </div>

        {/* Step 4: EF Core SQL Database Query */}
        <div className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-zinc-400 font-sans truncate">
            4. {isZh ? 'SQL 数据库查询' : 'SQL Database Query'}
          </span>
          <div className="flex-1 bg-zinc-900 h-3 rounded-full overflow-hidden flex items-center px-1 border border-zinc-800">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${isSqlSkipped ? 'bg-zinc-800 w-0' : 'bg-rose-500 w-full'}`} />
          </div>
          <span className={`w-12 text-right font-bold ${isSqlSkipped ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isSqlSkipped ? (isZh ? '0ms 跳过' : '0ms Skip') : 'SQL Exec'}
          </span>
        </div>
      </div>

      {/* Visual Pipeline Result Callout */}
      <div className="p-2 bg-zinc-900/90 rounded-lg text-[10px] text-zinc-300 font-sans flex items-center justify-between border border-zinc-800/80 mt-1">
        <span className="flex items-center gap-1.5 font-medium">
          {isSqlSkipped ? '⚡' : '⚙️'}
          {isSqlSkipped
            ? (isZh ? '缓存成功全路径拦截！SQL 数据库查询 0 次，零负载。' : 'Cache fully intercepted! 0 SQL queries executed.')
            : (isZh ? '缓存未命中，穿透直连 EF Core 与 SQL Server 数据库。' : 'Cache miss, executed EF Core SQL query.')}
        </span>
        {d.bytesSaved ? (
          <span className="font-bold text-amber-400 font-mono">
            {isZh ? `省流量 ${formatBytes(d.bytesSaved)}` : `Saved ${formatBytes(d.bytesSaved)}`}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export const CacheInspectorHud: React.FC = () => {
  const isAuthorized = useCacheInspectorAuth()
  const auth = useAuthStore()
  const [isEnabled, setIsEnabled] = useState(cacheDiagnosticStore.isInspectorEnabled())
  const [isOffline, setIsOffline] = useState(cacheDiagnosticStore.isOfflineSimulated())
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'requests' | 'invalidations'>('requests')
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<CacheDiagnosticEntry[]>(cacheDiagnosticStore.getDiagnostics())
  const [invalidationLogs, setInvalidationLogs] = useState<InvalidationLogEntry[]>(cacheDiagnosticStore.getInvalidationLogs())

  const lang = auth.language === 'zh' ? 'zh' : 'en'
  const t = copyDict[lang]

  useEffect(() => {
    const unsubscribe = cacheDiagnosticStore.subscribe(() => {
      setIsEnabled(cacheDiagnosticStore.isInspectorEnabled())
      setIsOffline(cacheDiagnosticStore.isOfflineSimulated())
      setDiagnostics([...cacheDiagnosticStore.getDiagnostics()])
      setInvalidationLogs([...cacheDiagnosticStore.getInvalidationLogs()])
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAuthorized && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        cacheDiagnosticStore.toggleInspector()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAuthorized])

  if (!isAuthorized || !isEnabled) {
    return null
  }

  const l1Hits = diagnostics.filter((d) => d.clientCache === 'HIT_304').length
  const l2Hits = diagnostics.filter((d) => d.edgeCache === 'HIT' || d.edgeCache === 'REVALIDATED').length
  const l3Hits = diagnostics.filter((d) => d.backendCache === 'HIT').length
  const totalHits = l1Hits + l2Hits + l3Hits
  const total = diagnostics.length
  const hitRatePct = total > 0 ? Math.round((totalHits / total) * 100) : 0

  const bytesSaved = cacheDiagnosticStore.getTotalBytesSaved()
  const { avgHitMs, speedupPct } = cacheDiagnosticStore.getLatencyStats()

  const getPrimaryStatusPill = (d: CacheDiagnosticEntry) => {
    if (d.status >= 500) {
      return (
        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-medium text-[10px]">
          {t.pills.serverError} ({d.status})
        </span>
      )
    }

    if (d.clientCache === 'HIT_304') {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium text-[10px]">
          {t.pills.l1Hit}
        </span>
      )
    }

    if (d.edgeCache === 'HIT' || d.edgeCache === 'REVALIDATED') {
      return (
        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-medium text-[10px]">
          {t.pills.l2Hit}
        </span>
      )
    }

    if (d.backendCache === 'HIT') {
      return (
        <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60 font-medium text-[10px]">
          {t.pills.l3Hit}
        </span>
      )
    }

    if (d.edgeCache === 'OFFLINE_SIMULATED') {
      return (
        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-medium text-[10px]">
          {t.pills.offlineSim}
        </span>
      )
    }

    return (
      <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700/60 font-medium text-[10px]">
        {t.pills.dbQuery}
      </span>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans text-xs select-none">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 text-zinc-100 border shadow-2xl rounded-full hover:bg-zinc-800 transition backdrop-blur-md cursor-pointer ${
            isOffline ? 'bg-amber-950/95 border-amber-600/80' : 'bg-zinc-900/95 border-zinc-700/80'
          }`}
          title={t.toggleTitle}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOffline ? 'bg-amber-400 opacity-75' : 'bg-emerald-400 opacity-75'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOffline ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="font-semibold text-xs tracking-wide">
            {isOffline ? t.offlineBanner : t.inspectorTitle}
          </span>
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-full font-mono text-[10px]">
            {hitRatePct}%
          </span>
        </button>
      ) : (
        <div className="w-[600px] max-w-[calc(100vw-32px)] bg-zinc-950/95 text-zinc-200 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-[580px]">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400 fill-emerald-400" />
              <span className="font-bold text-zinc-100 text-xs tracking-wide">{t.panelTitle}</span>
              <span className="text-[10px] text-zinc-500 font-mono">(Ctrl+Shift+C)</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Action Control Bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/50 border-b border-zinc-800/80 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => cacheDiagnosticStore.toggleOfflineSimulation()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  isOffline
                    ? 'bg-amber-950 text-amber-200 border border-amber-600/80 animate-pulse'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60'
                }`}
              >
                <Wifi className="h-3.5 w-3.5" />
                {isOffline ? t.offlineBtnOn : t.offlineBtnOff}
              </button>
              <button
                onClick={async () => {
                  await cacheDiagnosticStore.triggerPurgeTest()
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-800/60 rounded-md transition cursor-pointer font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.purgeTestBtn}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => {
                  await cacheDiagnosticStore.clearClientDbCache()
                }}
                className="flex items-center gap-1 px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 rounded-md transition cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                {t.clearL1Btn}
              </button>
              <button
                onClick={() => cacheDiagnosticStore.clearDiagnostics()}
                className="px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition cursor-pointer"
              >
                {t.clearLogsBtn}
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-4 gap-2 p-3 bg-zinc-900/30 border-b border-zinc-800/60">
            <div className="p-2.5 bg-zinc-900/80 rounded-xl border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 font-medium">{t.cardHitRate}</div>
              <div className="text-sm font-bold text-emerald-400 font-mono mt-1">
                {hitRatePct}%
                <span className="text-[10px] font-normal text-zinc-500 ml-1">({totalHits}/{total})</span>
              </div>
            </div>
            <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 font-medium">{t.cardSaved}</div>
              <div className="text-sm font-bold text-amber-400 font-mono mt-1">
                {formatBytes(bytesSaved)}
              </div>
            </div>
            <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 font-medium">{t.cardHitTime}</div>
              <div className="text-sm font-bold text-cyan-400 font-mono mt-1">
                {avgHitMs > 0 ? `${avgHitMs} ms` : t.fastText}
              </div>
            </div>
            <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 font-medium">{t.cardSpeedup}</div>
              <div className="text-sm font-bold text-purple-400 font-mono mt-1">
                {speedupPct > 0 ? `${t.fasterText} ${speedupPct}%` : t.ultimateText}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-800 px-3 bg-zinc-900/20">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2.5 px-3 text-[11px] font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'requests'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.tabRequests} ({diagnostics.length})
            </button>
            <button
              onClick={() => setActiveTab('invalidations')}
              className={`py-2.5 px-3 text-[11px] font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'invalidations'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.tabInvalidations} ({invalidationLogs.length})
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-2.5 font-mono text-[11px] space-y-1.5">
            {activeTab === 'requests' ? (
              diagnostics.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 italic">{t.emptyRequests}</div>
              ) : (
                diagnostics.map((d) => {
                  const isExpanded = expandedRequestId === d.id
                  return (
                    <div
                      key={d.id}
                      className="p-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/60 rounded-xl flex flex-col gap-1.5 transition cursor-pointer"
                      onClick={() => setExpandedRequestId(isExpanded ? null : d.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate font-sans font-semibold text-zinc-100 text-xs" title={d.path}>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />}
                          <span className="truncate">{d.path}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-zinc-400 font-mono">{d.rttMs} ms</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.status === 304
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : d.status === 200
                                ? 'bg-blue-950 text-blue-400 border border-blue-800/60'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            HTTP {d.status || 'ERR'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {getPrimaryStatusPill(d)}
                          {d.bytesSaved ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50 font-sans text-[10px]">
                              {t.savedText} {formatBytes(d.bytesSaved)}
                            </span>
                          ) : null}
                        </div>

                        {d.etag && (
                          <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[160px]" title={`ETag: ${d.etag}`}>
                            ETag: {d.etag.replace(/"/g, '')}
                          </span>
                        )}
                      </div>

                      {/* Expandable Visual Waterfall Breakdown */}
                      {isExpanded ? <ETagWaterfallPipeline d={d} lang={lang} /> : null}
                    </div>
                  )
                })
              )
            ) : invalidationLogs.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 italic">{t.emptyInvalidations}</div>
            ) : (
              invalidationLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-zinc-900/80 border border-amber-900/50 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-amber-300 font-sans font-semibold text-xs">
                    <span>⚡ {log.method}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[11px] text-zinc-200 font-mono">{log.path}</div>
                  {log.target && <div className="text-[10px] text-amber-400/90 font-sans italic">{log.target}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
