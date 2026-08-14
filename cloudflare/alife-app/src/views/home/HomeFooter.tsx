import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
  navItems: Array<{ href: string; label: string }>
}

const HomeFooter = ({ copy, navItems }: Props) => (
  <footer className="border-t border-home-border/40 px-5 py-12 sm:px-8 lg:px-10">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="h-8 w-8 rounded-full bg-white/90 object-contain p-1" />
        <div>
          <p className="text-sm font-semibold">{copy.churchName}</p>
          <p className="text-xs text-home-muted">{copy.footerLine}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[0.84rem] font-medium text-home-muted">
        {navItems.map((item) => <Link key={item.href} className="transition hover:text-home-gold-text" to={item.href}>{item.label}</Link>)}
      </div>
    </div>
  </footer>
)

export default HomeFooter
