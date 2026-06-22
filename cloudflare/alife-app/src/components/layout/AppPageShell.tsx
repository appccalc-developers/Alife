import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}

const AppPageShell = ({ children }: Props) => (
  <section className="mx-auto w-full max-w-6xl space-y-6">
    {children}
  </section>
)

export default AppPageShell
