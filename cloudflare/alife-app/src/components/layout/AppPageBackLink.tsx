import type { MouseEventHandler } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

type Props = {
  label: string
  to: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  className?: string
}

const AppPageBackLink = ({ label, to, onClick, className = '' }: Props) => (
  <Link
    to={to}
    onClick={onClick}
    className={`alife-titlebar-back group inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-[#c8d8d2] bg-white/75 p-1.5 pr-3.5 text-sm font-black text-[#18332d] shadow-[0_5px_18px_rgba(24,51,45,0.08)] backdrop-blur-md transition hover:-translate-x-0.5 hover:border-[#8eb9aa] hover:bg-[#f3f8f5] hover:shadow-[0_8px_22px_rgba(24,51,45,0.12)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1d4ed8]/30 motion-reduce:transform-none ${className}`}
    aria-label={label}
  >
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#deeee8] text-[#176b5a] transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none" aria-hidden="true">
      <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
    </span>
    <span className="min-w-0 truncate">{label}</span>
  </Link>
)

export default AppPageBackLink
