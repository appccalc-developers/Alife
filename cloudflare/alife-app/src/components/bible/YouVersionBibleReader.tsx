import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Info, LoaderCircle, Maximize2, Minimize2, Minus, Moon, Plus, Sun, Type } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { transformBibleHtml } from '@youversion/platform-core/browser'
import '@youversion/platform-core/browser/styles/index.css'
import { getYouVersionBibleClient } from '../../services/youVersionBibleService'

type Props = {
  reference: string
  versionId: number
  providerUrl: string
  language: 'zh' | 'en'
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
}

type ReaderState = {
  content: string
  copyright: string
  reference: string
} | { error: string } | null

type ReaderFont = 'serif' | 'sans' | 'system'
type ReaderTheme = 'light' | 'paper' | 'dark'
type ReaderPreferences = {
  fontSize: number
  font: ReaderFont
  theme: ReaderTheme
}

const PREFERENCES_STORAGE_KEY = 'alife:bible-reader-preferences'
const FONT_SIZES = ['0.95rem', '1.05rem', '1.15rem', '1.3rem', '1.5rem']
const FONT_FAMILIES: Record<ReaderFont, string> = {
  serif: 'Georgia, "Noto Serif SC", "Songti SC", serif',
  sans: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif',
}

const readPreferences = (): ReaderPreferences => {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || '{}') as Partial<ReaderPreferences>
    return {
      fontSize: typeof value.fontSize === 'number' ? Math.min(4, Math.max(0, value.fontSize)) : 2,
      font: value.font === 'sans' || value.font === 'system' ? value.font : 'serif',
      theme: value.theme === 'paper' || value.theme === 'dark' ? value.theme : 'light',
    }
  } catch {
    return { fontSize: 2, font: 'serif', theme: 'light' }
  }
}

const readerErrorCopy = (language: Props['language']) => language === 'zh'
  ? '暂时无法加载这段经文。你可以继续在 Bible.com 阅读。'
  : 'This passage could not be loaded right now. You can continue reading on Bible.com.'

const YouVersionBibleReader = ({ reference, versionId, providerUrl, language, canGoPrevious, canGoNext, onPrevious, onNext }: Props) => {
  const [state, setState] = useState<ReaderState>(null)
  const [preferences, setPreferences] = useState<ReaderPreferences>(readPreferences)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const isZh = language === 'zh'

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Reading controls still work when browser storage is unavailable.
    }
  }, [preferences])

  useEffect(() => {
    if (!isFocusMode) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const leaveFocusMode = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFocusMode(false)
    }
    window.addEventListener('keydown', leaveFocusMode)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', leaveFocusMode)
    }
  }, [isFocusMode])

  useEffect(() => {
    let active = true
    let bibleClient
    try {
      bibleClient = getYouVersionBibleClient()
    } catch {
      setState({ error: isZh ? '查经服务尚未完成设置。' : 'Bible reading is not configured yet.' })
      return () => { active = false }
    }

    void Promise.all([
      bibleClient.getPassage(versionId, reference, 'html', true, true),
      bibleClient.getVersion(versionId),
    ])
      .then(([passage, version]) => {
        if (active) setState({
          content: transformBibleHtml(passage.content).html,
          reference: passage.reference,
          copyright: version.copyright || version.title,
        })
      })
      .catch(() => { if (active) setState({ error: readerErrorCopy(language) }) })

    return () => { active = false }
  }, [isZh, language, reference, versionId])

  if (state === null) return <div className="flex min-h-[24rem] items-center justify-center rounded-[1.5rem] border border-[#d8e1dc] bg-white text-sm font-bold text-[#60716a] shadow-[0_16px_38px_rgba(30,54,48,0.07)]"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#176b5a]" />{isZh ? '正在加载经文…' : 'Loading Scripture…'}</div>

  if ('error' in state) return (
    <div className="rounded-[1.5rem] border border-[#ead8c6] bg-[#fffbf5] p-6 text-center shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
      <AlertCircle className="mx-auto h-8 w-8 text-[#b65c3e]" />
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#725b4d]">{state.error}</p>
      <a href={providerUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#173f36] px-4 text-sm font-black text-white transition hover:bg-[#12352e] focus:outline-none focus:ring-2 focus:ring-[#176b5a]/35">{isZh ? '在 Bible.com 阅读' : 'Read on Bible.com'} <ExternalLink className="h-4 w-4" /></a>
    </div>
  )

  const readerStyle = {
    '--yv-reader-font-size': FONT_SIZES[preferences.fontSize],
    '--yv-reader-font-family': FONT_FAMILIES[preferences.font],
  } as CSSProperties
  const themeClass = preferences.theme === 'dark'
    ? 'border-[#33443e] bg-[#17211e] text-[#e7eee9]'
    : preferences.theme === 'paper'
      ? 'border-[#e0d3ba] bg-[#f7f1e5] text-[#3d3529]'
      : 'border-[#d8e1dc] bg-white text-[#243c34]'
  const mutedTextClass = preferences.theme === 'dark' ? 'text-[#9eb0a8]' : preferences.theme === 'paper' ? 'text-[#867762]' : 'text-[#73817b]'
  const toolbarClass = preferences.theme === 'dark'
    ? 'border-[#3a4c45] bg-[#202d29]/95'
    : preferences.theme === 'paper'
      ? 'border-[#dfd1b7] bg-[#fbf6ec]/95'
      : 'border-[#dfe8e3] bg-white/95'
  const dividerClass = preferences.theme === 'dark' ? 'border-[#34463f]' : preferences.theme === 'paper' ? 'border-[#dfd1b7]' : 'border-[#e3ebe6]'
  const setFontSize = (fontSize: number) => setPreferences((current) => ({ ...current, fontSize: Math.min(4, Math.max(0, fontSize)) }))

  const reader = (
    <article
      data-reader-theme={preferences.theme}
      className={['border shadow-[0_16px_38px_rgba(30,54,48,0.07)] transition-colors', themeClass, isFocusMode ? 'fixed inset-0 z-[9999] overflow-y-auto rounded-none px-4 pb-24 pt-3 sm:px-8' : 'rounded-[1.5rem] p-5 sm:p-7'].join(' ')}
    >
      <div className={['sticky top-0 z-20 -mx-2 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-2 shadow-sm backdrop-blur', toolbarClass].join(' ')} aria-label={isZh ? '阅读设置' : 'Reading settings'}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setFontSize(preferences.fontSize - 1)} disabled={preferences.fontSize === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '缩小字号' : 'Decrease text size'}><Minus className="h-4 w-4" /></button>
          <span className="inline-flex min-w-12 items-center justify-center gap-1 text-xs font-black" aria-live="polite"><Type className="h-4 w-4" />{preferences.fontSize + 1}/5</span>
          <button type="button" onClick={() => setFontSize(preferences.fontSize + 1)} disabled={preferences.fontSize === 4} className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '增大字号' : 'Increase text size'}><Plus className="h-4 w-4" /></button>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <label className="inline-flex h-9 items-center rounded-lg border border-current/15 px-2 text-xs font-bold">
            <span className="sr-only">{isZh ? '经文字体' : 'Scripture font'}</span>
            <select value={preferences.font} onChange={(event) => setPreferences((current) => ({ ...current, font: event.target.value as ReaderFont }))} className="max-w-[7.5rem] bg-transparent outline-none" aria-label={isZh ? '选择经文字体' : 'Choose Scripture font'}>
              <option value="serif">{isZh ? '宋体阅读' : 'Serif'}</option>
              <option value="sans">{isZh ? '黑体阅读' : 'Sans serif'}</option>
              <option value="system">{isZh ? '系统字体' : 'System'}</option>
            </select>
          </label>

          <div className="flex rounded-lg border border-current/15 p-0.5" role="group" aria-label={isZh ? '阅读主题' : 'Reading theme'}>
            {([
              ['light', Sun, isZh ? '明亮' : 'Light'],
              ['paper', Type, isZh ? '护眼' : 'Paper'],
              ['dark', Moon, isZh ? '夜间' : 'Dark'],
            ] as const).map(([theme, Icon, label]) => <button key={theme} type="button" onClick={() => setPreferences((current) => ({ ...current, theme }))} aria-pressed={preferences.theme === theme} className={['inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition', preferences.theme === theme ? 'bg-[#176b5a] text-white shadow-sm' : 'hover:bg-black/5'].join(' ')} title={label}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></button>)}
          </div>

          <button type="button" onClick={() => setIsFocusMode((current) => !current)} aria-pressed={isFocusMode} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-current/15 px-2.5 text-xs font-black transition hover:bg-black/5" title={isFocusMode ? (isZh ? '退出专注阅读' : 'Exit focus mode') : (isZh ? '专注阅读' : 'Focus mode')}>
            {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFocusMode ? (isZh ? '退出' : 'Exit') : (isZh ? '专注' : 'Focus')}</span>
          </button>
        </div>
      </div>

      <div className={['border-b pb-5 text-center', dividerClass].join(' ')}><p className={['text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass].join(' ')}>{isZh ? '经文阅读' : 'Scripture reading'}</p><h2 className="mt-1 font-serif text-2xl font-bold">{state.reference}</h2></div>
      <div data-yv-sdk data-slot="yv-bible-renderer" data-show-verse-numbers="true" className="alife-bible-reader pb-7 sm:px-2" style={readerStyle} dangerouslySetInnerHTML={{ __html: state.content }} />
      <details className={['mt-8 border-t pt-3 text-xs', mutedTextClass, dividerClass].join(' ')}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-bold"><Info className="h-4 w-4" />{isZh ? '译本与版权说明' : 'Translation and copyright'}</summary>
        <p className="mt-3 leading-5">{state.copyright}</p>
      </details>
      {isFocusMode ? <nav className={['sticky bottom-3 z-20 mx-auto mt-8 flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border p-2 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur', toolbarClass].join(' ')} aria-label={isZh ? '章节切换' : 'Chapter navigation'}>
        <button type="button" onClick={onPrevious} disabled={!canGoPrevious} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '上一章' : 'Previous chapter'}><ChevronLeft className="h-5 w-5" />{isZh ? '上一章' : 'Previous'}</button>
        <span className={['shrink-0 text-center text-xs font-bold', mutedTextClass].join(' ')}>{state.reference}</span>
        <button type="button" onClick={onNext} disabled={!canGoNext} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '下一章' : 'Next chapter'}>{isZh ? '下一章' : 'Next'}<ChevronRight className="h-5 w-5" /></button>
      </nav> : null}
    </article>
  )

  return isFocusMode ? createPortal(reader, document.body) : reader
}

export default YouVersionBibleReader
