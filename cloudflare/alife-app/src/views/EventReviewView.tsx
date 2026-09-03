import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import ReviewChatDialog from '../components/group/ReviewChatDialog'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { enrollmentSessionService } from '../services/enrollmentSessionService'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { createReviewId, reviewSessionService } from '../services/reviewSessionService'
import { useAuthStore } from '../stores/auth'
import type { EventEnrollmentRecord } from '../types/enrollment'
import type { GroupEventRecord } from '../types/event'
import type { EventReviewRecord } from '../types/review'
import { loadAiContentContext, type AiContentContext } from '../utils/aiContentContext'
import { getEventLifecycle } from '../utils/eventLifecycle'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'

const EventReviewView = () => {
  const t = useUiText()
  const { groupId: routeGroupId, eventId: routeEventId } = useParams<{ groupId: string; eventId: string }>()
  const { groupId, eventId } = useActiveEntityIds({ groupId: routeGroupId, eventId: routeEventId })
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('reviewId') || ''
  const { language, me } = useAuthStore()
  const [newReviewId, setNewReviewId] = useState(() => createReviewId())
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [existingReview, setExistingReview] = useState<EventReviewRecord | null>(null)
  const [enrollments, setEnrollments] = useState<EventEnrollmentRecord[]>([])
  const [aiContentContext, setAiContentContext] = useState<AiContentContext>({ missionStatements: [], eventContext: null })
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

    Promise.all([
      eventService.getGroupEvents(groupId),
      reviewId
        ? reviewSessionService.listEventReviews(eventId)
        : Promise.resolve([] as EventReviewRecord[]),
      enrollmentSessionService.listEventEnrollments(eventId).catch(() => [] as EventEnrollmentRecord[]),
    ])
      .then(([events, reviews, enrollmentRecords]) => {
        if (cancelled) return
        setEvent(events.find((item) => item.id === eventId) ?? null)
        setExistingReview(reviewId ? reviews.find((item) => item.id === reviewId) ?? null : null)
        setEnrollments(enrollmentRecords)
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(normalizeApiError(reason).message || t('eventLoadFailed'))
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
  }, [eventId, groupId, reviewId, t])

  useEffect(() => {
    if (!reviewId) {
      setNewReviewId(createReviewId())
    }
  }, [eventId, reviewId])

  useEffect(() => {
    if (!groupId || !event) {
      setAiContentContext({ missionStatements: [], eventContext: null })
      return
    }

    let cancelled = false
    loadAiContentContext(groupId, { event })
      .then((context) => {
        if (!cancelled) {
          setAiContentContext(context)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiContentContext({ missionStatements: [], eventContext: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [event, groupId])

  if (!groupId || !eventId) {
    return <Navigate to="/" replace />
  }

  if (event && getEventLifecycle(event) !== 'past') {
    return <Navigate to={eventBasePath} replace />
  }

  return (
    <AppPageShell
      title={eventTitle || (language === 'zh' ? '活动回顾' : 'Event review')}
      context={language === 'zh' ? '小组生活 / 活动 / 回顾' : 'Group Life / Event / Review'}
      status={event ? <AppBadge variant="neutral">{language === 'zh' ? '已结束' : 'Past event'}</AppBadge> : undefined}
      backLink={{ label: language === 'zh' ? '返回活动回顾' : 'Back to event memories', to: `${eventBasePath}?section=memories` }}
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
          {reviewId && !existingReview ? (
            <AppEmptyState title={t('eventNotFound')} description={t('eventLoadFailed')} />
          ) : (
            <ReviewChatDialog
              groupId={groupId}
              event={event}
              memberId={me?.id}
              language={language}
              reviewId={reviewId || newReviewId}
              existingReview={existingReview}
              enrollments={enrollments}
              aiContentContext={aiContentContext}
              onSuccess={setSuccessMessage}
            />
          )}
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default EventReviewView
