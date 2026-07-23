import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, Play, Search, Sparkles } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'

export type TranscriptSegment = {
  id: string
  start: number // Seconds
  end: number // Seconds
  zh: string
  en: string
}
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export type SermonTranscriptPanelProps = {
  sermonTitle: string
  speakerName?: string
  iframeRef?: React.RefObject<HTMLIFrameElement | null>
  customTranscript?: TranscriptSegment[]
}

export const SermonTranscriptPanel: React.FC<SermonTranscriptPanelProps> = ({
  sermonTitle,
  speakerName,
  iframeRef,
  customTranscript,
}) => {
  const { language } = useAuthStore()
  const isZh = language === 'zh'

  const segments = customTranscript ?? []
  const [activeSegmentId, setActiveSegmentId] = useState<string>(segments[0]?.id ?? '')
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [viewMode, setViewMode] = useState<'bilingual' | 'zh' | 'en'>('bilingual')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const activeRef = useRef<HTMLDivElement | null>(null)

  // Listen to YouTube player messages or poll time
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data && typeof data.info?.currentTime === 'number') {
          const time = data.info.currentTime
          setCurrentTime(time)

          const matched = segments.find((s) => time >= s.start && time <= s.end)
          if (matched && matched.id !== activeSegmentId) {
            setActiveSegmentId(matched.id)
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [segments, activeSegmentId])

  // Scroll active segment into view automatically
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSegmentId])

  const handleSeek = (segment: TranscriptSegment) => {
    setActiveSegmentId(segment.id)
    setCurrentTime(segment.start)

    if (iframeRef?.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [segment.start, true] }),
          '*'
        )
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        )
      } catch (err) {
        console.warn('[Transcript] Seek postMessage failed:', err)
      }
    }
  }

  const handleCopyQuote = (segment: TranscriptSegment, e: React.MouseEvent) => {
    e.stopPropagation()
    const quoteText = `"${isZh ? segment.zh : segment.en}"\n— 《${sermonTitle}》${speakerName ? ` (${speakerName})` : ''} [${formatTime(segment.start)}]`
    navigator.clipboard.writeText(quoteText)
    setCopiedId(segment.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredSegments = segments.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return s.zh.toLowerCase().includes(q) || s.en.toLowerCase().includes(q)
  })

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-100 bg-[#f8faf9] px-5 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {isZh ? '双语交互式讲道逐字稿' : 'Interactive Bilingual Transcript'}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {isZh ? '点击句子跳转播放 · 实时时间轴高亮' : 'Click sentence to jump · Time-synchronized transcript'}
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 rounded-full bg-slate-200/80 p-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setViewMode('bilingual')}
            className={`rounded-full px-3 py-1 transition cursor-pointer ${
              viewMode === 'bilingual' ? 'bg-white text-emerald-900 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            {isZh ? '双语对照' : 'Bilingual'}
          </button>
          <button
            onClick={() => setViewMode('zh')}
            className={`rounded-full px-3 py-1 transition cursor-pointer ${
              viewMode === 'zh' ? 'bg-white text-emerald-900 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setViewMode('en')}
            className={`rounded-full px-3 py-1 transition cursor-pointer ${
              viewMode === 'en' ? 'bg-white text-emerald-900 shadow-sm font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="border-b border-slate-100 bg-white px-5 py-3 sm:px-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isZh ? '搜索讲道金句、经文或关键词...' : 'Search sermon quotes or keywords...'}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Transcript Segments Scroll Area */}
      <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5 space-y-2.5">
        {filteredSegments.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400">
            {segments.length === 0
              ? isZh
                ? '这篇讲道暂未提供字幕。'
                : 'A transcript is not available for this sermon yet.'
              : isZh
                ? '未匹配到相关字幕内容。'
                : 'No matching transcript segments found.'}
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const currentPlaybackSegment = currentTime > 0 ? segments.find((s) => currentTime >= s.start && currentTime < s.end) : null
            const targetSegmentId = currentPlaybackSegment ? currentPlaybackSegment.id : activeSegmentId
            const isActive = seg.id === targetSegmentId

            return (
              <div
                key={seg.id}
                ref={isActive ? activeRef : null}
                onClick={() => handleSeek(seg)}
                className={`group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-slate-100/80 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Timestamp Button */}
                  <button
                    type="button"
                    onClick={() => handleSeek(seg)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-black transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm animate-pulse'
                        : 'bg-slate-200/80 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white'
                    }`}
                    title={isZh ? '点击跳转视频到此秒数' : 'Click to jump video to this timestamp'}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {formatTime(seg.start)}
                  </button>

                  {/* Copy Quote Button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyQuote(seg, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-200 shadow-sm"
                    title={isZh ? '复制讲道金句' : 'Copy quote'}
                  >
                    {copiedId === seg.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Text Content */}
                <div className="mt-2.5 space-y-1.5">
                  {(viewMode === 'bilingual' || viewMode === 'zh') && (
                    <p className={`text-sm leading-relaxed ${isActive ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>
                      {seg.zh}
                    </p>
                  )}
                  {(viewMode === 'bilingual' || viewMode === 'en') && (
                    <p className={`text-xs leading-relaxed ${isActive ? 'font-bold text-emerald-900' : 'font-semibold text-slate-500'}`}>
                      {seg.en}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
