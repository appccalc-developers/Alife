import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpenText, Bot, Building2, CalendarClock, CheckCircle2, ChevronDown, CircleAlert, ClipboardList, FileText, ImageIcon, Languages, ListChecks, Mic, MicOff, Save, ShieldCheck, Sparkles, Upload, UserRound, UsersRound, WalletCards } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { EventDto, EventRamDraft, EventRamStatus, GroupEventRecord, MultilingualString } from '../types/event'
import type { AiSessionAppContext, AiSessionAttachment, AiSessionState } from '../types/aiSession'
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
import { confirmUnsavedChangesNavigation, setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'

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

const assistantModuleCopy: Record<string, {
  name: { en: string; zh: string }
  prompts: { en: string[]; zh: string[] }
}> = {
  core: { name: { en: 'Event facts', zh: '活动资料' }, prompts: { en: ['Check the current event facts and list what the leader still needs to confirm.'], zh: ['检查当前活动资料，列出还需要负责人确认的内容。'] } },
  venue: { name: { en: 'Venue request', zh: '场地申请' }, prompts: { en: ['Based on the confirmed time, attendance and audience, draft venue requirements. Do not choose or submit a venue for me.', 'List questions I should confirm before requesting a church venue.'], zh: ['根据已确认的时间、人数和对象，整理场地需求。不要替我选择或提交场地。', '列出申请教会场地前还需要人工确认的问题。'] } },
  registration: { name: { en: 'Registration', zh: '报名设置' }, prompts: { en: ['Suggest a registration deadline and necessary form fields from the current event facts. Mark every assumption.'], zh: ['根据当前活动资料建议报名截止时间和必要字段，并明确标出所有假设。'] } },
  finance: { name: { en: 'Fees and payments', zh: '费用与收款' }, prompts: { en: ['Organize the known fees and payment instructions, then list decisions that still need a person.'], zh: ['整理已知费用和付款说明，再列出仍需人工决定的事项。'] } },
  ram: { name: { en: 'Risk assessment', zh: '风险评估' }, prompts: { en: ['Draft possible risks from confirmed facts only. Leave people, phone numbers, qualifications and approvals unfilled.'], zh: ['只根据已确认事实起草可能风险；人员、电话、资质和审批保持待人工填写。'] } },
  roster: { name: { en: 'Volunteer roster', zh: '同工排班' }, prompts: { en: ['Draft the roles and shift requirements from confirmed event facts. Use only confirmed availability and capability labels; do not assign or confirm a person.'], zh: ['根据已确认的活动事实整理岗位和班次需求；只参考已确认的可用时间与能力标签，不替负责人安排或确认人员。'] } },
  programme: { name: { en: 'Programme and handover', zh: '程序单与交接' }, prompts: { en: ['Draft the event-day sequence and operational handover points. Do not choose owners, confirm assignments, or mark any item ready.'], zh: ['根据已确认资料起草当天程序和现场交接要点；不要选择负责人、确认排班或把任何环节标为已就绪。'] } },
  tasks: { name: { en: 'Preparation tasks', zh: '筹备任务' }, prompts: { en: ['Draft a preparation checklist with dependencies and suggested due dates. Leave every owner unassigned until a leader confirms them.'], zh: ['起草带前置关系和建议截止时间的筹备清单；负责人确认前不要替任何任务指定人员。'] } },
  communications: { name: { en: 'Notice and poster', zh: '通知与海报' }, prompts: { en: ['Draft a concise bilingual notice and poster content outline from confirmed event facts.'], zh: ['根据已确认活动资料，起草简洁的双语通知和海报内容提纲。'] } },
  closure: { name: { en: 'Closure and learning', zh: '结项与经验' }, prompts: { en: ['Summarize verified attendance, finance and incident outcomes only, then suggest follow-up questions. Do not invent learning or confirm closure.'], zh: ['只汇总已经核对的出席、财务和事故结果，再建议需要追问的问题；不要编造经验，也不要替负责人确认结项。'] } },
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
  const location = (lang === 'zh' ? event.locationName.zh : event.locationName.en) || event.locationName.en || event.locationName.zh
  const posterUrl = posterPreviewUrl || event.posterImageUrl || ''
  const requiresRegistration = event.maxCapacity > 0

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {location ? <p className="mt-0.5 text-sm text-slate-500">{location}</p> : null}
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
    visibility: 'groupVisible',
    publicationStatus: 'draft',
    personResponsible: organizerDisplayName,
    purpose: { zh: '', en: '' },
    title: { zh: '', en: '' },
    description: { zh: '', en: '' },
    locationName: { zh: '', en: '' },
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    maxCapacity: 0,
    capacityUnit: 'People',
    hardConstraints: [],
    optionalActivities: [],
    currency: 'NZD',
    paymentInstructions: { zh: '', en: '' },
    refundPolicy: { zh: '', en: '' },
    paymentEvidenceRequired: false,
    financeLeaderConfirmed: false,
    galleryUrls: [],
    legacySummary: null,
    contactProfileIds: [],
    enabledModules: [],
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
  if (!hasText(event.startDate) || Number.isNaN(Date.parse(event.startDate))) issues.push('startDate')
  if (!hasText(event.endDate) || Number.isNaN(Date.parse(event.endDate))) issues.push('endDate')
  if (!issues.includes('startDate') && !issues.includes('endDate') && Date.parse(event.endDate) < Date.parse(event.startDate)) issues.push('dateOrder')
  return issues
}

type OptionalEventModuleKey = NonNullable<EventDto['enabledModules']>[number]

const selectedOptionalModules = (event: EventDto): OptionalEventModuleKey[] => {
  if (Array.isArray(event.enabledModules)) return event.enabledModules
  const inferred: OptionalEventModuleKey[] = []
  if (event.maxCapacity > 0 || event.registrationDeadline) inferred.push('registration')
  if ((event.baseFeePerAdult ?? 0) > 0 || (event.baseFeePerChild ?? 0) > 0 || event.optionalActivities.some((x) => x.extraFee > 0)) inferred.push('finance')
  if (event.hardConstraints.length > 0 || event.ram?.isOuting) inferred.push('ram')
  if (event.requiresRoster) inferred.push('roster')
  return inferred
}

const toLocalDateTimeInput = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const fromLocalDateTimeInput = (value: string) => value ? new Date(value).toISOString() : ''

const getNoticeIssueLabel = (issue: string, language: string) => {
  const labels: Record<string, { zh: string; en: string }> = {
    eventDraft: { zh: '活动草稿', en: 'event draft' },
    group: { zh: '活动所属小组', en: 'owning group' },
    title: { zh: '中英文活动标题', en: 'bilingual event title' },
    description: { zh: '中英文活动描述', en: 'bilingual event description' },
    locationName: { zh: '中英文活动地点', en: 'bilingual event location' },
    startDate: { zh: '开始时间', en: 'start time' },
    endDate: { zh: '结束时间', en: 'end time' },
    registrationDeadline: { zh: '报名截止时间', en: 'registration deadline' },
    dateOrder: { zh: '正确的开始和结束时间', en: 'valid start and end order' },
    registrationDeadlineOrder: { zh: '早于活动开始的报名截止时间', en: 'a registration deadline before the event starts' },
    maxCapacity: { zh: '报名人数或无需报名', en: 'capacity or no-registration choice' },
    currency: { zh: '活动币种', en: 'event currency' },
  }
  const label = labels[issue]
  return label ? (language === 'zh' ? label.zh : label.en) : issue
}

const hasRecoverableEventSession = (
  state: AiSessionState<EventDto, MultilingualString | null> | null,
) => {
  if (!state) return false
  const draft = state.draft
  const hasDraftContent = Boolean(draft && (
    draft.title.zh.trim()
    || draft.title.en.trim()
    || draft.description.zh.trim()
    || draft.description.en.trim()
    || draft.locationName.zh.trim()
    || draft.locationName.en.trim()
    || draft.startDate
    || draft.endDate
    || draft.hardConstraints.length > 0
    || draft.optionalActivities.length > 0
  ))
  const hasContext = Boolean(state.context && (state.context.zh.trim() || state.context.en.trim()))
  return hasDraftContent || hasContext || state.chatHistory.length > 0
}

const SubmissionStatusHeader = ({
  title,
  description,
  canSubmit,
  submitted,
  submittedDetail,
  remainingCount,
  language,
  remainingMessage,
  resolveLabel,
  onResolve,
}: {
  title: string
  description: string
  canSubmit: boolean
  submitted: boolean
  submittedDetail?: string
  remainingCount: number
  language: 'en' | 'zh'
  remainingMessage?: string
  resolveLabel?: string
  onResolve?: () => void
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-semibold leading-5 text-amber-800">
            {remainingMessage || (isZh ? `还需补齐 ${remainingCount} 项资料。` : `${remainingCount} item(s) still need attention.`)}
          </p>
          {onResolve && resolveLabel ? (
            <button type="button" onClick={onResolve} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-900 transition hover:bg-amber-100">
              {resolveLabel}
            </button>
          ) : null}
        </div>
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
  visibility: record.visibility ?? 'groupVisible',
  publicationStatus: 'draft',
  personResponsible: '',
  purpose: { zh: '', en: '' },
  title: { zh: record.titleZh, en: record.titleEn },
  description: { zh: '', en: '' },
  locationName: { zh: '', en: '' },
  startDate: record.startDate,
  endDate: record.endDate,
  registrationDeadline: '',
  maxCapacity: 0,
  capacityUnit: 'People',
  hardConstraints: [],
  optionalActivities: [],
  baseFeePerAdult: null,
  baseFeePerChild: null,
  currency: 'USD',
  paymentInstructions: { zh: '', en: '' },
  refundPolicy: { zh: '', en: '' },
  paymentEvidenceRequired: false,
  financeLeaderConfirmed: false,
  posterImageUrl: null,
  galleryUrls: [],
  legacySummary: null,
  contactProfileIds: record.contactProfileIds ?? [],
  enabledModules: record.enabledModules ?? [],
  ram: createEmptyEventRamDraft(),
})

const getDraftFromRecord = (record: GroupEventRecord): EventDto => {
  try {
    const parsed = JSON.parse(record.eventDataJson) as EventDto
    if (parsed && parsed.title && parsed.description && parsed.locationName) {
      const draft = {
        ...parsed,
        id: record.id,
        visibility: parsed.visibility ?? record.visibility ?? 'groupVisible',
        personResponsible: parsed.personResponsible || parsed.organizerDisplayName || '',
        purpose: parsed.purpose ?? { zh: '', en: '' },
        contactProfileIds: record.contactProfileIds ?? parsed.contactProfileIds ?? [],
        enabledModules: record.enabledModules ?? parsed.enabledModules ?? [],
      }
      return { ...draft, ram: parsed.ram ?? createEmptyEventRamDraft(draft) }
    }
  } catch {
    // no-op
  }

  return fallbackDraftFromRecord(record)
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
  const assistantModule = assistantModuleCopy[searchParams.get('module') ?? '']
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
  const [aiAssistanceUsed, setAiAssistanceUsed] = useState(false)
  const [aiDraftReviewed, setAiDraftReviewed] = useState(false)
  const [recoveredDraftNotice, setRecoveredDraftNotice] = useState<{ updatedAt: string } | null>(null)
  const [draftResetting, setDraftResetting] = useState(false)
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
  const [activeTab, setActiveTab] = useState<EventEditorTab>(() => {
    const requestedStep = searchParams.get('step')
    return requestedStep === 'assistant' || requestedStep === 'notice' || requestedStep === 'ram'
      ? requestedStep
      : 'setup'
  })
  const [noticeSubmitted, setNoticeSubmitted] = useState(false)
  const [ramHasLocalChanges, setRamHasLocalChanges] = useState(false)
  const [ramStatus, setRamStatus] = useState<EventRamStatus>('draft')
  const [ramSubmittedByMemberId, setRamSubmittedByMemberId] = useState<string | null>(null)
  const [ramBusy, setRamBusy] = useState(false)
  const [ramMessage, setRamMessage] = useState('')
  const [ramAutosaveStatus, setRamAutosaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [ramLastSavedAt, setRamLastSavedAt] = useState<string | null>(null)
  const [ramAutosaveInFlight, setRamAutosaveInFlight] = useState(false)
  const [aiContentContext, setAiContentContext] = useState<AiContentContext>({ missionStatements: [], eventContext: null })
  const [sessionContextEventId, setSessionContextEventId] = useState('')
  const [ramSessionContextEventId, setRamSessionContextEventId] = useState('')
  const [sessionContextRevision, setSessionContextRevision] = useState(0)
  const targetEventId = eventId ?? savedEventId
  const ramDraftJson = useMemo(() => eventDraft?.ram ? JSON.stringify(eventDraft.ram) : '', [eventDraft?.ram])
  const hasUnsavedRamNavigationChanges = Boolean(targetEventId && ramHasLocalChanges)
  const unsavedRamNavigationMessage = language === 'zh'
    ? 'RAM 有尚未保存的更改。离开后这些更改会丢失，是否仍要离开？'
    : 'The RAM has unsaved changes. They will be lost if you leave. Leave without saving?'
  const canEditRam = Boolean(effectiveGroupId && canManageGroup(effectiveGroupId))
  const canAuditRam = hasAdminPermission('admin.events.audit')
  const sessionId = useMemo(
    () => eventPlanningSessionService.getSessionId(me?.id, eventId),
    [eventId, me?.id],
  )
  const initializedSessionScopesRef = useRef(new Set<string>())
  const initialSessionHydratedRef = useRef('')
  const ramBrowserBackGuardRegisteredRef = useRef(false)
  const ramBrowserBackAllowedRef = useRef(false)
  const latestRamDraftJsonRef = useRef(ramDraftJson)
  const ramAutosavePromiseRef = useRef<Promise<void> | null>(null)
  const ramAutosaveFailedJsonRef = useRef('')
  const posterInputRef = useRef<HTMLInputElement>(null)
  const referencePosterInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    latestRamDraftJsonRef.current = ramDraftJson
  }, [ramDraftJson])

  useEffect(() => {
    if (!targetEventId || !eventDraft?.ram || !ramHasLocalChanges || ramBusy || ramAutosaveInFlight || ramAutosaveFailedJsonRef.current === ramDraftJson) {
      return
    }

    setRamAutosaveStatus('pending')
    const ramSnapshot: EventRamDraft = eventDraft.ram
    const snapshotJson = ramDraftJson
    const timeoutId = window.setTimeout(() => {
      let task: Promise<void> | null = null
      task = (async () => {
        setRamAutosaveInFlight(true)
        setRamAutosaveStatus('saving')
        try {
          const record = await eventService.saveEventRam(targetEventId, ramSnapshot)
          ramAutosaveFailedJsonRef.current = ''
          setRamStatus(record.status)
          setRamSubmittedByMemberId(record.submittedByMemberId ?? null)
          setRamLastSavedAt(record.updatedUtc)
          setSessionContextRevision((current) => current + 1)
          if (latestRamDraftJsonRef.current === snapshotJson) {
            setRamHasLocalChanges(false)
            setRamAutosaveStatus('saved')
          } else {
            setRamAutosaveStatus('pending')
          }
        } catch {
          ramAutosaveFailedJsonRef.current = snapshotJson
          setRamAutosaveStatus('error')
        } finally {
          if (ramAutosavePromiseRef.current === task) {
            ramAutosavePromiseRef.current = null
          }
          setRamAutosaveInFlight(false)
        }
      })()
      ramAutosavePromiseRef.current = task
    }, 1500)

    return () => window.clearTimeout(timeoutId)
  }, [eventDraft?.ram, ramAutosaveInFlight, ramBusy, ramDraftJson, ramHasLocalChanges, targetEventId])

  useEffect(() => {
    setUnsavedChangesGuard(hasUnsavedRamNavigationChanges, unsavedRamNavigationMessage, 'confirm')
    return () => setUnsavedChangesGuard(false)
  }, [hasUnsavedRamNavigationChanges, unsavedRamNavigationMessage])

  useEffect(() => {
    if (!hasUnsavedRamNavigationChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedRamNavigationChanges])

  useEffect(() => {
    if (!hasUnsavedRamNavigationChanges) {
      ramBrowserBackGuardRegisteredRef.current = false
      ramBrowserBackAllowedRef.current = false
      return
    }

    if (!ramBrowserBackGuardRegisteredRef.current) {
      window.history.pushState({ alifeUnsavedEventRamGuard: true }, '', window.location.href)
      ramBrowserBackGuardRegisteredRef.current = true
    }

    const handlePopState = () => {
      if (ramBrowserBackAllowedRef.current) {
        ramBrowserBackAllowedRef.current = false
        return
      }

      const continueNavigation = () => {
        ramBrowserBackAllowedRef.current = true
        setUnsavedChangesGuard(false)
        window.history.back()
      }

      if (confirmUnsavedChangesNavigation(undefined, continueNavigation)) {
        continueNavigation()
        return
      }

      window.history.pushState({ alifeUnsavedEventRamGuard: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hasUnsavedRamNavigationChanges])
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
    setState: setSessionState,
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
    if (!sessionState) {
      return
    }

    const isInitialHydration = initialSessionHydratedRef.current !== sessionId
    if (isInitialHydration) {
      initialSessionHydratedRef.current = sessionId
    }

    if (sessionState.draft) {
      setEventDraft((current) => ({
        ...sessionState.draft!,
        visibility: sessionState.draft?.visibility ?? current?.visibility ?? 'groupVisible',
      }))
      setRamHasLocalChanges(true)
    }
    setAiInsight(sessionState?.context ?? null)
    if (isInitialHydration && sessionState?.context) {
      setAiAssistanceUsed(true)
      setAiDraftReviewed(false)
    }

    if (isInitialHydration && hasRecoverableEventSession(sessionState)) {
      setRecoveredDraftNotice({ updatedAt: sessionState.updatedAt })
      const restoredMessages: ChatMessage[] = [createIntroMessage(t('eventAssistantIntro'))]
      sessionState.chatHistory
        .filter((message) => message.role === 'user')
        .forEach((message) => restoredMessages.push({ role: 'user', text: message.text }))
      const restoredInsight = sessionState.context
        ? ((language === 'zh' ? sessionState.context.zh : sessionState.context.en)
          || sessionState.context.en
          || sessionState.context.zh)
        : ''
      if (restoredInsight) {
        restoredMessages.push({ role: 'assistant', text: restoredInsight, markdown: true })
      }
      setMessages(restoredMessages)
    }
  }, [isEditMode, language, sessionId, sessionState, t])

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
    ramAutosaveFailedJsonRef.current = ''
    setRamLastSavedAt(null)
    setRamAutosaveStatus('idle')
    if (eventFromNavigationState && eventFromNavigationStateId === eventIdValue) {
      const draft = getDraftFromRecord(eventFromNavigationState)
      setError('')
      setEventDraft(draft)
      setSessionContextEventId(eventIdValue)
      setNoticeSubmitted(true)
      setRamStatus(eventFromNavigationState.ramStatus ?? 'draft')
      setRamHasLocalChanges(false)
      setAiInsight(draft.legacySummary ?? null)
      setAiAssistanceUsed(false)
      setAiDraftReviewed(false)
      eventService.getEventRam(eventFromNavigationState.id)
        .then((ramRecord) => {
          if (cancelled) return
          setRamStatus(ramRecord.status)
          setRamSubmittedByMemberId(ramRecord.submittedByMemberId ?? null)
          setRamLastSavedAt(ramRecord.updatedUtc)
          setRamAutosaveStatus('saved')
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
        setAiAssistanceUsed(false)
        setAiDraftReviewed(false)
        eventService.getEventRam(record.id)
          .then((ramRecord) => {
            if (cancelled) return
            setRamStatus(ramRecord.status)
            setRamSubmittedByMemberId(ramRecord.submittedByMemberId ?? null)
            setRamLastSavedAt(ramRecord.updatedUtc)
            setRamAutosaveStatus('saved')
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

    if (!isEditMode && !sessionState) {
      return
    }

    if (!isEditMode && hasRecoverableEventSession(sessionState)) {
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
  }, [activeTab, aiAppContext, eventDraft, eventIdValue, isEditMode, ramSessionContextEventId, sessionContextEventId, sessionContextRevision, sessionId, sessionState])

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
        setEventDraft((current) => {
          const previousFinance = current ? JSON.stringify({
            adult: current.baseFeePerAdult, child: current.baseFeePerChild, currency: current.currency,
            options: current.optionalActivities, payment: current.paymentInstructions,
            refund: current.refundPolicy, evidence: current.paymentEvidenceRequired,
          }) : ''
          const nextFinance = JSON.stringify({
            adult: dto.baseFeePerAdult, child: dto.baseFeePerChild, currency: dto.currency,
            options: dto.optionalActivities, payment: dto.paymentInstructions,
            refund: dto.refundPolicy, evidence: dto.paymentEvidenceRequired,
          })
          const nextEnabledModules = current ? selectedOptionalModules(current) : dto.enabledModules ?? []
          return {
          ...dto,
          visibility: current?.visibility ?? dto.visibility ?? 'groupVisible',
          publicationStatus: current?.publicationStatus ?? dto.publicationStatus ?? 'draft',
          organizerDisplayName: dto.organizerDisplayName || current?.organizerDisplayName || me?.displayName || '',
          personResponsible: dto.personResponsible || current?.personResponsible || me?.displayName || '',
          purpose: dto.purpose && (dto.purpose.zh.trim() || dto.purpose.en.trim())
            ? dto.purpose
            : current?.purpose ?? { zh: '', en: '' },
          posterImageUrl: current?.posterImageUrl || dto.posterImageUrl || null,
          contactProfileIds: current?.contactProfileIds ?? dto.contactProfileIds ?? [],
          enabledModules: nextEnabledModules,
          requiresRoster: nextEnabledModules.includes('roster'),
          ram: dto.ram ?? current?.ram ?? createEmptyEventRamDraft(dto),
          financeLeaderConfirmed: previousFinance && previousFinance === nextFinance
            ? current?.financeLeaderConfirmed ?? false
            : false,
        }})
        setSaveStatus('idle')
        setNoticeSubmitted(false)
        setRamStatus('draft')
        setRamHasLocalChanges(true)
        setAiInsight(nextInsight)
        setAiAssistanceUsed(true)
        setAiDraftReviewed(false)
        const lang = language === 'zh' ? dto.title.zh : dto.title.en
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: nextInsight
              ? ((language === 'zh' ? nextInsight.zh : nextInsight.en) || nextInsight.en || nextInsight.zh)
              : t('eventExtracted', { name: lang || t('yourEvent') }),
            markdown: Boolean(nextInsight),
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
        ? (language === 'zh' ? 'AI 已读取海报；请到“AI 协助”查看整理结果。' : 'AI read the poster. Review the organized result in AI assistance.')
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
      setAiAssistanceUsed(true)
      setAiDraftReviewed((current) => current || !aiAssistanceUsed)
    } catch (reason) {
      setPosterGenerationStatus('error')
      setPosterGenerationMessage(normalizeApiError(reason).message)
    }
  }

  const handleCommitDraft = async () => {
    if (!eventDraft) {
      return
    }
    if (aiAssistanceUsed && !aiDraftReviewed) {
      setError(language === 'zh' ? '请先核对 AI 写入的草稿，并完成人工确认。' : 'Review the AI-assisted draft and confirm it before saving.')
      openEditorStep('assistant')
      return
    }

    const draftForCommit: EventDto = { ...eventDraft, publicationStatus: 'published' }
    const eventName = (language === 'zh' ? draftForCommit.title.zh : draftForCommit.title.en) || draftForCommit.title.en || draftForCommit.title.zh || t('yourEvent')

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
        let draftToSave = draftForCommit
        if (pendingPosterFile) {
          if (!effectiveGroupId) {
            throw new Error(t('missingGroupForEvent'))
          }
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, targetEventId)
          draftToSave = { ...draftForCommit, posterImageUrl }
          setEventDraft(draftToSave)
        }
        await eventService.updateGroupEvent(
          targetEventId,
          draftToSave,
          sessionId,
          { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
          aiAssistanceUsed && aiDraftReviewed,
        )
      } else if (effectiveGroupId) {
        const created = await eventService.createGroupEvent(
          effectiveGroupId,
          pendingPosterFile ? { ...draftForCommit, posterImageUrl: null } : draftForCommit,
          pendingPosterFile ? undefined : sessionId,
          {
            ...aiContentContext,
            eventContext: createEventContextFromDto(pendingPosterFile ? { ...draftForCommit, posterImageUrl: null } : draftForCommit),
          },
          aiAssistanceUsed && aiDraftReviewed,
        )
        setSavedEventId(created.id)
        persistedEventId = created.id
        activeEntityService.setEvent(created.id)

        if (pendingPosterFile) {
          const posterImageUrl = await uploadPosterFile(pendingPosterFile, effectiveGroupId, created.id)
          const draftToSave = { ...draftForCommit, id: created.id, posterImageUrl }
          setEventDraft(draftToSave)
          await eventService.updateGroupEvent(
            created.id,
            draftToSave,
            sessionId,
            { ...aiContentContext, eventContext: createEventContextFromDto(draftToSave) },
            false,
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
      setAiAssistanceUsed(false)
      setAiDraftReviewed(false)
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
      if (persistedEventId && effectiveGroupId) {
        const explicitGroupRoute = Boolean(routeGroupId || searchParams.get('groupId'))
        navigate(`${buildScopedEventDetailPath(effectiveGroupId, persistedEventId, explicitGroupRoute)}?section=workflow`, { replace: true })
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
    setRamAutosaveStatus('saving')
    try {
      if (ramAutosavePromiseRef.current) {
        await ramAutosavePromiseRef.current
      }
      const record = await eventService.saveEventRam(targetEventId, eventDraft.ram)
      ramAutosaveFailedJsonRef.current = ''
      setRamStatus(record.status)
      setRamSubmittedByMemberId(record.submittedByMemberId ?? null)
      setRamHasLocalChanges(false)
      setRamLastSavedAt(record.updatedUtc)
      setRamAutosaveStatus('saved')
      setSessionContextRevision((current) => current + 1)
      setRamMessage(language === 'zh' ? 'RAM 草稿已保存。' : 'RAM draft saved.')
    } catch (reason) {
      ramAutosaveFailedJsonRef.current = latestRamDraftJsonRef.current
      setRamAutosaveStatus('error')
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
      if (ramAutosavePromiseRef.current) {
        await ramAutosavePromiseRef.current
      }
      const savedRecord = await eventService.saveEventRam(targetEventId, eventDraft.ram)
      ramAutosaveFailedJsonRef.current = ''
      setRamLastSavedAt(savedRecord.updatedUtc)
      setRamHasLocalChanges(false)
      setRamAutosaveStatus('saved')
      const record = await eventService.submitEventRam(targetEventId)
      setRamStatus(record.status)
      setRamSubmittedByMemberId(record.submittedByMemberId ?? null)
      setRamMessage(language === 'zh' ? 'RAM 已提交审核。' : 'RAM sent for review.')
    } catch (reason) {
      setRamMessage(normalizeApiError(reason).message)
    } finally {
      setRamBusy(false)
    }
  }

  const handleApproveRam = async (decisionNotes: string) => {
    if (!targetEventId) return
    setRamBusy(true)
    setRamMessage('')
    try {
      if (ramAutosavePromiseRef.current) {
        await ramAutosavePromiseRef.current
      }
      const record = await eventService.approveEventRam(targetEventId, decisionNotes)
      setRamStatus(record.status)
      setRamSubmittedByMemberId(record.submittedByMemberId ?? null)
      setRamHasLocalChanges(false)
      setRamLastSavedAt(record.updatedUtc)
      setRamAutosaveStatus('saved')
      setRamMessage(language === 'zh' ? 'RAM 已批准，活动现在可以进入近期活动。' : 'RAM approved. The event can now appear as upcoming.')
    } catch (reason) {
      setRamMessage(normalizeApiError(reason).message)
    } finally {
      setRamBusy(false)
    }
  }

  const handleReturnRam = async (decisionNotes: string) => {
    if (!targetEventId) return
    setRamBusy(true)
    setRamMessage('')
    try {
      const record = await eventService.returnEventRam(targetEventId, decisionNotes)
      setRamStatus(record.status)
      setRamSubmittedByMemberId(record.submittedByMemberId ?? null)
      setRamHasLocalChanges(false)
      setRamLastSavedAt(record.updatedUtc)
      setRamAutosaveStatus('saved')
      setEventDraft((current) => current ? { ...current, ram: parseEventRam(record) } : current)
      setRamMessage(language === 'zh' ? 'RAM 已退回修改，负责人需要处理审核意见并重新确认后提交。' : 'RAM returned for changes. The leader must address the review notes, confirm the facts again, and resubmit.')
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
  const enabledOptionalModules = eventDraft ? selectedOptionalModules(eventDraft) : []
  const ramModuleEnabled = enabledOptionalModules.includes('ram')
  const setupBriefReady = Boolean(
    effectiveGroupId
    && posterHasRequiredBrief
    && eventDraft
    && hasText(eventDraft.personResponsible)
    && hasText(eventDraft.startDate)
    && hasText(eventDraft.endDate)
    && Date.parse(eventDraft.endDate) > Date.parse(eventDraft.startDate),
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
  const assistantMissingDetails = [...new Set(noticeIssues)].map((issue) => getNoticeIssueLabel(issue, language))
  const assistantDetailsReady = assistantMissingDetails.length === 0
  const aiReviewComplete = !aiAssistanceUsed || aiDraftReviewed
  const assistantCanContinue = assistantDetailsReady && aiReviewComplete
  const noticeRemainingCount = noticeIssues.length + (aiReviewComplete ? 0 : 1)
  const noticeCanSubmit = noticeIssues.length === 0 && canEditRam && aiReviewComplete
  const ramIssues = eventDraft?.ram ? getEventRamSubmissionIssues(eventDraft.ram, Boolean(targetEventId)) : ['ram']
  const ramCanSubmit = ramIssues.length === 0 && canEditRam
  const ramSubmitted = !ramHasLocalChanges && (ramStatus === 'awaitingReview' || ramStatus === 'approved')
  const ramSubmittedDetail = ramStatus === 'approved'
    ? (language === 'zh' ? '已批准' : 'Approved')
    : ramStatus === 'awaitingReview'
      ? (language === 'zh' ? '已提交审核' : 'Submitted for review')
      : undefined
  const tabs: Array<{ id: EventEditorTab; label: string; icon: React.ReactNode; ready?: boolean; submitted?: boolean }> = [
    { id: 'setup', label: language === 'zh' ? '基本资料' : 'Basic details', icon: <BookOpenText className="h-4 w-4" />, ready: setupBriefReady },
    { id: 'assistant', label: language === 'zh' ? 'AI 协助' : 'AI assistance', icon: <Sparkles className="h-4 w-4" />, ready: assistantCanContinue },
    { id: 'notice', label: language === 'zh' ? '通知与海报' : 'Notice & poster', icon: <FileText className="h-4 w-4" />, ready: noticeCanSubmit, submitted: noticeSubmitted },
    ...(targetEventId && ramModuleEnabled ? [{ id: 'ram' as const, label: language === 'zh' ? '风险评估' : 'Risk assessment', icon: <ShieldCheck className="h-4 w-4" />, ready: ramCanSubmit, submitted: ramSubmitted }] : []),
  ]

  useEffect(() => {
    if (activeTab === 'ram' && eventDraft && !ramModuleEnabled) setActiveTab('setup')
  }, [activeTab, eventDraft, ramModuleEnabled])

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

  const handleDiscardRecoveredDraft = async () => {
    const confirmed = window.confirm(language === 'zh'
      ? '确定放弃已找回的活动草稿并重新开始吗？此操作无法撤销。'
      : 'Discard the recovered event draft and start again? This cannot be undone.')
    if (!confirmed) return

    setDraftResetting(true)
    setError('')
    try {
      await eventService.closeSession(sessionId)
      const freshDraft = createInitialEventDraft(me?.displayName)
      const updatedAt = new Date().toISOString()
      initializedSessionScopesRef.current.clear()
      initialSessionHydratedRef.current = sessionId
      setRecoveredDraftNotice(null)
      setEventDraft(freshDraft)
      setAiInsight(null)
      setAiAssistanceUsed(false)
      setAiDraftReviewed(false)
      setMessages([createIntroMessage(t('eventAssistantIntro'))])
      setInput('')
      setNoticeSubmitted(false)
      setSaveStatus('idle')
      setRamStatus('draft')
      setRamHasLocalChanges(false)
      ramAutosaveFailedJsonRef.current = ''
      setRamLastSavedAt(null)
      setRamAutosaveStatus('idle')
      setSessionState({
        sessionId,
        draft: freshDraft,
        context: null,
        appContext: baseAiAppContext,
        chatHistory: [],
        updatedAt,
      })
      setActiveTab('setup')
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setDraftResetting(false)
    }
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
      setAiAssistanceUsed(true)
      setAiDraftReviewed(false)
    } catch (reason) {
      setBriefTranslationStatus('error')
      setBriefTranslationMessage(normalizeApiError(reason).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[#2f4b42]/10 bg-[linear-gradient(125deg,rgba(255,255,255,0.96),rgba(235,247,241,0.88))] px-5 py-5 shadow-[0_18px_50px_rgba(31,56,48,0.08)] sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full border border-emerald-700/10 bg-emerald-500/[0.04]" />
        <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{isEditMode ? t('edit') : t('createEvent')}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{isEditMode ? (language === 'zh' ? '编辑活动' : 'Edit event') : (language === 'zh' ? '创建活动' : 'Create event')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {language === 'zh'
            ? '直接填写或修改活动资料和时间，只加入本次真正需要的筹备项目；需要时再让 AI 协助整理。'
            : 'Enter or change event details and time directly, add only the preparation this event needs, and use AI assistance when helpful.'}
        </p>
        {!isEditMode ? <ol className="mt-5 grid border-t border-[#2f4b42]/10 pt-4 sm:grid-cols-3 sm:divide-x sm:divide-[#2f4b42]/10">
          <li className="py-2 sm:pr-5"><span className="text-[11px] font-black tracking-[0.14em] text-emerald-700">01 · {language === 'zh' ? '活动本身' : 'Event'}</span><p className="mt-1 text-sm font-bold text-slate-900">{language === 'zh' ? '填写名称和可修改的时间' : 'Enter the name and editable time'}</p></li>
          <li className="py-2 sm:px-5"><span className="text-[11px] font-black tracking-[0.14em] text-emerald-700">02 · {language === 'zh' ? '按需筹备' : 'Preparation'}</span><p className="mt-1 text-sm font-bold text-slate-900">{language === 'zh' ? '只勾选这次真正需要的项目' : 'Select only what this event needs'}</p></li>
          <li className="py-2 sm:pl-5"><span className="text-[11px] font-black tracking-[0.14em] text-emerald-700">03 · {language === 'zh' ? '分别办理' : 'Workspaces'}</span><p className="mt-1 text-sm font-bold text-slate-900">{language === 'zh' ? '保存后进入所选项目继续办理' : 'Save, then continue in selected workspaces'}</p></li>
        </ol> : null}
        </div>
      </header>

      {!isEditMode && recoveredDraftNotice ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm" aria-live="polite">
          <div>
            <p className="font-black text-amber-950">{language === 'zh' ? '已找回未提交的活动草稿' : 'Recovered an unsaved event draft'}</p>
            <p className="mt-1 text-sm text-amber-800">
              {language === 'zh' ? '活动资料和 AI 整理结果已经恢复。' : 'Event details and the AI summary have been restored.'}
              {' · '}
              {new Date(recoveredDraftNotice.updatedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-NZ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRecoveredDraftNotice(null)
                openEditorStep(aiInsight ? 'assistant' : 'setup')
              }}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-800"
            >
              {language === 'zh' ? '继续编辑' : 'Continue editing'}
            </button>
            <button
              type="button"
              onClick={() => { void handleDiscardRecoveredDraft() }}
              disabled={draftResetting}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {draftResetting ? (language === 'zh' ? '正在清除…' : 'Clearing…') : (language === 'zh' ? '放弃并重新开始' : 'Discard and start again')}
            </button>
          </div>
        </section>
      ) : null}

      <div className="sticky top-3 z-20 overflow-x-auto rounded-2xl border border-[#2f4b42]/10 bg-white/90 p-2 shadow-[0_10px_30px_rgba(31,56,48,0.10)] backdrop-blur" role="tablist" aria-label={language === 'zh' ? '活动编辑步骤' : 'Event editor steps'}>
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
        {eventDraft ? (
          <section className="space-y-5 rounded-2xl border border-[#2f4b42]/10 bg-white/90 p-5 shadow-[0_10px_30px_rgba(31,56,48,0.06)]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{language === 'zh' ? '基本资料' : 'Event details'}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{language === 'zh' ? '填写这次活动的资料' : 'Enter this event’s details'}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{language === 'zh' ? '先确认活动归属、可见范围、名称和时间；下方再选择本次需要的筹备项目。' : 'Confirm ownership, visibility, name and time here, then choose the preparation needed below.'}</p>
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

            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <legend className="px-1 text-sm font-black text-slate-950">
                {language === 'zh' ? '谁可以看到这个活动？' : 'Who can see this event?'}
              </legend>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {language === 'zh'
                  ? '活动正式发布后会按这里的范围展示。若本次活动加入了风险评估，则还要完成相应审核。'
                  : 'This scope applies after publication. If risk assessment is added, its review must also be completed.'}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {([
                  {
                    value: 'groupVisible' as const,
                    title: CurrentGroup?.isChurch
                      ? (language === 'zh' ? '教会内可见' : 'Church members')
                      : (language === 'zh' ? '小组内可见' : 'Group members'),
                    description: CurrentGroup?.isChurch
                      ? (language === 'zh' ? '仅已批准的教会成员可以查看。' : 'Only approved church members can view it.')
                      : (language === 'zh' ? '仅本小组已批准成员可以查看。' : 'Only approved members of this group can view it.'),
                  },
                  ...(!CurrentGroup?.isChurch ? [{
                    value: 'churchVisible' as const,
                    title: language === 'zh' ? '教会内可见' : 'Church members',
                    description: language === 'zh' ? '本小组成员及所属教会成员可以查看。' : 'Members of this group and its church can view it.',
                  }] : []),
                  {
                    value: 'public' as const,
                    title: language === 'zh' ? '公开可见' : 'Public',
                    description: language === 'zh' ? '任何访客都可查看，并可显示在公开首页活动卡片中。' : 'Anyone can view it, and it can appear in public homepage event cards.',
                  },
                ]).map((option) => {
                  const selected = (eventDraft.visibility ?? 'groupVisible') === option.value
                  return (
                    <label
                      key={option.value}
                      className={[
                        'cursor-pointer rounded-xl border p-3 transition',
                        selected ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-950">
                        <input
                          type="radio"
                          name="event-visibility"
                          value={option.value}
                          checked={selected}
                          onChange={() => updateSetupDraft({ visibility: option.value })}
                          className="h-4 w-4 accent-emerald-700"
                        />
                        {option.title}
                      </span>
                      <span className="mt-2 block pl-6 text-xs leading-5 text-slate-500">{option.description}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

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

            <section id="event-time" className="scroll-mt-28 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-emerald-700 p-2 text-white"><CalendarClock className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="font-black text-slate-950">{language === 'zh' ? '活动时间' : 'Event time'}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{language === 'zh' ? '不使用系统默认时间。请直接选择开始和结束时间，之后仍可回到这里修改。' : 'No system time is assumed. Choose the start and end directly, and return here whenever they need changing.'}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  {language === 'zh' ? '开始时间' : 'Start time'}
                  <input type="datetime-local" value={toLocalDateTimeInput(eventDraft.startDate)} onChange={(event) => updateSetupDraft({ startDate: fromLocalDateTimeInput(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  {language === 'zh' ? '结束时间' : 'End time'}
                  <input type="datetime-local" value={toLocalDateTimeInput(eventDraft.endDate)} onChange={(event) => updateSetupDraft({ endDate: fromLocalDateTimeInput(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
              </div>
              {eventDraft.startDate && eventDraft.endDate && Date.parse(eventDraft.endDate) <= Date.parse(eventDraft.startDate) ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-rose-700"><CircleAlert className="h-4 w-4" />{language === 'zh' ? '结束时间必须晚于开始时间。' : 'The end time must be later than the start time.'}</p>
              ) : null}
            </section>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <summary className="cursor-pointer text-sm font-black text-slate-800">{language === 'zh' ? '活动地点说明（可选）' : 'Event location text (optional)'}</summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">{language === 'zh' ? '这里填写给参加者看的地点文字，不会自动加入“教会场地申请”。需要申请教会场地时，请在下方另行选择。' : 'This is the location shown to attendees. It does not add a church venue request; select that module separately below when needed.'}</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {(['zh', 'en'] as const).map((lang) => (
                  <label key={lang} className="text-sm font-bold text-slate-700">
                    {language === 'zh' ? '地点' : 'Location'} ({lang})
                    <input value={eventDraft.locationName[lang]} onChange={(event) => updateSetupDraft({ locationName: { ...eventDraft.locationName, [lang]: event.target.value } })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  </label>
                ))}
              </div>
            </details>

            <fieldset id="event-module-selector" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4">
              <legend className="px-1 text-base font-black text-slate-950">{language === 'zh' ? '这次活动还需要哪些筹备？' : 'What else does this event need?'}</legend>
              <p className="mt-1 text-sm leading-6 text-slate-600">{language === 'zh' ? '全部默认不选。只有你勾选的项目才会出现在活动流程中，保存后也可以回来增减。' : 'Nothing is selected by default. Only checked items appear in the plan, and you can add or remove them later.'}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {([
                  { key: 'venue' as const, icon: Building2, zh: '申请教会场地', en: 'Request a church venue', zhDetail: '从管理员维护的场地目录中申请；不是普通地点说明。', enDetail: 'Request from the maintained venue catalog; separate from location text.' },
                  { key: 'registration' as const, icon: UsersRound, zh: '开放报名', en: 'Open registration', zhDetail: '设置容量、截止时间和报名资料。', enDetail: 'Set capacity, deadline and participant details.' },
                  { key: 'finance' as const, icon: WalletCards, zh: '费用与财务', en: 'Fees and finance', zhDetail: '需要预算、收费、付款或活动后对账时加入。', enDetail: 'Add for budgets, charges, payments or reconciliation.' },
                  { key: 'ram' as const, icon: ShieldCheck, zh: '风险评估（RAM）', en: 'Risk assessment (RAM)', zhDetail: '确实需要风险整理和人工审核时加入。', enDetail: 'Add when risk preparation and human review are needed.' },
                  { key: 'roster' as const, icon: UsersRound, zh: '同工排班', en: 'Volunteer roster', zhDetail: '需要岗位、班次和人员确认时加入。', enDetail: 'Add for roles, shifts and person-by-person confirmation.' },
                  { key: 'programme' as const, icon: ClipboardList, zh: '程序单与岗位交接', en: 'Programme and handover', zhDetail: '需要当天时间轴、环节负责人或岗位交接时加入。', enDetail: 'Add for an event-day timeline, item owners and operational handovers.' },
                ]).map((option) => {
                  const selected = enabledOptionalModules.includes(option.key)
                  const Icon = option.icon
                  return (
                    <label key={option.key} className={['flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition', selected ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-slate-50 hover:border-emerald-300'].join(' ')}>
                      <input type="checkbox" checked={selected} onChange={() => {
                        const next = selected ? enabledOptionalModules.filter((key) => key !== option.key) : [...enabledOptionalModules, option.key]
                        updateSetupDraft({ enabledModules: next, requiresRoster: next.includes('roster') })
                      }} className="mt-1 h-4 w-4 accent-emerald-700" />
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                      <span><span className="block text-sm font-black text-slate-950">{language === 'zh' ? option.zh : option.en}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{language === 'zh' ? option.zhDetail : option.enDetail}</span></span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

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

            <details
              className="group rounded-xl border border-slate-200 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <h3 className="font-black text-slate-950">{language === 'zh' ? '活动联系人（可选）' : 'Event contacts (optional)'}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {language === 'zh'
                      ? '选择需要显示在活动详情中的联系人；这不会影响进入下一步。'
                      : 'Choose contacts to display on the event detail page. This does not block the next step.'}
                  </p>
                  {eventDraft.contactProfileIds?.length ? (
                    <p className="mt-2 text-xs font-bold text-emerald-700">
                      {language === 'zh'
                        ? `已选择 ${eventDraft.contactProfileIds.length} 位联系人`
                        : `${eventDraft.contactProfileIds.length} contact(s) selected`}
                    </p>
                  ) : null}
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" />
              </summary>

              <div className="space-y-5 border-t border-slate-200 px-4 py-5">
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
              </div>
            </details>

            <details id="event-poster-workspace" className="group scroll-mt-28 overflow-hidden rounded-xl border border-violet-200 bg-violet-50/40 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{language === 'zh' ? '独立海报功能' : 'Independent poster feature'}</p>
                  <h3 className="mt-1 font-black text-slate-950">{language === 'zh' ? '活动海报（可选，不影响筹备项目）' : 'Event poster (optional and separate from preparation)'}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{language === 'zh' ? '点击展开后可上传现有海报、读取参考海报或生成 AI 草案。' : 'Expand to upload a poster, read a reference poster, or generate an AI draft.'}</p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-violet-700 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-violet-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{language === 'zh' ? '独立海报工作区' : 'Independent poster workspace'}</p>
                  <h3 className="mt-1 font-black text-slate-950">{language === 'zh' ? '活动海报与 AI 生成' : 'Event poster and AI generation'}</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{language === 'zh' ? '选好筹备流程后，你仍可在这里上传现有海报、读取旧海报，或根据活动资料生成新的 AI 海报草案。' : 'After choosing a preparation workflow, you can still upload a current poster, read an old poster, or generate a new AI poster draft from the event details.'}</p>
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
            </details>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="max-w-2xl">
                <p className="font-black text-sky-950">{language === 'zh' ? '第一步之后怎么做？' : 'What comes after step 1?'}</p>
                <p className="mt-1 text-sm leading-6 text-sky-800">
                  {setupBriefReady
                    ? (language === 'zh' ? '基础资料已经齐全。进入第二步，与 AI 一起补齐时间、地点和活动内容等共同资料。' : 'The starting brief is ready. Continue to step 2 and use AI to complete timing, venue and other shared event facts.')
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

      <div id="event-editor-panel-assistant" role="tabpanel" aria-labelledby="event-editor-tab-assistant" hidden={activeTab !== 'assistant'}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.75fr)] lg:items-start">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(31,56,48,0.06)]" aria-labelledby="event-ai-workspace-title">
            <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="event-ai-workspace-title" className="font-black text-slate-950">{language === 'zh' ? 'AI 活动助理' : 'AI event assistant'}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {language === 'zh' ? 'AI 会把建议写入可编辑草稿，但不会替你提交或批准；进入下一步前请检查改动。' : 'AI writes suggestions into an editable draft but never submits or approves them. Review changes before continuing.'}
                </p>
              </div>
            </header>

            {assistantModule ? (
              <div className="border-b border-violet-200 bg-violet-50 px-4 py-4 sm:px-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{language === 'zh' ? '当前协助项目' : 'Current assistance'}</p>
                <h3 className="mt-1 font-black text-violet-950">{localizeText(assistantModule.name, language)}</h3>
                <p className="mt-1 text-xs leading-5 text-violet-800">{language === 'zh' ? '选择一个具体请求，AI 只会生成待确认建议；场地选择、人员安排、提交和审批仍由有权限的人完成。' : 'Choose a specific request. AI produces a suggestion only; authorized people still choose venues, assign people, submit and approve.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(language === 'zh' ? assistantModule.prompts.zh : assistantModule.prompts.en).map((prompt) => (
                    <button key={prompt} type="button" onClick={() => { setInput(prompt); window.requestAnimationFrame(() => textareaRef.current?.focus()) }} className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-left text-xs font-bold text-violet-900 transition hover:bg-violet-100">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex max-h-[52vh] min-h-[23rem] flex-col gap-3 overflow-y-auto bg-slate-50/80 p-4 sm:p-5" aria-live="polite">
              {messages.map((msg, i) => (
                <div key={i} className={['max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed', msg.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'mr-auto border border-slate-200 bg-white text-slate-800 shadow-sm'].join(' ')}>
                  <div className={['mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide', msg.role === 'user' ? 'justify-end text-emerald-100' : 'text-violet-700'].join(' ')}>
                    {msg.role === 'user' ? <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> : <Bot className="h-3.5 w-3.5" aria-hidden="true" />}
                    {msg.role === 'user' ? (language === 'zh' ? '你' : 'You') : (language === 'zh' ? 'AI 整理' : 'AI summary')}
                  </div>
                  {msg.markdown && msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>, ul: ({ children }) => <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>, ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>, li: ({ children }) => <li className="mb-1">{children}</li>, code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{children}</code> }}>{msg.text}</ReactMarkdown>
                  ) : msg.text.split('\n').map((line, j) => <span key={j}>{line}{j < msg.text.split('\n').length - 1 && <br />}</span>)}
                </div>
              ))}
              {isSending ? (
                <div className="mr-auto max-w-[90%] rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-violet-600 shadow-sm">
                  <span className="animate-pulse">{t('geminiThinking')}</span>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
              <label htmlFor="event-ai-message" className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {language === 'zh' ? '补充或更正活动资料' : 'Add or correct event details'}
              </label>
              <div className="flex items-end gap-2">
                <textarea id="event-ai-message" ref={textareaRef} rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} disabled={isSending} placeholder={t('describeEventPlaceholder')} className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" />
                <button type="button" onClick={handleVoiceToggle} className={['inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition', listening ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'].join(' ')} aria-label={listening ? t('stopVoiceInput') : t('startVoiceInput')}>{listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
                <button type="button" onClick={() => { void handleSend() }} disabled={isSending || !input.trim()} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50" aria-label={t('send')}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {language === 'zh' ? 'AI 只整理你提供的事实；负责人、电话、资质和安全确认仍需人工核对。' : 'AI organizes only the facts you provide. People, phone numbers, qualifications, and safety confirmations still require human review.'}
              </p>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24" aria-labelledby="event-assistant-next-step">
            <section className={['rounded-2xl border p-5 shadow-sm', assistantCanContinue ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'].join(' ')}>
              <div className="flex items-start gap-3">
                <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', assistantCanContinue ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'].join(' ')}>
                  {assistantCanContinue ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ListChecks className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div>
                  <p className={['text-xs font-black uppercase tracking-[0.16em]', assistantCanContinue ? 'text-emerald-700' : 'text-amber-700'].join(' ')}>{language === 'zh' ? '资料完成情况' : 'Details status'}</p>
                  <h3 id="event-assistant-next-step" className="mt-1 text-lg font-black text-slate-950">
                    {noticeSubmitted && targetEventId
                      ? (language === 'zh' ? '通知已提交' : 'Notice submitted')
                      : !assistantDetailsReady
                        ? (language === 'zh' ? `还需确认 ${assistantMissingDetails.length} 项` : `${assistantMissingDetails.length} item(s) to confirm`)
                        : !aiReviewComplete
                          ? (language === 'zh' ? '等待负责人核对 AI 改动' : 'Human review of AI changes required')
                          : (language === 'zh' ? '活动资料已经齐全' : 'Event details are ready')}
                  </h3>
                </div>
              </div>

              {!assistantDetailsReady ? (
                <div className="mt-4">
                  <p className="text-xs font-bold text-amber-900">{language === 'zh' ? '点击一项，直接在对话中补充：' : 'Choose an item to add it in chat:'}</p>
                  <div className="mt-2 flex flex-wrap gap-2" aria-label={language === 'zh' ? '待确认资料' : 'Details to confirm'}>
                    {assistantMissingDetails.map((detail) => (
                      <button
                        key={detail}
                        type="button"
                        onClick={() => {
                          setInput((current) => `${current.trim()}${current.trim() ? '\n' : ''}${detail}${language === 'zh' ? '：' : ': '}`)
                          window.requestAnimationFrame(() => textareaRef.current?.focus())
                        }}
                        className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                      >
                        {detail}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !aiReviewComplete ? (
                <p className="mt-3 text-sm leading-6 text-amber-900">{language === 'zh' ? 'AI 已经修改了可编辑草稿。请逐项核对时间、地点、人员、费用及风险相关内容，再完成人工确认。' : 'AI changed the editable draft. Check timing, venue, people, finance and risk-related content before confirming your review.'}</p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {noticeSubmitted && targetEventId
                    ? (ramModuleEnabled
                      ? (language === 'zh' ? '下一步人工核对风险、责任人和紧急联系人。' : 'Next, manually verify risks, owners, and emergency contacts.')
                      : (language === 'zh' ? '本次没有加入风险评估，可继续保存并查看筹备方案。' : 'Risk assessment is not included. Save and continue to the preparation plan.'))
                    : (language === 'zh' ? '下一步预览双语通知和海报，再由你确认保存活动。' : 'Next, preview the bilingual notice and poster before saving the event.')}
                </p>
              )}

              {aiAssistanceUsed ? <label className={['mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm', aiDraftReviewed ? 'border-emerald-300 bg-white text-emerald-950' : 'border-amber-300 bg-white text-amber-950'].join(' ')}><input id="event-ai-human-review" type="checkbox" checked={aiDraftReviewed} onChange={(event) => { setAiDraftReviewed(event.target.checked); setError(''); setNoticeSubmitted(false); setSaveStatus('idle') }} className="mt-0.5 h-4 w-4 accent-emerald-700" /><span><strong>{language === 'zh' ? '负责人确认' : 'Leader confirmation'}</strong><span className="mt-1 block text-xs leading-5">{language === 'zh' ? '我已核对 AI 写入的活动资料；时间、地点、人员、费用和安全事实均以实际情况为准。' : 'I reviewed the AI-assisted event draft. Timing, venue, people, finance and safety facts match the real event.'}</span></span></label> : null}

              <div className="mt-4 grid gap-2">
                {assistantCanContinue ? (
                  <button type="button" onClick={() => openEditorStep(noticeSubmitted && targetEventId && ramModuleEnabled ? 'ram' : 'notice')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800">
                    {noticeSubmitted && targetEventId && ramModuleEnabled ? (language === 'zh' ? '下一步：检查风险评估' : 'Next: review risk assessment') : (language === 'zh' ? '下一步：检查通知与海报' : 'Next: review notice and poster')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={() => { if (!assistantDetailsReady) textareaRef.current?.focus(); else document.getElementById('event-ai-human-review')?.focus() }} className="min-h-11 rounded-xl bg-amber-700 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-800">
                    {!assistantDetailsReady ? (language === 'zh' ? '继续告诉 AI' : 'Continue with AI') : (language === 'zh' ? '先完成人工确认' : 'Complete human review')}
                  </button>
                )}
                <button type="button" onClick={() => openEditorStep('setup')} className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  {language === 'zh' ? '返回基本资料手动修改' : 'Edit basic details manually'}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <p className="font-black">{language === 'zh' ? 'AI 会更新哪些地方？' : 'What does AI update?'}</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>✓ {language === 'zh' ? '活动基本资料' : 'Basic event details'}</li>
                <li>✓ {language === 'zh' ? '双语通知与海报' : 'Bilingual notice and poster'}</li>
                <li>✓ {language === 'zh' ? 'RAM 草稿中的非敏感事实' : 'Non-sensitive facts in the RAM draft'}</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>

      <div id="event-editor-panel-notice" role="tabpanel" aria-labelledby="event-editor-tab-notice" hidden={activeTab !== 'notice'} className="space-y-5">
        <SubmissionStatusHeader
          title={language === 'zh' ? '活动通知文案' : 'Event notice copy'}
          description={language === 'zh' ? '这是面向成员的双语活动通知。检查时间、地点和海报后，由你确认保存活动；报名在独立模块中设置。' : 'This is the bilingual member-facing notice. Review its timing, venue and poster before saving; registration is configured in its own module.'}
          canSubmit={noticeCanSubmit}
          submitted={noticeSubmitted}
          remainingCount={noticeRemainingCount}
          language={language}
          remainingMessage={!aiReviewComplete && noticeIssues.length === 0
            ? (language === 'zh' ? 'AI 草稿仍需负责人核对并确认。' : 'The AI-assisted draft still needs leader review and confirmation.')
            : (language === 'zh' ? `通知还缺 ${noticeRemainingCount} 项，请返回 AI 协助继续处理。` : `The notice still needs ${noticeRemainingCount} item(s). Return to AI assistance to continue.`)}
          resolveLabel={language === 'zh' ? '返回 AI 协助' : 'Back to AI assistance'}
          onResolve={() => openEditorStep('assistant')}
        />
        {eventDraft ? <EventPreview event={eventDraft} lang={language} posterPreviewUrl={posterPreviewUrl} posterPendingUpload={Boolean(pendingPosterFile)} submitted={noticeSubmitted} /> : null}
        {eventDraft ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!effectiveGroupId ? <p className="text-xs text-amber-600">{t('noGroupContext')}</p> : null}
            {saveStatus === 'saved' ? <p className="text-xs text-emerald-600">{t('eventSavedToGroupShort')}</p> : null}
            <button type="button" onClick={() => { void handleCommitDraft() }} disabled={!noticeCanSubmit || saveStatus === 'saving' || isPosterUploading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60">
              <Save className="h-4 w-4" />{saveStatus === 'saving' ? t('saving') : (language === 'zh' ? '保存活动并查看筹备方案' : 'Save event and view plan')}
            </button>
          </div>
        ) : null}
      </div>

      {ramModuleEnabled ? <div id="event-editor-panel-ram" role="tabpanel" aria-labelledby="event-editor-tab-ram" hidden={activeTab !== 'ram'} className="space-y-5">
        <SubmissionStatusHeader
          title={language === 'zh' ? '风险评估与管理' : 'Risk Assessment and Management'}
          description={language === 'zh' ? 'AI 会复用活动资料起草 RAM，但负责人、电话、资质、车辆和安全确认不得由 AI 猜测，必须人工核对。' : 'AI reuses event facts to draft the RAM, but responsible people, phone numbers, qualifications, vehicles, and safety confirmations must be checked by a human.'}
          canSubmit={ramCanSubmit}
          submitted={ramSubmitted}
          submittedDetail={ramSubmittedDetail}
          remainingCount={targetEventId ? ramIssues.length : 1}
          language={language}
          remainingMessage={!targetEventId
            ? (language === 'zh' ? '请先提交活动通知，系统保存活动后才能处理 RAM。' : 'Submit the event notice first so the event exists before RAM can be processed.')
            : (language === 'zh' ? `RAM 还需人工核对 ${ramIssues.length} 项资料，请在下方逐项完成。` : `RAM still needs ${ramIssues.length} item(s) to be checked manually below.`)}
          resolveLabel={!targetEventId ? (language === 'zh' ? '返回通知与海报' : 'Back to notice') : undefined}
          onResolve={!targetEventId ? () => openEditorStep('notice') : undefined}
        />
        {eventDraft?.ram ? (
          <EventRamEditor
            ram={eventDraft.ram}
            status={ramStatus}
            language={language}
            canEdit={canEditRam}
            canAudit={canAuditRam}
            currentMemberId={me?.id ?? null}
            submittedByMemberId={ramSubmittedByMemberId}
            canSubmit={ramCanSubmit}
            busy={ramBusy}
            autosaveEnabled={Boolean(targetEventId)}
            autosaveStatus={ramAutosaveStatus}
            lastSavedAt={ramLastSavedAt}
            onChange={(ram) => {
              setEventDraft((current) => current ? { ...current, ram } : current)
              setRamStatus('draft')
              setRamHasLocalChanges(true)
              setRamAutosaveStatus(targetEventId ? 'pending' : 'idle')
              setRamMessage('')
            }}
            onSave={targetEventId ? () => { void handleSaveRam() } : undefined}
            onSubmit={targetEventId ? () => { void handleSubmitRam() } : undefined}
            onApprove={targetEventId ? (decisionNotes) => { void handleApproveRam(decisionNotes) } : undefined}
            onReturn={targetEventId ? (decisionNotes) => { void handleReturnRam(decisionNotes) } : undefined}
          />
        ) : null}
        {ramMessage ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{ramMessage}</p> : null}
      </div> : null}
    </div>
  )
}

export default EventCreatorView
