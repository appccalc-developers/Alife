import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import type { EventRamDraft, EventRamStatus, MultilingualString, RamHazard, RamOutingSafety } from '../../types/event'

type Props = {
  ram: EventRamDraft
  status: EventRamStatus
  language: 'en' | 'zh'
  canEdit: boolean
  canAudit: boolean
  canSubmit?: boolean
  currentMemberId?: string | null
  submittedByMemberId?: string | null
  busy?: boolean
  autosaveEnabled?: boolean
  autosaveStatus?: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  lastSavedAt?: string | null
  onChange: (ram: EventRamDraft) => void
  onSave?: () => void
  onSubmit?: () => void
  onApprove?: (decisionNotes: string) => void
  onReturn?: (decisionNotes: string) => void
}

const emptyText = (): MultilingualString => ({ zh: '', en: '' })
const emptyHazard = (): RamHazard => ({
  id: crypto.randomUUID(),
  hazard: emptyText(),
  likelihood: null,
  impact: null,
  riskScore: null,
  controlMeasures: emptyText(),
  personResponsible: '',
})

const statusText = {
  draft: { en: 'Draft', zh: '草稿' },
  awaitingReview: { en: 'Awaiting review', zh: '等待审核' },
  approved: { en: 'Approved', zh: '已批准' },
} as const

const likelihoodOptions = [
  { value: 1, en: '1 — Rare (<5%)', zh: '1 — 极少（<5%）' },
  { value: 2, en: '2 — Unlikely (5–29%)', zh: '2 — 不太可能（5–29%）' },
  { value: 3, en: '3 — Moderate (30–59%)', zh: '3 — 中等可能（30–59%）' },
  { value: 4, en: '4 — Likely (60–79%)', zh: '4 — 很可能（60–79%）' },
  { value: 5, en: '5 — Almost certain (80%+)', zh: '5 — 几乎确定（80%+）' },
] as const

const impactOptions = [
  { value: 1, en: '1 — Insignificant', zh: '1 — 可忽略' },
  { value: 2, en: '2 — Minor / basic first aid', zh: '2 — 轻微／基础急救' },
  { value: 3, en: '3 — Moderate / medical visit', zh: '3 — 中等／需要就医' },
  { value: 4, en: '4 — Major / hospitalisation', zh: '4 — 严重／需要住院' },
  { value: 5, en: '5 — Catastrophic / disability or death', zh: '5 — 灾难性／永久伤残或死亡' },
] as const

const boolOptions = [
  { value: '', en: 'Not confirmed', zh: '尚未确认' },
  { value: 'true', en: 'Yes - confirmed', zh: '是 - 已确认' },
  { value: 'false', en: 'No', zh: '否' },
]

const ageRangePresets: Array<{ id: string; label: MultilingualString; value: MultilingualString }> = [
  { id: 'all-ages', label: { en: 'All ages', zh: '全年龄段' }, value: { en: 'All ages', zh: '全年龄段' } },
  { id: 'children', label: { en: 'Children (0–12)', zh: '儿童（0–12 岁）' }, value: { en: 'Children aged 0–12', zh: '0–12 岁儿童' } },
  { id: 'youth', label: { en: 'Youth (13–17)', zh: '青少年（13–17 岁）' }, value: { en: 'Youth aged 13–17', zh: '13–17 岁青少年' } },
  { id: 'adults', label: { en: 'Adults (18+)', zh: '成人（18 岁以上）' }, value: { en: 'Adults aged 18 and over', zh: '18 岁及以上成人' } },
  { id: 'seniors', label: { en: 'Seniors (65+)', zh: '长者（65 岁以上）' }, value: { en: 'Seniors aged 65 and over', zh: '65 岁及以上长者' } },
  { id: 'families', label: { en: 'Families', zh: '家庭' }, value: { en: 'Families with children and adults', zh: '儿童与成人家庭成员' } },
]

const commonRiskPresets: Array<{
  id: string
  label: MultilingualString
  hazard: MultilingualString
  controlMeasures: MultilingualString
}> = [
  {
    id: 'slips-trips-falls',
    label: { en: 'Slips, trips and falls', zh: '滑倒、绊倒和跌倒' },
    hazard: { en: 'Slips, trips and falls', zh: '滑倒、绊倒和跌倒' },
    controlMeasures: {
      en: 'Keep walkways clear, clean spills promptly, and identify uneven or slippery surfaces.',
      zh: '保持通道畅通，及时清理积水，并标识不平整或湿滑区域。',
    },
  },
  {
    id: 'food-allergies',
    label: { en: 'Food allergies', zh: '食物过敏' },
    hazard: { en: 'Food allergies and cross-contamination', zh: '食物过敏与交叉污染' },
    controlMeasures: {
      en: 'Confirm known allergies, label ingredients, and separate food where cross-contamination is possible.',
      zh: '确认已知过敏情况，标注食材，并将可能交叉污染的食物分开。',
    },
  },
  {
    id: 'child-supervision',
    label: { en: 'Child supervision', zh: '儿童看护' },
    hazard: { en: 'Inadequate child supervision', zh: '儿童看护不足' },
    controlMeasures: {
      en: 'Confirm suitable supervision, use clear sign-in and sign-out arrangements, and identify safe activity areas.',
      zh: '确认合适的看护安排，使用清晰的签到签退流程，并划定安全活动区域。',
    },
  },
  {
    id: 'transport',
    label: { en: 'Transport and vehicles', zh: '交通与车辆' },
    hazard: { en: 'Transport and vehicle safety', zh: '交通与车辆安全' },
    controlMeasures: {
      en: 'Confirm drivers, licences, vehicle Rego and WOF, seatbelts, passenger numbers, and the planned route.',
      zh: '确认驾驶员、驾照、车辆 Rego 与 WOF、安全带、乘员人数和行车路线。',
    },
  },
  {
    id: 'weather',
    label: { en: 'Weather exposure', zh: '天气暴露' },
    hazard: { en: 'Adverse weather exposure', zh: '恶劣天气暴露' },
    controlMeasures: {
      en: 'Review the forecast and confirm shelter, drinking water, sun or rain protection, and an alternative plan.',
      zh: '查看天气预报，并确认遮蔽处、饮用水、防晒或防雨措施及备用方案。',
    },
  },
  {
    id: 'manual-handling',
    label: { en: 'Lifting and equipment', zh: '搬运与设备' },
    hazard: { en: 'Manual handling and equipment injury', zh: '搬运与设备造成的伤害' },
    controlMeasures: {
      en: 'Inspect equipment, use suitable lifting methods, share heavy loads, and keep setup areas clear.',
      zh: '检查设备，采用合适的搬运方式，重物由多人搬运，并保持布置区域畅通。',
    },
  },
]

const riskTone = (score: number | null) => {
  if (score === null) return 'bg-slate-100 text-slate-600'
  if (score >= 20) return 'bg-red-100 text-red-800'
  if (score >= 12) return 'bg-orange-100 text-orange-800'
  if (score >= 6) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

type RamSectionId = 'basic' | 'risks' | 'contacts' | 'confirmation'

const hasBilingualText = (value: MultilingualString) => Boolean(value.zh.trim() && value.en.trim())
const isRiskScore = (value: number | null) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5

const isHazardComplete = (hazard: RamHazard) => (
  hasBilingualText(hazard.hazard)
  && isRiskScore(hazard.likelihood)
  && isRiskScore(hazard.impact)
  && hazard.riskScore === Number(hazard.likelihood) * Number(hazard.impact)
  && hasBilingualText(hazard.controlMeasures)
  && Boolean(hazard.personResponsible.trim())
)

const isOutingSafetyComplete = (ram: EventRamDraft) => {
  if (!ram.isOuting) return true
  const safety = ram.outingSafety
  if (safety.transportRequired === null
    || !safety.venueRiskAssessed
    || !safety.firstAidKitAvailable
    || !safety.trainedFirstAiderName.trim()
    || !safety.trainedFirstAiderQualificationConfirmed
    || !safety.participantHealthNeedsReviewed
    || !safety.weatherPlanReviewed) {
    return false
  }
  return !safety.transportRequired
    || Boolean(safety.licensedDriverConfirmed && safety.vehicleRegistrationConfirmed && safety.vehicleWofConfirmed)
}

const RamCollapsibleSection = ({
  id,
  title,
  summary,
  complete,
  expanded,
  completeLabel,
  incompleteLabel,
  onToggle,
  children,
}: {
  id: RamSectionId
  title: string
  summary: string
  complete: boolean
  expanded: boolean
  completeLabel: string
  incompleteLabel: string
  onToggle: () => void
  children: ReactNode
}) => (
  <section className={['overflow-hidden rounded-2xl border transition', complete ? 'border-emerald-200' : 'border-slate-200'].join(' ')}>
    <h3 id={`ram-section-heading-${id}`} className="scroll-mt-24">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`ram-section-${id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-white px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <span className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black', complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'].join(' ')}>
          {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : '!'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-black text-slate-950">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{summary}</span>
        </span>
        <span className={['hidden rounded-full px-2.5 py-1 text-[11px] font-black sm:inline-flex', complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'].join(' ')}>
          {complete ? completeLabel : incompleteLabel}
        </span>
        <ChevronDown className={['h-5 w-5 shrink-0 text-slate-400 transition-transform', expanded ? 'rotate-180' : ''].join(' ')} aria-hidden="true" />
      </button>
    </h3>
    <div id={`ram-section-${id}`} hidden={!expanded} className="border-t border-slate-200 bg-slate-50/40 p-4 sm:p-5">
      {children}
    </div>
  </section>
)

const EventRamEditor = ({ ram, status, language, canEdit, canAudit, canSubmit = false, currentMemberId = null, submittedByMemberId = null, busy = false, autosaveEnabled = false, autosaveStatus = 'idle', lastSavedAt = null, onChange, onSave, onSubmit, onApprove, onReturn }: Props) => {
  const isZh = language === 'zh'
  const l = (en: string, zh: string) => isZh ? zh : en
  const lastSavedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString(isZh ? 'zh-CN' : 'en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''
  const autosaveText = !autosaveEnabled
    ? l('Auto-save starts after the event is created', '活动创建后启用自动保存')
    : autosaveStatus === 'pending'
    ? l('Waiting to auto-save…', '等待自动保存…')
    : autosaveStatus === 'saving'
      ? l('Auto-saving…', '正在自动保存…')
      : autosaveStatus === 'error'
        ? l('Auto-save failed. Changes are still local.', '自动保存失败，修改仍保留在本页。')
        : lastSavedTime
          ? l(`Last saved ${lastSavedTime}`, `最后保存 ${lastSavedTime}`)
          : l('Auto-save ready', '自动保存已就绪')
  const basicComplete = hasBilingualText(ram.activityName)
    && hasBilingualText(ram.activityDescription)
    && hasBilingualText(ram.participantAgeRange)
    && Number.isInteger(ram.participantCount)
    && Number(ram.participantCount) >= 1
    && typeof ram.isOuting === 'boolean'
  const risksComplete = ram.hazards.length > 0
    && ram.hazards.every(isHazardComplete)
    && isOutingSafetyComplete(ram)
  const contactsComplete = ram.emergencyContacts.length > 0
    && ram.emergencyContacts.every((contact) => (
      hasBilingualText(contact.role)
      && Boolean(contact.name.trim())
      && Boolean(contact.phone.trim())
    ))
  const confirmationComplete = ram.missingInformation.length === 0 && ram.leaderConfirmed
  const sectionCompletion: Record<RamSectionId, boolean> = {
    basic: basicComplete,
    risks: risksComplete,
    contacts: contactsComplete,
    confirmation: confirmationComplete,
  }
  const sectionOrder: RamSectionId[] = ['basic', 'risks', 'contacts', 'confirmation']
  const firstIncompleteSection = sectionOrder.find((section) => !sectionCompletion[section]) ?? null
  const [expandedSections, setExpandedSections] = useState<Record<RamSectionId, boolean>>(() => {
    const firstIncomplete = firstIncompleteSection ?? 'confirmation'
    return {
      basic: firstIncomplete === 'basic',
      risks: firstIncomplete === 'risks',
      contacts: firstIncomplete === 'contacts',
      confirmation: firstIncomplete === 'confirmation',
    }
  })
  const [submitGuidance, setSubmitGuidance] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [selectedRiskPresetId, setSelectedRiskPresetId] = useState('')
  const completedSectionCount = Object.values(sectionCompletion).filter(Boolean).length
  const progressPercent = completedSectionCount * 25
  const isSelfReview = Boolean(currentMemberId && submittedByMemberId && currentMemberId === submittedByMemberId)
  const canReview = canAudit && status === 'awaitingReview' && !isSelfReview
  const showActionBar = Boolean(
    (canEdit && onSave)
    || (canEdit && onSubmit && status === 'draft')
    || (canAudit && status === 'awaitingReview'),
  )
  const fieldClass = (invalid: boolean, extra = '') => [
    'mt-1 w-full rounded-lg border px-3 py-2 font-normal outline-none transition focus:ring-2 focus:ring-teal-100',
    invalid ? 'border-amber-400 bg-amber-50/50 focus:border-amber-500' : 'border-slate-300 bg-white focus:border-teal-500',
    extra,
  ].join(' ')
  const sectionLabel = (section: RamSectionId) => ({
    basic: l('Basic information', '基本信息'),
    risks: l('Risks', '风险'),
    contacts: l('Contacts', '联系人'),
    confirmation: l('Human confirmation', '人工确认'),
  })[section]
  const toggleSection = (section: RamSectionId) => {
    setExpandedSections((current) => ({
      basic: false,
      risks: false,
      contacts: false,
      confirmation: false,
      [section]: !current[section],
    }))
  }
  const openSection = (section: RamSectionId, focusFirstInvalid = false) => {
    setExpandedSections({
      basic: section === 'basic',
      risks: section === 'risks',
      contacts: section === 'contacts',
      confirmation: section === 'confirmation',
    })
    window.requestAnimationFrame(() => {
      document.getElementById(`ram-section-heading-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (focusFirstInvalid) {
        window.requestAnimationFrame(() => {
          const field = document.querySelector<HTMLElement>(`#ram-section-${section} [data-ram-invalid="true"]`)
          field?.focus({ preventScroll: true })
          field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    })
  }
  const handleSubmitAttempt = () => {
    if (firstIncompleteSection) {
      setSubmitGuidance(l(
        `Review ${sectionLabel(firstIncompleteSection)}. Focus moved to the first incomplete field.`,
        `请继续检查“${sectionLabel(firstIncompleteSection)}”，焦点已移到第一个未完成字段。`,
      ))
      openSection(firstIncompleteSection, true)
      return
    }
    setSubmitGuidance('')
    onSubmit?.()
  }
  const emit = (next: EventRamDraft, preserveConfirmation = false) => {
    setSubmitGuidance('')
    onChange({
      ...next,
      leaderConfirmed: preserveConfirmation ? next.leaderConfirmed : false,
    })
  }
  const updateText = (field: 'activityName' | 'activityDescription' | 'participantAgeRange', lang: 'en' | 'zh', value: string) => {
    emit({ ...ram, [field]: { ...ram[field], [lang]: value } })
  }
  const updateHazard = (index: number, patch: Partial<RamHazard>) => {
    const hazards = ram.hazards.map((hazard, hazardIndex) => {
      if (hazardIndex !== index) return hazard
      const next = { ...hazard, ...patch }
      next.riskScore = next.likelihood !== null && next.impact !== null ? next.likelihood * next.impact : null
      return next
    })
    emit({ ...ram, hazards })
  }
  const updateSafety = (field: keyof RamOutingSafety, value: string) => {
    const parsed = value === '' ? null : value === 'true'
    emit({ ...ram, outingSafety: { ...ram.outingSafety, [field]: parsed } })
  }
  const isOutingSafetyFieldInvalid = (field: keyof RamOutingSafety) => {
    if (!ram.isOuting) return false
    if (field === 'transportRequired') return ram.outingSafety.transportRequired === null
    if (field === 'licensedDriverConfirmed' || field === 'vehicleRegistrationConfirmed' || field === 'vehicleWofConfirmed') {
      return ram.outingSafety.transportRequired === true && ram.outingSafety[field] !== true
    }
    return ram.outingSafety[field] !== true
  }
  const addCommonRiskPreset = () => {
    const preset = commonRiskPresets.find((item) => item.id === selectedRiskPresetId)
    if (!preset) return
    emit({
      ...ram,
      hazards: [
        ...ram.hazards,
        {
          ...emptyHazard(),
          hazard: { ...preset.hazard },
          controlMeasures: { ...preset.controlMeasures },
        },
      ],
    })
    setSelectedRiskPresetId('')
  }

  return (
    <section className="space-y-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">RAM</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{l('Risk Assessment and Management', '风险评估与管理')}</h2>
          <p className="mt-1 text-sm text-slate-500">{l('Based on the church RAM manual. Risk score = likelihood x impact.', '依据教会 RAM 手册。风险分数 = 可能性 × 影响。')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">{statusText[status][language]}</span>
          <span aria-live="polite" className={['rounded-lg px-3 py-1.5 text-xs font-bold', !autosaveEnabled ? 'bg-slate-100 text-slate-600' : autosaveStatus === 'error' ? 'bg-rose-50 text-rose-700' : autosaveStatus === 'pending' || autosaveStatus === 'saving' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'].join(' ')}>
            {autosaveText}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">{l('Completion progress', '填写进度')}</p>
            <p className="mt-1 text-lg font-black text-slate-950">{l(`${completedSectionCount} of 4 sections complete`, `已完成 ${completedSectionCount}/4 个分区`)}</p>
          </div>
          <span className="text-2xl font-black text-teal-800">{progressPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={l('RAM completion progress', 'RAM 填写进度')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
          <div className="h-full rounded-full bg-teal-600 transition-[width]" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs leading-5 text-teal-800">{l('Amber fields still need attention. Use the section shortcuts or the action below to find the next item.', '琥珀色字段仍需补充；可使用分区快捷入口，或点击底部按钮定位下一项。')}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['basic', l('Basic information', '基本信息')],
            ['risks', l('Risks', '风险')],
            ['contacts', l('Contacts', '联系人')],
            ['confirmation', l('Human confirmation', '人工确认')],
          ] as Array<[RamSectionId, string]>).map(([section, label], index) => (
            <button key={section} type="button" onClick={() => openSection(section)} className={['flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-black transition', sectionCompletion[section] ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50' : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50'].join(' ')}>
              <span className={['flex h-6 w-6 shrink-0 items-center justify-center rounded-full', sectionCompletion[section] ? 'bg-emerald-100' : 'bg-amber-100'].join(' ')}>
                {sectionCompletion[section] ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <RamCollapsibleSection
          id="basic"
          title={l('Basic information', '基本信息')}
          summary={basicComplete ? l('Activity details and attendance are complete.', '活动资料和参与信息已补齐。') : l('Complete the bilingual activity details, attendance, and outing choice.', '请补齐双语活动资料、参加人数和活动性质。')}
          complete={basicComplete}
          expanded={expandedSections.basic}
          completeLabel={l('Complete', '已完成')}
          incompleteLabel={l('Needs attention', '待补充')}
          onToggle={() => toggleSection('basic')}
        >
          <fieldset disabled={!canEdit || busy} className="grid gap-4 disabled:opacity-75 md:grid-cols-2">
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`name-${lang}`} className="text-sm font-semibold text-slate-700">
              {l('Activity name', '活动名称')} ({lang})
              <input value={ram.activityName[lang]} onChange={(e) => updateText('activityName', lang, e.target.value)} aria-invalid={!ram.activityName[lang].trim()} data-ram-invalid={!ram.activityName[lang].trim()} className={fieldClass(!ram.activityName[lang].trim())} />
            </label>
          ))}
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`description-${lang}`} className="text-sm font-semibold text-slate-700">
              {l('Activity description', '活动描述')} ({lang})
              <textarea value={ram.activityDescription[lang]} onChange={(e) => updateText('activityDescription', lang, e.target.value)} rows={3} aria-invalid={!ram.activityDescription[lang].trim()} data-ram-invalid={!ram.activityDescription[lang].trim()} className={fieldClass(!ram.activityDescription[lang].trim())} />
            </label>
          ))}
          <label className="text-sm font-semibold text-slate-700">{l('Participant count', '参加人数')}
            <input type="number" min={1} value={ram.participantCount ?? ''} onChange={(e) => emit({ ...ram, participantCount: e.target.value ? Number(e.target.value) : null })} aria-invalid={!Number.isInteger(ram.participantCount) || Number(ram.participantCount) < 1} data-ram-invalid={!Number.isInteger(ram.participantCount) || Number(ram.participantCount) < 1} className={fieldClass(!Number.isInteger(ram.participantCount) || Number(ram.participantCount) < 1)} />
          </label>
          <label className="text-sm font-semibold text-slate-700">{l('Is this an outing?', '是否为外出活动？')}
            <select value={ram.isOuting === null ? '' : String(ram.isOuting)} onChange={(e) => emit({ ...ram, isOuting: e.target.value === '' ? null : e.target.value === 'true' })} aria-invalid={ram.isOuting === null} data-ram-invalid={ram.isOuting === null} className={fieldClass(ram.isOuting === null)}>
              {boolOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}
            </select>
          </label>
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-slate-700">{l('Common age ranges', '常用年龄范围')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ageRangePresets.map((preset) => {
                const selected = ram.participantAgeRange.zh === preset.value.zh && ram.participantAgeRange.en === preset.value.en
                return (
                  <button key={preset.id} type="button" aria-pressed={selected} onClick={() => emit({ ...ram, participantAgeRange: { ...preset.value } })} className={['rounded-full border px-3 py-1.5 text-xs font-bold transition', selected ? 'border-teal-500 bg-teal-100 text-teal-900' : 'border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'].join(' ')}>
                    {preset.label[language]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{l('Choose a common range or edit the bilingual fields below.', '可选择常用范围，也可以继续编辑下方中英文字段。')}</p>
          </div>
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`age-${lang}`} className="text-sm font-semibold text-slate-700">{l('Participant age range', '参与者年龄范围')} ({lang})
              <input value={ram.participantAgeRange[lang]} onChange={(e) => updateText('participantAgeRange', lang, e.target.value)} aria-invalid={!ram.participantAgeRange[lang].trim()} data-ram-invalid={!ram.participantAgeRange[lang].trim()} className={fieldClass(!ram.participantAgeRange[lang].trim())} />
            </label>
          ))}
          </fieldset>
        </RamCollapsibleSection>

        <RamCollapsibleSection
          id="risks"
          title={l('Risks', '风险')}
          summary={risksComplete ? l(`${ram.hazards.length} risk item(s) checked.`, `已核对 ${ram.hazards.length} 个风险项。`) : l('Complete each hazard, its controls, and any outing safety checks.', '请补齐每项危害、控制措施和外出安全核对。')}
          complete={risksComplete}
          expanded={expandedSections.risks}
          completeLabel={l('Complete', '已完成')}
          incompleteLabel={l('Needs attention', '待补充')}
          onToggle={() => toggleSection('risks')}
        >
          <fieldset disabled={!canEdit || busy} className="space-y-5 disabled:opacity-75">
          <div>
          <div>
            <h3 className="font-black text-slate-900">{l('Hazard identification and controls', '危害识别与控制措施')}</h3>
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <label htmlFor="ram-common-risk" className="text-xs font-black text-sky-950">{l('Start with a common risk', '选择一个常用风险')}</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select id="ram-common-risk" value={selectedRiskPresetId} onChange={(event) => setSelectedRiskPresetId(event.target.value)} data-ram-invalid={ram.hazards.length === 0} className="min-h-10 min-w-0 flex-1 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
                  <option value="">{l('Select a common risk…', '请选择常用风险…')}</option>
                  {commonRiskPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label[language]}</option>)}
                </select>
                <button type="button" disabled={!selectedRiskPresetId} onClick={addCommonRiskPreset} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{l('Add selected risk', '添加所选风险')}</button>
                <button type="button" onClick={() => emit({ ...ram, hazards: [...ram.hazards, emptyHazard()] })} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-800"><Plus className="h-3.5 w-3.5" />{l('Add blank risk', '添加空白风险')}</button>
              </div>
              <p className="mt-2 text-xs leading-5 text-sky-800">{l('The preset adds editable hazard and control suggestions only. Confirm likelihood, impact, and the responsible person yourself.', '预设只会添加可编辑的风险名称和控制措施建议；可能性、影响和负责人仍须人工确认。')}</p>
            </div>
          </div>
          <div className="mt-3 space-y-4">
            {ram.hazards.map((hazard, index) => (
              <div key={hazard.id || index} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><span className="text-sm font-black text-slate-700">{l('Hazard', '危害')} {index + 1}</span>{canEdit ? <button type="button" aria-label={l('Remove hazard', '删除危害')} onClick={() => emit({ ...ram, hazards: ram.hazards.filter((_, i) => i !== index) })} className="text-rose-600"><Trash2 className="h-4 w-4" /></button> : null}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(['zh', 'en'] as const).map((lang) => <label key={`hazard-${lang}`} className="text-xs font-bold text-slate-600">{l('Hazard', '危害')} ({lang})<input value={hazard.hazard[lang]} onChange={(e) => updateHazard(index, { hazard: { ...hazard.hazard, [lang]: e.target.value } })} aria-invalid={!hazard.hazard[lang].trim()} data-ram-invalid={!hazard.hazard[lang].trim()} className={fieldClass(!hazard.hazard[lang].trim(), 'text-sm')} /></label>)}
                  <label className="text-xs font-bold text-slate-600">{l('Likelihood (1-5)', '可能性（1–5）')}<select value={hazard.likelihood ?? ''} onChange={(e) => updateHazard(index, { likelihood: e.target.value ? Number(e.target.value) : null })} aria-invalid={!isRiskScore(hazard.likelihood)} data-ram-invalid={!isRiskScore(hazard.likelihood)} className={fieldClass(!isRiskScore(hazard.likelihood), 'text-sm')}><option value="">—</option>{likelihoodOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>
                  <label className="text-xs font-bold text-slate-600">{l('Impact (1-5)', '影响（1–5）')}<select value={hazard.impact ?? ''} onChange={(e) => updateHazard(index, { impact: e.target.value ? Number(e.target.value) : null })} aria-invalid={!isRiskScore(hazard.impact)} data-ram-invalid={!isRiskScore(hazard.impact)} className={fieldClass(!isRiskScore(hazard.impact), 'text-sm')}><option value="">—</option>{impactOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>
                  <div className="md:col-span-2"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${riskTone(hazard.riskScore)}`}>{l('Risk score', '风险分数')}: {hazard.riskScore ?? '—'}</span></div>
                  {(['zh', 'en'] as const).map((lang) => <label key={`control-${lang}`} className="text-xs font-bold text-slate-600">{l('Control measures', '控制措施')} ({lang})<textarea value={hazard.controlMeasures[lang]} onChange={(e) => updateHazard(index, { controlMeasures: { ...hazard.controlMeasures, [lang]: e.target.value } })} rows={2} aria-invalid={!hazard.controlMeasures[lang].trim()} data-ram-invalid={!hazard.controlMeasures[lang].trim()} className={fieldClass(!hazard.controlMeasures[lang].trim(), 'text-sm')} /></label>)}
                  <label className="text-xs font-bold text-slate-600 md:col-span-2">{l('Person responsible - exact confirmed name only', '负责人 - 仅填写已确认的准确姓名')}<input value={hazard.personResponsible} onChange={(e) => updateHazard(index, { personResponsible: e.target.value })} aria-invalid={!hazard.personResponsible.trim()} data-ram-invalid={!hazard.personResponsible.trim()} className={fieldClass(!hazard.personResponsible.trim(), 'text-sm')} /></label>
                </div>
              </div>
            ))}
          </div>
          </div>

          {ram.isOuting ? <div><h4 className="font-black text-slate-900">{l('Outing safety checks', '外出活动安全核对')}</h4><div className="mt-3 grid gap-3 md:grid-cols-2">
            {([
              ['transportRequired', 'Transport required', '需要交通工具'],
              ['licensedDriverConfirmed', 'Licensed driver confirmed', '已确认合格驾驶员'],
              ['vehicleRegistrationConfirmed', 'Current vehicle registration confirmed', '已确认车辆 Rego 有效'],
              ['vehicleWofConfirmed', 'Current WOF confirmed', '已确认车辆 WOF 有效'],
              ['venueRiskAssessed', 'Venue risk assessed', '已评估活动场地风险'],
              ['firstAidKitAvailable', 'First-aid kit available', '已备妥急救箱'],
              ['trainedFirstAiderQualificationConfirmed', 'First-aid qualification confirmed', '已确认急救资格'],
              ['participantHealthNeedsReviewed', 'Participant health needs reviewed', '已核对参与者健康需求'],
              ['weatherPlanReviewed', 'Weather plan reviewed', '已核对天气预案'],
            ] as Array<[keyof RamOutingSafety, string, string]>).map(([field, en, zh]) => <label key={field} className="text-xs font-bold text-slate-600">{l(en, zh)}<select value={ram.outingSafety[field] === null ? '' : String(ram.outingSafety[field])} onChange={(e) => updateSafety(field, e.target.value)} aria-invalid={isOutingSafetyFieldInvalid(field)} data-ram-invalid={isOutingSafetyFieldInvalid(field)} className={fieldClass(isOutingSafetyFieldInvalid(field), 'text-sm')}>{boolOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>)}
            <label className="text-xs font-bold text-slate-600 md:col-span-2">{l('Trained first aider - exact confirmed name only', '受训急救员 - 仅填写已确认的准确姓名')}<input value={ram.outingSafety.trainedFirstAiderName} onChange={(e) => emit({ ...ram, outingSafety: { ...ram.outingSafety, trainedFirstAiderName: e.target.value } })} aria-invalid={!ram.outingSafety.trainedFirstAiderName.trim()} data-ram-invalid={!ram.outingSafety.trainedFirstAiderName.trim()} className={fieldClass(!ram.outingSafety.trainedFirstAiderName.trim(), 'text-sm')} /></label>
          </div></div> : null}
          </fieldset>
        </RamCollapsibleSection>

        <RamCollapsibleSection
          id="contacts"
          title={l('Contacts', '联系人')}
          summary={contactsComplete ? l(`${ram.emergencyContacts.length} emergency contact(s) checked.`, `已核对 ${ram.emergencyContacts.length} 位紧急联系人。`) : l('Add at least one confirmed emergency contact.', '请至少补齐一位已确认的紧急联系人。')}
          complete={contactsComplete}
          expanded={expandedSections.contacts}
          completeLabel={l('Complete', '已完成')}
          incompleteLabel={l('Needs attention', '待补充')}
          onToggle={() => toggleSection('contacts')}
        >
          <fieldset disabled={!canEdit || busy} className="disabled:opacity-75">
          <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{l('Emergency contacts', '紧急联系人')}</h3>{canEdit ? <button type="button" onClick={() => emit({ ...ram, emergencyContacts: [...ram.emergencyContacts, { role: emptyText(), name: '', phone: '' }] })} data-ram-invalid={ram.emergencyContacts.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800"><Plus className="h-3.5 w-3.5" />{l('Add contact', '添加联系人')}</button> : null}</div>
          <div className="mt-3 space-y-3">
            {ram.emergencyContacts.map((contact, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
              {(['zh', 'en'] as const).map((lang) => <label key={lang} className="text-xs font-bold text-slate-600">{l('Role', '角色')} ({lang})<input value={contact.role[lang]} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, role: { ...item.role, [lang]: e.target.value } } : item) })} aria-invalid={!contact.role[lang].trim()} data-ram-invalid={!contact.role[lang].trim()} className={fieldClass(!contact.role[lang].trim(), 'text-sm')} /></label>)}
              <label className="text-xs font-bold text-slate-600">{l('Name - do not guess', '姓名 - 不得猜测')}<input value={contact.name} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, name: e.target.value } : item) })} aria-invalid={!contact.name.trim()} data-ram-invalid={!contact.name.trim()} className={fieldClass(!contact.name.trim(), 'text-sm')} /></label>
              <label className="text-xs font-bold text-slate-600">{l('Phone - do not guess', '电话 - 不得猜测')}<div className="flex gap-2"><input value={contact.phone} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, phone: e.target.value } : item) })} aria-invalid={!contact.phone.trim()} data-ram-invalid={!contact.phone.trim()} className={fieldClass(!contact.phone.trim(), 'min-w-0 flex-1 text-sm')} /><button type="button" aria-label={l(`Remove contact ${index + 1}`, `删除联系人 ${index + 1}`)} onClick={() => emit({ ...ram, emergencyContacts: ram.emergencyContacts.filter((_, i) => i !== index) })} className="text-rose-600"><Trash2 className="h-4 w-4" /></button></div></label>
            </div>)}
          </div>
          </fieldset>
        </RamCollapsibleSection>

        <RamCollapsibleSection
          id="confirmation"
          title={l('Human confirmation', '人工确认')}
          summary={confirmationComplete ? l('AI markers are resolved and the leader has confirmed the RAM.', 'AI 缺失标记已处理，组长已完成人工确认。') : ram.missingInformation.length > 0 ? l(`${ram.missingInformation.length} AI-marked item(s) still need review.`, `还有 ${ram.missingInformation.length} 项 AI 缺失标记需要处理。`) : l('The leader must confirm all facts before submission.', '提交前需要组长确认所有资料均为真实事实。')}
          complete={confirmationComplete}
          expanded={expandedSections.confirmation}
          completeLabel={l('Complete', '已完成')}
          incompleteLabel={l('Needs confirmation', '待确认')}
          onToggle={() => toggleSection('confirmation')}
        >
          <div className="space-y-4">
            {ram.missingInformation.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="h-4 w-4" />{l('AI marked missing information', 'AI 标记的缺失信息')}</div>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-amber-800">
                  {ram.missingInformation.map((item, index) => <li key={`${item.fieldPath}-${index}`}>
                    {item.message[language] || item.message.en || item.message.zh} <span className="text-xs opacity-70">({item.fieldPath})</span>
                    {canEdit ? <button type="button" disabled={busy} data-ram-invalid="true" onClick={() => emit({ ...ram, missingInformation: ram.missingInformation.filter((_, itemIndex) => itemIndex !== index) })} className="ml-2 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-bold text-amber-800 disabled:opacity-50">{l('Mark resolved', '标记为已解决')}</button> : null}
                  </li>)}
                </ul>
                <p className="mt-2 text-xs text-amber-700">{l('Fill the related fields, then remove only the markers you have verified.', '请先补齐相关字段，只移除已经人工核实的标记。')}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {l('No unresolved AI markers remain.', '没有未处理的 AI 缺失标记。')}
              </div>
            )}

            {canEdit ? <label className={['flex items-start gap-3 rounded-xl border p-4 text-sm', ram.leaderConfirmed ? 'border-teal-200 bg-teal-50 text-teal-950' : 'border-amber-300 bg-amber-50 text-amber-950'].join(' ')}><input type="checkbox" disabled={busy} checked={ram.leaderConfirmed} aria-invalid={!ram.leaderConfirmed} data-ram-invalid={!ram.leaderConfirmed} onChange={(e) => { setSubmitGuidance(''); onChange({ ...ram, leaderConfirmed: e.target.checked }) }} className="mt-0.5" /><span><strong>{l('Leader confirmation', '组长人工确认')}</strong><span className="mt-1 block text-xs leading-5">{l('I checked the RAM against the real activity details. Names, phones, qualifications, licences, Rego and WOF are confirmed facts, not AI assumptions.', '我已按真实活动资料核对 RAM；姓名、电话、资质、驾照、Rego 与 WOF 均为已确认事实，并非 AI 推断。')}</span></span></label> : (
              <div className={['rounded-xl border px-4 py-3 text-sm font-bold', ram.leaderConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'].join(' ')}>
                {ram.leaderConfirmed ? l('Leader confirmation recorded.', '已记录组长人工确认。') : l('Leader confirmation is still required.', '仍需组长进行人工确认。')}
              </div>
            )}
          </div>
        </RamCollapsibleSection>
      </div>

      {showActionBar ? <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur">
        <p className="sr-only" aria-live="polite">{submitGuidance}</p>
        {submitGuidance ? <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900" aria-hidden="true">{submitGuidance}</p> : null}
        {status === 'awaitingReview' && canAudit ? <div className="mb-3 space-y-2">
          {isSelfReview ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{l('You submitted this RAM, so another authorized person must review it.', '这份 RAM 是你提交的，必须由另一位有权限的人审核，不能自己批准。')}</p> : <>
            <label className="block text-xs font-bold text-slate-700">{l('Review notes', '审核意见')}<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} maxLength={2000} rows={2} placeholder={l('Optional when approving; required when returning for changes.', '批准时可选；退回修改时必须填写原因。')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
            <p className="text-xs text-slate-500">{l('Check the hazards, controls, named responsible people and emergency contacts. AI cannot make this decision.', '请核对风险、控制措施、明确负责人和紧急联系人。AI 不能替你作出审批决定。')}</p>
          </>}
        </div> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
        {canEdit && onSave ? <button type="button" disabled={busy} onClick={onSave} className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-bold text-teal-800 disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />{l('Save now', '立即保存')}</button> : null}
        {canEdit && onSubmit && status === 'draft' ? <button type="button" disabled={busy || (!canSubmit && !firstIncompleteSection)} onClick={handleSubmitAttempt} title={firstIncompleteSection ? l('Opens the first incomplete section without submitting.', '资料尚未完成；点击后定位到第一个未完成分区，不会提交。') : undefined} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{firstIncompleteSection ? l('Find next incomplete item', '定位下一未完成项') : l('Send for review', '提交审核')}</button> : null}
        {canReview && onReturn ? <button type="button" disabled={busy || reviewNotes.trim().length < 3} onClick={() => onReturn(reviewNotes.trim())} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" />{l('Return for changes', '退回修改')}</button> : null}
        {canReview && onApprove ? <button type="button" disabled={busy} onClick={() => onApprove(reviewNotes.trim())} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{l('Approve RAM', '批准 RAM')}</button> : null}
        </div>
      </div> : null}
    </section>
  )
}

export default EventRamEditor
