import type { ReactNode } from 'react'

type Props = {
  title?: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}

const AppPageShell = ({ children }: Props) => (
  <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    {children}
  </section>
)

export default AppPageShell
