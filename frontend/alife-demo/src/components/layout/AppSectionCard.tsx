import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  dense?: boolean
  children: ReactNode
}

const AppSectionCard = ({ title, subtitle, dense = false, children }: Props) => (
  <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${dense ? 'p-4' : 'p-5 sm:p-6'}`}>
    {title || subtitle ? (
      <header className="mb-4 space-y-1">
        {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </header>
    ) : null}
    {children}
  </article>
)

export default AppSectionCard
