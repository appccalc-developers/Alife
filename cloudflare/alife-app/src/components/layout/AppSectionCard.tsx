import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  action?: ReactNode
  dense?: boolean
  children: ReactNode
}

const AppSectionCard = ({ title, subtitle, action, dense = false, children }: Props) => (
  <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${dense ? 'p-4' : 'p-5 sm:p-6'}`}>
    {title || subtitle || action ? (
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title ? <h2 className="text-base font-semibold leading-tight text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="mt-0.5 text-sm leading-snug text-slate-600">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    ) : null}
    {children}
  </article>
)

export default AppSectionCard
