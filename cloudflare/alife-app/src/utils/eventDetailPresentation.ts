import type { EventEnrollmentRecord } from '../types/enrollment'
import type { EventDto, GroupEventRecord, MultilingualString } from '../types/event'
import { normalizeImageUrl } from '../services/imageWorkerApi'

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

export const getLabels = (language: string) => (language === 'zh' ? labels.zh : labels.en)

export const localized = (value: MultilingualString | null | undefined, language: string) =>
  (language === 'zh' ? value?.zh : value?.en) || value?.en || value?.zh || ''

export const formatDateTime = (value: string | null | undefined, language: string) => {
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

export const parseEventDto = (record: GroupEventRecord): EventDto => {
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

export const parseEnrollmentPayload = (record: EventEnrollmentRecord): EnrollmentPayload => {
  try {
    const parsed = JSON.parse(record.enrollmentJson) as EnrollmentPayload
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const isBeforeDeadline = (deadline: string | null | undefined) => {
  if (!deadline) return true
  const time = new Date(deadline).getTime()
  return Number.isFinite(time) ? Date.now() <= time : true
}
