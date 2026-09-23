import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  action?: ReactNode
  dense?: boolean
  children: ReactNode
}

const AppSectionCard = ({ title, subtitle, action, dense = false, children }: Props) => (
  <article className={`alife-panel rounded-[var(--alife-radius-card)] ${dense ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}>
    {title || subtitle || action ? (
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/10 pb-4">
        <div className="relative min-w-0 pl-3.5">
          <span className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-[#e37b63]" aria-hidden="true" />
          {title ? <h2 className="text-base font-black leading-tight tracking-[-0.01em] text-[#18332d] sm:text-lg desktop:font-bold">{title}</h2> : null}
          {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    ) : null}
    {children}
  </article>
)

export default AppSectionCard
