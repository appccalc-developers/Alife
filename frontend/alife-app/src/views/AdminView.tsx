import { useState } from 'react'
import { groupService } from '../api/groupService'

const AdminView = () => {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const syncSermons = async () => {
    setLoading(true)
    setResult('')

    try {
      const response = await groupService.syncSermons()
      setResult(response.message || 'Sermon sync triggered.')
    } catch {
      setResult('Failed to trigger sermon sync.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-600">System-level operations for Alife administrators.</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sermons</h2>
        <p className="mt-1 text-sm text-slate-600">Run manual sync from connected sources.</p>
        <button
          className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={loading}
          onClick={() => {
            syncSermons().catch(() => undefined)
          }}
        >
          {loading ? 'Syncing...' : 'Sync Sermons'}
        </button>
      </article>

      {result ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">{result}</p> : null}
    </section>
  )
}

export default AdminView
