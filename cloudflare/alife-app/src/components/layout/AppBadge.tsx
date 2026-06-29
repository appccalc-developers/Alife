import type { ReactNode } from 'react'

type Props = {
  variant?: 'neutral' | 'success' | 'warning' | 'info' | 'danger'
  children: ReactNode
}

const AppBadge = ({ variant = 'neutral', children }: Props) => {
  const variantClass =
    variant === 'success'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : variant === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : variant === 'info'
          ? 'bg-blue-50 text-blue-700 ring-blue-200'
          : variant === 'danger'
            ? 'bg-rose-50 text-rose-700 ring-rose-200'
            : 'bg-slate-100 text-slate-700 ring-slate-200'

  return <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${variantClass}`}>{children}</span>
}

export default AppBadge
