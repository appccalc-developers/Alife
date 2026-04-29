import type { ReactNode } from 'react'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'

type Props = {
  title: string
  loading: boolean
  error?: string
  actions?: ReactNode
  main: ReactNode
}

const PageEditorShell = ({ title, loading, error, actions, main }: Props) => (
  <AppPageShell title={title} subtitle="Draft pages stay private until they are published." actions={actions}>
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
      <main className="space-y-4">{main}</main>
    ) : null}
  </AppPageShell>
)

export default PageEditorShell
