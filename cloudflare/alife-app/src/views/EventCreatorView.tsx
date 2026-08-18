import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpenText, CheckCircle2, CircleAlert, FileText, ImageIcon, Languages, MessageSquareText, Mic, MicOff, Save, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { EventDto, EventRamStatus, GroupEventRecord, MultilingualString } from '../types/event'
import type { AiSessionAppContext, AiSessionAttachment } from '../types/aiSession'
import { eventService } from '../services/eventService'
import { eventPosterAiService, type GeneratedEventPoster } from '../services/eventPosterAiService'
import { aiTranslationService } from '../services/aiTranslationService'
import { activeEntityService } from '../services/activeEntityService'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import { eventPlanningSessionService } from '../services/eventPlanningSessionService'
import { fileToInlineAiAttachment } from '../services/aiSessionService'
import { isImageFile, uploadImage } from '../services/imageWorkerApi'
import { useAiSession } from '../hooks/useAiSession'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import { useUiText } from '../i18n/uiText'
import CoverImage from '../components/CoverImage'
import { createEventContextFromDto, loadAiContentContext, type AiContentContext } from '../utils/aiContentContext'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { contactService } from '../services/contactService'
import type { ContactProfileDto } from '../types/contact'
import { localizeText } from '../utils/localizedText'
import EventRamEditor from '../components/events/EventRamEditor'
import { createEmptyEventRamDraft, getEventRamSubmissionIssues, parseEventRam } from '../utils/eventRam'
import type { MissingTranslatableField } from '../utils/bilingualValidation'

// ────────────────────────────────────────────────────────────────────────────
// Helper sub-components
// ────────────────────────────────────────────────────────────────────────────

const BilingualField = ({ label, value }: { label: string; value: MultilingualString }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
    <span className="col-span-2 font-semibold text-slate-700">{label}</span>
    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
      <span className="mr-1 text-xs text-slate-400">zh</span>
      {value.zh || <span className="italic text-slate-400">—</span>}
    </span>
    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
      <span className="mr-1 text-xs text-slate-400">en</span>
      {value.en || <span className="italic text-slate-400">—</span>}
    </span>
  </div>
)

const fmt = (iso: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const EventPreview = ({
  event,
  lang,
  posterPreviewUrl,
  posterPendingUpload = false,
  submitted = false,
}: {
  event: EventDto
  lang: string
  posterPreviewUrl?: string
  posterPendingUpload?: boolean
  submitted?: boolean
}) => {
  const ui = useUiText()
  const t = (ml: MultilingualString) => (lang === 'zh' ? ml.zh : ml.en) || ml.en || ml.zh || '—'
  const [showRaw, setShowRaw] = useState(false)
  const title = t(event.title)
  const posterUrl = posterPreviewUrl || event.posterImageUrl || ''
  const requiresRegistration = event.maxCapacity > 0

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t(event.locationName)}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {submitted ? (lang === 'zh' ? '已提交' : 'Submitted') : ui('draft')}
        </span>
      </div>

      {posterUrl ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <CoverImage src={posterUrl} alt={`${title || ui('yourEvent')} ${ui('poster')}`} aspectRatio={16 / 9} fetchPriority="high" className="w-full" />
          {posterPendingUpload ? (
            <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              {ui('previewImagePending')}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Description */}
      <p className="text-sm text-slate-700">{t(event.description)}</p>

      {/* Dates */}
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          { label: ui('start'), value: fmt(event.startDate) },
          { label: ui('end'), value: fmt(event.endDate) },
          { label: ui('registrationDeadline'), value: requiresRegistration ? fmt(event.registrationDeadline) : ui('noRegistration') },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
            <span className="block text-xs text-slate-500">{label}</span>
            <span className="font-medium text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      {/* Capacity & fees */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          {requiresRegistration
            ? <>{ui('capacity')}: <strong>{event.maxCapacity} {event.capacityUnit}</strong></>
            : <strong>{ui('noRegistration')}</strong>}
        </span>
        {event.baseFeePerAdult != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {ui('adult')}: <strong>{event.currency} {event.baseFeePerAdult}</strong>
          </span>
        )}
        {event.baseFeePerChild != null && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
            {ui('child')}: <strong>{event.currency} {event.baseFeePerChild}</strong>
          </span>
        )}
      </div>

      {/* Hard constraints */}
      {event.hardConstraints.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{ui('rulesConstraints')}</h3>
          <ul className="space-y-1.5">
            {event.hardConstraints.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                  !
                </span>
                <span>
                  <span className="mr-1.5 rounded bg-amber-200 px-1 py-0.5 text-xs font-medium text-amber-800">
                    {rule.ruleKey}
                  </span>
                  {t(rule.displayMessage)}
                  {rule.isMandatory && (
                    <span className="ml-1.5 text-xs text-red-500">({ui('mandatory')})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optional activities */}
      {event.optionalActivities.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{ui('optionalActivities')}</h3>
          <ul className="flex flex-wrap gap-2">
            {event.optionalActivities.map((act, i) => (
              <li key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                {t(act.name)}
                {act.extraFee > 0 && (
                  <span className="ml-1.5 text-xs text-emerald-600">+{event.currency} {act.extraFee}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bilingual fields (detailed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 group-open:text-slate-700">
          {ui('bilingualFields')}
        </summary>
        <div className="mt-3 space-y-3">
          <BilingualField label={ui('title')} value={event.title} />
          <BilingualField label={ui('description')} value={event.description} />
          <BilingualField label={ui('location')} value={event.locationName} />
          {event.legacySummary && <BilingualField label={ui('legacySummary')} value={event.legacySummary} />}
        </div>
      </details>

      {/* Raw JSON toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-emerald-600 hover:underline"
        >
          {showRaw ? ui('hideRawJson') : ui('showRawJson')}
        </button>
        {showRaw && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
            {JSON.stringify(event, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; text: string; markdown?: boolean }
type PosterUploadStatus = 'idle' | 'selected' | 'uploading' | 'uploaded' | 'error'
type PosterAnalysisStatus = 'idle' | 'analyzing' | 'analyzed' | 'error'
type PosterGenerationStatus = 'idle' | 'generating' | 'generated' | 'adopted' | 'error'
type EventBriefTranslationStatus = 'idle' | 'translating' | 'translated' | 'error'
type EventEditorTab = 'setup' | 'assistant' | 'notice' | 'ram'

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const eventPosterFolder = (groupId: string, eventId: string) => `groups/${groupId}/events/${eventId}/calendar`
const MAX_POSTER_GENERATION_BASE_IMAGE_BYTES = 6 * 1024 * 1024
const POSTER_GENERATION_BASE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const createIntroMessage = (text: string): ChatMessage => ({
  role: 'assistant',
  text,
  markdown: true,
})

const createInitialEventDraft = (organizerDisplayName = ''): EventDto => {
  const draft: EventDto = {
    organizerDisplayName,
    personResponsible: organizerDisplayName,
    purpose: { zh: '', en: '' },
    title: { zh: '', en: '' },
    description: { zh: '', en: '' },
    locationName: { zh: '', en: '' },
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    maxCapacity: 1,
    capacityUnit: 'Families',
    hardConstraints: [],
    optionalActivities: [],
    currency: 'NZD',
    galleryUrls: [],
    legacySummary: null,
    contactProfileIds: [],
  }
  return { ...draft, ram: createEmptyEventRamDraft(draft) }
}

const hasText = (value: string | null | undefined) => Boolean(value?.trim())
const hasBilingualText = (value: MultilingualString | null | undefined) => Boolean(value?.zh.trim() && value?.en.trim())

const getMissingEventBriefTranslations = (eventDraft: EventDto | null): MissingTranslatableField[] => {
  if (!eventDraft) return []
  return (['title', 'description'] as const).flatMap((field) => {
    const zh = eventDraft[field].zh.trim()
    const en = eventDraft[field].en.trim()
    if ((!zh && !en) || (zh && en)) return []
    return [{
      field,
      sourceLanguage: zh ? 'zh' : 'en',
      targetLanguage: zh ? 'en' : 'zh',
      sourceText: zh || en,
      textType: field === 'title' ? 'church event title' : 'church event description',
    } satisfies MissingTranslatableField]
  })
}

const getNoticeSubmissionIssues = (event: EventDto) => {
  const issues: string[] = []
  if (!hasBilingualText(event.title)) issues.push('title')
  if (!hasBilingualText(event.description)) issues.push('description')
  if (!hasBilingualText(event.locationName)) issues.push('locationName')
  if (!hasText(event.startDate) || Number.isNaN(Date.parse(event.startDate))) issues.push('startDate')
  if (!hasText(event.endDate) || Number.isNaN(Date.parse(event.endDate))) issues.push('endDate')
  const requiresRegistration = event.maxCapacity > 0
  if (requiresRegistration && (!hasText(event.registrationDeadline) || Number.isNaN(Date.parse(event.registrationDeadline)))) issues.push('registrationDeadline')
  if (!issues.includes('startDate') && !issues.includes('endDate') && Date.parse(event.endDate) < Date.parse(event.startDate)) issues.push('dateOrder')
  if (requiresRegistration && !issues.includes('startDate') && !issues.includes('registrationDeadline') && Date.parse(event.registrationDeadline) > Date.parse(event.startDate)) issues.push('registrationDeadlineOrder')
  if (!Number.isInteger(event.maxCapacity) || event.maxCapacity < 0) issues.push('maxCapacity')
  if (!event.currency.trim()) issues.push('currency')
  return issues
}

const SubmissionStatusHeader = ({
  title,
  description,
  canSubmit,
  submitted,
  submittedDetail,
  remainingCount,
  language,
}: {
  title: string
  description: string
  canSubmit: boolean
  submitted: boolean
  submittedDetail?: string
  remainingCount: number
  language: 'en' | 'zh'
}) => {
  const isZh = language === 'zh'
  return (
    <header className="rounded-2xl border border-[#2f4b42]/10 bg-white/90 p-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={isZh ? '提交状态' : 'Submission status'}>
          <span className={['inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black', canSubmit ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'].join(' ')}>
            {canSubmit ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            {canSubmit ? (isZh ? '可提交' : 'Ready to submit') : (isZh ? '尚不可提交' : 'Not ready')}
          </span>
          <span className={['inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black', submitted ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'].join(' ')}>
            {submitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {submitted ? (submittedDetail || (isZh ? '已提交' : 'Submitted')) : (isZh ? '未提交' : 'Not submitted')}
          </span>
        </div>
      </div>
      {!canSubmit && remainingCount > 0 ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          {isZh ? `还需补齐 ${remainingCount} 项资料，AI 会在“AI 对话与洞察”中继续引导。` : `${remainingCount} item(s) still need attention. AI will continue guiding you in AI chat and insights.`}
        </p>
      ) : null}
    </header>
  )
}

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

const fallbackDraftFromRecord = (record: GroupEventRecord): EventDto => ({
  id: record.id,
  personResponsible: '',
  purpose: { zh: '', en: '' },
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
  contactProfileIds: record.contactProfileIds ?? [],
  ram: createEmptyEventRamDraft(),
})

const getDraftFromRecord = (record: GroupEventRecord): EventDto => {
  try {
    const parsed = JSON.parse(record.eventDataJson) as EventDto
    if (parsed && parsed.title && parsed.description && parsed.locationName) {
      const draft = {
        ...parsed,
        id: record.id,
        personResponsible: parsed.personResponsible || parsed.organizerDisplayName || '',
        purpose: parsed.purpose ?? { zh: '', en: '' },
        contactProfileIds: record.contactProfileIds ?? parsed.contactProfileIds ?? [],
      }
      return { ...draft, ram: parsed.ram ?? createEmptyEventRamDraft(draft) }
    }
  } catch {
    // no-op
  }

  return fallbackDraftFromRecord(record)
}

const EventWorkflowPanel = ({
  eventDraft,
  targetEventId,
  language,
  ramStatus,
  noticeSubmitted,
}: {
  eventDraft: EventDto | null
  targetEventId: string
  language: string
  ramStatus: EventRamStatus
  noticeSubmitted: boolean
}) => {
  const isZh = language === 'zh'
  const titleReady = Boolean(eventDraft && (eventDraft.title.zh.trim() || eventDraft.title.en.trim()))
  const descriptionReady = Boolean(eventDraft && (eventDraft.description.zh.trim() || eventDraft.description.en.trim()))
  const timeReady = Boolean(eventDraft?.startDate && eventDraft?.endDate)
  const registrationReady = Boolean(eventDraft && (eventDraft.maxCapacity === 0 || (eventDraft.maxCapacity > 0 && eventDraft.registrationDeadline)))
  const savedReady = Boolean(targetEventId)
  const setupReady = Boolean(titleReady && descriptionReady && eventDraft && hasText(eventDraft.personResponsible))
  const items = [
    {
      label: isZh ? '1. 填写初始化资料' : '1. Add the starting brief',
      hint: isZh ? '填写活动标题、描述和负责人，并可生成或上传海报。' : 'Add the title, description, and person responsible; then generate or upload a poster.',
      ready: setupReady,
      icon: <BookOpenText className="h-4 w-4" />,
    },
    {
      label: isZh ? '2. 与 AI 补齐共同资料' : '2. Complete shared facts with AI',
      hint: isZh ? 'AI 会把活动项目等资料同时用于通知和 RAM。' : 'AI reuses facts such as activities across the notice and RAM.',
      ready: titleReady && timeReady && registrationReady,
      icon: <MessageSquareText className="h-4 w-4" />,
    },
    {
      label: isZh ? '3. 提交活动通知' : '3. Submit the event notice',
      hint: isZh ? '检查双语文案、时间、地点、报名资料和海报。' : 'Check bilingual copy, timing, venue, enrollment details, and poster.',
      ready: savedReady && noticeSubmitted,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: isZh ? '4. 人工确认并提交 RAM' : '4. Human-check and submit the RAM',
      hint: isZh ? '补齐缺失资料并由组长确认，不接受 AI 猜测。' : 'Resolve missing facts and have a leader confirm them; do not accept AI guesses.',
      ready: ramStatus === 'awaitingReview' || ramStatus === 'approved',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: isZh ? '5. RAM 审核批准' : '5. RAM review and approval',
      hint: isZh ? '只有批准后才进入近期活动并开放报名。' : 'Only approval moves the event to Upcoming and allows enrollment.',
      ready: ramStatus === 'approved',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ]
  const readyCount = items.filter((item) => item.ready).length

  return (
    <section className="rounded-2xl border border-[#2f4b42]/10 bg-white/78 p-4 shadow-[0_10px_30px_rgba(31,56,48,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{isZh ? '活动工作流' : 'Event workflow'}</p>
          <h2 className="mt-1 text-lg font-black text-[#18332d]">{isZh ? '从想法到可报名活动' : 'From idea to enrollable event'}</h2>
        </div>
        <span className="rounded-lg bg-[#e3f0eb] px-3 py-1 text-sm font-black text-[#176b5a]">{readyCount}/{items.length}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={['flex gap-3 rounded-xl border p-3', item.ready ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'].join(' ')}>
            <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'].join(' ')}>
              {item.ready ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
            </span>
            <span>
              <span className="block text-sm font-black text-slate-950">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.hint}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

const EventCreatorView = () => {
  const { language, me, hasAdminPermission, canManageGroup } = useAuthStore()
  const t = useUiText()
  const { CurrentGroup } = useCurrentGroupStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { groupId: routeGroupId, eventId: routeEventId } = useParams<{ groupId?: string; eventId?: string }>()
  const [searchParams] = useSearchParams()
  const activeIds = useActiveEntityIds({
    groupId: routeGroupId || searchParams.get('groupId') || undefined,
    eventId: routeEventId || undefined,
  })
  const isCanonicalEditMode = location.pathname === '/events/edit'
  const eventId = routeEventId ?? (isCanonicalEditMode ? activeIds.eventId : undefined)
  const isEditMode = Boolean(eventId)
  const eventIdValue = eventId ?? ''
  const effectiveGroupId = activeIds.groupId || CurrentGroup?.id || null
  const eventFromNavigationState = (location.state as { event?: GroupEventRecord } | null)?.event
  const eventFromNavigationStateId = eventFromNavigationState ? String(eventFromNavigationState.id) : ''
  const eventFromNavigationStateData = eventFromNavigationState?.eventDataJson ?? ''

  const [messages, setMessages] = useState<ChatMessage[]>(() => [createIntroMessage(t('eventAssistantIntro'))])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [eventDraft, setEventDraft] = useState<EventDto | null>(() => createInitialEventDraft(me?.displayName))
  const [availableContacts, setAvailableContacts] = useState<ContactProfileDto[]>([])
  const [aiInsight, setAiInsight] = useState<MultilingualString | null>(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedEventId, setSavedEventId] = useState('')
  const [pendingPosterFile, setPendingPosterFile] = useState<File | null>(null)
  const [posterPreviewUrl, setPosterPreviewUrl] = useState('')
  const [posterUploadStatus, setPosterUploadStatus] = useState<PosterUploadStatus>('idle')
  const [posterUploadError, setPosterUploadError] = useState('')
  const [posterAnalysisStatus, setPosterAnalysisStatus] = useState<PosterAnalysisStatus>('idle')
  const [posterAnalysisMessage, setPosterAnalysisMessage] = useState('')
  const [posterGenerationStatus, setPosterGenerationStatus] = useState<PosterGenerationStatus>('idle')
  const [posterGenerationMessage, setPosterGenerationMessage] = useState('')
  const [posterGenerationGuidance, setPosterGenerationGuidance] = useState('')
  const [posterGenerationBaseImageName, setPosterGenerationBaseImageName] = useState('')
  const [posterGenerationBasePreviewUrl, setPosterGenerationBasePreviewUrl] = useState('')
  const [generatedPoster, setGeneratedPoster] = useState<GeneratedEventPoster | null>(null)
  const [generatedPosterSourceKey, setGeneratedPosterSourceKey] = useState('')
  const [briefTranslationStatus, setBriefTranslationStatus] = useState<EventBriefTranslationStatus>('idle')
  const [briefTranslationMessage, setBriefTranslationMessage] = useState('')
  const [activeTab, setActiveTab] = useState<EventEditorTab>('setup')
  const [noticeSubmitted, setNoticeSubmitted] = useState(false)
  const [ramHasLocalChanges, setRamHasLocalChanges] = useState(false)
  const [ramStatus, setRamStatus] = useState<EventRamStatus>('draft')
  const [ramBusy, setRamBusy] = useState(false)
  const [ramMessage, setRamMessage] = useState('')
  const [aiContentContext, setAiContentContext] = useState<AiContentContext>({ missionStatements: [], eventContext: null })
  const [sessionContextEventId, setSessionContextEventId] = useState('')
  const [ramSessionContextEventId, setRamSessionContextEventId] = useState('')
  const [sessionContextRevision, setSessionContextRevision] = useState(0)
  const targetEventId = eventId ?? savedEventId
  const canEditRam = Boolean(effectiveGroupId && canManageGroup(effectiveGroupId))
  const canAuditRam = hasAdminPermission('admin.events.audit')
  const sessionId = useMemo(
    () => eventPlanningSessionService.getSessionId(me?.id, eventId),
    [eventId, me?.id],
  )
  const initializedSessionScopesRef = useRef(new Set<string>())
  const posterInputRef = useRef<HTMLInputElement>(null)
  const referencePosterInputRef = useRef<HTMLInputElement>(null)
  const posterGenerationBaseInputRef = useRef<HTMLInputElement>(null)
  const posterObjectUrlRef = useRef('')
  const posterGenerationBaseObjectUrlRef = useRef('')
  const eventContext = useMemo(
    () => eventDraft ? createEventContextFromDto(eventDraft) : aiContentContext.eventContext,
    [aiContentContext.eventContext, eventDraft],
  )
  const posterBriefKey = useMemo(() => JSON.stringify(eventDraft ? {
    title: eventDraft.title,
    description: eventDraft.description,
    purpose: eventDraft.purpose,
    locationName: eventDraft.locationName,
    startDate: eventDraft.startDate,
    endDate: eventDraft.endDate,
  } : null), [eventDraft])
  const selectedContactFacts = useMemo(
    () => availableContacts
      .filter((contact) => (eventDraft?.contactProfileIds ?? []).includes(contact.id))
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
      })),
    [availableContacts, eventDraft?.contactProfileIds],
  )
  const baseAiAppContext = useMemo<AiSessionAppContext>(() => ({
    language,
    ...(me?.id ? {
      userId: me.id,
      memberId: me.id,
      userProfile: { id: me.id, displayName: me.displayName },
      memberProfile: { id: me.id, displayName: me.displayName },
    } : {}),
    ...(effectiveGroupId ? { groupId: effectiveGroupId } : {}),
    missionStatements: aiContentContext.missionStatements,
    eventContext: aiContentContext.eventContext,
    eventData: aiContentContext.eventContext?.eventData ?? null,
  }), [aiContentContext.eventContext, aiContentContext.missionStatements, effectiveGroupId, language, me?.displayName, me?.id])
  const aiAppContext = useMemo<AiSessionAppContext>(() => ({
    language,
    ...(me?.id ? {
      userId: me.id,
      memberId: me.id,
      userProfile: { id: me.id, displayName: me.displayName },
      memberProfile: { id: me.id, displayName: me.displayName },
    } : {}),
    ...(effectiveGroupId ? { groupId: effectiveGroupId } : {}),
    ...(targetEventId ? { eventId: targetEventId } : {}),
    missionStatements: aiContentContext.missionStatements,
    eventContext,
    eventData: eventContext?.eventData ?? null,
    knownFacts: {
      ...(targetEventId ? { eventId: targetEventId } : {}),
      eventContacts: selectedContactFacts,
    },
  }), [aiContentContext.missionStatements, effectiveGroupId, eventContext, language, me?.displayName, me?.id, selectedContactFacts, targetEventId])
  const {
    state: sessionState,
    loading: sessionLoading,
    error: sessionError,
    clearError: clearSessionError,
    sendMessage,
  } = useAiSession<EventDto, MultilingualString | null>(
    isEditMode ? '' : sessionId,
    '/api/events/session',
    baseAiAppContext,
  )
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const clearPosterObjectUrl = () => {
    if (posterObjectUrlRef.current) {
      URL.revokeObjectURL(posterObjectUrlRef.current)
      posterObjectUrlRef.current = ''
    }
  }

  const clearPosterGenerationBaseObjectUrl = () => {
    if (posterGenerationBaseObjectUrlRef.current) {
      URL.revokeObjectURL(posterGenerationBaseObjectUrlRef.current)
      posterGenerationBaseObjectUrlRef.current = ''
    }
  }

  useEffect(() => {
    return () => {
      clearPosterObjectUrl()
      clearPosterGenerationBaseObjectUrl()
    }
  }, [])

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== 'assistant') {
        return prev
      }

      return [createIntroMessage(t('eventAssistantIntro'))]
    })
  }, [t])

  useEffect(() => {
    if (!me?.displayName) return
    setEventDraft((current) => current && !current.organizerDisplayName
      ? { ...current, organizerDisplayName: me.displayName, personResponsible: current.personResponsible || me.displayName }
      : current)
  }, [me?.displayName])

  useEffect(() => {
    if (isEditMode) {
      return
    }
    if (sessionState?.draft) {
      setEventDraft(sessionState.draft)
      setRamHasLocalChanges(true)
    }
    setAiInsight(sessionState?.context ?? null)
  }, [isEditMode, sessionState])

  useEffect(() => {
    if (!effectiveGroupId) {
      setAiContentContext({ missionStatements: [], eventContext: null })
      return
    }

    let cancelled = false
    loadAiContentContext(effectiveGroupId, { currentGroup: CurrentGroup })
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
  }, [CurrentGroup, effectiveGroupId])

  useEffect(() => {
    if (!effectiveGroupId) {
      setAvailableContacts([])
      return
    }
    let cancelled = false
    contactService.list(effectiveGroupId)
      .then((items) => { if (!cancelled) setAvailableContacts(items) })
      .catch(() => { if (!cancelled) setAvailableContacts([]) })
    return () => { cancelled = true }
  }, [effectiveGroupId])

  useEffect(() => {
    if (!isEditMode || !eventId) {
      return
    }

    let cancelled = false
    setSessionContextEventId('')
    setRamSessionContextEventId('')
    if (eventFromNavigationState && eventFromNavigationStateId === eventIdValue) {
      const draft = getDraftFromRecord(eventFromNavigationState)
      setError('')
      setEventDraft(draft)
      setSessionContextEventId(eventIdValue)
      setNoticeSubmitted(true)
      setRamStatus(eventFromNavigationState.ramStatus ?? 'draft')
      setRamHasLocalChanges(false)
      setAiInsight(draft.legacySummary ?? null)
      eventService.getEventRam(eventFromNavigationState.id)
        .then((ramRecord) => {
          if (cancelled) return
          setRamStatus(ramRecord.status)
          setEventDraft((current) => current ? { ...current, ram: parseEventRam(ramRecord) } : current)
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setRamSessionContextEventId(eventIdValue)
        })
      return () => { cancelled = true }
    }

    if (!effectiveGroupId) {
      setError(t('eventLoadFromGroupFailed'))
      return
    }

    eventService.getGroupEvents(effectiveGroupId)
      .then((records) => {
        if (cancelled) return
        const record = records.find((item) => String(item.id) === eventIdValue)
        if (!record) {
          setError(t('eventNotFound'))
          return
        }

        const draft = getDraftFromRecord(record)
        setError('')
        setEventDraft(draft)
        setSessionContextEventId(eventIdValue)
        setNoticeSubmitted(true)
        setRamStatus(record.ramStatus ?? 'draft')
        setRamHasLocalChanges(false)
        setAiInsight(draft.legacySummary ?? null)
        eventService.getEventRam(record.id)
          .then((ramRecord) => {
            if (cancelled) return
            setRamStatus(ramRecord.status)
            setEventDraft((current) => current ? { ...current, ram: parseEventRam(ramRecord) } : current)
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setRamSessionContextEventId(eventIdValue)
          })
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('eventLoadFailed'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [effectiveGroupId, eventFromNavigationState, eventFromNavigationStateData, eventFromNavigationStateId, eventIdValue, isEditMode])

  useEffect(() => {
    if (!eventDraft) {
      return
    }

    const isRamContext = isEditMode && activeTab === 'ram'
    if (isEditMode) {
      if (sessionContextEventId !== eventIdValue) {
        return
      }
      if (isRamContext && ramSessionContextEventId !== eventIdValue) {
        return
      }
    }

    const scope = `${sessionId}:${isEditMode ? (isRamContext ? 'ram' : 'event') : 'create'}:${sessionContextRevision}`
    if (initializedSessionScopesRef.current.has(scope)) {
      return
    }

    initializedSessionScopesRef.current.add(scope)
    void eventService.startSession(sessionId, eventDraft, aiAppContext)
      .catch((reason) => {
        initializedSessionScopesRef.current.delete(scope)
        setError(normalizeApiError(reason).message)
      })
  }, [activeTab, aiAppContext, eventDraft, eventIdValue, isEditMode, ramSessionContextEventId, sessionContextEventId, sessionContextRevision, sessionId])

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleAiRequest = async (msg: string, attachments: AiSessionAttachment[] = []) => {
    const isSending = isEditMode ? loading : sessionLoading
    if ((!msg && attachments.length === 0) || isSending) return false

    if (isEditMode) {
      setError('')
    } else {
      clearSessionError()
    }
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    scrollToBottom()
    if (isEditMode) {
      setLoading(true)
    }

    try {
      const response = isEditMode
        ? await eventService.extractFromChat(msg, sessionId, 'text', aiAppContext, attachments)
        : await sendMessage(msg, { inputMode: 'text', appContext: aiAppContext, attachments })

      if (response.responseMode === 'result' && response.result) {
        const dto = response.result
        let nextInsight: MultilingualString | null = dto.legacySummary ?? null
        if (isEditMode) {
          nextInsight = (response as typeof response & { legacySummary?: MultilingualString | null }).legacySummary ?? nextInsight
        } else {
          nextInsight = response.context ?? nextInsight
        }
        setEventDraft((current) => ({
          ...dto,
          organizerDisplayName: dto.organizerDisplayName || current?.organizerDisplayName || me?.displayName || '',
          personResponsible: dto.personResponsible || current?.personResponsible || me?.displayName || '',
          purpose: dto.purpose && (dto.purpose.zh.trim() || dto.purpose.en.trim())
            ? dto.purpose
            : current?.purpose ?? { zh: '', en: '' },
          posterImageUrl: current?.posterImageUrl || dto.posterImageUrl || null,
          contactProfileIds: current?.contactProfileIds ?? dto.contactProfileIds ?? [],
          ram: dto.ram ?? current?.ram ?? createEmptyEventRamDraft(dto),
        }))
        setSaveStatus('idle')
        setNoticeSubmitted(false)
        setRamStatus('draft')
        setRamHasLocalChanges(true)
        setAiInsight(nextInsight)
        const lang = language === 'zh' ? dto.title.zh : dto.title.en
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: t('eventExtracted', { name: lang || t('yourEvent') }),
          },
        ])
      } else {
        const markdown = response.markdown?.trim()
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: markdown || t('eventNeedMoreInfo'),
            markdown: true,
          },
        ])
      }
      return true
    } catch (err) {
      const apiError = normalizeApiError(err)
      if (isEditMode) {
        setError(apiError.message)
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: t('eventExtractFailed', { message: apiError.message }), markdown: true },
      ])
      return false
    } finally {
      if (isEditMode) {
        setLoading(false)
      }
      scrollToBottom()
    }
  }

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    await handleAiRequest(msg)
  }

  const analyzePosterWithAi = async (file: File, referenceOnly: boolean) => {
    const isSupported = file.type.startsWith('image/')
      || file.type === 'application/pdf'
      || /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)
    if (!isSupported) {
      setPosterAnalysisStatus('error')
      setPosterAnalysisMessage(language === 'zh' ? 'AI 仅支持读取图片或 PDF 海报。' : 'AI can read image or PDF posters only.')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setPosterAnalysisStatus('error')
      setPosterAnalysisMessage(language === 'zh' ? '供 AI 读取的海报不能超过 6 MB。' : 'Posters sent to AI must be 6 MB or smaller.')
      return
    }

    setPosterAnalysisStatus('analyzing')
    setPosterAnalysisMessage(language === 'zh' ? 'AI 正在读取海报…' : 'AI is reading the poster…')
    try {
      const attachment = await fileToInlineAiAttachment(file, 'event-poster')
      const prompt = referenceOnly
        ? (language === 'zh'
            ? '请读取这张外部制作或过期的参考海报，提取可复用的活动信息。旧日期和旧报名截止日期仅作为参考，除非我明确确认，否则不要当作当前活动日期。请同时检查活动通知和风险评估与管理报告还缺少什么。'
            : 'Read this externally produced or expired reference poster and extract reusable event facts. Treat old dates and registration deadlines as reference only unless I explicitly confirm them. Check what is still missing for both the event notice and the RAM report.')
        : (language === 'zh'
            ? '请读取这张当前活动海报，提取活动通知和风险评估与管理报告可复用的信息，并指出仍需负责人确认的资料。'
            : 'Read this current event poster, reuse its facts for the event notice and RAM report, and identify anything the person responsible must still confirm.')
      const succeeded = await handleAiRequest(prompt, [attachment])
      setPosterAnalysisStatus(succeeded ? 'analyzed' : 'error')
      setPosterAnalysisMessage(succeeded
        ? (language === 'zh' ? 'AI 已读取海报；请到“AI 对话与洞察”查看结果。' : 'AI read the poster. Review the result in AI chat and insights.')
        : (language === 'zh' ? 'AI 未能读取海报，请稍后重试。' : 'AI could not read the poster. Please try again.'))
    } catch (reason) {
      setPosterAnalysisStatus('error')
      setPosterAnalysisMessage(normalizeApiError(reason).message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleVoiceToggle = () => {
    if (listening) {
      speechRecognitionRef.current?.stop()
      setListening(false)
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError(t('voiceUnsupported'))
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language === 'zh' ? 'zh-CN' : 'en-NZ'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      setInput(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setError(t('voiceStopped'))
    }
    speechRecognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const setLocalPosterPreview = (file: File) => {
    clearPosterObjectUrl()
    const objectUrl = URL.createObjectURL(file)
    posterObjectUrlRef.current = objectUrl
    setPosterPreviewUrl(objectUrl)
  }

  const uploadPosterFile = async (file: File, groupId: string, uploadEventId: string) => {
    setPosterUploadStatus('uploading')
    setPosterUploadError('')
    const uploaded = await uploadImage(file, eventPosterFolder(groupId, uploadEventId))
    clearPosterObjectUrl()
    setPosterPreviewUrl('')
    setPendingPosterFile(null)
    setPosterUploadStatus('uploaded')
    return uploaded.url
  }

  const handlePosterChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    if (!isImageFile(file)) {
      setPosterUploadStatus('error')
      setPosterUploadError(t('selectImageFile'))
      return
    }

    setLocalPosterPreview(file)
    setPendingPosterFile(file)
    setPosterUploadError('')
    setSaveStatus('idle')
    setNoticeSubmitted(false)
    setRamStatus('draft')
    setRamHasLocalChanges(true)
    setEventDraft((current) => current?.ram ? { ...current, ram: { ...current.ram, leaderConfirmed: false } } : current)
    void analyzePosterWithAi(file, false)

    if (!targetEventId) {
      setPosterUploadStatus('selected')
      return
    }

    if (!effectiveGroupId) {
      setPosterUploadStatus('error')
      setPosterUploadError(t('missingGroupForEvent'))
      return
    }

    try {
      const posterImageUrl = await uploadPosterFile(file, effectiveGroupId, targetEventId)
      setEventDraft((current) => current ? { ...current, posterImageUrl } : current)
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setPosterUploadStatus('error')
      setPosterUploadError(t('eventPosterUploadFailed', { message: apiError.message }))
    }
  }

  const handleReferencePosterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    void analyzePosterWithAi(file, true)
  }

  const handleGeneratePoster = async (baseImage: File) => {
    if (!effectiveGroupId || !eventDraft) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '请先从小组管理选择所属小组，并填写活动资料。' : 'Select the owning group from group management and add the event details first.')
      return
    }

    const hasTitle = Boolean(eventDraft.title.zh.trim() || eventDraft.title.en.trim())
    const hasDescription = Boolean(eventDraft.description.zh.trim() || eventDraft.description.en.trim())
    if (!hasTitle || !hasDescription) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '请先填写活动标题和描述，AI 才能生成相关海报。' : 'Add an event title and description before asking AI to generate a relevant poster.')
      return
    }

    if (!POSTER_GENERATION_BASE_IMAGE_TYPES.has(baseImage.type.toLowerCase())) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '海报底图必须是 JPEG、PNG 或 WebP 图片。' : 'The base poster must be a JPEG, PNG, or WebP image.')
      return
    }
    if (baseImage.size === 0 || baseImage.size > MAX_POSTER_GENERATION_BASE_IMAGE_BYTES) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '海报底图必须大于 0 且不超过 6 MB。' : 'The base poster must be larger than 0 bytes and no more than 6 MB.')
      return
    }

    const sourceKey = posterBriefKey
    setGeneratedPoster(null)
    setGeneratedPosterSourceKey('')
    setPosterGenerationStatus('generating')
    setPosterGenerationMessage(language === 'zh' ? '正在把底图、活动描述和教会资料传给 Gemini 生成海报草案…' : 'Sending the base image, event description, and church context to Gemini to create a poster draft…')
    try {
      const poster = await eventPosterAiService.generate({
        groupId: effectiveGroupId,
        guidance: posterGenerationGuidance.trim(),
        baseImage,
        event: {
          title: eventDraft.title,
          description: eventDraft.description,
          purpose: eventDraft.purpose,
          locationName: eventDraft.locationName,
          startDate: eventDraft.startDate,
          endDate: eventDraft.endDate,
        },
      })
      setGeneratedPoster(poster)
      setGeneratedPosterSourceKey(sourceKey)
      setPosterGenerationStatus('generated')
      const churchName = localizeText(poster.context.churchName, language)
      setPosterGenerationMessage(language === 'zh'
        ? `已在所选底图基础上生成结合${churchName || '本教会'}资料的海报草案。请检查图片和文字，确认后再采用。`
        : `Poster draft generated from the selected base image and ${churchName || 'the current church'} context. Review the image and all text before adopting it.`)
    } catch (reason) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(normalizeApiError(reason).message)
    }
  }

  const handlePosterGenerationBaseImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    if (!POSTER_GENERATION_BASE_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '海报底图必须是 JPEG、PNG 或 WebP 图片。' : 'The base poster must be a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size === 0 || file.size > MAX_POSTER_GENERATION_BASE_IMAGE_BYTES) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '海报底图必须大于 0 且不超过 6 MB。' : 'The base poster must be larger than 0 bytes and no more than 6 MB.')
      return
    }

    clearPosterGenerationBaseObjectUrl()
    const objectUrl = URL.createObjectURL(file)
    posterGenerationBaseObjectUrlRef.current = objectUrl
    setPosterGenerationBasePreviewUrl(objectUrl)
    setPosterGenerationBaseImageName(file.name)
    void handleGeneratePoster(file)
  }

  const handleAdoptGeneratedPoster = async () => {
    if (!generatedPoster) return
    if (generatedPosterSourceKey !== posterBriefKey) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(language === 'zh' ? '活动资料已改变，请重新生成后再采用。' : 'The event brief has changed. Regenerate the poster before adopting it.')
      return
    }

    try {
      const file = await eventPosterAiService.toFile(generatedPoster)
      setLocalPosterPreview(file)
      setPendingPosterFile(file)
      setPosterUploadStatus('selected')
      setPosterUploadError('')
      setSaveStatus('idle')
      setNoticeSubmitted(false)
      setPosterGenerationStatus('adopted')
      setPosterGenerationMessage(language === 'zh' ? '已采用这张 AI 海报草案；保存活动后才会上传。' : 'AI poster draft adopted. It will upload only after you save the event.')
    } catch (reason) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(normalizeApiError(reason).message)
    }
  }

  const handleCommitDraft = async () => {
    if (!eventDraft) {
      return
    }

    const eventName = (language === 'zh' ? eventDraft.title.zh : eventDraft.title.en) || eventDraft.title.en || eventDraft.title.zh || t('yourEvent')

    if (!isEditMode && !effectiveGroupId) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: t('noGroupSelected'),
        },
      ])
      scrollToBottom()
      return
    }

    setSaveStatus('saving')
    try {
      let persistedEventId = targetEventId

      if (targetEventId) {
        let draftToSave = eventDraft
        if (pendingPosterFile) {
          if (!effectiveGroupId) {
            throw new Error(t('missingGroupForEvent'))
          }
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, targetEventId)
          draftToSave = { ...eventDraft, posterImageUrl }
          setEventDraft(draftToSave)
        }
        await eventService.updateGroupEvent(
          targetEventId,
          draftToSave,
          sessionId,
          { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
        )
      } else if (effectiveGroupId) {
        const created = await eventService.createGroupEvent(
          effectiveGroupId,
          pendingPosterFile ? { ...eventDraft, posterImageUrl: null } : eventDraft,
          pendingPosterFile ? undefined : sessionId,
          {
            ...aiContentContext,
            eventContext: createEventContextFromDto(pendingPosterFile ? { ...eventDraft, posterImageUrl: null } : eventDraft),
          },
        )
        setSavedEventId(created.id)
        persistedEventId = created.id
        activeEntityService.setEvent(created.id)

        if (pendingPosterFile) {
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, created.id)
          const draftToSave = { ...eventDraft, id: created.id, posterImageUrl }
          setEventDraft(draftToSave)
          await eventService.updateGroupEvent(
            created.id,
            draftToSave,
            sessionId,
            { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
          )
        }
      } else {
        throw new Error(t('missingGroupForEvent'))
      }
      if (persistedEventId) {
        activeEntityService.setEvent(persistedEventId)
      }
      setSaveStatus('saved')
      setNoticeSubmitted(true)
      setRamStatus('draft')
      setRamHasLocalChanges(false)
      if (isEditMode) setSessionContextRevision((current) => current + 1)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: isEditMode
            ? t('eventUpdated', { name: eventName })
            : t('eventSavedToGroup', { name: eventName }),
        },
      ])
      if (!isEditMode && persistedEventId && effectiveGroupId) {
        const explicitGroupRoute = Boolean(routeGroupId || searchParams.get('groupId'))
        navigate(`${buildScopedEventDetailPath(effectiveGroupId, persistedEventId, explicitGroupRoute)}/edit`, { replace: true })
      }
    } catch (err) {
      setSaveStatus('error')
      const apiError = normalizeApiError(err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: t('eventSaveFailed', { message: apiError.message }),
          markdown: true,
        },
      ])
    }
    scrollToBottom()
  }

  const handleSaveRam = async () => {
    if (!targetEventId || !eventDraft?.ram) return
    setRamBusy(true)
    setRamMessage('')
    try {
      const record = await eventService.saveEventRam(targetEventId, eventDraft.ram)
      setRamStatus(record.status)
      setRamHasLocalChanges(false)
      setSessionContextRevision((current) => current + 1)
      setRamMessage(language === 'zh' ? 'RAM 草稿已保存。' : 'RAM draft saved.')
    } catch (reason) {
      setRamMessage(normalizeApiError(reason).message)
    } finally {
      setRamBusy(false)
    }
  }

  const handleSubmitRam = async () => {
    if (!targetEventId || !eventDraft?.ram || getEventRamSubmissionIssues(eventDraft.ram, true).length > 0) return
    setRamBusy(true)
    setRamMessage('')
    try {
      await eventService.saveEventRam(targetEventId, eventDraft.ram)
      const record = await eventService.submitEventRam(targetEventId)
      setRamStatus(record.status)
      setRamHasLocalChanges(false)
      setRamMessage(language === 'zh' ? 'RAM 已提交审核。' : 'RAM sent for review.')
    } catch (reason) {
      setRamMessage(normalizeApiError(reason).message)
    } finally {
      setRamBusy(false)
    }
  }

  const handleApproveRam = async () => {
    if (!targetEventId) return
    setRamBusy(true)
    setRamMessage('')
    try {
      const record = await eventService.approveEventRam(targetEventId)
      setRamStatus(record.status)
      setRamHasLocalChanges(false)
      setRamMessage(language === 'zh' ? 'RAM 已批准，活动现在可以进入近期活动。' : 'RAM approved. The event can now appear as upcoming.')
    } catch (reason) {
      setRamMessage(normalizeApiError(reason).message)
    } finally {
      setRamBusy(false)
    }
  }

  const isSending = isEditMode ? loading : sessionLoading
  const isPosterUploading = posterUploadStatus === 'uploading'
  const isPosterGenerating = posterGenerationStatus === 'generating'
  const generatedPosterPreviewUrl = generatedPoster
    ? `data:${generatedPoster.mimeType};base64,${generatedPoster.imageBase64}`
    : ''
  const generatedPosterIsStale = Boolean(generatedPoster && generatedPosterSourceKey !== posterBriefKey)
  const posterHasRequiredBrief = Boolean(eventDraft
    && (eventDraft.title.zh.trim() || eventDraft.title.en.trim())
    && (eventDraft.description.zh.trim() || eventDraft.description.en.trim()))
  const posterGenerationBlockers = [
    !effectiveGroupId
      ? (language === 'zh' ? '从小组管理选择活动所属小组' : 'select the group that owns this event from group management')
      : '',
    !eventDraft || !(eventDraft.title.zh.trim() || eventDraft.title.en.trim())
      ? (language === 'zh' ? '填写活动标题（至少一种语言）' : 'add an event title in at least one language')
      : '',
    !eventDraft || !(eventDraft.description.zh.trim() || eventDraft.description.en.trim())
      ? (language === 'zh' ? '填写活动描述（至少一种语言）' : 'add an event description in at least one language')
      : '',
  ].filter(Boolean)
  const missingEventBriefTranslations = getMissingEventBriefTranslations(eventDraft)
  const setupBriefReady = Boolean(
    effectiveGroupId
    && posterHasRequiredBrief
    && eventDraft
    && hasText(eventDraft.personResponsible),
  )
  const posterStatusMessage =
    posterUploadStatus === 'selected'
      ? t('eventPosterSelectedPendingUpload')
      : posterUploadStatus === 'uploading'
        ? t('eventPosterUploading')
        : posterUploadStatus === 'uploaded'
          ? t('eventPosterUploaded')
          : posterUploadStatus === 'error'
            ? posterUploadError
            : ''
  const posterButtonLabel = eventDraft?.posterImageUrl || posterPreviewUrl
    ? t('eventPosterReplace')
    : t('eventPosterChoose')
  const noticeIssues = eventDraft ? getNoticeSubmissionIssues(eventDraft) : ['eventDraft']
  if (!effectiveGroupId) noticeIssues.push('group')
  const noticeCanSubmit = noticeIssues.length === 0 && canEditRam
  const ramIssues = eventDraft?.ram ? getEventRamSubmissionIssues(eventDraft.ram, Boolean(targetEventId)) : ['ram']
  const ramCanSubmit = ramIssues.length === 0 && canEditRam
  const ramSubmitted = !ramHasLocalChanges && (ramStatus === 'awaitingReview' || ramStatus === 'approved')
  const ramSubmittedDetail = ramStatus === 'approved'
    ? (language === 'zh' ? '已批准' : 'Approved')
    : ramStatus === 'awaitingReview'
      ? (language === 'zh' ? '已提交审核' : 'Submitted for review')
      : undefined
  const tabs: Array<{ id: EventEditorTab; label: string; icon: React.ReactNode; ready?: boolean; submitted?: boolean }> = [
    { id: 'setup', label: language === 'zh' ? '1. 工作流与初始化' : '1. Workflow & setup', icon: <BookOpenText className="h-4 w-4" /> },
    { id: 'assistant', label: language === 'zh' ? '2. AI 对话与洞察' : '2. AI chat & insights', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'notice', label: language === 'zh' ? '3. 活动通知文案' : '3. Event notice', icon: <FileText className="h-4 w-4" />, ready: noticeCanSubmit, submitted: noticeSubmitted },
    { id: 'ram', label: language === 'zh' ? '4. 风险评估与管理' : '4. Risk assessment', icon: <ShieldCheck className="h-4 w-4" />, ready: ramCanSubmit, submitted: ramSubmitted },
  ]

  const updateSetupDraft = (patch: Partial<EventDto>) => {
    setEventDraft((current) => current ? {
      ...current,
      ...patch,
      ram: current.ram ? { ...current.ram, leaderConfirmed: false } : current.ram,
    } : current)
    setNoticeSubmitted(false)
    setSaveStatus('idle')
    setRamStatus('draft')
    setRamHasLocalChanges(true)
    if (patch.title || patch.description) {
      setBriefTranslationStatus('idle')
      setBriefTranslationMessage('')
    }
  }

  const openEditorStep = (step: EventEditorTab) => {
    setActiveTab(step)
    window.requestAnimationFrame(() => {
      document.getElementById(`event-editor-tab-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleFillMissingEventTranslations = async () => {
    if (!effectiveGroupId || missingEventBriefTranslations.length === 0) return
    setBriefTranslationStatus('translating')
    setBriefTranslationMessage(language === 'zh' ? 'AI 正在补全缺少的语言…' : 'AI is filling the missing language…')
    try {
      const translations = await aiTranslationService.translateTextFields({
        scope: CurrentGroup?.isChurch ? 'church' : 'group',
        groupId: effectiveGroupId,
        fields: missingEventBriefTranslations,
      })
      setEventDraft((current) => {
        if (!current) return current
        const title = { ...current.title }
        const description = { ...current.description }
        translations.forEach((translation) => {
          if (translation.field === 'title' && !title[translation.language].trim()) title[translation.language] = translation.text
          if (translation.field === 'description' && !description[translation.language].trim()) description[translation.language] = translation.text
        })
        return {
          ...current,
          title,
          description,
          ram: current.ram ? { ...current.ram, leaderConfirmed: false } : current.ram,
        }
      })
      setNoticeSubmitted(false)
      setSaveStatus('idle')
      setRamStatus('draft')
      setRamHasLocalChanges(true)
      setBriefTranslationStatus('translated')
      setBriefTranslationMessage(language === 'zh' ? '另一种语言已作为 AI 草稿补全，请人工检查。' : 'The other language was filled as an AI draft. Please review it.')
    } catch (reason) {
      setBriefTranslationStatus('error')
      setBriefTranslationMessage(normalizeApiError(reason).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="rounded-2xl border border-[#2f4b42]/10 bg-white/78 px-5 py-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{isEditMode ? t('edit') : t('createEvent')}</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{isEditMode ? t('editEventWithAi') : t('createEventWithAi')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {isEditMode
            ? t('editEventAiDescription')
            : t('createEventAiDescription')}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#2f4b42]/10 bg-white/85 p-2 shadow-[0_10px_30px_rgba(31,56,48,0.06)]" role="tablist" aria-label={language === 'zh' ? '活动编辑步骤' : 'Event editor steps'}>
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`event-editor-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`event-editor-panel-${tab.id}`}
              onClick={() => openEditorStep(tab.id)}
              className={[
                'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
                activeTab === tab.id ? 'bg-[#176b5a] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
              {tab.submitted ? <CheckCircle2 className="h-3.5 w-3.5 text-sky-300" /> : tab.ready ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
            </button>
          ))}
        </div>
      </div>

      {(error || sessionError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error || sessionError}</p>
      )}

      <div id="event-editor-panel-setup" role="tabpanel" aria-labelledby="event-editor-tab-setup" hidden={activeTab !== 'setup'} className="space-y-6">
        <EventWorkflowPanel
          eventDraft={eventDraft}
          targetEventId={targetEventId}
          language={language}
          ramStatus={ramStatus}
          noticeSubmitted={noticeSubmitted}
        />

        {eventDraft ? (
          <section className="space-y-5 rounded-2xl border border-[#2f4b42]/10 bg-white/90 p-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{language === 'zh' ? '初始化资料' : 'Starting brief'}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{language === 'zh' ? '先告诉 AI 这次活动为什么而办' : 'Tell AI why this event matters'}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{language === 'zh' ? '这些资料会成为通知文案和 RAM 的共同事实来源；稍后仍可在 AI 对话中补充或更正。' : 'These details become shared facts for the notice and RAM. You can add to or correct them later in AI chat.'}</p>
            </div>

            {effectiveGroupId ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
                {language === 'zh'
                  ? `所属小组：${CurrentGroup?.id === effectiveGroupId ? localizeText(CurrentGroup.name, language) : '当前小组'}`
                  : `Owning group: ${CurrentGroup?.id === effectiveGroupId ? localizeText(CurrentGroup.name, language) : 'current group'}`}
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <span>{language === 'zh' ? '尚未从小组管理选择活动所属小组，因此无法生成海报或保存活动。' : 'No owning group is selected from group management, so the poster cannot be generated and the event cannot be saved.'}</span>
                <button type="button" onClick={() => navigate('/groups?section=events')} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 font-bold text-rose-800">
                  {language === 'zh' ? '返回小组管理' : 'Back to group management'}
                </button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{language === 'zh' ? '活动标题与描述' : 'Event title and description'}</h3>
                  <span className="mt-1 block text-xs font-semibold text-amber-700">{language === 'zh' ? '海报生成必填；每项至少填写一种语言' : 'Required for poster generation; use at least one language for each'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleFillMissingEventTranslations() }}
                  disabled={!effectiveGroupId || missingEventBriefTranslations.length === 0 || briefTranslationStatus === 'translating'}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Languages className="h-4 w-4" aria-hidden="true" />
                  {briefTranslationStatus === 'translating'
                    ? (language === 'zh' ? 'AI 翻译中…' : 'AI translating…')
                    : (language === 'zh' ? 'AI 补全另一语言' : 'AI fill missing language')}
                </button>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {(['zh', 'en'] as const).map((lang) => (
                  <div key={lang} className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">
                      {language === 'zh' ? '活动标题' : 'Event title'} ({lang})
                      <input
                        value={eventDraft.title[lang]}
                        onChange={(event) => updateSetupDraft({ title: { ...eventDraft.title, [lang]: event.target.value } })}
                        placeholder={lang === 'zh' ? '例如：2026 青年夏令营' : 'e.g. 2026 Youth Summer Camp'}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="block text-sm font-bold text-slate-700">
                      {language === 'zh' ? '活动描述' : 'Event description'} ({lang})
                      <textarea
                        rows={4}
                        value={eventDraft.description[lang]}
                        onChange={(event) => updateSetupDraft({ description: { ...eventDraft.description, [lang]: event.target.value } })}
                        placeholder={lang === 'zh' ? '说明活动对象、主要内容、氛围和希望带来的结果。' : 'Describe the audience, main activities, atmosphere, and intended outcome.'}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </div>
                ))}
              </div>
              {briefTranslationMessage ? (
                <p className={['mt-3 rounded-lg px-3 py-2 text-xs', briefTranslationStatus === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-sky-200 bg-sky-50 text-sky-800'].join(' ')}>
                  {briefTranslationMessage}
                </p>
              ) : missingEventBriefTranslations.length > 0 ? (
                <p className="mt-3 text-xs text-sky-700">{language === 'zh' ? '已检测到只填写了一种语言的内容，可点击上方按钮补全另一种语言；AI 结果需要人工检查。' : 'Some content has only one language. Use the button above to fill the other language, then review the AI draft.'}</p>
              ) : !posterHasRequiredBrief ? (
                <p className="mt-3 text-xs text-slate-500">{language === 'zh' ? '先用中文或英文填写标题和描述，之后即可让 AI 补全另一种语言。' : 'First add the title and description in Chinese or English, then AI can fill the other language.'}</p>
              ) : (
                <p className="mt-3 text-xs text-emerald-700">{language === 'zh' ? '标题和描述的中英文内容已经完整。' : 'The title and description are complete in both languages.'}</p>
              )}
            </div>

            <label className="block text-sm font-bold text-slate-700">
              {language === 'zh' ? '活动负责人' : 'Person responsible'}
              <input
                value={eventDraft.personResponsible ?? ''}
                onChange={(event) => updateSetupDraft({ personResponsible: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-black text-slate-800">
                {language === 'zh' ? '补充活动目标（可选）' : 'Additional event objective (optional)'}
              </summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {language === 'zh' ? '如果活动描述已经说明了为什么举办，可以不填。仅在需要单独记录期望结果时补充。' : 'Leave this empty when the description already explains why the event exists. Use it only for a distinct intended outcome.'}
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {(['zh', 'en'] as const).map((lang) => (
                  <label key={lang} className="text-sm font-bold text-slate-700">
                    {language === 'zh' ? '活动目标' : 'Event objective'} ({lang})
                    <textarea
                      rows={3}
                      value={eventDraft.purpose?.[lang] ?? ''}
                      onChange={(event) => updateSetupDraft({ purpose: { ...(eventDraft.purpose ?? { zh: '', en: '' }), [lang]: event.target.value } })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                ))}
              </div>
            </details>

            <div>
              <h3 className="font-black text-slate-950">{language === 'zh' ? '活动联系人' : 'Event contacts'}</h3>
              <p className="mt-1 text-sm text-slate-500">{language === 'zh' ? '可选择一位或多位联系人，他们会显示在活动详情中。' : 'Choose one or more contacts to show with the event.'}</p>
              {availableContacts.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availableContacts.map((contact) => {
                    const selected = (eventDraft.contactProfileIds ?? []).includes(contact.id)
                    return (
                      <label key={contact.id} className={['flex cursor-pointer items-center gap-3 rounded-xl border p-3', selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'].join(' ')}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const ids = eventDraft.contactProfileIds ?? []
                            updateSetupDraft({ contactProfileIds: selected ? ids.filter((id) => id !== contact.id) : [...ids, contact.id] })
                          }}
                        />
                        {contact.photoUrl ? <img src={contact.photoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : null}
                        <span><span className="block text-sm font-bold text-slate-950">{localizeText(contact.name, language)}</span><span className="block text-xs text-slate-500">{localizeText(contact.role, language)}</span></span>
                      </label>
                    )
                  })}
                </div>
              ) : <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{language === 'zh' ? '当前小组尚无可选择的联系人资料。' : 'This group has no available contact profiles yet.'}</p>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">{language === 'zh' ? '海报与 AI 读取' : 'Poster and AI reading'}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{language === 'zh' ? '现用海报会保存为活动图片并自动交给 AI 读取。旧海报或 PDF 可仅供 AI 参考，不会成为当前活动海报。' : 'A current poster is saved as the event image and read by AI. An old poster or PDF can be AI reference only and will not become the current poster.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input ref={posterInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void handlePosterChange(event) }} />
                  <button type="button" onClick={() => posterInputRef.current?.click()} disabled={isPosterUploading || isSending || saveStatus === 'saving'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50">
                    <ImageIcon className="h-4 w-4" />{posterButtonLabel}
                  </button>
                  <input ref={referencePosterInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReferencePosterChange} />
                  <button type="button" onClick={() => referencePosterInputRef.current?.click()} disabled={isSending} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                    <Upload className="h-4 w-4" />{language === 'zh' ? '读取旧/参考海报' : 'Read old/reference poster'}
                  </button>
                </div>
              </div>
              {posterStatusMessage ? <p className={['mt-3 rounded-lg px-3 py-2 text-xs', posterUploadStatus === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : posterUploadStatus === 'selected' ? 'border border-amber-200 bg-amber-50 text-amber-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'].join(' ')}>{posterStatusMessage}</p> : null}
              {posterAnalysisMessage ? <p className={['mt-2 rounded-lg px-3 py-2 text-xs', posterAnalysisStatus === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : posterAnalysisStatus === 'analyzing' ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'].join(' ')}>{posterAnalysisMessage}</p> : null}

              <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <h4 className="flex items-center gap-2 font-black text-slate-950">
                      <Sparkles className="h-4 w-4 text-violet-600" aria-hidden="true" />
                      {language === 'zh' ? 'AI 生成海报草案' : 'Generate an AI poster draft'}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {language === 'zh'
                        ? '点击生成后请上传一张海报底图。AI 会以该图片为视觉基础，结合活动标题、描述、目的，以及系统中的教会和小组正式资料进行修改。不会读取联系人、电话或 RAM 内部资料。'
                        : 'After you click generate, upload a base poster image. AI edits that image using the event title, description, purpose, and the canonical church and group profile stored in Alife. Contacts, phone numbers, and internal RAM details are not included.'}
                    </p>
                  </div>
                  <input
                    ref={posterGenerationBaseInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePosterGenerationBaseImageChange}
                  />
                  <button
                    type="button"
                    onClick={() => posterGenerationBaseInputRef.current?.click()}
                    disabled={!effectiveGroupId || !posterHasRequiredBrief || isPosterGenerating || isPosterUploading || saveStatus === 'saving'}
                    title={posterGenerationBlockers.length > 0 ? posterGenerationBlockers.join(language === 'zh' ? '；' : '; ') : undefined}
                    aria-describedby={posterGenerationBlockers.length > 0 ? 'poster-generation-requirements' : undefined}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {isPosterGenerating
                      ? (language === 'zh' ? '生成中…' : 'Generating…')
                      : generatedPoster
                        ? (language === 'zh' ? '更换底图并重新生成' : 'Choose another base and regenerate')
                        : (language === 'zh' ? '上传底图并生成' : 'Upload base and generate')}
                  </button>
                </div>

                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {language === 'zh'
                    ? '选择底图后会立即调用 Gemini，可能产生费用。请只上传有权使用且不含私人或敏感资料的图片。生成内容可能出现文字、人物或神学表达偏差，必须由负责人检查。只有点击“采用这张海报”并保存活动后，生成结果才会成为活动海报。'
                    : 'Selecting a base image immediately calls Gemini and may incur cost. Upload only an image you have the right to use and that contains no private or sensitive information. Generated text, people, or theological expression may be inaccurate and must be reviewed by a leader. The result becomes the event poster only after you choose “Adopt this poster” and save.'}
                </div>

                {posterGenerationBasePreviewUrl ? (
                  <div className="mt-3 grid gap-3 rounded-lg border border-violet-100 bg-violet-50/60 p-3 sm:grid-cols-[10rem_1fr] sm:items-center">
                    <div className="overflow-hidden rounded-lg border border-violet-200 bg-white">
                      <img src={posterGenerationBasePreviewUrl} alt={language === 'zh' ? '上传的海报底图' : 'Uploaded base poster'} className="h-24 w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-900">{language === 'zh' ? '本次生成使用的底图' : 'Base image used for this generation'}</p>
                      <p className="mt-1 break-all text-xs text-violet-700">{posterGenerationBaseImageName}</p>
                    </div>
                  </div>
                ) : null}

                <label className="mt-3 block text-sm font-bold text-slate-700">
                  {language === 'zh' ? '补充视觉描述（可选）' : 'Additional visual direction (optional)'}
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={posterGenerationGuidance}
                    onChange={(event) => setPosterGenerationGuidance(event.target.value)}
                    disabled={isPosterGenerating}
                    placeholder={language === 'zh' ? '例如：温暖自然、适合家庭营会、留出清晰的标题区域。不要填写姓名、电话等私人资料。' : 'For example: warm and natural, suitable for a family camp, with clear space for the title. Do not include names, phone numbers, or other private data.'}
                    className="mt-1 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-400">{posterGenerationGuidance.length}/600</span>
                </label>

                {posterGenerationBlockers.length > 0 ? (
                  <div id="poster-generation-requirements" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-bold">{language === 'zh' ? '“上传底图并生成”暂不可用，还需要：' : '“Upload base and generate” is unavailable until you:'}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {posterGenerationBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  </div>
                ) : null}

                {generatedPosterPreviewUrl ? (
                  <div className="mt-4 space-y-3">
                    <div className="overflow-hidden rounded-xl border border-violet-200 bg-slate-100">
                      <CoverImage src={generatedPosterPreviewUrl} alt={language === 'zh' ? 'AI 生成的活动海报草案' : 'AI-generated event poster draft'} aspectRatio={16 / 9} className="w-full" />
                    </div>
                    {generatedPosterIsStale ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {language === 'zh' ? '活动资料在生成后已经改变。这张草案可能已过期，请重新生成后再采用。' : 'The event brief changed after generation. This draft may be stale; regenerate it before adopting.'}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {language === 'zh' ? 'AI 草案不会自动发布或覆盖现有海报。' : 'AI drafts never publish automatically or overwrite the current poster.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => { void handleAdoptGeneratedPoster() }}
                        disabled={generatedPosterIsStale || isPosterGenerating || isPosterUploading}
                        className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3.5 py-2 text-sm font-bold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {language === 'zh' ? '采用这张海报' : 'Adopt this poster'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {posterGenerationMessage ? (
                  <p className={['mt-3 rounded-lg px-3 py-2 text-xs', posterGenerationStatus === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : posterGenerationStatus === 'generating' ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-violet-200 bg-violet-50 text-violet-800'].join(' ')}>
                    {posterGenerationMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="max-w-2xl">
                <p className="font-black text-sky-950">{language === 'zh' ? '第一步之后怎么做？' : 'What comes after step 1?'}</p>
                <p className="mt-1 text-sm leading-6 text-sky-800">
                  {setupBriefReady
                    ? (language === 'zh' ? '基础资料已经齐全。进入第二步，与 AI 一起补齐时间、地点、活动项目、报名设置等共同资料。' : 'The starting brief is ready. Continue to step 2 and use AI to complete timing, venue, activities, enrollment, and other shared facts.')
                    : (language === 'zh' ? '建议先补齐上面的基础资料；也可以现在进入第二步，让 AI 通过对话协助补充。' : 'Complete the starting brief above if possible, or continue now and let AI help fill the gaps through conversation.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEditorStep('assistant')}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-sky-800"
              >
                {language === 'zh' ? '下一步：与 AI 补齐资料' : 'Next: complete details with AI'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <div id="event-editor-panel-assistant" role="tabpanel" aria-labelledby="event-editor-tab-assistant" hidden={activeTab !== 'assistant'} className="space-y-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
          <strong>{language === 'zh' ? '共享资料工作区：' : 'Shared-facts workspace: '}</strong>
          {language === 'zh' ? 'AI 会汇集初始化资料、海报和对话，复用活动名称、项目、人数、联系人等信息，同时引导完成通知文案和 RAM。所有安全事实仍须人工确认。' : 'AI combines the starting brief, posters, and chat; reuses names, activities, attendance, contacts, and other facts across the notice and RAM; and guides both deliverables. Safety facts still require human confirmation.'}
        </div>
        {aiInsight ? (
          <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm text-sky-950 shadow-sm">
            <span className="font-bold">{t('aiInsight')}</span>{language === 'zh' ? aiInsight.zh : aiInsight.en}
          </div>
        ) : null}
        <div className="flex max-h-[50vh] min-h-72 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {messages.map((msg, i) => (
            <div key={i} className={['max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', msg.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'mr-auto bg-white text-slate-800 shadow-sm'].join(' ')}>
              {msg.markdown && msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>, ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>, ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>, li: ({ children }) => <li className="mb-1">{children}</li>, code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{children}</code> }}>{msg.text}</ReactMarkdown>
              ) : msg.text.split('\n').map((line, j) => <span key={j}>{line}{j < msg.text.split('\n').length - 1 && <br />}</span>)}
            </div>
          ))}
          {isSending ? <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-slate-400 shadow-sm"><span className="animate-pulse">{t('geminiThinking')}</span></div> : null}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-end gap-3">
          <textarea ref={textareaRef} rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} disabled={isSending} placeholder={t('describeEventPlaceholder')} className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
          <button type="button" onClick={handleVoiceToggle} className={['inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition', listening ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'].join(' ')} aria-label={listening ? t('stopVoiceInput') : t('startVoiceInput')}>{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
          <button type="button" onClick={() => { void handleSend() }} disabled={isSending || !input.trim()} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50" aria-label={t('send')}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>

      <div id="event-editor-panel-notice" role="tabpanel" aria-labelledby="event-editor-tab-notice" hidden={activeTab !== 'notice'} className="space-y-5">
        <SubmissionStatusHeader title={language === 'zh' ? '活动通知文案' : 'Event notice copy'} description={language === 'zh' ? '这是面向成员的双语活动通知。每次 AI 整理后，可提交与已提交状态都会在这里更新。' : 'This is the bilingual member-facing event notice. Ready and submitted states update after every AI pass.'} canSubmit={noticeCanSubmit} submitted={noticeSubmitted} remainingCount={noticeIssues.length} language={language} />
        {eventDraft ? <EventPreview event={eventDraft} lang={language} posterPreviewUrl={posterPreviewUrl} posterPendingUpload={Boolean(pendingPosterFile)} submitted={noticeSubmitted} /> : null}
        {eventDraft ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!effectiveGroupId ? <p className="text-xs text-amber-600">{t('noGroupContext')}</p> : null}
            {saveStatus === 'saved' ? <p className="text-xs text-emerald-600">{t('eventSavedToGroupShort')}</p> : null}
            <button type="button" onClick={() => { void handleCommitDraft() }} disabled={!noticeCanSubmit || saveStatus === 'saving' || isPosterUploading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60">
              <Save className="h-4 w-4" />{saveStatus === 'saving' ? t('saving') : targetEventId ? (language === 'zh' ? '重新提交活动通知' : 'Resubmit event notice') : (language === 'zh' ? '提交活动通知' : 'Submit event notice')}
            </button>
          </div>
        ) : null}
      </div>

      <div id="event-editor-panel-ram" role="tabpanel" aria-labelledby="event-editor-tab-ram" hidden={activeTab !== 'ram'} className="space-y-5">
        <SubmissionStatusHeader title={language === 'zh' ? '风险评估与管理' : 'Risk Assessment and Management'} description={language === 'zh' ? 'AI 会复用活动资料起草 RAM，但负责人、电话、资质、车辆和安全确认不得由 AI 猜测，必须人工核对。' : 'AI reuses event facts to draft the RAM, but responsible people, phone numbers, qualifications, vehicles, and safety confirmations must be checked by a human.'} canSubmit={ramCanSubmit} submitted={ramSubmitted} submittedDetail={ramSubmittedDetail} remainingCount={ramIssues.length} language={language} />
        {!targetEventId ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{language === 'zh' ? '请先在“活动通知文案”中保存活动，再保存或提交 RAM。' : 'Save the event in Event notice first, then save or submit the RAM.'}</p> : null}
        {eventDraft?.ram ? (
          <EventRamEditor
            ram={eventDraft.ram}
            status={ramStatus}
            language={language}
            canEdit={canEditRam}
            canAudit={canAuditRam}
            canSubmit={ramCanSubmit}
            busy={ramBusy}
            onChange={(ram) => {
              setEventDraft((current) => current ? { ...current, ram } : current)
              setRamStatus('draft')
              setRamHasLocalChanges(true)
              setRamMessage('')
            }}
            onSave={targetEventId ? () => { void handleSaveRam() } : undefined}
            onSubmit={targetEventId ? () => { void handleSubmitRam() } : undefined}
            onApprove={targetEventId ? () => { void handleApproveRam() } : undefined}
          />
        ) : null}
        {ramMessage ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{ramMessage}</p> : null}
      </div>
    </div>
  )
}

export default EventCreatorView
