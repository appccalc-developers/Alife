import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  block?: boolean
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const AppActionButton = ({
  variant = 'secondary',
  size = 'md',
  block = false,
  children,
  className = '',
  ...props
}: Props) => {
  const variantClass =
    variant === 'primary'
      ? 'border border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
      : variant === 'danger'
        ? 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
        : variant === 'ghost'
          ? 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100'
          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'

  const sizeClass = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${sizeClass} ${block ? 'w-full' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export default AppActionButton
