import { Check, ChevronDown, Globe2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Language } from '../../i18n/locale'

type Props = {
  language: Language
  onChange: (language: Language) => void | Promise<void>
  variant?: 'app' | 'home'
}

const languageNames: Record<Language, string> = {
  en: 'English',
  zh: '中文',
}

const LanguageSelector = ({ language, onChange, variant = 'app' }: Props) => {
  const isHome = variant === 'home'
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const accessibleLabel = language === 'zh'
    ? `选择语言，当前语言：${languageNames[language]}`
    : `Select language, current language: ${languageNames[language]}`

  useEffect(() => {
    if (!open) return

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus()
    })
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectLanguage = (nextLanguage: Language) => {
    setOpen(false)
    if (nextLanguage !== language) {
      void onChange(nextLanguage)
    }
  }

  const moveMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    if (!items.length) return

    event.preventDefault()
    const focusedIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (focusedIndex + 1) % items.length
          : (focusedIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className={[
          'inline-flex w-14 items-center justify-center gap-1.5 border px-2 font-medium transition-[font-weight] hover:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto sm:min-w-[6.75rem] sm:px-3',
          isHome
            ? 'h-9 rounded-lg border-white/15 text-[0.84rem] text-white/60 focus-visible:ring-white/70 focus-visible:ring-offset-home-dark'
            : 'h-10 rounded-xl border-[#2f4b42]/15 text-sm text-[#60716a] focus-visible:ring-[#176b5a]/40 focus-visible:ring-offset-[#fbfaf6]',
        ].join(' ')}
        aria-label={accessibleLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={accessibleLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <Globe2 aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
        <span aria-hidden="true" className="hidden whitespace-nowrap sm:inline">
          {languageNames[language]}
        </span>
        <ChevronDown aria-hidden="true" className={['h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={language === 'zh' ? '选择语言' : 'Select language'}
          className={[
            'absolute right-0 top-full z-50 mt-2 min-w-40 rounded-xl border p-2 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl',
            isHome ? 'border-white/10 bg-home-dark/95' : 'border-[#2f4b42]/10 bg-white/95',
          ].join(' ')}
          onKeyDown={moveMenuFocus}
        >
          {(Object.keys(languageNames) as Language[]).map((optionLanguage) => {
            const selected = optionLanguage === language
            return (
              <button
                key={optionLanguage}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={[
                  'flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none',
                  isHome
                    ? selected
                      ? 'bg-white/[0.07] font-semibold text-white'
                      : 'font-medium text-white/70 hover:bg-white/[0.07] hover:text-white focus:bg-white/[0.07] focus:text-white'
                    : selected
                      ? 'bg-[#e3f0eb] font-semibold text-[#0d4f43]'
                      : 'font-medium text-[#60716a] hover:bg-[#e3f0eb] hover:text-[#0d4f43] focus:bg-[#e3f0eb] focus:text-[#0d4f43]',
                ].join(' ')}
                onClick={() => selectLanguage(optionLanguage)}
              >
                <span>{languageNames[optionLanguage]}</span>
                <Check aria-hidden="true" className={['h-4 w-4', selected ? 'opacity-100' : 'opacity-0'].join(' ')} />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default LanguageSelector
