import { useState, type ReactNode } from 'react'
import { PanelRightClose, Settings2 } from 'lucide-react'
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
  const [inspectorOpen, setInspectorOpen] = useState(false)

  return (
  <AppPageShell fullBleed>
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
        <div className="relative min-w-0">
          <main className="min-w-0 space-y-4">{main}</main>

          <button
            type="button"
            className="fixed right-4 top-24 z-50 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#176b5a] shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-200 desktop:right-7"
            aria-label={t('pageSettings')}
            title={t('pageSettings')}
            onClick={() => setInspectorOpen(true)}
          >
            <Settings2 className="h-5 w-5" />
          </button>

          {inspectorOpen ? (
            <div className="pointer-events-none fixed inset-0 z-50">
              <button
                type="button"
                className="pointer-events-auto absolute inset-0 bg-slate-950/45 backdrop-blur-sm desktop:hidden"
                aria-label={t('close')}
                onClick={() => setInspectorOpen(false)}
              />
              <aside className="pointer-events-auto fixed inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl border border-slate-200 bg-[#f8faf7] shadow-2xl desktop:inset-x-auto desktop:bottom-5 desktop:right-5 desktop:top-24 desktop:w-[27rem] desktop:rounded-3xl">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#176b5a]">
                      {t('pageSettings')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-label={t('close')}
                    title={t('close')}
                    onClick={() => setInspectorOpen(false)}
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {sidebar}
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      ) : (
        <main className="min-w-0 space-y-4">{main}</main>
      )
    ) : null}
  </AppPageShell>
  )
}

export default PageEditorShell
