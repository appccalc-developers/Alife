import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentGroupStore } from '../stores/currentGroup'

const HomeView = () => {
  const navigate = useNavigate()
  const { refreshChurchGroup } = useCurrentGroupStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const openChurchGroup = async () => {
      setLoading(true)
      setError('')

      const church = await refreshChurchGroup()
      if (cancelled) {
        return
      }

      if (church?.id) {
        navigate(`/groups/${church.id}`, { replace: true })
        return
      }

      setError('Unable to load the Church group right now.')
      setLoading(false)
    }

    openChurchGroup().catch(() => {
      if (!cancelled) {
        setError('Unable to load the Church group right now.')
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [navigate, refreshChurchGroup])

  return (
    <section className="space-y-5">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Opening church group...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}
    </section>
  )
}

export default HomeView
