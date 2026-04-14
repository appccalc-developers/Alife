import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}

const AppPageShell = ({ title, subtitle, children, actions }: Props) => (
  <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
    {children}
  </section>
)

export default AppPageShell
