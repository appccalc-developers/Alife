import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

export type AppOverflowAction = {
  label: string
  icon?: ReactNode
  to?: string
  onSelect?: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}

type Props = {
  actions: AppOverflowAction[]
  label: string
}

const AppOverflowMenu = ({ actions, label }: Props) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  if (!actions.length) return null

  const itemClassName = (tone: AppOverflowAction['tone']) => [
    'flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]/25 disabled:cursor-not-allowed disabled:opacity-45',
    tone === 'danger'
      ? 'text-rose-700 hover:bg-rose-50'
      : 'text-[#40554e] hover:bg-[#edf5f1] hover:text-[#0d4f43]',
  ].join(' ')

  const select = (action: AppOverflowAction) => {
    if (action.disabled) return
    setOpen(false)
    action.onSelect?.()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="alife-icon-button h-11 w-11 bg-white/92 shadow-sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.55rem)] z-50 min-w-52 rounded-2xl border border-[#2f4b42]/15 bg-white p-1.5 shadow-[0_20px_50px_rgba(24,51,45,0.18)]"
        >
          {actions.map((action) => action.to ? (
            <Link
              key={`${action.to}:${action.label}`}
              to={action.to}
              role="menuitem"
              aria-disabled={action.disabled || undefined}
              className={itemClassName(action.tone)}
              onClick={(event) => {
                if (action.disabled) {
                  event.preventDefault()
                  return
                }
                select(action)
              }}
            >
              {action.icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">{action.icon}</span> : null}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className={itemClassName(action.tone)}
              onClick={() => select(action)}
            >
              {action.icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">{action.icon}</span> : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default AppOverflowMenu
