import { useEffect, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useAuthStore } from '../../stores/auth'
import type { HomeCopy, Language } from './homeCopy'
import { createSectionHandler, isDropdownNavItem } from './homeUtils'
import type { HomeNavDropdownItem, HomeNavItem } from './homeUtils'

type Props = {
  copy: HomeCopy
  language: Language
  solid?: boolean
  navItems?: HomeNavItem[]
}

const HomeNavHeader = ({ copy, language, solid = false, navItems: providedNavItems }: Props) => {
  const auth = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileExpandedKey, setMobileExpandedKey] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) {
      setMobileExpandedKey(null)
    }
  }, [menuOpen])

  const accountTo = '/enter'
  const accountLabel = copy.enterAlife
  const nextLanguageLabel = copy.nextLanguageLabel

  const fallbackNavItems: HomeNavItem[] = [
    { href: '#welcome', label: copy.nav.welcome },
  ]

  const navItems = providedNavItems?.length
    ? providedNavItems
    : fallbackNavItems
  const scrollToSection = createSectionHandler(() => setMenuOpen(false))
  const closeDropdownNavigation = (target?: HTMLElement) => {
    setMenuOpen(false)
    setMobileExpandedKey(null)
    target?.blur()
  }

  const renderDesktopNavItem = (item: HomeNavItem) => {
    if (isDropdownNavItem(item)) {
      return (
        <div key={item.key} className="group relative">
          <button
            className="inline-flex items-center gap-1 whitespace-nowrap px-3.5 py-1.5 text-[0.84rem] font-medium text-white/60 transition hover:text-white focus:text-white focus:outline-none"
            type="button"
            aria-haspopup="true"
          >
            {item.label}
            <ChevronDown className="h-3.5 w-3.5 transition group-hover:rotate-180 group-focus-within:rotate-180" />
          </button>
          <div className="invisible absolute left-1/2 top-full mt-2 min-w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-home-dark/95 p-2 opacity-0 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="grid gap-1">
              {item.items.map((child) => (
                <Link
                  key={child.to}
                  className="rounded-lg px-3 py-2 text-[0.86rem] font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white focus:bg-white/[0.07] focus:text-white focus:outline-none"
                  to={child.to}
                  onClick={(event) => closeDropdownNavigation(event.currentTarget)}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <a key={item.href} className="whitespace-nowrap px-3.5 py-1.5 text-[0.84rem] font-medium text-white/60 transition hover:text-white" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
        {item.label}
      </a>
    )
  }

  const renderMobileDropdown = (item: HomeNavDropdownItem) => {
    const expanded = mobileExpandedKey === item.key
    return (
      <div key={item.key}>
        <button
          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[0.92rem] font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          type="button"
          aria-expanded={expanded}
          onClick={() => setMobileExpandedKey(expanded ? null : item.key)}
        >
          <span>{item.label}</span>
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded ? (
          <div className="ml-3 mt-1 grid gap-0.5 border-l border-white/10 pl-2">
            {item.items.map((child) => (
              <Link
                key={child.to}
                className="rounded-lg px-3 py-2 text-[0.9rem] font-medium text-white/62 transition hover:bg-white/[0.06] hover:text-white"
                to={child.to}
                onClick={(event) => closeDropdownNavigation(event.currentTarget)}
              >
                {child.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ${solid || scrolled ? 'bg-home-dark/80 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl' : ''}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 text-white sm:px-8 lg:px-10">
        <Link className="flex shrink-0 items-center gap-3" to="/">
          <img src={logo} alt="" className="h-8 w-8 rounded-full bg-white/90 object-contain p-1" />
          <span className="hidden text-[0.94rem] font-semibold tracking-tight sm:block">{copy.churchName}</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
          {navItems.map(renderDesktopNavItem)}
        </nav>

        <div className="flex items-center gap-3">
          <button
            className="text-[0.84rem] font-medium text-white/45 transition hover:text-white"
            type="button"
            onClick={() => void auth.updateLanguage(language === 'zh' ? 'en' : 'zh')}
            aria-label="Switch language"
          >
            {nextLanguageLabel}
          </button>
          <Link className="hidden whitespace-nowrap rounded-lg border border-white/15 px-4 py-1.5 text-[0.84rem] font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/[0.06] sm:inline-flex" to={accountTo}>
            {accountLabel}
          </Link>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 transition hover:bg-white/[0.06] lg:hidden"
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-white/[0.06] bg-home-dark/90 px-5 pb-5 pt-3 backdrop-blur-xl sm:px-8 lg:hidden">
          <nav className="grid gap-0.5">
            {navItems.map((item) => isDropdownNavItem(item) ? renderMobileDropdown(item) : (
              <a key={item.href} className="rounded-lg px-3 py-2.5 text-[0.92rem] font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
                {item.label}
              </a>
            ))}
          </nav>
          <Link className="mt-3 block rounded-lg border border-white/15 py-2.5 text-center text-[0.92rem] font-semibold text-white transition hover:bg-white/[0.06]" to={accountTo} onClick={() => setMenuOpen(false)}>
            {accountLabel}
          </Link>
        </div>
      ) : null}
    </header>
  )
}

export default HomeNavHeader
