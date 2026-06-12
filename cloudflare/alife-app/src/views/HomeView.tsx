import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUiText } from '../i18n/uiText'
import { activeEntityService } from '../services/activeEntityService'
import { useCurrentGroupStore } from '../stores/currentGroup'

const HomeView = () => {
  const t = useUiText()
  const navigate = useNavigate()
  const { refreshChurchGroup } = useCurrentGroupStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tRef = useRef(t)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    let cancelled = false

    const openDefaultGroup = async () => {
      setLoading(true)
      setError('')

      const activeGroupId = activeEntityService.getAll().groupId
      if (activeGroupId) {
        navigate('/groups', { replace: true })
        return
      }

      const church = await refreshChurchGroup()
      if (cancelled) {
        return
      }

      if (church?.id) {
        activeEntityService.setGroup(church.id)
        navigate('/groups', { replace: true })
        return
      }

      setError(tRef.current('churchGroupLoadError'))
      setLoading(false)
    }

    openDefaultGroup().catch(() => {
      if (!cancelled) {
        setError(tRef.current('churchGroupLoadError'))
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [navigate, refreshChurchGroup])

  return (
    <section className="space-y-5">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">{t('openingChurchGroup')}</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}
    </section>
  )
}

export default HomeView
