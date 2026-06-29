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
      ? 'border border-[#176b5a] bg-[#176b5a] text-white shadow-[0_9px_22px_rgba(23,107,90,0.18)] hover:border-[#0d4f43] hover:bg-[#0d4f43]'
      : variant === 'danger'
        ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
        : variant === 'ghost'
          ? 'border border-transparent bg-transparent text-[#40554e] hover:bg-[#e3f0eb]'
          : 'border border-[#2f4b42]/15 bg-white text-[#40554e] shadow-sm hover:border-[#176b5a]/25 hover:text-[#0d4f43]'

  const sizeClass = size === 'sm' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-10 px-4 py-2 text-sm'

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl font-bold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variantClass} ${sizeClass} ${block ? 'w-full' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export default AppActionButton
