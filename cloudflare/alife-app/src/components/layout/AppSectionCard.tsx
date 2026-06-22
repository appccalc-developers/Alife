import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  action?: ReactNode
  dense?: boolean
  children: ReactNode
}

const AppSectionCard = ({ title, subtitle, action, dense = false, children }: Props) => (
  <article className={`alife-panel rounded-[1.75rem] ${dense ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
    {title || subtitle || action ? (
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-[#18332d]">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-[#66766f]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    ) : null}
    {children}
  </article>
)

export default AppSectionCard
