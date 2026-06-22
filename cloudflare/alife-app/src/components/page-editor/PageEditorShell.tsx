import type { ReactNode } from 'react'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import { useUiText } from '../../i18n/uiText'

type Props = {
  loading: boolean
  error?: string
  main: ReactNode
  sidebar: ReactNode
}

const PageEditorShell = ({ loading, error, main, sidebar }: Props) => {
  const t = useUiText()

  return (
  <AppPageShell >
    {loading ? (
      <AppSectionCard dense>
        <p className="text-sm text-slate-600">{t('loadingEditor')}</p>
      </AppSectionCard>
    ) : null}

    {!loading && error ? (
      <AppSectionCard dense>
        <p className="text-sm text-rose-700">{error}</p>
      </AppSectionCard>
    ) : null}

    {!loading && !error ? (
      sidebar ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <main className="min-w-0 space-y-4">{main}</main>
          <aside className="min-w-0 space-y-4">{sidebar}</aside>
        </div>
      ) : (
        <main className="min-w-0 space-y-4">{main}</main>
      )
    ) : null}
  </AppPageShell>
  )
}

export default PageEditorShell
