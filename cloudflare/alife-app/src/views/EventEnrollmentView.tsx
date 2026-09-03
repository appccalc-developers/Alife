import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import EnrollmentChatDialog from '../components/group/EnrollmentChatDialog'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { eventService } from '../services/eventService'
import { useAuthStore } from '../stores/auth'
import type { GroupEventRecord } from '../types/event'
import { getEventLifecycle, readEventLifecycleData } from '../utils/eventLifecycle'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'

const EventEnrollmentView = () => {
  const t = useUiText()
  const { groupId: routeGroupId, eventId: routeEventId } = useParams<{ groupId: string; eventId: string }>()
  const { groupId, eventId } = useActiveEntityIds({ groupId: routeGroupId, eventId: routeEventId })
  const { language, me } = useAuthStore()
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(routeGroupId))
  const eventTitle = event ? (language === 'zh' ? event.titleZh || event.titleEn : event.titleEn || event.titleZh) : ''

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

  if (event && (getEventLifecycle(event) !== 'upcoming' || !readEventLifecycleData(event).acceptsEnrollments)) {
    return <Navigate to={eventBasePath} replace />
  }

  return (
    <AppPageShell
      title={eventTitle || (language === 'zh' ? '活动报名' : 'Event enrollment')}
      context={language === 'zh' ? '小组生活 / 活动 / 报名' : 'Group Life / Event / Enrollment'}
      status={event ? <AppBadge variant="success">{language === 'zh' ? '开放报名' : 'Enrollment open'}</AppBadge> : undefined}
      backLink={{ label: language === 'zh' ? '返回活动' : 'Back to event', to: eventBasePath }}
    >

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
