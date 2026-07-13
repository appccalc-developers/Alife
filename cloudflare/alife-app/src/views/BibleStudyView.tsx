import { AlertCircle, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { BibleVersion } from '@youversion/platform-core'
import YouVersionBibleReader from '../components/bible/YouVersionBibleReader'
import AppPageShell from '../components/layout/AppPageShell'
import { bibleReadingProgressService, type BibleReadingProgress } from '../services/bibleReadingProgressService'
import { getAvailableBibleVersions } from '../services/youVersionBibleService'
import { useAuthStore } from '../stores/auth'
import { bibleBooks, findBibleBook } from '../utils/bibleBooks'

type ReaderLanguage = 'zh' | 'en'
type Testament = 'old' | 'new'
type SavedReadingPosition = {
  book: string
  chapter: number
  language: ReaderLanguage
  zhVersion?: string
  enVersion?: string
  updatedUtc: string
}

const OLD_TESTAMENT_COUNT = 39
const readingPositionStorageKey = (memberId: string) => `alife:bible-reading-position:${memberId}`

const readSavedReadingPosition = (memberId: string): SavedReadingPosition | null => {
  try {
    const raw = window.localStorage.getItem(readingPositionStorageKey(memberId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SavedReadingPosition>
    const savedBook = bibleBooks.find((item) => item.id === value.book)
    if (!savedBook) return null
    return {
      book: savedBook.id,
      chapter: clampChapter(String(value.chapter ?? 1), savedBook.chapters),
      language: value.language === 'en' ? 'en' : 'zh',
      zhVersion: typeof value.zhVersion === 'string' ? value.zhVersion : undefined,
      enVersion: typeof value.enVersion === 'string' ? value.enVersion : undefined,
      updatedUtc: typeof value.updatedUtc === 'string' ? value.updatedUtc : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

const saveReadingPosition = (memberId: string, position: SavedReadingPosition) => {
  try {
    window.localStorage.setItem(readingPositionStorageKey(memberId), JSON.stringify(position))
  } catch {
    // Reading still works when storage is disabled or full.
  }
}

const normalizeReadingPosition = (value: BibleReadingProgress): SavedReadingPosition | null => {
  const savedBook = bibleBooks.find((item) => item.id === value.book)
  if (!savedBook) return null
  return {
    book: savedBook.id,
    chapter: clampChapter(String(value.chapter), savedBook.chapters),
    language: value.language === 'en' ? 'en' : 'zh',
    zhVersion: value.zhVersion || undefined,
    enVersion: value.enVersion || undefined,
    updatedUtc: value.updatedUtc,
  }
}

const bookGroups = [
  { id: 'law', testament: 'old' as const, zh: '律法书', en: 'Law', books: bibleBooks.slice(0, 5) },
  { id: 'history-ot', testament: 'old' as const, zh: '历史书', en: 'History', books: bibleBooks.slice(5, 17) },
  { id: 'wisdom', testament: 'old' as const, zh: '诗歌智慧书', en: 'Poetry & Wisdom', books: bibleBooks.slice(17, 22) },
  { id: 'major-prophets', testament: 'old' as const, zh: '大先知书', en: 'Major Prophets', books: bibleBooks.slice(22, 27) },
  { id: 'minor-prophets', testament: 'old' as const, zh: '小先知书', en: 'Minor Prophets', books: bibleBooks.slice(27, 39) },
  { id: 'gospels', testament: 'new' as const, zh: '福音书', en: 'Gospels', books: bibleBooks.slice(39, 43) },
  { id: 'history-nt', testament: 'new' as const, zh: '历史书', en: 'History', books: bibleBooks.slice(43, 44) },
  { id: 'pauline', testament: 'new' as const, zh: '保罗书信', en: 'Pauline Letters', books: bibleBooks.slice(44, 57) },
  { id: 'general-letters', testament: 'new' as const, zh: '普通书信', en: 'General Letters', books: bibleBooks.slice(57, 65) },
  { id: 'apocalyptic', testament: 'new' as const, zh: '启示文学', en: 'Apocalyptic', books: bibleBooks.slice(65) },
]

const englishVersion: BibleVersion = {
  id: 206,
  abbreviation: 'WEBUS',
  localized_abbreviation: 'WEB',
  localized_title: 'World English Bible',
  title: 'World English Bible, American English Edition, without Strong\'s Numbers',
  language_tag: 'en',
  books: [],
  youversion_deep_link: 'https://www.bible.com/bible/206',
}

const clampChapter = (value: string | null, maximum: number) => {
  const chapter = Number.parseInt(value || '1', 10)
  return Number.isFinite(chapter) ? Math.min(Math.max(chapter, 1), maximum) : 1
}

const formatVersionName = (version: BibleVersion) => version.localized_title || version.title || version.abbreviation

const BibleStudyView = () => {
  const auth = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const language = (searchParams.get('lang') === 'en' ? 'en' : 'zh') as ReaderLanguage
  const selectedBook = findBibleBook(searchParams.get('book') || 'JHN')
  const book = selectedBook.id
  const chapter = clampChapter(searchParams.get('chapter'), selectedBook.chapters)
  const reference = `${book}.${chapter}`
  const isZh = auth.language === 'zh'
  const [testament, setTestament] = useState<Testament>(() => bibleBooks.indexOf(selectedBook) < OLD_TESTAMENT_COUNT ? 'old' : 'new')
  const [bookGroupId, setBookGroupId] = useState(() => bookGroups.find((group) => group.books.some((item) => item.id === selectedBook.id))?.id || 'gospels')
  const [availableVersions, setAvailableVersions] = useState<BibleVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(true)
  const [versionsError, setVersionsError] = useState(false)
  const chapterPickerRef = useRef<HTMLDetailsElement>(null)
  const chapterGridRef = useRef<HTMLDivElement>(null)
  const selectedChapterRef = useRef<HTMLButtonElement>(null)
  const [restoredReadingMemberId, setRestoredReadingMemberId] = useState<string | null>(null)
  const versionParam = language === 'zh' ? 'zhVersion' : 'enVersion'
  const selectedVersionId = Number.parseInt(searchParams.get(versionParam) || searchParams.get('version') || '', 10)

  useEffect(() => {
    const memberId = auth.me?.id
    if (!memberId || auth.isGuest) {
      setRestoredReadingMemberId(null)
      return
    }

    let active = true
    const local = readSavedReadingPosition(memberId)
    const initialParams = new URLSearchParams(searchParams)
    const hasExplicitReference = initialParams.has('book') || initialParams.has('chapter')

    const applyPosition = (position: SavedReadingPosition) => {
      const params = new URLSearchParams(initialParams)
      if (!hasExplicitReference) {
        params.set('book', position.book)
        params.set('chapter', String(position.chapter))
      }
      if (!params.has('lang')) params.set('lang', position.language)
      if (!params.has('zhVersion') && position.zhVersion) params.set('zhVersion', position.zhVersion)
      if (!params.has('enVersion') && position.enVersion) params.set('enVersion', position.enVersion)
      if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true })
    }

    if (local) applyPosition(local)

    void bibleReadingProgressService.get()
      .then(async (remoteValue) => {
        if (!active) return
        const remote = remoteValue ? normalizeReadingPosition(remoteValue) : null
        const localIsNewer = local && (!remote || Date.parse(local.updatedUtc) > Date.parse(remote.updatedUtc))
        const userChangedPosition = new URLSearchParams(window.location.search).toString() !== searchParams.toString()

        if (localIsNewer) {
          const savedRemote = await bibleReadingProgressService.save(local)
          if (active) saveReadingPosition(memberId, normalizeReadingPosition(savedRemote) || local)
        } else if (remote && !userChangedPosition) {
          saveReadingPosition(memberId, remote)
          applyPosition(remote)
        }
      })
      .catch(() => {
        // Local progress remains available while offline or when account sync is unavailable.
      })
      .finally(() => {
        if (active) setRestoredReadingMemberId(memberId)
      })

    return () => { active = false }
    // Restore once for the authenticated user; subsequent URL changes are saved below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.me?.id, auth.isGuest])

  useEffect(() => {
    const memberId = auth.me?.id
    if (!memberId || auth.isGuest || restoredReadingMemberId !== memberId) return
    const position = {
      book,
      chapter,
      language,
      zhVersion: searchParams.get('zhVersion') || undefined,
      enVersion: searchParams.get('enVersion') || undefined,
    }
    saveReadingPosition(memberId, { ...position, updatedUtc: new Date().toISOString() })
    const syncTimer = window.setTimeout(() => {
      void bibleReadingProgressService.save(position)
        .then((remote) => {
          const normalized = normalizeReadingPosition(remote)
          if (normalized) saveReadingPosition(memberId, normalized)
        })
        .catch(() => {
          // The local timestamp keeps this change eligible for upload on the next visit.
        })
    }, 750)
    return () => window.clearTimeout(syncTimer)
  }, [auth.isGuest, auth.me?.id, book, chapter, language, restoredReadingMemberId, searchParams])

  useEffect(() => {
    setTestament(bibleBooks.indexOf(selectedBook) < OLD_TESTAMENT_COUNT ? 'old' : 'new')
    setBookGroupId(bookGroups.find((group) => group.books.some((item) => item.id === selectedBook.id))?.id || 'gospels')
  }, [selectedBook])

  useEffect(() => {
    let active = true
    setVersionsLoading(true)
    setVersionsError(false)
    void getAvailableBibleVersions(language)
      .then((versions) => { if (active) setAvailableVersions(versions.sort((left, right) => right.id - left.id)) })
      .catch(() => {
        if (active) {
          setAvailableVersions(language === 'en' ? [englishVersion] : [])
          setVersionsError(language === 'zh')
        }
      })
      .finally(() => { if (active) setVersionsLoading(false) })
    return () => { active = false }
  }, [language])

  const defaultVersion = language === 'en'
    ? availableVersions.find((item) => item.id === englishVersion.id) || availableVersions[0] || englishVersion
    : availableVersions[0]
  const version = availableVersions.find((item) => item.id === selectedVersionId) || defaultVersion
  const providerUrl = useMemo(() => version?.youversion_deep_link?.toString() || 'https://www.bible.com/', [version])
  const visibleBookGroups = bookGroups.filter((group) => group.testament === testament)
  const selectedBookGroup = visibleBookGroups.find((group) => group.id === bookGroupId) || visibleBookGroups[0]

  const setReference = (next: Partial<{ book: string; chapter: string; lang: ReaderLanguage; version: string }>) => {
    const params = new URLSearchParams(searchParams)
    const nextBook = findBibleBook(next.book ?? book)
    params.set('book', nextBook.id)
    params.set('chapter', String(clampChapter(next.chapter ?? String(chapter), nextBook.chapters)))
    params.set('lang', next.lang ?? language)
    if (next.version) {
      const targetLanguage = next.lang ?? language
      params.set(targetLanguage === 'zh' ? 'zhVersion' : 'enVersion', next.version)
      params.delete('version')
    }
    setSearchParams(params, { replace: true })
  }

  return (
    <AppPageShell
      title={isZh ? '查经' : 'Bible study'}
      subtitle={isZh ? '选择经卷和章节，安静阅读、预备和记录。' : 'Choose a book and chapter to read, prepare, and reflect.'}
    >
      <section className="space-y-4">
        <div className="rounded-[1.5rem] border border-[#d8e1dc] bg-[#f8fbf8] p-4 shadow-[0_16px_38px_rgba(30,54,48,0.06)] sm:p-5">
          <div className="flex flex-col gap-4 border-b border-[#dfe9e4] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-black text-[#18332d]"><BookOpen className="h-5 w-5 text-[#176b5a]" />{isZh ? '选择经文' : 'Choose Scripture'}</div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-xl border border-[#cddbd4] bg-white p-1" aria-label={isZh ? '阅读语言' : 'Reading language'}>
                {(['zh', 'en'] as const).map((item) => <button key={item} type="button" onClick={() => setReference({ lang: item })} className={['rounded-lg px-3 py-2 text-sm font-black transition', language === item ? 'bg-[#173f36] text-white shadow-sm' : 'text-[#63756d] hover:bg-[#edf5f1]'].join(' ')}>{item === 'zh' ? '中文' : 'English'}</button>)}
              </div>
              {availableVersions.length ? <label className="flex h-10 max-w-full items-center gap-2 rounded-xl border border-[#cddbd4] bg-white pl-3 text-sm font-bold text-[#40554e] focus-within:border-[#176b5a] focus-within:ring-2 focus-within:ring-[#176b5a]/15">
                <span className="shrink-0 text-xs text-[#718079]">{language === 'zh' ? (isZh ? '译本' : 'Translation') : (isZh ? '英文译本' : 'Translation')}</span>
                <select value={version?.id || ''} onChange={(event) => setReference({ version: event.target.value })} className="h-full min-w-0 max-w-[17rem] bg-transparent pr-3 text-sm font-bold text-[#18332d] outline-none" aria-label={language === 'zh' ? (isZh ? '选择中文译本' : 'Choose Chinese version') : (isZh ? '选择英文译本' : 'Choose English version')}>
                  {availableVersions.map((item) => <option key={item.id} value={item.id}>{formatVersionName(item)} ({item.localized_abbreviation || item.abbreviation})</option>)}
                </select>
              </label> : null}
            </div>
          </div>

          <div className="pt-4">
            <div className="flex gap-2" role="tablist" aria-label={isZh ? '圣经部分' : 'Bible testament'}>
              {(['old', 'new'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={testament === item} onClick={() => { setTestament(item); setBookGroupId(bookGroups.find((group) => group.testament === item)?.id || '') }} className={['rounded-lg px-4 py-2 text-sm font-black transition', testament === item ? 'bg-[#dceee7] text-[#155345]' : 'text-[#63756d] hover:bg-white'].join(' ')}>{item === 'old' ? (isZh ? '旧约' : 'Old Testament') : (isZh ? '新约' : 'New Testament')}</button>)}
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={isZh ? '经卷分类' : 'Book categories'}>
              {visibleBookGroups.map((group) => <button key={group.id} type="button" onClick={() => setBookGroupId(group.id)} className={['shrink-0 rounded-lg border px-3 py-2 text-sm font-bold transition', selectedBookGroup?.id === group.id ? 'border-[#176b5a] bg-[#173f36] text-white shadow-sm' : 'border-[#d9e4de] bg-white text-[#52665e] hover:border-[#9fc3b5] hover:bg-[#edf5f1]'].join(' ')}>{isZh ? group.zh : group.en}<span className="ml-1.5 text-xs opacity-70">{group.books.length}</span></button>)}
            </div>
            <div className="mt-2 rounded-xl border border-[#dfe9e4] bg-white p-3" aria-label={isZh ? '选择经卷' : 'Choose a Bible book'}>
              <p className="mb-2 text-xs font-black tracking-wide text-[#718079]">{isZh ? selectedBookGroup?.zh : selectedBookGroup?.en}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {selectedBookGroup?.books.map((item) => <button key={item.id} type="button" onClick={() => setReference({ book: item.id, chapter: '1' })} className={['rounded-lg px-3 py-2 text-left text-sm font-bold transition', item.id === book ? 'bg-[#173f36] text-white shadow-sm' : 'bg-[#f5f8f6] text-[#40554e] hover:bg-[#dceee7] hover:text-[#155345]'].join(' ')}>{isZh ? item.zh : item.en}</button>)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#dbe6e0] bg-white p-2">
            <button type="button" onClick={() => setReference({ chapter: String(chapter - 1) })} disabled={chapter === 1} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-transparent px-2 text-sm font-bold text-[#315349] transition hover:border-[#d5e4dc] hover:bg-[#edf5f1] disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '上一章' : 'Previous chapter'}><ChevronLeft className="h-5 w-5" /><span className="hidden sm:inline">{isZh ? '上一章' : 'Previous'}</span></button>
            <details ref={chapterPickerRef} onToggle={(event) => { if (event.currentTarget.open) window.requestAnimationFrame(() => { const grid = chapterGridRef.current; const selected = selectedChapterRef.current; if (grid && selected) grid.scrollTop = Math.max(0, selected.offsetTop - (grid.clientHeight - selected.offsetHeight) / 2) }) }} className="group relative min-w-0 flex-1 sm:max-w-xs">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[#cbdad3] bg-[#f8fbf9] px-4 text-[#18332d] shadow-sm transition hover:border-[#94b9aa] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]/25 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 text-left"><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#788880]">{isZh ? '当前章节' : 'Current chapter'}</span><span className="block truncate text-sm font-black">{isZh ? `第 ${chapter} 章` : `Chapter ${chapter}`}</span></span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#718078]">{chapter}/{selectedBook.chapters}<ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></span>
              </summary>
              <div className="absolute bottom-[calc(100%+0.6rem)] left-1/2 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#cfddd6] bg-white p-3 shadow-[0_20px_55px_rgba(24,51,45,0.2)]">
                <div className="mb-3 flex items-center justify-between px-1"><p className="text-sm font-black text-[#18332d]">{isZh ? `${selectedBook.zh} · 选择章节` : `${selectedBook.en} · Choose chapter`}</p><span className="text-xs font-bold text-[#7b8b84]">{selectedBook.chapters}</span></div>
                <div ref={chapterGridRef} className="relative grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
                  {Array.from({ length: selectedBook.chapters }, (_, index) => index + 1).map((item) => <button key={item} ref={item === chapter ? selectedChapterRef : undefined} type="button" onClick={() => { setReference({ chapter: String(item) }); chapterPickerRef.current?.removeAttribute('open') }} aria-current={item === chapter ? 'page' : undefined} className={['relative flex h-10 items-center justify-center rounded-lg text-sm font-black transition', item === chapter ? 'bg-[#176b5a] text-white shadow-sm' : 'bg-[#f3f7f5] text-[#40554e] hover:bg-[#dceee7] hover:text-[#155345]'].join(' ')}>{item}{item === chapter ? <Check className="absolute right-1 top-1 h-3 w-3" /> : null}</button>)}
                </div>
              </div>
            </details>
            <button type="button" onClick={() => setReference({ chapter: String(chapter + 1) })} disabled={chapter === selectedBook.chapters} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-transparent px-2 text-sm font-bold text-[#315349] transition hover:border-[#d5e4dc] hover:bg-[#edf5f1] disabled:cursor-not-allowed disabled:opacity-35" aria-label={isZh ? '下一章' : 'Next chapter'}><span className="hidden sm:inline">{isZh ? '下一章' : 'Next'}</span><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>

        {versionsLoading ? <div className="flex min-h-[24rem] items-center justify-center rounded-[1.5rem] border border-[#d8e1dc] bg-white text-sm font-bold text-[#60716a] shadow-[0_16px_38px_rgba(30,54,48,0.07)]"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#176b5a]" />{isZh ? '正在准备可用译本…' : 'Loading available versions…'}</div> : null}
        {versionsError ? <div className="rounded-[1.5rem] border border-[#ead8c6] bg-[#fffbf5] p-6 text-center shadow-[0_16px_38px_rgba(30,54,48,0.07)]"><AlertCircle className="mx-auto h-8 w-8 text-[#b65c3e]" /><p className="mt-3 text-sm leading-6 text-[#725b4d]">{isZh ? '暂时无法加载中文译本，请稍后再试。' : 'Chinese versions could not be loaded right now. Please try again shortly.'}</p></div> : null}
        {!versionsLoading && !versionsError && version ? <YouVersionBibleReader reference={reference} versionId={version.id} providerUrl={providerUrl} language={language} canGoPrevious={chapter > 1} canGoNext={chapter < selectedBook.chapters} onPrevious={() => setReference({ chapter: String(chapter - 1) })} onNext={() => setReference({ chapter: String(chapter + 1) })} /> : null}
      </section>
    </AppPageShell>
  )
}

export default BibleStudyView
