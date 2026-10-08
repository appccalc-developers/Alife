import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Info, LoaderCircle, Maximize2, Minimize2, Minus, Moon, Plus, Sun, Type } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { transformBibleHtml } from '@youversion/platform-core/browser'
import '@youversion/platform-core/browser/styles/index.css'
import { getYouVersionBibleClient } from '../../services/youVersionBibleService'
import { bibleVersionAttribution } from '../../utils/bibleAttribution'
import { bibleRequestFailure, type BibleRequestFailure } from '../../utils/bibleRequestFailure'

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
  key: string
  content: string
  copyright: string
  reference: string
} | { key: string; error: string; retryable: boolean } | null

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

const readerErrorCopy = (language: Props['language'], failure: BibleRequestFailure) => {
  if (failure === 'not-configured') return language === 'zh'
    ? '本站暂未提供内嵌经文阅读。你可以在 Bible.com 阅读。'
    : 'In-page Scripture reading is not available here yet. You can read on Bible.com.'
  if (failure === 'rate-limited') return language === 'zh'
    ? '经文服务目前请求过多，请稍后再试。你也可以继续在 Bible.com 阅读。'
    : 'Scripture requests are temporarily limited. Please try again later or continue on Bible.com.'
  if (failure === 'access-denied') return language === 'zh'
    ? '目前无法在这里提供这段经文。你可以继续在 Bible.com 阅读。'
    : 'This passage is not available here right now. You can continue on Bible.com.'
  return language === 'zh'
    ? '暂时无法加载这段经文。你可以继续在 Bible.com 阅读。'
    : 'This passage could not be loaded right now. You can continue reading on Bible.com.'
}

const YouVersionBibleReader = ({ reference, versionId, providerUrl, language, canGoPrevious, canGoNext, onPrevious, onNext }: Props) => {
  const [state, setState] = useState<ReaderState>(null)
  const [preferences, setPreferences] = useState<ReaderPreferences>(readPreferences)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [retryRevision, setRetryRevision] = useState(0)
  const isZh = language === 'zh'
  const requestKey = `${versionId}:${reference}:${language}:${retryRevision}`
  const currentState = state?.key === requestKey ? state : null

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
    } catch (cause: unknown) {
      setIsFocusMode(false)
      setState({ key: requestKey, error: readerErrorCopy(language, bibleRequestFailure(cause)), retryable: false })
      return () => { active = false }
    }

    void Promise.all([
      bibleClient.getPassage(versionId, reference, 'html', true, true),
      bibleClient.getVersion(versionId),
    ])
      .then(([passage, version]) => {
        const copyright = bibleVersionAttribution(version)
        if (!copyright) throw new Error('Bible version attribution is unavailable.')
        if (active) setState({
          key: requestKey,
          content: transformBibleHtml(passage.content).html,
          reference: passage.reference,
          copyright,
        })
      })
      .catch((cause: unknown) => {
        if (active) {
          const failure = bibleRequestFailure(cause)
          setIsFocusMode(false)
          setState({ key: requestKey, error: readerErrorCopy(language, failure), retryable: failure === 'other' })
        }
      })

    return () => { active = false }
  }, [isZh, language, reference, requestKey, retryRevision, versionId])

  if (currentState === null) {
    const loading = <div className={['flex items-center justify-center border border-[#d8e1dc] bg-white text-sm font-bold text-[#60716a] shadow-[0_16px_38px_rgba(30,54,48,0.07)]', isFocusMode ? 'fixed inset-0 z-[9999]' : 'min-h-[24rem] rounded-[1.5rem]'].join(' ')}><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#176b5a]" />{isZh ? '正在加载经文…' : 'Loading Scripture…'}</div>
    return isFocusMode ? createPortal(loading, document.body) : loading
  }

  if ('error' in currentState) return (
    <div role="alert" className="rounded-[1.5rem] border border-[#ead8c6] bg-[#fffbf5] p-6 text-center shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
      <AlertCircle className="mx-auto h-8 w-8 text-[#b65c3e]" />
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#725b4d]">{currentState.error}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {currentState.retryable ? <button type="button" onClick={() => setRetryRevision((current) => current + 1)} className="inline-flex h-11 items-center rounded-xl border border-[#a9c6b8] bg-white px-4 text-sm font-black text-[#173f36] transition hover:bg-[#edf5f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]/35">{isZh ? '重试加载' : 'Try again'}</button> : null}
        <a href={providerUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#173f36] px-4 text-sm font-black text-white transition hover:bg-[#12352e] focus:outline-none focus:ring-2 focus-visible:ring-[#176b5a]/35">{isZh ? '在 Bible.com 阅读' : 'Read on Bible.com'} <ExternalLink className="h-4 w-4" /></a>
      </div>
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
  const attributionTextClass = preferences.theme === 'dark' ? 'text-[#b8c9c0]' : preferences.theme === 'paper' ? 'text-[#6e604d]' : 'text-[#52665e]'
  const toolbarClass = preferences.theme === 'dark'
    ? 'border-[#3a4c45] bg-[#202d29]/95'
    : preferences.theme === 'paper'
      ? 'border-[#dfd1b7] bg-[#fbf6ec]/95'
      : 'border-[#dfe8e3] bg-white/95'
  const focusToolbarClass = preferences.theme === 'dark'
    ? 'border-[#53665e]/70 bg-[#202d29]/90'
    : preferences.theme === 'paper'
      ? 'border-[#d4c3a5]/75 bg-[#fbf6ec]/92'
      : 'border-white/75 bg-white/90'
  const dividerClass = preferences.theme === 'dark' ? 'border-[#34463f]' : preferences.theme === 'paper' ? 'border-[#dfd1b7]' : 'border-[#e3ebe6]'
  const setFontSize = (fontSize: number) => setPreferences((current) => ({ ...current, fontSize: Math.min(4, Math.max(0, fontSize)) }))

  const reader = (
    <article
      data-reader-theme={preferences.theme}
      className={['border shadow-[0_16px_38px_rgba(30,54,48,0.07)] transition-colors', themeClass, isFocusMode ? 'fixed inset-0 z-[9999] overflow-y-auto rounded-none px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8' : 'rounded-[1.5rem] p-5 sm:p-7'].join(' ')}
    >
      <div className={['sticky z-20 -mx-2 flex items-center rounded-2xl border transition-[background-color,border-color,box-shadow] duration-200', isFocusMode ? 'top-0 mb-3 flex-nowrap justify-between gap-1 p-1.5 shadow-[0_8px_30px_rgba(18,38,32,0.13)] backdrop-blur-xl backdrop-saturate-150 sm:mb-5 sm:flex-wrap sm:gap-2 sm:p-2' : 'top-[4.75rem] mb-5 flex-wrap justify-between gap-2 p-2 shadow-sm backdrop-blur sm:top-[5rem]', isFocusMode ? focusToolbarClass : toolbarClass].join(' ')} aria-label={isZh ? '阅读设置' : 'Reading settings'}>
        <div className={['flex items-center', isFocusMode ? 'gap-0 sm:gap-1' : 'gap-1'].join(' ')}>
          <button type="button" onClick={() => setFontSize(preferences.fontSize - 1)} disabled={preferences.fontSize === 0} className={['inline-flex items-center justify-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35', isFocusMode ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9'].join(' ')} aria-label={isZh ? '缩小字号' : 'Decrease text size'}><Minus className="h-4 w-4" /></button>
          <span className={['inline-flex items-center justify-center gap-1 text-xs font-black', isFocusMode ? 'min-w-10 sm:min-w-12' : 'min-w-12'].join(' ')} aria-live="polite"><Type className="h-4 w-4" />{preferences.fontSize + 1}<span className={isFocusMode ? 'hidden sm:inline' : ''}>/5</span></span>
          <button type="button" onClick={() => setFontSize(preferences.fontSize + 1)} disabled={preferences.fontSize === 4} className={['inline-flex items-center justify-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35', isFocusMode ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9'].join(' ')} aria-label={isZh ? '增大字号' : 'Increase text size'}><Plus className="h-4 w-4" /></button>
        </div>

        <div className={['flex min-w-0 items-center justify-end', isFocusMode ? 'flex-nowrap gap-0.5 sm:flex-wrap sm:gap-1.5' : 'flex-wrap gap-1.5'].join(' ')}>
          <label className={['h-9 items-center rounded-lg border border-current/15 px-2 text-xs font-bold', isFocusMode ? 'hidden sm:inline-flex' : 'inline-flex'].join(' ')}>
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
            ] as const).map(([theme, Icon, label]) => <button key={theme} type="button" onClick={() => setPreferences((current) => ({ ...current, theme }))} aria-pressed={preferences.theme === theme} className={['inline-flex h-8 items-center gap-1 rounded-md text-xs font-bold transition', isFocusMode ? 'px-1.5 sm:px-2' : 'px-2', preferences.theme === theme ? 'bg-[#176b5a] text-white shadow-sm' : 'hover:bg-black/5'].join(' ')} title={label}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></button>)}
          </div>

          <button type="button" onClick={() => setIsFocusMode((current) => !current)} aria-pressed={isFocusMode} className={['inline-flex items-center gap-1.5 rounded-lg border border-current/15 text-xs font-black transition hover:bg-black/5', isFocusMode ? 'h-8 px-2 sm:h-9 sm:px-2.5' : 'h-9 px-2.5'].join(' ')} title={isFocusMode ? (isZh ? '退出专注阅读' : 'Exit focus mode') : (isZh ? '专注阅读' : 'Focus mode')}>
            {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFocusMode ? (isZh ? '退出' : 'Exit') : (isZh ? '专注' : 'Focus')}</span>
          </button>
        </div>
      </div>

      <div className={['border-b pb-5 text-center', dividerClass].join(' ')}><p className={['text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass].join(' ')}>{isZh ? '经文阅读' : 'Scripture reading'}</p><h2 className="mt-1 font-serif text-2xl font-bold">{currentState.reference}</h2></div>
      <div data-yv-sdk data-slot="yv-bible-renderer" data-show-verse-numbers="true" className="alife-bible-reader pb-7 sm:px-2" style={readerStyle} dangerouslySetInnerHTML={{ __html: currentState.content }} />
      <div className={['mt-8 border-t pt-3 text-sm', attributionTextClass, dividerClass].join(' ')}>
        <p className="flex items-center gap-2 font-bold"><Info className="h-4 w-4 shrink-0" />{isZh ? '译本与版权说明' : 'Translation and copyright'}</p>
        <p className="mt-2 leading-5">{currentState.copyright}</p>
      </div>
      {isFocusMode ? <nav className={['fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-xl items-center justify-between gap-1 rounded-2xl border p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl backdrop-saturate-150 sm:inset-x-8 sm:gap-3 sm:p-2', focusToolbarClass].join(' ')} aria-label={isZh ? '章节切换' : 'Chapter navigation'}>
        <button type="button" onClick={onPrevious} disabled={!canGoPrevious} className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 sm:h-11 sm:w-auto sm:flex-1 sm:px-3" aria-label={isZh ? '上一章' : 'Previous chapter'}><ChevronLeft className="h-5 w-5" /><span className="hidden sm:inline">{isZh ? '上一章' : 'Previous'}</span></button>
        <span className={['min-w-0 flex-1 truncate text-center text-xs font-bold sm:flex-none', mutedTextClass].join(' ')}>{currentState.reference}</span>
        <button type="button" onClick={onNext} disabled={!canGoNext} className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 sm:h-11 sm:w-auto sm:flex-1 sm:px-3" aria-label={isZh ? '下一章' : 'Next chapter'}><span className="hidden sm:inline">{isZh ? '下一章' : 'Next'}</span><ChevronRight className="h-5 w-5" /></button>
      </nav> : null}
    </article>
  )

  return isFocusMode ? createPortal(reader, document.body) : reader
}

export default YouVersionBibleReader
