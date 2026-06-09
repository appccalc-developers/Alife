import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import ReviewChatDialog from '../components/group/ReviewChatDialog'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useUiText } from '../i18n/uiText'
import { enrollmentSessionService } from '../services/enrollmentSessionService'
import { eventService } from '../services/eventService'
import { createReviewId, reviewSessionService } from '../services/reviewSessionService'
import { useAuthStore } from '../stores/auth'
import type { EventEnrollmentRecord } from '../types/enrollment'
import type { GroupEventRecord } from '../types/event'
import type { EventReviewRecord } from '../types/review'

const EventReviewView = () => {
  const t = useUiText()
  const { groupId = '', eventId = '' } = useParams<{ groupId: string; eventId: string }>()
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('reviewId') || ''
  const { language, me } = useAuthStore()
  const [newReviewId, setNewReviewId] = useState(() => createReviewId())
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [existingReview, setExistingReview] = useState<EventReviewRecord | null>(null)
  const [enrollments, setEnrollments] = useState<EventEnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setSuccessMessage('')

    Promise.all([
      eventService.getGroupEvents(groupId),
      reviewSessionService.listEventReviews(eventId).catch(() => [] as EventReviewRecord[]),
      enrollmentSessionService.listEventEnrollments(eventId).catch(() => [] as EventEnrollmentRecord[]),
    ])
      .then(([events, reviews, enrollmentRecords]) => {
        if (cancelled) return
        setEvent(events.find((item) => item.id === eventId) ?? null)
        setExistingReview(reviewId ? reviews.find((item) => item.id === reviewId) ?? null : null)
        setEnrollments(enrollmentRecords)
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
  }, [eventId, groupId, reviewId, t])

  useEffect(() => {
    if (!reviewId) {
      setNewReviewId(createReviewId())
    }
  }, [eventId, reviewId])

  if (!groupId || !eventId) {
    return <Navigate to="/" replace />
  }

  return (
    <AppPageShell>
      <div className="mb-5">
        <Link to={`/groups/${groupId}`} className="text-sm font-medium text-slate-600 hover:text-slate-950">
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
              onSuccess={setSuccessMessage}
            />
          )}
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default EventReviewView
