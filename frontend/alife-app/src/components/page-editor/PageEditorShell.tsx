import type { ReactNode } from 'react'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'

type Props = {
  title: string
  loading: boolean
  error?: string
  actions?: ReactNode
  main: ReactNode
  sidebar: ReactNode
}

const PageEditorShell = ({ title, loading, error, actions, main, sidebar }: Props) => (
  <AppPageShell >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>

    {loading ? (
      <AppSectionCard dense>
        <p className="text-sm text-slate-600">Loading editor...</p>
      </AppSectionCard>
    ) : null}

    {!loading && error ? (
      <AppSectionCard dense>
        <p className="text-sm text-rose-700">{error}</p>
      </AppSectionCard>
    ) : null}

    {!loading && !error ? (
      sidebar ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <main className="space-y-4">{main}</main>
          <aside className="space-y-4">{sidebar}</aside>
        </div>
      ) : (
        <main className="space-y-4">{main}</main>
      )
    ) : null}
  </AppPageShell>
)

export default PageEditorShell
