import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ExternalLink } from 'lucide-react'
import { useListSourceResolver } from '../../hooks/useListSourceResolver'
import { activeEntityService } from '../../services/activeEntityService'
import { useAuthStore } from '../../stores/auth'
import type { LocalizedText } from '../../types'
import type { EventDto, GroupEventRecord, MultilingualString } from '../../types/event'
import type { ListViewMetadata } from '../../types/page-editor'
import { formatCountdownTargetDateTime } from '../../utils/countdownDateTime'
import {
  EditableText,
  PropertyPanel,
  SelectInput,
  TextInput,
  isVideoSource,
  patchContent,
  patchLocalizedContent,
  patchLocalizedSectionHeader,
  readLocalizedText,
  readText,
  toLocalizedValue,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import MediaPickerInput from '../media/MediaPickerInput'
import { resolveEventBoundActionUrl } from '../../utils/eventRoutes'

type CountdownMode = 'custom' | 'event'
type CountdownTargetField = 'startDate' | 'registrationDeadline' | 'endDate'

type CountdownBinding = {
  mode: CountdownMode
  eventId: string
  preset: string
  targetField: CountdownTargetField
}

type CountdownItem = {
  text?: LocalizedText | string
}

type EventDetails = {
  record: GroupEventRecord
  dto: EventDto
  title: string
  description: string
  location: string
  posterImageUrl: string
}

const DEFAULT_COUNTDOWN_IMAGE = '/media/alife-message-poster.jpg'

const countdownModes: CountdownMode[] = ['custom', 'event']
const countdownTargetFields: CountdownTargetField[] = ['startDate', 'registrationDeadline', 'endDate']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const label = (language: string, en: string, zh: string) => language === 'zh' ? zh : en

const readCountdownBinding = (content: Record<string, unknown>): CountdownBinding => {
  const raw = isRecord(content.countdown) ? content.countdown : {}
  const rawMode = typeof raw.mode === 'string' ? raw.mode : typeof content.datasource === 'string' ? content.datasource : ''
  const mode = countdownModes.includes(rawMode as CountdownMode) ? rawMode as CountdownMode : 'custom'
  const rawTargetField = typeof raw.targetField === 'string' ? raw.targetField : ''

  return {
    mode,
    eventId: typeof raw.eventId === 'string'
      ? raw.eventId.trim()
      : typeof raw.itemId === 'string'
        ? raw.itemId.trim()
        : typeof content.eventId === 'string'
          ? content.eventId.trim()
          : '',
    preset: typeof raw.preset === 'string' && raw.preset.trim() ? raw.preset.trim() : 'upcoming',
    targetField: countdownTargetFields.includes(rawTargetField as CountdownTargetField)
      ? rawTargetField as CountdownTargetField
      : 'startDate',
  }
}

const fallbackEventDto = (record: GroupEventRecord): EventDto => ({
  id: record.id,
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
      return {
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
    }
  } catch {
    // Fall back to the event row fields when the stored draft JSON is unavailable.
  }

  return fallbackEventDto(record)
}

const localizeMultilingual = (value: MultilingualString | LocalizedText | string | null | undefined, language: string) => {
  if (typeof value === 'string') {
    return value
  }

  return (
    (language === 'zh' ? value?.zh : value?.en) || value?.en || value?.zh || ''
  )
}

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

const readDateTime = (value: string | null | undefined) => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

const resolveEventDetails = (record: GroupEventRecord | undefined, language: string): EventDetails | undefined => {
  if (!record) return undefined
  const dto = parseEventDto(record)
  const title = localizeMultilingual(dto.title, language) || record.titleEn || record.titleZh
  const description = localizeMultilingual(dto.description, language)
  const location = localizeMultilingual(dto.locationName, language)
  const posterImageUrl = typeof dto.posterImageUrl === 'string' ? dto.posterImageUrl.trim() : ''

  return { record, dto, title, description, location, posterImageUrl }
}

const readEventTarget = (details: EventDetails | undefined, targetField: CountdownTargetField) => {
  if (!details) return ''
  if (targetField === 'registrationDeadline') {
    return details.dto.registrationDeadline || details.record.startDate
  }
  if (targetField === 'endDate') {
    return details.dto.endDate || details.record.endDate
  }
  return details.dto.startDate || details.record.startDate
}

const buildCountdown = (targetDateTime: string, startDateTime: string, endDateTime: string, now: number) => {
  const targetMs = readDateTime(targetDateTime)
  const startMs = readDateTime(startDateTime)
  const endMs = readDateTime(endDateTime)
  const isCurrent = Boolean(startMs && endMs && now >= startMs && now <= endMs)
  const totalMs = targetMs ? Math.max(0, targetMs - now) : 0
  const totalSeconds = Math.floor(totalMs / 1000)

  return {
    hasTarget: Boolean(targetMs),
    isCurrent,
    isComplete: Boolean(targetMs && now > targetMs && !isCurrent),
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

const readHeaderText = (content: Record<string, unknown>, language: string, key: 'title' | 'subtitle') => {
  const header = isRecord(content.header) ? content.header : {}
  const value = header[key]
  if (typeof value === 'string') return value
  if (isRecord(value)) return localizeMultilingual(value as LocalizedText, language)
  return ''
}

const readManualItems = (content: Record<string, unknown>, language: string) => {
  const items = Array.isArray(content.items) ? content.items : []
  return items
    .map((item) => isRecord(item) ? localizeMultilingual(item.text as LocalizedText | string | undefined, language) : '')
    .filter(Boolean)
}

const eventItems = (details: EventDetails | undefined, binding: CountdownBinding, language: string) => {
  if (!details) return []
  const items = [
    `${label(language, 'Time', '时间')}: ${formatDateTime(details.dto.startDate || details.record.startDate, language) || label(language, 'To be confirmed', '时间待确认')}`,
  ]

  if (details.location) {
    items.push(`${label(language, 'Location', '地点')}: ${details.location}`)
  }

  const target = readEventTarget(details, binding.targetField)
  if (target) {
    items.push(`${targetLabel(binding.targetField, language)}: ${formatDateTime(target, language)}`)
  }

  return items
}

const targetLabel = (targetField: CountdownTargetField, language: string) => {
  if (targetField === 'registrationDeadline') {
    return label(language, 'Registration deadline', '报名截止')
  }
  if (targetField === 'endDate') {
    return label(language, 'Event ends', '活动结束')
  }
  return label(language, 'Event starts', '活动开始')
}

const countdownLabel = (targetField: CountdownTargetField, language: string) => {
  if (targetField === 'registrationDeadline') {
    return label(language, 'Until registration closes', '距离报名截止')
  }
  if (targetField === 'endDate') {
    return label(language, 'Until event ends', '距离活动结束')
  }
  return label(language, 'Until event starts', '距离活动开始')
}

const optionLabelForEvent = (record: GroupEventRecord, language: string) => {
  const details = resolveEventDetails(record, language)
  const title = details?.title || record.titleEn || record.titleZh || record.id
  const date = formatDateTime(details?.dto.startDate || record.startDate, language)
  return date ? `${title} - ${date}` : title
}

type CountdownMediaProps = {
  src: string
  title: string
  eyebrow: string
  targetDateTime: string
  targetDateTimeAttribute?: string
  targetDateTimeLabel: string
}

const CountdownMedia = ({
  src,
  title,
  eyebrow,
  targetDateTime,
  targetDateTimeAttribute,
  targetDateTimeLabel,
}: CountdownMediaProps) => {
  const source = src.trim()

  return (
    <div className="group relative min-h-[18rem] overflow-hidden bg-black">
      {source && isVideoSource(source) ? (
        <video
          src={source}
          className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : (
        <img
          src={source || DEFAULT_COUNTDOWN_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-home-dark/84 via-home-dark/18 to-transparent" />
      <div className="pointer-events-none absolute left-5 top-5 z-10">
        <span className="inline-flex rounded-lg bg-home-gold px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-home-gold-text">
          {eyebrow}
        </span>
        {targetDateTimeAttribute ? (
          <time
            dateTime={targetDateTimeAttribute}
            aria-label={`${targetDateTimeLabel}: ${targetDateTime}`}
            className="mt-3 block rounded-lg bg-black/45 px-3 py-2 text-2xl font-bold leading-tight text-white shadow-lg backdrop-blur-sm tabular-nums"
          >
            {targetDateTime}
          </time>
        ) : (
          <p className="mt-3 rounded-lg bg-black/45 px-3 py-2 text-2xl font-bold leading-tight text-white shadow-lg backdrop-blur-sm tabular-nums">
            {targetDateTime}
          </p>
        )}
      </div>
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/90 text-home-dark shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition group-hover:scale-105">
          <CalendarDays className="h-9 w-9" />
        </span>
      </span>
      <span className="absolute inset-x-5 bottom-5 text-sm font-bold leading-6 text-white/82">{title}</span>
    </div>
  )
}

const CountdownSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, onUpdate, contextGroupId, page, allowGroupDataSources = true }: SectionComponentProps) => {
  const auth = useAuthStore()
  const language = auth.language
  const editable = mode === 'edit' && !disabled && onUpdate
  const binding = readCountdownBinding(section.contentJson)
  const isEventBound = binding.mode === 'event'
  const groupId = contextGroupId || page?.ownerGroupId || undefined
  const metadata = useMemo<ListViewMetadata>(() => ({
    sourceType: 'events',
    sourceScope: 'group',
    source: 'events',
    preset: binding.preset,
    layout: 'grid',
    limit: binding.eventId ? 50 : 1,
    sortBy: 'date',
    sortDirection: binding.preset === 'recent' ? 'desc' : 'asc',
  }), [binding.eventId, binding.preset])
  const { data: events, isLoading: eventsLoading, error: eventsError } = useListSourceResolver(metadata, {
    groupId,
    enabled: isEventBound && allowGroupDataSources,
  })
  const eventRecords = (events ?? []) as GroupEventRecord[]
  const selectedEvent = isEventBound
    ? binding.eventId
      ? eventRecords.find((item) => item.id === binding.eventId) ?? eventRecords[0]
      : eventRecords[0]
    : undefined
  const eventDetails = useMemo(
    () => resolveEventDetails(selectedEvent, language),
    [language, selectedEvent],
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const eventTarget = readEventTarget(eventDetails, binding.targetField)
  const manualTarget = readText(section.contentJson, 'targetDateTime', 'countdownTarget', 'endDateTime')
  const targetDateTime = isEventBound ? eventTarget : manualTarget
  const countdown = useMemo(
    () => buildCountdown(
      targetDateTime,
      isEventBound ? eventDetails?.dto.startDate || eventDetails?.record.startDate || '' : '',
      isEventBound ? eventDetails?.dto.endDate || eventDetails?.record.endDate || '' : '',
      now,
    ),
    [eventDetails, isEventBound, now, targetDateTime],
  )
  const customImageUrl = isEventBound
    ? readText(section.contentJson, 'imageOverrideUrl')
    : readText(section.contentJson, 'imageUrl', 'backgroundImage', 'backgroundImageUrl')
  const imageUrl = customImageUrl || eventDetails?.posterImageUrl || DEFAULT_COUNTDOWN_IMAGE
  const leftEyebrow = isEventBound
    ? label(language, 'Upcoming event', '近期活动')
    : readLocalizedText(section.contentJson, language, 'eyebrow', 'kicker') || label(language, 'Countdown', '倒数计时')
  const manualLeftTitle = readHeaderText(section.contentJson, language, 'title')
  const leftTitle = (isEventBound ? eventDetails?.title : manualLeftTitle) ||
    manualLeftTitle ||
    label(language, 'Prepare for what is coming next.', '为即将来到的相聚预备。')
  const manualLeftBody = readHeaderText(section.contentJson, language, 'subtitle')
  const leftBody = (isEventBound ? eventDetails?.description || eventDetails?.location : manualLeftBody) ||
    manualLeftBody ||
    label(language, 'Use this section to focus attention on a date, gathering, registration deadline, or ministry moment.', '用这个区块提醒大家关注一个日期、聚会、报名截止或服事重点。')
  const manualItems = readManualItems(section.contentJson, language)
  const items = isEventBound
    ? eventItems(eventDetails, binding, language)
    : manualItems.length
      ? manualItems
      : [
        label(language, 'Clarify who should respond and what the next step is.', '说明谁需要回应，以及下一步是什么。'),
        label(language, 'Keep the message short enough for mobile readers.', '让信息足够简短，方便手机阅读。'),
        label(language, 'Use the button to send people to details, enrollment, or contact.', '用按钮带大家前往详情、报名或联系入口。'),
      ]
  const cardEyebrow = isEventBound
    ? label(language, 'Upcoming event', '近期活动')
    : readLocalizedText(section.contentJson, language, 'cardEyebrow') || label(language, 'Save the date', '请预留时间')
  const manualCardTitle = readLocalizedText(section.contentJson, language, 'title', 'headline')
  const cardTitle = (isEventBound ? eventDetails?.title : manualCardTitle) ||
    manualCardTitle ||
    label(language, 'Next gathering', '下一次相聚')
  const manualCardBody = readLocalizedText(section.contentJson, language, 'body', 'centerText', 'text')
  const cardBody = (isEventBound ? eventDetails?.description || eventDetails?.location : manualCardBody) ||
    manualCardBody ||
    label(language, 'Add a short invitation and let the timer create urgency without overwhelming the page.', '加入一段简短邀请，让倒数提醒带出行动感。')
  const statusLabel = !countdown.hasTarget
    ? label(language, 'Set a target time', '请设置目标时间')
    : countdown.isCurrent
      ? readLocalizedText(section.contentJson, language, 'currentLabel') || label(language, 'Happening now', '正在进行')
      : countdown.isComplete
        ? readLocalizedText(section.contentJson, language, 'completeLabel') || label(language, 'Countdown complete', '倒数已结束')
        : readLocalizedText(section.contentJson, language, 'countdownLabel') || countdownLabel(binding.targetField, language)
  const metaLabel = readLocalizedText(section.contentJson, language, 'metaLabel') ||
    (isEventBound ? targetLabel(binding.targetField, language) : label(language, 'Target date and time', '目标日期时间'))
  const metaValue = formatCountdownTargetDateTime(targetDateTime, language) ||
    (isEventBound ? '' : readLocalizedText(section.contentJson, language, 'metaValue')) ||
    label(language, 'To be confirmed', '时间待确认')
  const targetDateTimeAttribute = readDateTime(targetDateTime)
    ? new Date(targetDateTime).toISOString()
    : undefined
  const footerText = (isEventBound ? eventDetails?.location : readLocalizedText(section.contentJson, language, 'footerText')) ||
    readLocalizedText(section.contentJson, language, 'footerText') ||
    label(language, 'Confirm details before publishing so leaders and members see the right time.', '发布前请确认详情，让带领人与成员看到正确时间。')
  const linkLabel = isEventBound
    ? label(language, 'View event details', '查看活动详情')
    : readLocalizedText(section.contentJson, language, 'linkLabel', 'linkText', 'ctaLabel') || label(language, 'Learn more', '了解更多')
  const configuredLinkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
  const linkUrl = isEventBound && eventDetails
    ? resolveEventBoundActionUrl(configuredLinkUrl, eventDetails.record.groupId, eventDetails.record.id)
    : configuredLinkUrl
  const isExternalLink = Boolean(linkUrl && !linkUrl.startsWith('/') && !linkUrl.startsWith('#'))

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, language, patch))
  const updateCountdown = (patch: Partial<CountdownBinding>) => {
    const current = isRecord(section.contentJson.countdown) ? section.contentJson.countdown : {}
    updateContent({ countdown: { ...current, ...patch } })
  }
  const updateLeftTitle = (value: string) => onUpdate?.(patchLocalizedSectionHeader(section, language, 'title', value))
  const updateLeftBody = (value: string) => onUpdate?.(patchLocalizedSectionHeader(section, language, 'subtitle', value))
  const updateItem = (index: number, value: string) => {
    const currentItems = Array.isArray(section.contentJson.items) ? [...section.contentJson.items] : []
    const currentItem = isRecord(currentItems[index]) ? currentItems[index] as CountdownItem : {}
    currentItems[index] = {
      ...currentItem,
      text: toLocalizedValue(currentItem.text, language, value),
    }
    updateContent({ items: currentItems })
  }

  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        focusKey="countdown-source-mode"
        label={label(language, 'Datasource', '数据来源')}
        value={binding.mode}
        disabled={disabled}
        options={[
          { value: 'custom', label: label(language, 'Customized', '自定义') },
          { value: 'event', label: label(language, 'Event', '活动') },
        ]}
        onChange={(value) => updateCountdown({ mode: value as CountdownMode })}
      />
      {binding.mode === 'event' ? (
        <>
          <SelectInput
            focusKey="countdown-event-id"
            label={label(language, 'Event', '活动')}
            value={binding.eventId}
            disabled={disabled}
            options={[
              {
                value: '',
                label: eventsLoading
                  ? label(language, 'Loading events...', '正在加载活动...')
                  : label(language, 'Next upcoming event', '下一个近期活动'),
              },
              ...eventRecords.map((record) => ({
                value: record.id,
                label: optionLabelForEvent(record, language),
              })),
            ]}
            onChange={(value) => updateCountdown({ eventId: value })}
          />
          <SelectInput
            focusKey="countdown-preset"
            label={label(language, 'Event preset', '活动预设')}
            value={binding.preset}
            disabled={disabled}
            options={[
              { value: 'upcoming', label: label(language, 'Upcoming', '即将开始') },
              { value: 'recent', label: label(language, 'Recent', '最近') },
              { value: 'all', label: label(language, 'All', '全部') },
            ]}
            onChange={(value) => updateCountdown({ preset: value, eventId: '' })}
          />
          <SelectInput
            focusKey="countdown-target-field"
            label={label(language, 'Countdown target', '倒数目标')}
            value={binding.targetField}
            disabled={disabled}
            options={[
              { value: 'startDate', label: label(language, 'Event start time', '活动开始时间') },
              { value: 'registrationDeadline', label: label(language, 'Registration deadline', '报名截止时间') },
              { value: 'endDate', label: label(language, 'Event end time', '活动结束时间') },
            ]}
            onChange={(value) => updateCountdown({ targetField: value as CountdownTargetField })}
          />
          <MediaPickerInput
            focusKey="countdown-image-override"
            label={label(language, 'Image/video override URL', '图片/视频覆盖链接')}
            value={readText(section.contentJson, 'imageOverrideUrl')}
            disabled={disabled}
            groupId={groupId}
            accept="media"
            onChange={(value) => updateContent({ imageOverrideUrl: value })}
          />
        </>
      ) : (
        <>
          <TextInput
            focusKey="countdown-target-date"
            label={label(language, 'Countdown target date/time', '倒数目标日期时间')}
            value={manualTarget}
            disabled={disabled}
            placeholder="2026-12-25T10:00:00"
            onChange={(value) => updateContent({ targetDateTime: value, countdownTarget: value, endDateTime: value })}
          />
          <MediaPickerInput
            focusKey="countdown-image"
            label={label(language, 'Image/video URL', '图片/视频链接')}
            value={readText(section.contentJson, 'imageUrl', 'backgroundImage', 'backgroundImageUrl')}
            disabled={disabled}
            groupId={groupId}
            accept="media"
            onChange={(value) => updateContent({ imageUrl: value, backgroundImage: value, backgroundImageUrl: value })}
          />
        </>
      )}
      <TextInput
        focusKey="countdown-action-url"
        label={label(language, 'Button link URL', '按钮链接地址')}
        value={readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')}
        disabled={disabled}
        onChange={(value) => updateContent({ linkUrl: value, ctaUrl: value, href: value })}
      />
      {eventsError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 md:col-span-2">
          {label(language, 'Unable to load events for this section.', '无法为此区块加载活动。')}
        </p>
      ) : null}
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  return (
    <section id={domId} className="scroll-mt-24 px-5 py-20 text-home-gold-text sm:px-8 lg:px-10 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.36fr_0.64fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-accent">{leftEyebrow}</p>
          <EditableText
            as="h2"
            multiline
            value={leftTitle}
            fallback={label(language, 'Countdown title', '倒数标题')}
            disabled={!editable || isEventBound}
            className="mt-4 block text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
            onChange={updateLeftTitle}
          />
          <EditableText
            as="p"
            multiline
            value={leftBody}
            fallback={label(language, 'Add a short introduction.', '添加一段简短介绍。')}
            disabled={!editable || isEventBound}
            className="mt-4 block max-w-[50ch] text-[0.94rem] leading-7 text-home-muted"
            onChange={updateLeftBody}
          />
          <div className="mt-6 grid gap-2.5">
            {items.map((item, index) => (
              <article key={`${item}-${index}`} className="flex gap-3 rounded-xl border border-home-border/60 bg-white/60 p-3.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-home-green text-xs font-semibold text-white">{index + 1}</span>
                <EditableText
                  as="p"
                  multiline
                  value={item}
                  fallback={label(language, 'Detail', '详情')}
                  disabled={!editable || isEventBound}
                  className="block text-sm leading-6 text-home-muted"
                  onChange={(value) => updateItem(index, value)}
                />
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <article className="overflow-hidden rounded-2xl border border-home-border bg-home-dark text-white shadow-[0_16px_48px_rgba(30,18,10,0.18)]">
            <div className="grid lg:grid-cols-[0.58fr_0.42fr]">
              <CountdownMedia
                src={imageUrl}
                title={footerText}
                eyebrow={cardEyebrow}
                targetDateTime={metaValue}
                targetDateTimeAttribute={targetDateTimeAttribute}
                targetDateTimeLabel={metaLabel}
              />
              <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-home-gold">{cardEyebrow}</p>
                  <EditableText
                    as="h3"
                    multiline
                    value={cardTitle}
                    fallback={label(language, 'Countdown title', '倒数标题')}
                    disabled={!editable || isEventBound}
                    className="mt-3 block text-2xl font-bold leading-tight"
                    onChange={(value) => updateLocalizedContent({ title: value, headline: value })}
                  />
                  <EditableText
                    as="p"
                    multiline
                    value={cardBody}
                    fallback={label(language, 'Add a short invitation.', '添加一段简短邀请。')}
                    disabled={!editable || isEventBound}
                    className="mt-4 block text-sm font-semibold leading-7 text-white/72"
                    onChange={(value) => updateLocalizedContent({ body: value, centerText: value, text: value })}
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-home-gold">{statusLabel}</p>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: label(language, 'D', '天'), value: countdown.days },
                      { label: label(language, 'H', '时'), value: countdown.hours },
                      { label: label(language, 'M', '分'), value: countdown.minutes },
                      { label: label(language, 'S', '秒'), value: countdown.seconds },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-white/[0.06] px-2 py-3">
                        <span className="block text-2xl font-bold tabular-nums">
                          {countdown.hasTarget ? String(item.value).padStart(2, '0') : '--'}
                        </span>
                        <span className="mt-1 block text-[0.68rem] font-medium uppercase tracking-wide text-white/40">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold leading-5 text-white/52">{footerText}</p>
                  {linkUrl || mode === 'edit' ? (
                    <a
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-home-gold px-4 py-2.5 text-sm font-semibold text-home-gold-text transition hover:-translate-y-0.5"
                      href={mode === 'render' && linkUrl ? linkUrl : undefined}
                      target={mode === 'render' && isExternalLink ? '_blank' : undefined}
                      rel={mode === 'render' && isExternalLink ? 'noopener noreferrer' : undefined}
                      onClick={(event) => {
                        if (mode === 'edit') {
                          event.preventDefault()
                          return
                        }

                        if (isEventBound && eventDetails) {
                          activeEntityService.setEvent(eventDetails.record.id)
                        }
                      }}
                    >
                      <EditableText
                        value={linkLabel}
                        fallback={label(language, 'Learn more', '了解更多')}
                        disabled={!editable || isEventBound}
                        className="text-sm"
                        onChange={(value) => updateLocalizedContent({ linkLabel: value, linkText: value, ctaLabel: value })}
                      />
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
          {mode === 'edit' && showProperties ? renderProperties() : null}
        </div>
      </div>
    </section>
  )
}

export default CountdownSection
