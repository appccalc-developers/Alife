import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import { virtualChurchGuestVisitEnabled } from '../../app/routing/virtualChurchPublicAccess'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
  navItems: Array<{ href: string; label: string }>
}

const HomeFooter = ({ copy, navItems }: Props) => (
  <footer className="border-t border-home-border/50 bg-[#eae2d4] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
    <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="h-10 w-10 rounded-full bg-white/90 object-contain p-1 shadow-[0_8px_24px_rgba(42,31,19,0.08)]" />
        <div>
          <p className="text-sm font-semibold tracking-tight">{copy.churchName}</p>
          <p className="mt-1 text-xs leading-5 text-home-muted">{copy.footerLine}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.84rem] font-semibold text-home-muted">
        {navItems.map((item) => <Link key={item.href} className="border-b border-transparent pb-1 transition hover:border-home-accent/45 hover:text-home-gold-text" to={item.href}>{item.label}</Link>)}
        {virtualChurchGuestVisitEnabled() ? (
          <Link
            to="/virtual-church?vcVisual=v3"
            className="inline-flex min-h-11 items-center rounded-sm text-xs font-normal transition-colors hover:text-home-gold-text hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-home-green focus-visible:ring-offset-4"
          >
            {copy.virtualChurchTourLabel}
          </Link>
        ) : null}
      </div>
    </div>
  </footer>
)

export default HomeFooter
