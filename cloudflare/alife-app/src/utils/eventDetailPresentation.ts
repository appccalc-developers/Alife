import { eventDetailPresentationText } from '../i18n/eventDetailPresentation.ts'
import type { EventDto, GroupEventRecord, MultilingualString } from '../types/event'
import { normalizeImageUrl } from '../services/imageWorkerApi'

const labels = eventDetailPresentationText.labels

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
  baseFeePerAdult: null,
  baseFeePerChild: null,
  currency: 'USD',
  posterImageUrl: null,
  galleryUrls: [],
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

export const isBeforeDeadline = (deadline: string | null | undefined) => {
  if (!deadline) return true
  const time = new Date(deadline).getTime()
  return Number.isFinite(time) ? Date.now() <= time : true
}
