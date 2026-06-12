import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import EnrollmentChatDialog from '../components/group/EnrollmentChatDialog'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { eventService } from '../services/eventService'
import { useAuthStore } from '../stores/auth'
import type { GroupEventRecord } from '../types/event'

const EventEnrollmentView = () => {
  const t = useUiText()
  const { groupId: routeGroupId, eventId: routeEventId } = useParams<{ groupId: string; eventId: string }>()
  const { groupId, eventId } = useActiveEntityIds({ groupId: routeGroupId, eventId: routeEventId })
  const { language, me } = useAuthStore()
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!groupId || !eventId) {
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setSuccessMessage('')

    eventService
      .getGroupEvents(groupId)
      .then((events) => {
        if (cancelled) return
        setEvent(events.find((item) => item.id === eventId) ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('eventLoadFailed'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventId, groupId, t])

  if (!groupId || !eventId) {
    return <Navigate to="/" replace />
  }

  return (
    <AppPageShell>
      <div className="mb-5">
        <Link to="/groups" className="text-sm font-medium text-slate-600 hover:text-slate-950">
          {t('backToGroup')}
        </Link>
      </div>

      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">{t('loadingManagementWorkspace')}</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && !event ? (
        <AppEmptyState title={t('eventNotFound')} description={t('eventLoadFromGroupFailed')} />
      ) : null}

      {!loading && !error && event ? (
        <div className="space-y-4">
          {successMessage ? (
            <AppSectionCard dense>
              <p className="text-sm text-emerald-700">{successMessage}</p>
            </AppSectionCard>
          ) : null}
          <EnrollmentChatDialog
            variant="page"
            groupId={groupId}
            event={event}
            memberId={me?.id}
            initialApplicantName={me?.displayName?.trim() ?? ''}
            language={language}
            onSuccess={setSuccessMessage}
          />
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default EventEnrollmentView
