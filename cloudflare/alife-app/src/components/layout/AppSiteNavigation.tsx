import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'

type Props = {
  items: { key: string; label: string; to: string }[]
  activeSection: string | null
  label: string
  idPrefix: string
  panelId: string
  resolveTo?: (to: string, search: string) => string
  onNavigate?: () => void
}

const AppSiteNavigation = ({ items, activeSection, label, idPrefix, panelId, resolveTo = to => to, onNavigate }: Props) => {
  const auth = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const itemKeys = items.map(item => item.key).join(',')
  const hasActiveTab = items.some(item => item.key === activeSection)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const revealCurrentTab = () => {
      const current = nav.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!current) return
      const bounds = nav.getBoundingClientRect()
      const itemBounds = current.getBoundingClientRect()
      if (itemBounds.left < bounds.left) nav.scrollLeft -= bounds.left - itemBounds.left
      else if (itemBounds.right > bounds.right) nav.scrollLeft += itemBounds.right - bounds.right
    }
    revealCurrentTab()
    const resizeObserver = new ResizeObserver(revealCurrentTab)
    resizeObserver.observe(nav)
    return () => resizeObserver.disconnect()
  }, [activeSection, auth.language, itemKeys])

  if (!items.length) return null

  return (
    <nav ref={navRef} role="tablist" aria-label={label} className="mt-4 flex gap-1 overflow-x-auto border-t border-[var(--alife-titlebar-divider)] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('[role="tab"]'))
        const index = tabs.indexOf(document.activeElement as HTMLAnchorElement)
        if (index < 0) return
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        tabs[next]?.focus()
      }}
    >
      {items.map(item => (
        <Link
          key={item.key}
          to={resolveTo(item.to, location.search)}
          role="tab"
          id={`${idPrefix}-${item.key}`}
          aria-controls={panelId}
          aria-selected={activeSection === item.key}
          tabIndex={activeSection === item.key || (!hasActiveTab && item.key === items[0]?.key) ? 0 : -1}
          preventScrollReset
          aria-current={activeSection === item.key ? 'page' : undefined}
          onClick={event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            // A filter navigation can update history before React finishes rendering.
            const to = resolveTo(item.to, window.location.search)
            const openTab = () => { onNavigate?.(); navigate(to, { preventScrollReset: true }) }
            if (confirmUnsavedChangesNavigation(to, openTab)) openTab()
          }}
          className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${activeSection === item.key ? 'border-[var(--alife-titlebar-accent)] bg-white/10 text-white' : 'border-transparent text-[#c7d9d2] hover:bg-white/10 hover:text-white'}`}
        >{item.label}</Link>
      ))}
    </nav>
  )
}

export default AppSiteNavigation
