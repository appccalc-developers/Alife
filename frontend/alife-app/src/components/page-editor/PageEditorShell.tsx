import type { ReactNode } from 'react'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'

type Props = {
  loading: boolean
  error?: string
  main: ReactNode
  sidebar: ReactNode
}

const PageEditorShell = ({ loading, error, main, sidebar }: Props) => (
  <AppPageShell >
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
