import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { useAuthStore } from '../../stores/auth'
import type { HomeCopy, Language } from './homeCopy'
import { createSectionHandler } from './homeUtils'

type Props = {
  copy: HomeCopy
  language: Language
}

const HomeNavHeader = ({ copy, language }: Props) => {
  const auth = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const accountTo = auth.isGuest ? '/onboarding' : '/groups/select'
  const accountLabel = auth.isGuest ? copy.account : copy.enterAlife

  const navItems = [
    { href: '#about', label: copy.nav.about },
    { href: '#visit', label: copy.nav.visit },
    { href: '#groups', label: copy.nav.groups },
    { href: '#events', label: language === 'zh' ? '近期活动' : 'Events' },
    { href: '#location', label: copy.nav.location },
  ]
  const scrollToSection = createSectionHandler(() => setMenuOpen(false))

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ${scrolled ? 'bg-home-dark/80 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl' : ''}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 text-white sm:px-8 lg:px-10">
        <Link className="flex shrink-0 items-center gap-3" to="/">
          <img src={logo} alt="" className="h-8 w-8 rounded-full bg-white/90 object-contain p-1" />
          <span className="hidden text-[0.94rem] font-semibold tracking-tight sm:block">{copy.churchName}</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} className="whitespace-nowrap px-3.5 py-1.5 text-[0.84rem] font-medium text-white/60 transition hover:text-white" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            className="text-[0.84rem] font-medium text-white/45 transition hover:text-white"
            type="button"
            onClick={() => void auth.updateLanguage(language === 'zh' ? 'en' : 'zh')}
            aria-label="Switch language"
          >
            {language === 'zh' ? 'EN' : '中文'}
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
            {navItems.map((item) => (
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
