import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  dense?: boolean
  children: ReactNode
}

const AppSectionCard = ({ title, subtitle, dense = false, children }: Props) => (
  <article className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${dense ? 'p-4' : 'p-5 sm:p-6'}`}>
    {children}
  </article>
)

export default AppSectionCard
