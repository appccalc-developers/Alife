import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type SharedProps = {
  label: string
  icon: ReactNode
  to?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}

type Props = SharedProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps>

const actionClassName = 'alife-titlebar-primary inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:px-4'

const AppTitleBarAction = ({ label, icon, to, onClick, disabled, className = '', ...buttonProps }: Props) => {
  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        aria-label={label}
        title={label}
        aria-disabled={disabled || undefined}
        className={`${actionClassName} ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`.trim()}
        onClick={disabled ? (event) => event.preventDefault() : onClick}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`${actionClassName} ${className}`.trim()}
      onClick={onClick}
      {...buttonProps}
    >
      {content}
    </button>
  )
}

export default AppTitleBarAction
