import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, Pencil, Workflow } from 'lucide-react'
import EnrollmentChatDialog from '../components/group/EnrollmentChatDialog'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AppTitleBarAction from '../components/layout/AppTitleBarAction'
import CoverImage from '../components/CoverImage'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { enrollmentSessionService } from '../services/enrollmentSessionService'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { normalizeImageUrl } from '../services/imageWorkerApi'
import { parseReviewDraft, reviewSessionService } from '../services/reviewSessionService'
import { useAuthStore } from '../stores/auth'
import type { EventEnrollmentRecord } from '../types/enrollment'
import type { EventDto, GroupEventRecord, MultilingualString } from '../types/event'
import type { EventReviewRecord } from '../types/review'
import { contactService } from '../services/contactService'
import type { ContactProfileDto } from '../types/contact'
import { getEventLifecycle, readEventLifecycleData } from '../utils/eventLifecycle'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import EventWorkflowPanel from '../components/events/EventWorkflowPanel'
import useConfirmation from '../hooks/useConfirmation'

type EventDetailSection = 'notice' | 'workflow' | 'enrollments' | 'memories'

type EnrollmentPayload = {
  applicantName?: string
  consentStatus?: string
  paymentFiles?: Array<{ fileName?: string; url?: string }>
  submittedAtUtc?: string
}

const labels = {
  en: {
    backToGroup: 'Back to group',
    backToEvents: 'Back to events',
    loading: 'Loading event...',
    eventLoadFailed: 'Unable to load event.',
    eventNotFound: 'Event not found.',
    notice: 'Event notice',
    enrollments: 'Enrollment',
    memories: 'Memories',
    registrationDeadline: 'Registration deadline',
    noRegistration: 'No registration required',
    location: 'Location',
    time: 'Time',
    capacity: 'Capacity',
    fees: 'Fees',
    rules: 'Rules',
    optionalActivities: 'Optional activities',
    poster: 'Poster',
    gallery: 'Gallery',
    noPoster: 'No poster image yet.',
    noDescription: 'No event description yet.',
    registered: 'Registered',
    youAreRegistered: 'You are registered for this event.',
    withdraw: 'Withdraw enrollment',
    withdrawing: 'Withdrawing...',
    withdrawClosed: 'Enrollment withdrawal is closed after the registration deadline.',
    withdrawConfirm: 'You will no longer be enrolled in this event and your submitted enrollment will be removed.',
    withdrawTitle: 'Withdraw enrollment?',
    withdrawSuccess: 'Enrollment withdrawn.',
    noEnrollments: 'No enrollments yet.',
    enrollNow: 'Enroll now',
    alreadyEnrolled: 'Already enrolled',
    submitted: 'Submitted',
    paymentFiles: 'Payment files',
    guestEnrollmentHint: 'Please complete registration before enrolling.',
    noReviews: 'No memories have been published yet.',
    addReview: 'Add review',
    modifyReview: 'Modify review',
    deleteReview: 'Delete',
    deleteReviewConfirm: 'This review will be removed from the event. This cannot be undone.',
    deleteReviewTitle: 'Delete review?',
    deleteReviewSuccess: 'Review deleted.',
    summary: 'Summary',
    reflection: 'Reflection',
    people: 'People',
    activities: 'Activities',
    photos: 'Photos',
  },
  zh: {
    backToGroup: '返回小组',
    backToEvents: '返回活动列表',
    loading: '正在加载活动...',
    eventLoadFailed: '无法加载活动。',
    eventNotFound: '未找到活动。',
    notice: '活动通知',
    enrollments: '报名',
    memories: '图文回忆',
    registrationDeadline: '报名截止',
    noRegistration: '无需报名',
    location: '地点',
    time: '时间',
    capacity: '容量',
    fees: '费用',
    rules: '规则',
    optionalActivities: '可选活动',
    poster: '海报',
    gallery: '图库',
    noPoster: '尚无海报图片。',
    noDescription: '尚无活动描述。',
    registered: '已报名',
    youAreRegistered: '你已经报名这个活动。',
    withdraw: '撤回报名',
    withdrawing: '正在撤回...',
    withdrawClosed: '报名截止后不能撤回报名。',
    withdrawConfirm: '撤回后，你将不再报名此活动，已提交的报名资料也会被移除。',
    withdrawTitle: '要撤回报名吗？',
    withdrawSuccess: '报名已撤回。',
    noEnrollments: '还没有人报名。',
    enrollNow: '我要报名',
    alreadyEnrolled: '已报名',
    submitted: '提交时间',
    paymentFiles: '付款凭证',
    guestEnrollmentHint: '请先完成注册，再报名活动。',
    noReviews: '还没有发布图文回忆。',
    addReview: '添加回顾',
    modifyReview: '修改回顾',
    deleteReview: '删除',
    deleteReviewConfirm: '这条回顾将从活动中移除，此操作无法撤销。',
    deleteReviewTitle: '要删除回顾吗？',
    deleteReviewSuccess: '回顾已删除。',
    summary: '摘要',
    reflection: '回顾',
    people: '人物',
    activities: '活动',
    photos: '照片',
  },
} as const

const getLabels = (language: string) => (language === 'zh' ? labels.zh : labels.en)

const localized = (value: MultilingualString | null | undefined, language: string) =>
  (language === 'zh' ? value?.zh : value?.en) || value?.en || value?.zh || ''

const formatDateTime = (value: string | null | undefined, language: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fallbackEventDto = (record: GroupEventRecord): EventDto => ({
  id: record.id,
  visibility: record.visibility ?? 'groupVisible',
  title: { zh: record.titleZh, en: record.titleEn },
  description: { zh: '', en: '' },
  locationName: { zh: '', en: '' },
  startDate: record.startDate,
  endDate: record.endDate,
  registrationDeadline: record.startDate,
  maxCapacity: 0,
  capacityUnit: 'People',
  hardConstraints: [],
  optionalActivities: [],
  baseFeePerAdult: null,
  baseFeePerChild: null,
  currency: 'USD',
  posterImageUrl: null,
  galleryUrls: [],
  legacySummary: null,
})

const parseEventDto = (record: GroupEventRecord): EventDto => {
  try {
    const parsed = JSON.parse(record.eventDataJson) as Partial<EventDto>
    if (parsed && typeof parsed === 'object') {
      const dto = {
        ...fallbackEventDto(record),
        ...parsed,
        id: record.id,
        title: parsed.title ?? { zh: record.titleZh, en: record.titleEn },
        description: parsed.description ?? { zh: '', en: '' },
        locationName: parsed.locationName ?? { zh: '', en: '' },
        hardConstraints: Array.isArray(parsed.hardConstraints) ? parsed.hardConstraints : [],
        optionalActivities: Array.isArray(parsed.optionalActivities) ? parsed.optionalActivities : [],
        galleryUrls: Array.isArray(parsed.galleryUrls) ? parsed.galleryUrls : [],
      }
      return {
        ...dto,
        posterImageUrl: dto.posterImageUrl ? normalizeImageUrl(dto.posterImageUrl) : dto.posterImageUrl,
        galleryUrls: dto.galleryUrls.map(normalizeImageUrl),
      }
    }
  } catch {
    // Fall back to the summary fields stored on the event row.
  }

  const fallback = fallbackEventDto(record)
  return {
    ...fallback,
    posterImageUrl: fallback.posterImageUrl ? normalizeImageUrl(fallback.posterImageUrl) : fallback.posterImageUrl,
    galleryUrls: fallback.galleryUrls.map(normalizeImageUrl),
  }
}

const parseEnrollmentPayload = (record: EventEnrollmentRecord): EnrollmentPayload => {
  try {
    const parsed = JSON.parse(record.enrollmentJson) as EnrollmentPayload
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const isBeforeDeadline = (deadline: string | null | undefined) => {
  if (!deadline) return true
  const time = new Date(deadline).getTime()
  return Number.isFinite(time) ? Date.now() <= time : true
}

const EventNoticePanel = ({ event, eventDto, language, contacts, currentGroupRoute }: { event: GroupEventRecord; eventDto: EventDto; language: string; contacts: ContactProfileDto[]; currentGroupRoute: boolean }) => {
  const text = getLabels(language)
  const title = localized(eventDto.title, language) || event.titleEn || event.titleZh
  const description = localized(eventDto.description, language)
  const location = localized(eventDto.locationName, language)
  const posterUrl = typeof eventDto.posterImageUrl === 'string' && eventDto.posterImageUrl.trim()
    ? eventDto.posterImageUrl.trim()
    : undefined
  const [loadedPoster, setLoadedPoster] = useState<{ url: string; aspectRatio: number } | null>(null)
  const posterAspectRatio = loadedPoster && loadedPoster.url === posterUrl ? loadedPoster.aspectRatio : null
  const galleryUrls = eventDto.galleryUrls.filter(Boolean)
  const feeParts = [
    eventDto.baseFeePerAdult != null ? `${eventDto.currency} ${eventDto.baseFeePerAdult} / adult` : '',
    eventDto.baseFeePerChild != null ? `${eventDto.currency} ${eventDto.baseFeePerChild} / child` : '',
  ].filter(Boolean)

  const useDesktopSideBySideLayout = posterAspectRatio !== null && posterAspectRatio >= 1

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={useDesktopSideBySideLayout ? 'desktop:grid desktop:grid-cols-2' : ''}>
          {posterUrl ? (
            <CoverImage
              key={posterUrl}
              src={posterUrl}
              alt={title || text.poster}
              aspectRatio={posterAspectRatio ?? 16 / 9}
              className="w-full bg-slate-50"
              fetchPriority="high"
              objectFit="contain"
              onLoad={(image) => {
                if (image.naturalHeight > 0) {
                  setLoadedPoster({ url: posterUrl, aspectRatio: image.naturalWidth / image.naturalHeight })
                }
              }}
              openOnLongPressOrDoubleClick
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center bg-slate-100 text-sm text-slate-500">
              {text.noPoster}
            </div>
          )}
          <div className={['p-5 sm:p-6', useDesktopSideBySideLayout ? 'desktop:border-l desktop:border-slate-200' : ''].join(' ')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-black text-[#18332d]">{text.notice}</h2>
              </div>
              <AppBadge variant={eventDto.maxCapacity === 0 || !isBeforeDeadline(eventDto.registrationDeadline) ? 'neutral' : 'success'}>
                {eventDto.maxCapacity === 0
                  ? text.noRegistration
                  : `${text.registrationDeadline}: ${formatDateTime(eventDto.registrationDeadline, language) || '-'}`}
              </AppBadge>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {description || text.noDescription}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 desktop:grid-cols-3">
        <AppSectionCard dense title={text.time}>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Start</dt>
              <dd className="mt-1 text-slate-900">{formatDateTime(eventDto.startDate, language) || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">End</dt>
              <dd className="mt-1 text-slate-900">{formatDateTime(eventDto.endDate, language) || '-'}</dd>
            </div>
          </dl>
        </AppSectionCard>
        <AppSectionCard dense title={text.location}>
          <p className="text-sm text-slate-700">{location || '-'}</p>
        </AppSectionCard>
        <AppSectionCard dense title={text.capacity}>
          <p className="text-sm text-slate-700">
            {eventDto.maxCapacity > 0 ? `${eventDto.maxCapacity} ${eventDto.capacityUnit}` : text.noRegistration}
          </p>
          {feeParts.length ? <p className="mt-2 text-sm text-slate-500">{feeParts.join(' - ')}</p> : null}
        </AppSectionCard>
      </div>

      {eventDto.hardConstraints.length ? (
        <AppSectionCard dense title={text.rules}>
          <ul className="space-y-2">
            {eventDto.hardConstraints.map((rule) => (
              <li key={`${rule.ruleKey}-${localized(rule.displayMessage, language)}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span className="font-semibold">{rule.ruleKey}</span>
                <span className="ml-2">{localized(rule.displayMessage, language)}</span>
              </li>
            ))}
          </ul>
        </AppSectionCard>
      ) : null}

      {eventDto.optionalActivities.length ? (
        <AppSectionCard dense title={text.optionalActivities}>
          <ul className="flex flex-wrap gap-2">
            {eventDto.optionalActivities.map((activity, index) => (
              <li key={`${localized(activity.name, language)}-${index}`} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
                {localized(activity.name, language)}
                {activity.extraFee > 0 ? <span className="ml-1 text-xs">+{eventDto.currency} {activity.extraFee}</span> : null}
              </li>
            ))}
          </ul>
        </AppSectionCard>
      ) : null}

      {contacts.length ? (
        <AppSectionCard dense title={language === 'zh' ? '活动联系人' : 'Event contacts'}>
          <div className="grid gap-3 sm:grid-cols-2">
            {contacts.map((contact) => (
              <Link key={contact.id} to={currentGroupRoute ? `/contacts/${encodeURIComponent(contact.id)}` : `/groups/${encodeURIComponent(contact.ownerGroupId)}/contacts/${encodeURIComponent(contact.id)}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50">
                {contact.photoUrl ? <img src={contact.photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : null}
                <span><span className="block font-bold text-slate-950">{localized(contact.name as MultilingualString, language)}</span><span className="block text-sm text-slate-500">{localized(contact.role as MultilingualString, language)}</span></span>
              </Link>
            ))}
          </div>
        </AppSectionCard>
      ) : null}

      {galleryUrls.length ? (
        <AppSectionCard dense title={text.gallery}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryUrls.map((url, index) => (
              <CoverImage
                key={`${url}-${index}`}
                src={url}
                alt={`${text.gallery} ${index + 1}`}
                aspectRatio={1}
                className="rounded-lg"
                openOnLongPressOrDoubleClick
              />
            ))}
          </div>
        </AppSectionCard>
      ) : null}
    </div>
  )
}

const EnrollmentPanel = ({
  event,
  eventDto,
  enrollments,
  language,
  memberId,
  isGuest,
  loading,
  onRefresh,
}: {
  event: GroupEventRecord
  eventDto: EventDto
  enrollments: EventEnrollmentRecord[]
  language: string
  memberId?: string
  isGuest: boolean
  loading: boolean
  onRefresh: () => Promise<void>
}) => {
  const text = getLabels(language)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')
  const currentEnrollment = memberId ? enrollments.find((item) => item.memberId === memberId) : undefined
  const canWithdraw = isBeforeDeadline(eventDto.registrationDeadline)

  const withdraw = async () => {
    if (!currentEnrollment || !await requestConfirmation({
      title: text.withdrawTitle,
      description: text.withdrawConfirm,
      confirmLabel: text.withdraw,
      tone: 'danger',
    })) return
    setDeletingId(currentEnrollment.id)
    setMessage('')
    try {
      await enrollmentSessionService.deleteEnrollment(event.id, currentEnrollment.id)
      setMessage(text.withdrawSuccess)
      await onRefresh()
    } catch (reason) {
      setMessage(normalizeApiError(reason).message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
    <div className="space-y-5">
      {message ? (
        <AppSectionCard dense>
          <p className={message === text.withdrawSuccess ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{message}</p>
        </AppSectionCard>
      ) : null}

      {currentEnrollment ? (
        <AppSectionCard
          dense
          title={text.youAreRegistered}
          action={
            canWithdraw ? (
              <AppActionButton variant="danger" disabled={Boolean(deletingId)} onClick={() => void withdraw()}>
                {deletingId ? text.withdrawing : text.withdraw}
              </AppActionButton>
            ) : null
          }
        >
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
            <AppBadge variant="success">{text.alreadyEnrolled}</AppBadge>
            {!canWithdraw ? <p className="mt-2 text-sm text-emerald-900">{text.withdrawClosed}</p> : null}
          </div>
        </AppSectionCard>
      ) : isGuest ? (
        <AppSectionCard dense title={text.enrollNow}>
          <p className="text-sm text-slate-600">{text.guestEnrollmentHint}</p>
        </AppSectionCard>
      ) : (
        <AppSectionCard dense title={text.enrollNow}>
          <EnrollmentChatDialog
            variant="page"
            groupId={event.groupId}
            event={event}
            memberId={memberId}
            language={language}
            onSuccess={(successMessage) => {
              setMessage(successMessage)
              window.setTimeout(() => {
                onRefresh().catch(() => undefined)
              }, 300)
            }}
          />
        </AppSectionCard>
      )}

      <AppSectionCard dense title={`${text.enrollments} (${enrollments.length})`}>
        {loading ? <p className="text-sm text-slate-500">{text.loading}</p> : null}
        {!loading && enrollments.length === 0 ? <p className="text-sm text-slate-500">{text.noEnrollments}</p> : null}
        <div className="space-y-2">
          {enrollments.map((enrollment) => {
            const payload = parseEnrollmentPayload(enrollment)
            const isCurrentUser = enrollment.memberId === memberId
            const applicantName = payload.applicantName || enrollment.memberId.slice(0, 8)
            const paymentCount = payload.paymentFiles?.length ?? 0
            return (
              <div
                key={enrollment.id}
                className={[
                  'rounded-lg border px-3 py-3',
                  isCurrentUser ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{applicantName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {text.submitted}: {formatDateTime(payload.submittedAtUtc || enrollment.createdUtc, language) || '-'}
                    </p>
                  </div>
                  {isCurrentUser ? <AppBadge variant="success">{text.registered}</AppBadge> : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {text.paymentFiles}: {paymentCount}
                </p>
              </div>
            )
          })}
        </div>
      </AppSectionCard>
    </div>
    {confirmationModal}
    </>
  )
}

const MemoriesPanel = ({
  eventId,
  eventBasePath,
  reviews,
  language,
  memberId,
  canManage,
  onRefresh,
}: {
  eventId: string
  eventBasePath: string
  reviews: EventReviewRecord[]
  language: string
  memberId?: string
  canManage: boolean
  onRefresh: () => Promise<void>
}) => {
  const text = getLabels(language)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')

  const deleteReview = async (reviewId: string) => {
    if (!await requestConfirmation({
      title: text.deleteReviewTitle,
      description: text.deleteReviewConfirm,
      confirmLabel: text.deleteReview,
      tone: 'danger',
    })) return
    setDeletingId(reviewId)
    setMessage('')
    try {
      await reviewSessionService.deleteReview(eventId, reviewId)
      setMessage(text.deleteReviewSuccess)
      await onRefresh()
    } catch (reason) {
      setMessage(normalizeApiError(reason).message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
    <div className="space-y-5">
      {memberId ? <div className="flex justify-end">
        <Link
          to={`${eventBasePath}/review`}
          onClick={() => activeEntityService.setEvent(eventId)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {text.addReview}
        </Link>
      </div> : null}

      {message ? (
        <AppSectionCard dense>
          <p className={message === text.deleteReviewSuccess ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{message}</p>
        </AppSectionCard>
      ) : null}

      {reviews.length === 0 ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-500">{text.noReviews}</p>
        </AppSectionCard>
      ) : null}

      {reviews.map((review) => {
        const draft = parseReviewDraft(review)
        const photos = draft?.photoFiles ?? []
        const canMutate = review.memberId === memberId || canManage
        return (
          <AppSectionCard
            key={review.id}
            dense
            title={localized(draft?.summary, language) || text.summary}
            action={canMutate ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`${eventBasePath}/review?reviewId=${encodeURIComponent(review.id)}`}
                  onClick={() => activeEntityService.setEvent(eventId)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  {text.modifyReview}
                </Link>
                <AppActionButton
                  size="sm"
                  variant="danger"
                  disabled={deletingId === review.id}
                  onClick={() => void deleteReview(review.id)}
                >
                  {deletingId === review.id ? text.withdrawing : text.deleteReview}
                </AppActionButton>
              </div>
            ) : null}
          >
            {photos.length ? (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <CoverImage
                    key={`${photo.url}-${index}`}
                    src={photo.url}
                    alt={photo.fileName || `${text.photos} ${index + 1}`}
                    aspectRatio={1}
                    className="rounded-lg"
                    openOnLongPressOrDoubleClick
                  />
                ))}
              </div>
            ) : null}

            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{text.reflection}</h3>
                <p className="mt-1 whitespace-pre-wrap leading-6">{localized(draft?.reflection, language) || '-'}</p>
              </div>

              {draft?.recognizedPeople?.length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{text.people}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {draft.recognizedPeople.map((person) => (
                      <li key={`${person.name}-${person.correction ?? ''}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {person.correction || person.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {draft?.recognizedActivities?.length ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{text.activities}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {draft.recognizedActivities.map((activity, index) => (
                      <li key={`${localized(activity.name, language)}-${index}`} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
                        {localized(activity.name, language)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </AppSectionCard>
        )
      })}
    </div>
    {confirmationModal}
    </>
  )
}

const EventDetailView = () => {
  const { groupId: routeGroupId, eventId: routeEventId } = useParams<{ groupId: string; eventId: string }>()
  const { groupId, eventId } = useActiveEntityIds({ groupId: routeGroupId, eventId: routeEventId })
  const [searchParams] = useSearchParams()
  const { language, me, isGuest, canManageGroup, hasAdminPermission } = useAuthStore()
  const canManage = canManageGroup(groupId)
  const canAuditRam = hasAdminPermission('admin.events.audit')
  const text = getLabels(language)
  const [event, setEvent] = useState<GroupEventRecord | null>(null)
  const [enrollments, setEnrollments] = useState<EventEnrollmentRecord[]>([])
  const [reviews, setReviews] = useState<EventReviewRecord[]>([])
  const [contacts, setContacts] = useState<ContactProfileDto[]>([])
  const [loading, setLoading] = useState(true)
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [error, setError] = useState('')

  const activeSection = (searchParams.get('section') || 'notice') as EventDetailSection
  const currentGroupRoute = !routeGroupId
  const eventBasePath = buildScopedEventDetailPath(groupId, eventId, Boolean(routeGroupId))

  const refreshRelated = useCallback(async () => {
    if (!eventId) return
    setRelatedLoading(true)
    try {
      const [nextEnrollments, nextReviews] = await Promise.all([
        enrollmentSessionService.listEventEnrollments(eventId).catch(() => [] as EventEnrollmentRecord[]),
        reviewSessionService.listEventReviews(eventId).catch(() => [] as EventReviewRecord[]),
      ])
      setEnrollments(nextEnrollments)
      setReviews(nextReviews)
    } finally {
      setRelatedLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!groupId || !eventId) return

    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      eventService.getGroupEvents(groupId, me?.id ?? 'anonymous'),
      enrollmentSessionService.listEventEnrollments(eventId).catch(() => [] as EventEnrollmentRecord[]),
      reviewSessionService.listEventReviews(eventId).catch(() => [] as EventReviewRecord[]),
      contactService.list(groupId).catch(() => [] as ContactProfileDto[]),
    ])
      .then(([events, nextEnrollments, nextReviews, groupContacts]) => {
        if (cancelled) return
        const nextEvent = events.find((item) => item.id === eventId) ?? null
        setEvent(nextEvent)
        setEnrollments(nextEnrollments)
        setReviews(nextReviews)
        const ids = new Set(nextEvent?.contactProfileIds ?? [])
        setContacts(groupContacts.filter((contact) => ids.has(contact.id)))
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.eventLoadFailed)
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
  }, [eventId, groupId, me?.id, text.eventLoadFailed])

  const eventDto = useMemo(() => (event ? parseEventDto(event) : null), [event])
  const lifecycle = event ? getEventLifecycle(event) : null
  const acceptsEnrollments = event ? readEventLifecycleData(event).acceptsEnrollments : false
  const eventTitle = eventDto ? localized(eventDto.title, language) || event?.titleEn || event?.titleZh : ''
  const eventLocation = eventDto ? localized(eventDto.locationName, language) : ''
  const eventSubtitle = eventDto
    ? [formatDateTime(eventDto.startDate, language), eventLocation].filter(Boolean).join(' · ')
    : undefined
  const lifecycleLabel = lifecycle === 'planning'
    ? (language === 'zh' ? '筹备中' : 'Planning')
    : lifecycle === 'past'
      ? (language === 'zh' ? '已结束' : 'Past')
      : lifecycle === 'upcoming'
        ? (language === 'zh' ? '即将举行' : 'Upcoming')
        : ''
  const sectionContext = activeSection === 'workflow'
    ? (language === 'zh' ? '流程与产出物' : 'Workflow & outputs')
    : activeSection === 'enrollments'
      ? (language === 'zh' ? '报名' : 'Enrollment')
      : activeSection === 'memories'
        ? (language === 'zh' ? '回顾' : 'Memories')
        : (language === 'zh' ? '活动通知' : 'Event notice')
  const eventScopeContext = routeGroupId
    ? (language === 'zh' ? '教会生活 / 活动' : 'Church Life / Events')
    : (language === 'zh' ? '小组生活 / 活动' : 'Group Life / Events')
  const eventContext = (
    <>
      <span className="desktop:hidden">{eventScopeContext}</span>
      <span className="hidden desktop:inline">{eventScopeContext} / {sectionContext}</span>
    </>
  )
  const backToEventsPath = routeGroupId ? '/church?section=events' : '/groups?section=events'

  if (!groupId || !eventId) {
    return <Navigate to="/" replace />
  }

  if (
    event &&
    ((activeSection === 'enrollments' && (lifecycle !== 'upcoming' || !acceptsEnrollments)) ||
      (activeSection === 'memories' && lifecycle !== 'past'))
  ) {
    return <Navigate to={eventBasePath} replace />
  }

  return (
    <AppPageShell
      title={eventTitle || (language === 'zh' ? '活动' : 'Events')}
      context={eventContext}
      subtitle={eventSubtitle}
      backLink={{ to: backToEventsPath, label: text.backToEvents }}
      status={lifecycle ? <AppBadge variant={lifecycle === 'upcoming' ? 'success' : lifecycle === 'planning' ? 'warning' : 'neutral'}>{lifecycleLabel}</AppBadge> : undefined}
      primaryAction={!isGuest && event ? (
        <AppTitleBarAction
          label={language === 'zh' ? '活动工作区' : 'Event workspace'}
          icon={<LayoutDashboard className="h-4 w-4" />}
          to={`${eventBasePath}/workspace`}
        />
      ) : undefined}
      overflowLabel={language === 'zh' ? '更多操作' : 'More actions'}
      overflowActions={event ? [{
        label: activeSection === 'workflow'
          ? (language === 'zh' ? '活动通知' : 'Event notice')
          : (language === 'zh' ? '流程与产出物' : 'Workflow & outputs'),
        icon: <Workflow className="h-4 w-4" />,
        to: `${eventBasePath}${activeSection === 'workflow' ? '' : '?section=workflow'}`,
      }, ...((canManage || canAuditRam) ? [{
        label: language === 'zh' ? (canAuditRam ? '检查 / 批准 RAM' : '编辑活动 / RAM') : (canAuditRam ? 'Review / approve RAM' : 'Edit event / RAM'),
        icon: <Pencil className="h-4 w-4" />,
        to: `${eventBasePath}/edit`,
        onSelect: () => activeEntityService.setEvent(eventId),
      }] : [])] : []}
    >
      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">{text.loading}</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && !event ? (
        <AppEmptyState title={text.eventNotFound} description={text.eventLoadFailed} />
      ) : null}

      {!loading && !error && event && eventDto ? (
        <>
          {activeSection === 'workflow' ? (
            <EventWorkflowPanel eventId={eventId} groupId={groupId} editPath={`${eventBasePath}/edit`} language={language} canManage={canManage} />
          ) : activeSection === 'enrollments' ? (
            <EnrollmentPanel
              event={event}
              eventDto={eventDto}
              enrollments={enrollments}
              language={language}
              memberId={me?.id}
              isGuest={isGuest}
              loading={relatedLoading}
              onRefresh={refreshRelated}
            />
          ) : activeSection === 'memories' ? (
            <MemoriesPanel
              eventId={eventId}
              eventBasePath={eventBasePath}
              reviews={reviews}
              language={language}
              memberId={me?.id}
              canManage={canManage}
              onRefresh={refreshRelated}
            />
          ) : (
            <EventNoticePanel event={event} eventDto={eventDto} language={language} contacts={contacts} currentGroupRoute={currentGroupRoute} />
          )}
        </>
      ) : null}
    </AppPageShell>
  )
}

export default EventDetailView
