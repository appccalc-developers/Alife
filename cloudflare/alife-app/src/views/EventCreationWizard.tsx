import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  BookOpenText,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Church,
  Compass,
  GraduationCap,
  MapPinned,
  Music2,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  TentTree,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { eventCompositionService } from '../services/eventCompositionService'
import { eventService } from '../services/eventService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { useCurrentGroupStore } from '../stores/currentGroup'
import type { EventDto, EventVisibility, MultilingualString } from '../types/event'
import type {
  EventActivityType,
  EventArchetype,
  EventFactInput,
  EventPlanComposeRequest,
  EventPlanProposal,
  EventSeriesSetup,
} from '../types/eventComposition'
import { createEmptyEventRamDraft } from '../utils/eventRam'
import {
  applyActivityTypePreset,
  applyAiCopyDraft,
  deriveAiCandidateFacts,
  proposalIsCurrent,
  resolveActivityType,
} from '../utils/eventCreationWizard'

type WizardStep = 1 | 2 | 3 | 4 | 5
type BooleanFactValue = 'unknown' | 'yes' | 'no'

const moduleCatalog = [
  ['TEAM.WORK', 'Team & work', '团队与任务', 'eventTeam', 'Always required'],
  ['PEOPLE.REGISTRATION', 'Registration', '邀请与报名', 'roleRestricted', 'TEAM.WORK'],
  ['SERVICE.ROSTER', 'Service roster', '岗位与轮班', 'userSpecific', 'TEAM.WORK'],
  ['MONEY.FINANCE', 'Finance', '财务', 'roleRestricted', 'TEAM.WORK'],
  ['SAFETY.RAM', 'RAM & safety', 'RAM 与安全', 'approvalEvidence', 'TEAM.WORK'],
  ['SAFEGUARDING.CHILD', 'Child safeguarding', '儿童保护', 'roleRestricted', 'PEOPLE.REGISTRATION'],
  ['PROGRAM.PRODUCTION', 'Programme', '节目与制作', 'eventTeam', 'TEAM.WORK'],
  ['PLACE.RESOURCE', 'Venue & resources', '场地与资源', 'eventTeam', 'TEAM.WORK'],
  ['MOVE.STAY', 'Travel & stay', '交通与住宿', 'roleRestricted', 'TEAM.WORK'],
  ['FOOD.HOSPITALITY', 'Food & hospitality', '餐饮与接待', 'roleRestricted', 'TEAM.WORK'],
  ['FESTIVAL.OPERATIONS', 'Festival operations', '庆典现场营运', 'roleRestricted', 'SAFETY.RAM · PROGRAM.PRODUCTION · PLACE.RESOURCE'],
  ['COMMS.FOLLOWUP', 'Communication', '沟通与跟进', 'mixed visibility', 'TEAM.WORK'],
] as const

const booleanFacts = [
  ['people.volunteersRequired', 'Volunteers are required', '需要志愿同工'],
  ['money.hasMoneyFlow', 'Money will be collected or spent', '存在收费或支出'],
  ['safety.requiresRam', 'RAM review is required', '需要 RAM 检视'],
  ['people.childrenPresent', 'Children will participate', '有未成年人参与'],
  ['programme.productionRequired', 'A managed programme is required', '需要受管理的节目流程'],
  ['place.resourcesRequired', 'Managed venue/resources are required', '需要管理场地或资源'],
  ['move.transportRequired', 'Transport is required', '需要交通安排'],
  ['move.accommodationRequired', 'Accommodation is required', '需要住宿安排'],
  ['food.serviceRequired', 'Food service is required', '需要餐饮服务'],
  ['scale.multiZone', 'Multiple live zones are required', '需要多个现场区域'],
  ['comms.followupRequired', 'Structured follow-up is required', '需要结构化跟进'],
] as const

const iconRegistry: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  meal: UtensilsCrossed,
  people: UsersRound,
  map: MapPinned,
  outdoors: Compass,
  camp: TentTree,
  retreat: Church,
  children: UsersRound,
  training: GraduationCap,
  fellowship: UsersRound,
  worship: Church,
  study: BookOpenText,
  prayer: Church,
  festival: PartyPopper,
  celebration: PartyPopper,
  outreach: Compass,
  performance: Music2,
}

const nowPlusDays = (days: number, hour: number) => {
  const value = new Date()
  value.setDate(value.getDate() + days)
  value.setHours(hour, 0, 0, 0)
  const offset = value.getTimezoneOffset()
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

const localize = (value: MultilingualString, language: string) =>
  (language === 'zh' ? value.zh : value.en) || value.en || value.zh

const asIso = (localValue: string) => new Date(localValue).toISOString()

const weekdayCode = (localValue: string) => {
  const day = new Date(localValue).getDay()
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day]
}

const safeTimeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Pacific/Auckland' }
  catch { return 'Pacific/Auckland' }
}

const initialFactValues = () => Object.fromEntries(
  booleanFacts.map(([code]) => [code, 'unknown']),
) as Record<string, BooleanFactValue>

const createFact = (code: string, value: boolean | string | null, source: 'human' | 'aiCandidate' = 'human'): EventFactInput => ({
  code,
  value,
  certainty: source === 'aiCandidate' ? 'candidate' : value === null ? 'unknown' : 'confirmed',
  source,
})

const EventCreationWizard = () => {
  const { language, me, canManageGroup } = useAuthStore()
  const { CurrentGroup } = useCurrentGroupStore()
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const groupId = routeGroupId || searchParams.get('groupId') || CurrentGroup?.id || ''
  const isZh = language === 'zh'
  const canCreate = Boolean(groupId && canManageGroup(groupId))
  const [step, setStep] = useState<WizardStep>(1)
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogError, setCatalogError] = useState('')
  const [archetypeCode, setArchetypeCode] = useState('')
  const [activityTypeCode, setActivityTypeCode] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>(['TEAM.WORK'])
  const [visibility, setVisibility] = useState<EventVisibility>('groupVisible')
  const [registrationMode, setRegistrationMode] = useState<'none' | 'required'>('none')
  const [useRecommendedWorkflow, setUseRecommendedWorkflow] = useState(false)
  const [title, setTitle] = useState<MultilingualString>({ en: '', zh: '' })
  const [description, setDescription] = useState<MultilingualString>({ en: '', zh: '' })
  const [locationName, setLocationName] = useState<MultilingualString>({ en: '', zh: '' })
  const [startLocal, setStartLocal] = useState(() => nowPlusDays(7, 10))
  const [endLocal, setEndLocal] = useState(() => nowPlusDays(7, 12))
  const [maxCapacity, setMaxCapacity] = useState('')
  const [timeZone, setTimeZone] = useState(safeTimeZone)
  const [rollingWeeks, setRollingWeeks] = useState(12)
  const [factValues, setFactValues] = useState<Record<string, BooleanFactValue>>(initialFactValues)
  const [aiCandidateFacts, setAiCandidateFacts] = useState<Record<string, boolean>>({})
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [proposal, setProposal] = useState<EventPlanProposal | null>(null)
  const [proposalSignature, setProposalSignature] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const aiSessionId = useRef(crypto.randomUUID())
  const aiStarted = useRef(false)
  const hydratedKey = useRef('')

  const selectedArchetype = useMemo(
    () => archetypes.find((item) => item.code === archetypeCode) ?? null,
    [archetypeCode, archetypes],
  )
  const selectedType = useMemo(
    () => resolveActivityType(archetypes, archetypeCode, activityTypeCode),
    [activityTypeCode, archetypeCode, archetypes],
  )

  const buildComposition = (): EventPlanComposeRequest => ({
    schemaVersion: '1.1.0',
    archetypeCode,
    activityTypeCode,
    useRecommendedWorkflow,
    basePlanVersion: null,
    facts: {
      items: [
        createFact('people.registrationMode', registrationMode),
        createFact('visibility', visibility),
        ...booleanFacts.map(([code]) => {
          const manual = factValues[code]
          if (manual === 'yes') return createFact(code, true)
          if (manual === 'no') return createFact(code, false)
          return code in aiCandidateFacts
            ? createFact(code, aiCandidateFacts[code], 'aiCandidate')
            : createFact(code, null)
        }),
      ],
    },
    humanSelections: moduleCatalog
      .filter(([code]) => code !== 'TEAM.WORK')
      .map(([moduleCode]) => ({ moduleCode, selected: selectedModules.includes(moduleCode) })),
  })

  const signature = useMemo(() => JSON.stringify({
    archetypeCode, activityTypeCode, selectedModules, visibility, registrationMode,
    useRecommendedWorkflow, title, description, locationName, startLocal, endLocal,
    maxCapacity, timeZone, rollingWeeks, factValues, aiCandidateFacts,
  }), [activityTypeCode, aiCandidateFacts, archetypeCode, description, endLocal, factValues, locationName, maxCapacity, registrationMode, rollingWeeks, selectedModules, startLocal, timeZone, title, useRecommendedWorkflow, visibility])

  useEffect(() => {
    if (!groupId) {
      setCatalogState('error')
      setCatalogError(isZh ? '缺少活动所属小组。' : 'An owning group is required.')
      return
    }
    let active = true
    setCatalogState('loading')
    eventCompositionService.listArchetypes(groupId)
      .then((items) => {
        if (!active) return
        setArchetypes(items)
        setCatalogState('ready')
      })
      .catch((reason) => {
        if (!active) return
        const apiError = normalizeApiError(reason)
        setCatalogError(apiError.message)
        setCatalogState('error')
      })
    return () => { active = false }
  }, [groupId])

  useEffect(() => {
    if (!groupId || catalogState !== 'ready' || hydratedKey.current === groupId) return
    hydratedKey.current = groupId
    const raw = localStorage.getItem(`alife:event-create:1.1:${groupId}`)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as Record<string, unknown>
      const savedArchetype = typeof saved.archetypeCode === 'string' ? saved.archetypeCode : ''
      const archetype = archetypes.find((item) => item.code === savedArchetype)
      const savedType = typeof saved.activityTypeCode === 'string' ? saved.activityTypeCode : ''
      if (savedArchetype && !archetype) throw new Error('unknown archetype')
      if (savedType && !archetype?.activityTypes.some((item) => item.code === savedType)) throw new Error('unknown activity type')
      setArchetypeCode(savedArchetype)
      setActivityTypeCode(savedType)
      if (Array.isArray(saved.selectedModules)) setSelectedModules(saved.selectedModules.filter((x): x is string => typeof x === 'string'))
      if (saved.title && typeof saved.title === 'object') setTitle(saved.title as MultilingualString)
      if (saved.description && typeof saved.description === 'object') setDescription(saved.description as MultilingualString)
      if (saved.locationName && typeof saved.locationName === 'object') setLocationName(saved.locationName as MultilingualString)
      if (typeof saved.visibility === 'string') setVisibility(saved.visibility as EventVisibility)
      if (saved.registrationMode === 'none' || saved.registrationMode === 'required') setRegistrationMode(saved.registrationMode)
      if (typeof saved.startLocal === 'string') setStartLocal(saved.startLocal)
      if (typeof saved.endLocal === 'string') setEndLocal(saved.endLocal)
      if (typeof saved.maxCapacity === 'string') setMaxCapacity(saved.maxCapacity)
      if (typeof saved.timeZone === 'string') setTimeZone(saved.timeZone)
      if (typeof saved.rollingWeeks === 'number') setRollingWeeks(saved.rollingWeeks)
      if (saved.factValues && typeof saved.factValues === 'object') setFactValues(saved.factValues as Record<string, BooleanFactValue>)
      if (typeof saved.useRecommendedWorkflow === 'boolean') setUseRecommendedWorkflow(saved.useRecommendedWorkflow)
    } catch {
      localStorage.removeItem(`alife:event-create:1.1:${groupId}`)
      setError(isZh ? '已舍弃无法识别的旧草稿代码；请重新选择活动原型与模板。' : 'An unrecognized saved draft was discarded. Choose an archetype and event template again.')
    }
  }, [archetypes, catalogState, groupId, isZh])

  useEffect(() => {
    if (!groupId || hydratedKey.current !== groupId) return
    localStorage.setItem(`alife:event-create:1.1:${groupId}`, JSON.stringify({
      archetypeCode, activityTypeCode, selectedModules, visibility, registrationMode,
      useRecommendedWorkflow, title, description, locationName, startLocal, endLocal,
      maxCapacity, timeZone, rollingWeeks, factValues,
    }))
  }, [activityTypeCode, archetypeCode, description, endLocal, factValues, groupId, locationName, maxCapacity, registrationMode, rollingWeeks, selectedModules, startLocal, timeZone, title, useRecommendedWorkflow, visibility])

  useEffect(() => {
    if (proposal && proposalSignature !== signature) {
      setProposal(null)
      setProposalSignature('')
      setIdempotencyKey(crypto.randomUUID())
    }
  }, [proposal, proposalSignature, signature])

  const chooseArchetype = (code: string) => {
    setArchetypeCode(code)
    setActivityTypeCode('')
    setSelectedModules(['TEAM.WORK'])
    setUseRecommendedWorkflow(false)
    setStep(2)
    setError('')
  }

  const chooseType = (type: EventActivityType) => {
    const preset = applyActivityTypePreset(type)
    setActivityTypeCode(type.code)
    setSelectedModules(preset.selectedModules)
    setVisibility(preset.visibility)
    setRegistrationMode(preset.registrationMode)
    setUseRecommendedWorkflow(preset.useRecommendedWorkflow)
    setStep(3)
    setError('')
  }

  const buildEvent = (): EventDto => ({
    organizerDisplayName: me?.displayName || '',
    visibility,
    personResponsible: me?.displayName || '',
    purpose: { en: '', zh: '' },
    title,
    description,
    locationName,
    startDate: asIso(startLocal),
    endDate: asIso(endLocal),
    registrationDeadline: registrationMode === 'required'
      ? new Date(new Date(startLocal).getTime() - 24 * 60 * 60 * 1000).toISOString()
      : asIso(startLocal),
    maxCapacity: registrationMode === 'required' ? Number(maxCapacity) : 0,
    capacityUnit: 'People',
    hardConstraints: [],
    optionalActivities: [],
    baseFeePerAdult: null,
    baseFeePerChild: null,
    currency: 'NZD',
    posterImageUrl: null,
    galleryUrls: [],
    legacySummary: null,
    contactProfileIds: [],
    ram: createEmptyEventRamDraft(),
  })

  const validateDetails = () => {
    if (!title.en.trim() && !title.zh.trim()) return isZh ? '请填写活动名称。' : 'Enter an event title.'
    if (!description.en.trim() && !description.zh.trim()) return isZh ? '请填写活动说明。' : 'Enter an event description.'
    if (!startLocal || !endLocal || new Date(endLocal) <= new Date(startLocal)) return isZh ? '结束时间必须晚于开始时间。' : 'End time must be after start time.'
    if (registrationMode === 'required' && (!Number.isInteger(Number(maxCapacity)) || Number(maxCapacity) < 1)) return isZh ? '报名型活动必须明确填写容量。' : 'A registered event requires an explicit capacity.'
    if (selectedArchetype?.isSeries && (!timeZone.trim() || rollingWeeks !== 12)) return isZh ? '定期活动需要 IANA 时区，并在此阶段固定物化未来 12 周。' : 'Recurring events require an IANA time zone and a 12-week rolling window in this phase.'
    return ''
  }

  const runAi = async () => {
    if (!aiPrompt.trim()) return
    setAiBusy(true)
    setError('')
    try {
      const draft = buildEvent()
      const appContext = {
        language,
        userId: me?.id,
        memberId: me?.id,
        groupId,
        knownFacts: { archetypeCode, activityTypeCode },
      }
      if (!aiStarted.current) {
        await eventService.startSession(aiSessionId.current, draft, appContext)
        aiStarted.current = true
      }
      const response = await eventService.extractFromChat(aiPrompt.trim(), aiSessionId.current, 'text', appContext)
      setAiReply(response.markdown || (isZh ? 'AI 已返回可审阅草稿。' : 'AI returned a reviewable draft.'))
      if (response.result) {
        const result = response.result
        const copy = applyAiCopyDraft({ title, description, locationName }, result)
        setTitle(copy.title)
        setDescription(copy.description)
        setLocationName(copy.locationName)
        setAiCandidateFacts((current) => ({ ...current, ...deriveAiCandidateFacts(result) }))
      }
      setAiPrompt('')
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setAiBusy(false)
    }
  }

  const compose = async () => {
    const issue = validateDetails()
    if (issue) { setError(issue); return false }
    setBusy(true)
    setError('')
    try {
      const composition = buildComposition()
      const nextProposal = await eventCompositionService.compose(groupId, composition)
      setProposal(nextProposal)
      setProposalSignature(signature)
      setIdempotencyKey(crypto.randomUUID())
      return true
    } catch (reason) {
      setError(normalizeApiError(reason).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    if (!proposal || !proposalIsCurrent(proposalSignature, signature)) {
      setError(isZh ? '方案已经过期，请重新生成。' : 'The proposal is stale. Compose it again.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const event = buildEvent()
      let seriesSetup: EventSeriesSetup | null = null
      if (selectedArchetype?.isSeries) {
        const durationMinutes = Math.round((new Date(endLocal).getTime() - new Date(startLocal).getTime()) / 60_000)
        seriesSetup = {
          name: { en: title.en || title.zh, zh: title.zh || title.en },
          recurrenceRule: `FREQ=WEEKLY;INTERVAL=1;BYDAY=${weekdayCode(startLocal)}`,
          timeZone,
          firstStartLocal: startLocal,
          durationMinutes,
          exceptionDates: [],
          rollingOccurrenceWeeks: 12,
        }
      }
      const created = await eventService.createGroupEvent(groupId, event, aiStarted.current ? aiSessionId.current : undefined, undefined, null, {
        composition: buildComposition(),
        proposalHash: proposal.proposalHash,
        idempotencyKey,
        seriesSetup,
      })
      localStorage.removeItem(`alife:event-create:1.1:${groupId}`)
      navigate(`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(created.id)}/workspace`, {
        replace: true,
        state: { created: true },
      })
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(apiError.status === 412
        ? (isZh ? '服务器判定 proposal 已过期，请重新组合并审查。' : 'The server rejected a stale proposal. Recompose and review it.')
        : apiError.message)
      if (apiError.status === 412) setProposal(null)
    } finally {
      setBusy(false)
    }
  }

  const next = async () => {
    setError('')
    if (step === 1 && !archetypeCode) { setError(isZh ? '请选择活动原型。' : 'Choose an event archetype.'); return }
    if (step === 2 && !activityTypeCode) { setError(isZh ? '请选择具体活动模板。' : 'Choose an event template.'); return }
    if (step === 4) {
      if (await compose()) setStep(5)
      return
    }
    if (step < 5) setStep((step + 1) as WizardStep)
  }

  const stepLabels = isZh
    ? ['活动原型', '具体模板', '预设与外围功能', '资料与事实', '方案审查']
    : ['Archetype', 'Event template', 'Preset & modules', 'Details & facts', 'Plan review']

  if (!canCreate && groupId) {
    return <AppPageShell title={isZh ? '建立活动' : 'Create event'}><AppEmptyState title={isZh ? '需要小组管理权限' : 'Group management permission required'} description={isZh ? '只有所属小组的 leader／co-leader 可以建立并接受活动方案。' : 'Only an owning-group leader or co-leader can create and accept an event plan.'} /></AppPageShell>
  }

  return (
    <AppPageShell
      title={isZh ? '建立活动' : 'Create an event'}
      subtitle={isZh ? '从系统原型和具体活动模板开始；所有预选都要在人工接受前审查。' : 'Start with a system archetype and event template. Every preset remains reviewable before human acceptance.'}
    >
      <nav className="overflow-x-auto rounded-2xl border border-[#2f4b42]/10 bg-white/80 p-2" aria-label={isZh ? '建立活动步骤' : 'Event creation steps'}>
        <ol className="flex min-w-[42rem] items-center gap-1">
          {stepLabels.map((label, index) => {
            const number = (index + 1) as WizardStep
            const active = number === step
            const complete = number < step
            return <li key={label} className="min-w-0 flex-1"><button type="button" disabled={number > step} onClick={() => setStep(number)} aria-current={active ? 'step' : undefined} className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-black transition ${active ? 'bg-[#176b5a] text-white' : complete ? 'bg-[#e3f0eb] text-[#0d4f43]' : 'text-[#66766f]'}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/80 text-[#176b5a]">{complete ? <Check className="h-3.5 w-3.5" /> : number}</span><span className="truncate">{label}</span></button></li>
          })}
        </ol>
      </nav>

      {catalogState === 'loading' ? <AppSectionCard><p role="status" className="text-sm text-[#66766f]">{isZh ? '正在载入受控活动目录……' : 'Loading the controlled event catalogue…'}</p></AppSectionCard> : null}
      {catalogState === 'error' ? <AppEmptyState title={isZh ? '活动目录无法载入' : 'Event catalogue unavailable'} description={catalogError} actionLabel={isZh ? '重试' : 'Retry'} onAction={() => window.location.reload()} /> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}

      {catalogState === 'ready' && step === 1 ? <AppSectionCard title={isZh ? '1. 选择活动原型' : '1. Choose an event archetype'} subtitle={isZh ? '原型只决定结构；具体模块预选由下一步的活动类型决定。' : 'The archetype defines structure. The activity type in the next step supplies module presets.'}><div className="grid gap-4 tablet:grid-cols-2">{archetypes.map((item) => <button key={item.code} type="button" onClick={() => chooseArchetype(item.code)} aria-pressed={item.code === archetypeCode} className={`min-h-36 rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40 ${item.code === archetypeCode ? 'border-[#176b5a] bg-[#e3f0eb]' : 'border-[#2f4b42]/15 bg-[#fbfcf8] hover:border-[#176b5a]/40'}`}><CalendarRange className="h-6 w-6 text-[#176b5a]" aria-hidden="true" /><h2 className="mt-3 text-lg font-black text-[#18332d]">{localize(item.name, language)}</h2><p className="mt-2 text-sm leading-6 text-[#66766f]">{item.isSeries ? (isZh ? '每周 Series · 自动物化未来 12 周 Occurrences' : 'Weekly Series · materializes 12 weeks of occurrences') : item.hasZones ? (isZh ? '单次 Occurrence · 支持 Sessions 与 Zones' : 'One occurrence · supports sessions and zones') : item.hasSessions ? (isZh ? '单次 Occurrence · 支持 Sessions' : 'One occurrence · supports sessions') : (isZh ? '单次 Event 与一个 Occurrence' : 'One event and one occurrence')}</p><AppBadge className="mt-3" variant="neutral">{item.activityTypes.length} {isZh ? '种模板' : item.activityTypes.length === 1 ? 'template' : 'templates'}</AppBadge></button>)}</div></AppSectionCard> : null}

      {catalogState === 'ready' && step === 2 ? <AppSectionCard title={isZh ? '2. 选择具体活动模板' : '2. Choose an event template'} subtitle={selectedArchetype ? localize(selectedArchetype.name, language) : ''}>{selectedArchetype?.activityTypes.length ? <div className="grid gap-4 tablet:grid-cols-2">{selectedArchetype.activityTypes.map((type) => { const Icon = iconRegistry[type.iconKey] ?? ShieldCheck; return <button key={type.code} type="button" onClick={() => chooseType(type)} aria-pressed={type.code === activityTypeCode} className={`rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40 ${type.code === activityTypeCode ? 'border-[#176b5a] bg-[#e3f0eb]' : 'border-[#2f4b42]/15 bg-[#fbfcf8] hover:border-[#176b5a]/40'}`}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#176b5a]"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="text-xs font-bold text-[#66766f]">v{type.version}</span></div><h2 className="mt-3 text-base font-black text-[#18332d]">{localize(type.name, language)}</h2><p className="mt-2 text-sm leading-6 text-[#66766f]">{localize(type.description, language)}</p><div className="mt-3 flex flex-wrap gap-2"><AppBadge variant="neutral">{type.defaults.visibility}</AppBadge><AppBadge variant="neutral">{type.defaults.registrationMode}</AppBadge>{type.recommendedWorkflowTemplateCode ? <AppBadge variant="info">{type.recommendedWorkflowTemplateCode}</AppBadge> : null}</div></button> })}</div> : selectedArchetype ? <AppEmptyState title={isZh ? '当前分类没有启用的活动模板' : 'No active event templates in this category'} description={isZh ? '系统管理员可以在活动模板管理中重新启用或新增模板。' : 'A system administrator can reactivate or add a template in Event template management.'} /> : <AppEmptyState title={isZh ? '先选择原型' : 'Choose an archetype first'} description={isZh ? '返回上一步选择四种系统原型之一。' : 'Return to the previous step and choose one of the four system archetypes.'} />}</AppSectionCard> : null}

      {catalogState === 'ready' && step === 3 && selectedType ? <div className="space-y-5"><AppSectionCard title={isZh ? '3. 审查结构与默认值' : '3. Review structure and defaults'} subtitle={isZh ? '预选不是政策结论；确认事实或依赖可能在 proposal 中把模块提升为 required。' : 'Presets are not policy conclusions. Confirmed facts or dependencies may promote a module to required in the proposal.'}><div className="grid gap-4 tablet:grid-cols-3"><label className="text-sm font-bold text-[#40554e]">{isZh ? '可见性' : 'Visibility'}<select value={visibility} onChange={(event) => setVisibility(event.target.value as EventVisibility)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 bg-white px-3"><option value="groupVisible">groupVisible</option><option value="churchVisible">churchVisible</option><option value="public">public</option></select></label><label className="text-sm font-bold text-[#40554e]">{isZh ? '报名方式' : 'Registration'}<select value={registrationMode} onChange={(event) => setRegistrationMode(event.target.value as 'none' | 'required')} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 bg-white px-3"><option value="none">none</option><option value="required">required</option></select></label><div className="rounded-xl bg-[#fbfcf8] p-3 text-sm"><p className="font-black text-[#18332d]">{isZh ? '结构' : 'Structure'}</p><p className="mt-1 text-[#66766f]">{selectedArchetype?.isSeries ? 'EventSeries · weekly · 12 weeks' : selectedArchetype?.hasZones ? 'Event · Occurrence · Sessions · Zones' : selectedArchetype?.hasSessions ? 'Event · Occurrence · Sessions' : 'Event · Occurrence'}</p></div></div>{selectedType.recommendedWorkflowTemplateCode ? <label className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4"><input type="checkbox" checked={useRecommendedWorkflow} onChange={(event) => setUseRecommendedWorkflow(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong className="block text-sm text-sky-950">{isZh ? `建议 ${selectedType.recommendedWorkflowTemplateCode} Workflow` : `Recommend ${selectedType.recommendedWorkflowTemplateCode} workflow`}</strong><span className="mt-1 block text-xs leading-5 text-sky-800">{isZh ? '只选择现有版本化模板；不可用时 proposal 会明确警告，并允许无 Workflow 建立。' : 'Only an existing versioned template can be selected. If unavailable, the proposal warns and allows creation without a workflow.'}</span></span></label> : null}</AppSectionCard><AppSectionCard title={isZh ? '外围功能预选集' : 'Preset and optional modules'} subtitle={isZh ? 'MONEY.FINANCE 永不由类型自动预选。关闭预设不会覆盖 required 事实或依赖。' : 'MONEY.FINANCE is never type-preselected. Turning off a preset cannot override a required fact or dependency.'}><div className="grid gap-3 tablet:grid-cols-2">{moduleCatalog.map(([code, en, zh, dataClass, dependencies]) => { const always = code === 'TEAM.WORK'; const selected = always || selectedModules.includes(code); return <label key={code} className={`flex items-start gap-3 rounded-xl border p-4 ${selected ? 'border-[#176b5a]/30 bg-[#e3f0eb]/60' : 'border-[#2f4b42]/10 bg-white'}`}><input type="checkbox" disabled={always} checked={selected} onChange={(event) => setSelectedModules((current) => event.target.checked ? [...new Set([...current, code])] : current.filter((item) => item !== code))} className="mt-1 h-4 w-4" /><span className="min-w-0"><strong className="block text-sm text-[#18332d]">{isZh ? zh : en}</strong><span className="mt-1 block break-words text-xs text-[#66766f]">{code} · {dataClass}</span><span className="mt-1 block text-xs text-[#66766f]">{isZh ? '依赖：' : 'Depends on: '}{dependencies}</span></span></label>})}</div></AppSectionCard><AppSectionCard title={isZh ? '常用岗位预设' : 'Typical service-slot presets'} subtitle={isZh ? '岗位会以活动／各场次起止时间建立；人数可编辑，也不会自动指派成员或成为政策结论。关闭 SERVICE.ROSTER 时不会建立。' : 'Slots use the event/occurrence start and end times. Counts remain editable; no member is assigned and no policy conclusion is made. None are created when SERVICE.ROSTER is disabled.'}><div className="grid gap-2 tablet:grid-cols-2">{selectedType.presetServiceSlots.map((slot) => <div key={slot.roleCode} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 py-2"><span className="min-w-0"><strong className="block truncate text-sm text-[#18332d]">{localize(slot.label, language)}</strong><span className="block truncate text-xs text-[#66766f]">{slot.roleCode}</span></span><AppBadge variant="neutral">{slot.requiredCount} {isZh ? '人' : 'people'}</AppBadge></div>)}</div></AppSectionCard></div> : null}

      {catalogState === 'ready' && step === 4 ? <div className="space-y-5"><AppSectionCard title={isZh ? '4. 双语资料与时间' : '4. Bilingual details and schedule'}><div className="grid gap-4 tablet:grid-cols-2"><BilingualInput label={isZh ? '活动名称' : 'Event title'} value={title} onChange={setTitle} /><BilingualInput label={isZh ? '地点说明' : 'Location description'} value={locationName} onChange={setLocationName} /><BilingualInput multiline className="tablet:col-span-2" label={isZh ? '活动说明' : 'Description'} value={description} onChange={setDescription} /><Field label={isZh ? '开始时间' : 'Start time'}><input type="datetime-local" required value={startLocal} onChange={(event) => setStartLocal(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 px-3" /></Field><Field label={isZh ? '结束时间' : 'End time'}><input type="datetime-local" required value={endLocal} onChange={(event) => setEndLocal(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 px-3" /></Field>{registrationMode === 'required' ? <Field label={isZh ? '容量（People）' : 'Capacity (People)'}><input type="number" min="1" step="1" value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 px-3" placeholder={isZh ? '请明确填写，不从类型推断' : 'Enter explicitly; not inferred from type'} /></Field> : null}{selectedArchetype?.isSeries ? <><Field label={isZh ? 'IANA 时区' : 'IANA time zone'}><input value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 px-3" /></Field><Field label={isZh ? '滚动物化窗口' : 'Rolling materialization'}><input value={`${rollingWeeks} ${isZh ? '周' : 'weeks'}`} disabled className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/10 bg-slate-50 px-3" /><input type="hidden" value={rollingWeeks} onChange={() => setRollingWeeks(12)} /></Field></> : null}</div></AppSectionCard><AppSectionCard title={isZh ? '组合事实' : 'Composition facts'} subtitle={isZh ? '未知值保持 unknown。类型不会替你确认儿童、交通、费用或安全事实。' : 'Unknown stays unknown. The activity type never confirms child, travel, money or safety facts for you.'}><div className="grid gap-3 tablet:grid-cols-2">{booleanFacts.map(([code, en, zh]) => <fieldset key={code} className="rounded-xl border border-[#2f4b42]/10 p-4"><legend className="px-1 text-sm font-black text-[#18332d]">{isZh ? zh : en}</legend><p className="mt-1 break-all text-xs text-[#66766f]">{code}</p><div className="mt-3 flex gap-2">{(['unknown', 'yes', 'no'] as const).map((value) => <button key={value} type="button" aria-pressed={factValues[code] === value} onClick={() => setFactValues((current) => ({ ...current, [code]: value }))} className={`min-h-9 flex-1 rounded-lg border px-2 text-xs font-bold ${factValues[code] === value ? 'border-[#176b5a] bg-[#e3f0eb] text-[#0d4f43]' : 'border-[#2f4b42]/15 bg-white text-[#66766f]'}`}>{value === 'unknown' ? (isZh ? '未知' : 'Unknown') : value === 'yes' ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')}</button>)}</div>{factValues[code] === 'unknown' && code in aiCandidateFacts ? <p className="mt-2 text-xs font-semibold text-amber-800">{isZh ? `AI 候选：${aiCandidateFacts[code] ? '是' : '否'}（未确认，不触发政策）` : `AI candidate: ${aiCandidateFacts[code] ? 'yes' : 'no'} (unconfirmed; does not trigger policy)`}</p> : null}</fieldset>)}</div></AppSectionCard><AppSectionCard title={isZh ? 'AI 资料助手（可选）' : 'AI details assistant (optional)'} subtitle={isZh ? '只采用双语文字草稿；候选事实保持 candidate。AI 不得改变原型、类型、模块、Workflow 决定或安全确认。' : 'Only bilingual copy drafts are adopted. Candidate facts remain candidates. AI cannot change archetype, type, modules, workflow decisions or safety confirmations.'}><textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} rows={3} className="w-full rounded-xl border border-[#2f4b42]/15 p-3 text-sm" placeholder={isZh ? '例如：把这段活动资料整理成中英文说明……' : 'For example: turn these notes into bilingual event copy…'} />{aiReply ? <p className="mt-3 rounded-xl bg-[#fbfcf8] p-3 text-sm leading-6 text-[#40554e]">{aiReply}</p> : null}<AppActionButton className="mt-3" disabled={aiBusy || !aiPrompt.trim()} onClick={() => void runAi()}><Sparkles className="mr-2 h-4 w-4" />{aiBusy ? (isZh ? '整理中……' : 'Drafting…') : (isZh ? '生成可审阅草稿' : 'Draft for review')}</AppActionButton></AppSectionCard></div> : null}

      {catalogState === 'ready' && step === 5 ? <AppSectionCard title={isZh ? '5. Plan Review 与人工接受' : '5. Plan review and human acceptance'} subtitle={isZh ? '服务器已重新计算 proposal。接受后才原子建立 Event、Occurrence／Series、RAM、Workflow 与不可变快照。' : 'The server recomputed this proposal. Acceptance atomically creates the event, occurrence/series, RAM, workflow and immutable snapshot.'}>{busy && !proposal ? <p role="status" className="text-sm text-[#66766f]">{isZh ? '正在组合方案……' : 'Composing the plan…'}</p> : proposal ? <div className="space-y-5"><div className="flex flex-wrap items-center gap-2"><AppBadge variant="info">{proposal.activityTypeCode} · v{proposal.activityTypeVersion}</AppBadge><AppBadge variant={proposal.readiness.status === 'ready' ? 'success' : 'warning'}>{proposal.readiness.status}</AppBadge>{proposal.workflowRecommendation ? <AppBadge variant={proposal.workflowRecommendation.status === 'unavailable' ? 'warning' : 'neutral'}>{proposal.workflowRecommendation.code} · {proposal.workflowRecommendation.status}{proposal.workflowRecommendation.resolvedVersion ? ` · v${proposal.workflowRecommendation.resolvedVersion}` : ''}</AppBadge> : null}</div><div><h3 className="text-sm font-black text-[#18332d]">{isZh ? '模块及来源' : 'Modules and sources'}</h3><div className="mt-2 grid gap-2 tablet:grid-cols-2">{proposal.moduleDecisions.filter((item) => item.status !== 'inactive').map((item) => <div key={item.moduleCode} className="rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-3"><div className="flex items-start justify-between gap-2"><strong className="text-sm text-[#18332d]">{localize(item.label, language)}</strong><AppBadge variant={item.status === 'required' ? 'warning' : 'neutral'}>{item.status}</AppBadge></div><p className="mt-2 break-words text-xs leading-5 text-[#66766f]">{item.reasonCodes.join(' · ')}</p>{item.dependencies.length ? <p className="mt-1 text-xs text-[#66766f]">{isZh ? '依赖：' : 'Depends on: '}{item.dependencies.join(', ')}</p> : null}</div>)}</div></div>{proposal.readiness.blockers.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-black text-amber-950">{isZh ? '建立后的准备度责任' : 'Post-create readiness responsibilities'}</h3><ul className="mt-2 space-y-1 text-sm text-amber-900">{proposal.readiness.blockers.map((item, index) => <li key={`${item.en}-${index}`}>• {localize(item, language)}</li>)}</ul></div> : null}{proposal.warnings.length ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><h3 className="text-sm font-black text-sky-950">{isZh ? '警告' : 'Warnings'}</h3><ul className="mt-2 space-y-1 text-sm text-sky-900">{proposal.warnings.map((item, index) => <li key={`${item.en}-${index}`}>• {localize(item, language)}</li>)}</ul></div> : null}<AppActionButton variant="primary" disabled={busy || proposalSignature !== signature} onClick={() => void accept()}><ShieldCheck className="mr-2 h-4 w-4" />{busy ? (isZh ? '正在建立……' : 'Creating…') : (isZh ? '人工接受并建立活动' : 'Human accept and create event')}</AppActionButton></div> : <AppEmptyState title={isZh ? '尚无可接受方案' : 'No proposal to accept'} description={isZh ? '资料变化或服务器拒绝后必须重新组合。' : 'Changes or a server rejection require a fresh composition.'} actionLabel={isZh ? '重新生成 proposal' : 'Recompose proposal'} onAction={() => void compose()} />}</AppSectionCard> : null}

      {catalogState === 'ready' ? <footer className="flex flex-wrap items-center justify-between gap-3"><AppActionButton variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((step - 1) as WizardStep)}><ChevronLeft className="mr-2 h-4 w-4" />{isZh ? '上一步' : 'Back'}</AppActionButton>{step < 5 ? <AppActionButton variant="primary" disabled={busy} onClick={() => void next()}>{busy ? (isZh ? '处理中……' : 'Working…') : (isZh ? '继续' : 'Continue')}<ChevronRight className="ml-2 h-4 w-4" /></AppActionButton> : null}</footer> : null}
    </AppPageShell>
  )
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="text-sm font-bold text-[#40554e]">{label}{children}</label>

const BilingualInput = ({ label, value, onChange, multiline = false, className = '' }: { label: string; value: MultilingualString; onChange: (value: MultilingualString) => void; multiline?: boolean; className?: string }) => <fieldset className={className}><legend className="text-sm font-bold text-[#40554e]">{label}</legend><div className="mt-2 grid gap-2 tablet:grid-cols-2">{(['zh', 'en'] as const).map((code) => <label key={code} className="text-xs font-bold uppercase tracking-wide text-[#66766f]">{code}{multiline ? <textarea rows={4} value={value[code]} onChange={(event) => onChange({ ...value, [code]: event.target.value })} className="mt-1 w-full rounded-xl border border-[#2f4b42]/15 p-3 text-sm font-normal normal-case tracking-normal text-[#18332d]" /> : <input value={value[code]} onChange={(event) => onChange({ ...value, [code]: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 px-3 text-sm font-normal normal-case tracking-normal text-[#18332d]" />}</label>)}</div></fieldset>

export default EventCreationWizard
