import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  fullBleed?: boolean
}

const AppPageShell = ({ title, subtitle, actions, children, fullBleed = false }: Props) => (
  <section className={fullBleed ? 'mx-auto w-full max-w-none space-y-5 desktop:space-y-6' : 'mx-auto w-full max-w-6xl space-y-5 desktop:space-y-6'}>
    {title || subtitle || actions ? (
      <header className="flex flex-col gap-4 rounded-[var(--alife-radius-card)] border border-[#2f4b42]/10 bg-white/70 px-5 py-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)] backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:px-6 desktop:rounded-none desktop:border-x-0 desktop:border-t-0 desktop:bg-transparent desktop:px-1 desktop:pt-1 desktop:shadow-none desktop:backdrop-blur-none">
        <div className="min-w-0">
          {title ? <h1 className="text-2xl font-black leading-tight tracking-[-0.03em] text-[#18332d] sm:text-3xl desktop:font-bold">{title}</h1> : null}
          {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66766f]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    ) : null}
    {children}
  </section>
)

export default AppPageShell
