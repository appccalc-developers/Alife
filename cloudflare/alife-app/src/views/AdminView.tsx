import { useState } from 'react'
import { groupService } from '../api/groupService'
import { useUiText } from '../i18n/uiText'

const AdminView = () => {
  const t = useUiText()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const syncSermons = async () => {
    setLoading(true)
    setResult('')

    try {
      const response = await groupService.syncSermons()
      setResult(response.message || t('sermonSyncTriggered'))
    } catch {
      setResult(t('sermonSyncFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin')}</h1>
        <p className="text-sm text-slate-600">{t('adminDescription')}</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{t('sermons')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('sermonsAdminDescription')}</p>
        <button
          className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={loading}
          onClick={() => {
            syncSermons().catch(() => undefined)
          }}
        >
          {loading ? t('syncing') : t('syncSermons')}
        </button>
      </article>

      {result ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{result}</p> : null}
    </section>
  )
}

export default AdminView
