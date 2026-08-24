import { useEffect, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import LanguageSelector from '../../components/i18n/LanguageSelector'
import { useAuthStore } from '../../stores/auth'
import type { HomeCopy, Language } from './homeCopy'
import { createSectionHandler, isDropdownNavItem, isRouteNavItem } from './homeUtils'
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

  const navItems = providedNavItems ?? []
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
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.95rem] font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            type="button"
            aria-haspopup="true"
          >
            {item.label}
            <ChevronDown className="h-4 w-4 transition group-hover:rotate-180 group-focus-within:rotate-180" />
          </button>
          <div className="invisible absolute left-1/2 top-full mt-2 min-w-60 -translate-x-1/2 rounded-xl border border-white/15 bg-home-dark/95 p-2 opacity-0 shadow-[0_22px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="grid gap-1">
              {item.items.map((child) => (
                <Link
                  key={child.to}
                  className="rounded-lg px-3.5 py-2.5 text-[0.94rem] font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
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

    if (isRouteNavItem(item)) {
      return (
        <Link
          key={item.to}
          className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.95rem] font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          to={item.to}
        >
          {item.label}
        </Link>
      )
    }

    return (
      <a key={item.href} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.95rem] font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
        {item.label}
      </a>
    )
  }

  const renderMobileDropdown = (item: HomeNavDropdownItem) => {
    const expanded = mobileExpandedKey === item.key
    return (
      <div key={item.key}>
        <button
          className="flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
          type="button"
          aria-expanded={expanded}
          onClick={() => setMobileExpandedKey(expanded ? null : item.key)}
        >
          <span>{item.label}</span>
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded ? (
          <div className="ml-3 mt-1 grid gap-0.5 rounded-xl border border-white/15 bg-black/20 p-1.5">
            {item.items.map((child) => (
              <Link
                key={child.to}
                className="rounded-lg px-3.5 py-3 text-[0.95rem] font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
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
    <header className={`fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 transition-[background-color,box-shadow] duration-500 ${solid || scrolled ? 'bg-home-dark/80 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl' : ''}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 text-white sm:px-8 lg:px-10">
        <Link className="flex shrink-0 items-center gap-3" to="/">
          <img src={logo} alt="" className="h-9 w-9 rounded-full bg-white/90 object-contain p-1" />
          <span className="hidden text-base font-semibold tracking-tight sm:block">{copy.churchName}</span>
        </Link>

        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/10 bg-black/20 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.14)] backdrop-blur-md lg:flex">
          {navItems.map(renderDesktopNavItem)}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelector language={language} onChange={auth.updateLanguage} variant="home" />
          <Link className="hidden whitespace-nowrap rounded-lg border border-white/15 px-4 py-1.5 text-[0.84rem] font-semibold text-white/90 transition hover:border-white/25 hover:bg-white/[0.06] sm:inline-flex" to={accountTo}>
            {accountLabel}
          </Link>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/30 bg-black/20 text-white shadow-sm backdrop-blur-md transition hover:border-white/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-home-dark/95 px-5 pb-6 pt-4 shadow-[0_24px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:px-8 lg:hidden">
          <nav aria-label="Primary" className="grid gap-1">
            {navItems.map((item) => isDropdownNavItem(item) ? renderMobileDropdown(item) : isRouteNavItem(item) ? (
              <Link
                key={item.to}
                className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-semibold text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                to={item.to}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.href} className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-semibold text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
                {item.label}
              </a>
            ))}
          </nav>
          <Link className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-4 py-3 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" to={accountTo} onClick={() => setMenuOpen(false)}>
            {accountLabel}
          </Link>
        </div>
      ) : null}
    </header>
  )
}

export default HomeNavHeader
