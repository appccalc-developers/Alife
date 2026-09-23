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

const HomeNavHeader = ({ copy, language, navItems: providedNavItems }: Props) => {
  const auth = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileExpandedKey, setMobileExpandedKey] = useState<string | null>(null)

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
            className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap border-b border-transparent px-2.5 py-1.5 text-[0.85rem] font-semibold text-white/82 transition duration-300 hover:border-home-gold/70 hover:text-white focus:border-home-gold/70 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
            type="button"
            aria-haspopup="true"
          >
            {item.label}
            <ChevronDown className="h-4 w-4 transition group-hover:rotate-180 group-focus-within:rotate-180" />
          </button>
          <div className="invisible absolute left-1/2 top-full mt-2 min-w-60 -translate-x-1/2 rounded-2xl border border-[#c8b89d] bg-[#eee3d1]/[0.98] p-2 opacity-0 shadow-[0_20px_56px_rgba(66,48,30,0.18)] backdrop-blur-xl transition duration-300 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <div className="grid gap-1">
              {item.items.map((child) => (
                <Link
                  key={child.to}
                  className="rounded-xl px-3.5 py-2.5 text-[0.9rem] font-medium text-[#5a4a38] transition hover:bg-home-gold/35 hover:text-home-dark focus:bg-home-gold/35 focus:text-home-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-home-green/35"
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
          className="inline-flex min-h-10 items-center whitespace-nowrap border-b border-transparent px-2.5 py-1.5 text-[0.85rem] font-semibold text-white/82 transition duration-300 hover:border-home-gold/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55"
          to={item.to}
        >
          {item.label}
        </Link>
      )
    }

    return (
      <a key={item.href} className="inline-flex min-h-10 items-center whitespace-nowrap border-b border-transparent px-2.5 py-1.5 text-[0.85rem] font-semibold text-white/82 transition duration-300 hover:border-home-gold/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
        {item.label}
      </a>
    )
  }

  const renderMobileDropdown = (item: HomeNavDropdownItem) => {
    const expanded = mobileExpandedKey === item.key
    return (
      <div key={item.key}>
        <button
          className="flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold text-home-dark transition hover:bg-home-gold/25 hover:text-home-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-home-green/35"
          type="button"
          aria-expanded={expanded}
          onClick={() => setMobileExpandedKey(expanded ? null : item.key)}
        >
          <span>{item.label}</span>
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded ? (
          <div className="ml-3 mt-1 grid gap-0.5 rounded-xl border border-[#c8b89d] bg-[#eee3d1]/80 p-1.5">
            {item.items.map((child) => (
              <Link
                key={child.to}
                className="rounded-lg px-3.5 py-3 text-[0.95rem] font-medium text-home-muted transition hover:bg-home-gold/25 hover:text-home-dark focus:bg-home-gold/25 focus:text-home-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-home-green/35"
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
    <header className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,27,23,0.58)_0%,rgba(26,34,29,0.36)_72%,rgba(26,34,29,0.18)_100%)] shadow-[0_8px_24px_rgba(12,18,15,0.1)] backdrop-blur-[10px] backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 text-white sm:px-6 lg:px-8">
        <Link className="group flex shrink-0 items-center gap-2.5" to="/">
          <img src={logo} alt="" className="h-9 w-9 rounded-full border border-white/35 bg-[#f5ecdc]/90 object-contain p-1 shadow-[0_5px_16px_rgba(0,0,0,0.18)] transition duration-300 group-hover:scale-105" />
          <span className="hidden max-w-52 text-[0.82rem] font-semibold leading-tight tracking-tight text-white/94 sm:block">{copy.churchName}</span>
        </Link>

        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
          {navItems.map(renderDesktopNavItem)}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector language={language} onChange={auth.updateLanguage} variant="home" />
          <Link className="hidden min-h-9 items-center whitespace-nowrap rounded-full border border-white/35 bg-[#f3dfbd]/90 px-4 py-1.5 text-[0.78rem] font-semibold text-[#2b2015] shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition duration-300 hover:border-white/55 hover:bg-[#f7e8cc] sm:inline-flex" to={accountTo}>
            {accountLabel}
          </Link>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/10 text-white shadow-sm backdrop-blur-md transition hover:border-white/50 hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 lg:hidden"
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
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-[#c5b497] bg-[#e8dcc8]/[0.98] px-4 pb-5 pt-3 shadow-[0_20px_44px_rgba(66,48,30,0.16)] backdrop-blur-xl sm:px-6 lg:hidden">
          <nav aria-label="Primary" className="grid gap-1">
            {navItems.map((item) => isDropdownNavItem(item) ? renderMobileDropdown(item) : isRouteNavItem(item) ? (
              <Link
                key={item.to}
                className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-semibold text-home-dark transition hover:bg-home-gold/25 hover:text-home-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-home-green/35"
                to={item.to}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.href} className="flex min-h-12 items-center rounded-xl px-4 py-3 text-base font-semibold text-home-dark transition hover:bg-home-gold/25 hover:text-home-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-home-green/35" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
                {item.label}
              </a>
            ))}
          </nav>
          <Link className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-home-green bg-home-green px-4 py-3 text-base font-semibold text-white shadow-[0_8px_20px_rgba(47,111,98,0.18)] transition hover:bg-home-green-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-green/35" to={accountTo} onClick={() => setMenuOpen(false)}>
            {accountLabel}
          </Link>
        </div>
      ) : null}
    </header>
  )
}

export default HomeNavHeader
