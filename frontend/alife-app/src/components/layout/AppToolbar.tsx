import type { ReactNode } from 'react'

type Props = {
  title?: string
  description?: string
  children: ReactNode
}

const AppToolbar = ({ title, description, children }: Props) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      {title || description ? (
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
          {description ? <p className="text-xs text-slate-600">{description}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </div>
)

export default AppToolbar
