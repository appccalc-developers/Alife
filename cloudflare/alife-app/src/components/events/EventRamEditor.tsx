import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { EventRamDraft, EventRamStatus, MultilingualString, RamHazard, RamOutingSafety } from '../../types/event'

type Props = {
  ram: EventRamDraft
  status: EventRamStatus
  language: 'en' | 'zh'
  canEdit: boolean
  canAudit: boolean
  canSubmit?: boolean
  busy?: boolean
  onChange: (ram: EventRamDraft) => void
  onSave?: () => void
  onSubmit?: () => void
  onApprove?: () => void
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

const riskTone = (score: number | null) => {
  if (score === null) return 'bg-slate-100 text-slate-600'
  if (score >= 20) return 'bg-red-100 text-red-800'
  if (score >= 12) return 'bg-orange-100 text-orange-800'
  if (score >= 6) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

const EventRamEditor = ({ ram, status, language, canEdit, canAudit, canSubmit = false, busy = false, onChange, onSave, onSubmit, onApprove }: Props) => {
  const isZh = language === 'zh'
  const l = (en: string, zh: string) => isZh ? zh : en
  const emit = (next: EventRamDraft, preserveConfirmation = false) => onChange({
    ...next,
    leaderConfirmed: preserveConfirmation ? next.leaderConfirmed : false,
  })
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

  return (
    <section className="space-y-5 rounded-2xl border border-teal-200 bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">RAM</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{l('Risk Assessment and Management', '风险评估与管理')}</h2>
          <p className="mt-1 text-sm text-slate-500">{l('Based on the church RAM manual. Risk score = likelihood x impact.', '依据教会 RAM 手册。风险分数 = 可能性 × 影响。')}</p>
        </div>
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">{statusText[status][language]}</span>
      </div>

      {ram.missingInformation.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="h-4 w-4" />{l('AI marked missing information', 'AI 标记的缺失信息')}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {ram.missingInformation.map((item, index) => <li key={`${item.fieldPath}-${index}`}>
              {item.message[language] || item.message.en || item.message.zh} <span className="text-xs opacity-70">({item.fieldPath})</span>
              {canEdit ? <button type="button" onClick={() => emit({ ...ram, missingInformation: ram.missingInformation.filter((_, itemIndex) => itemIndex !== index) })} className="ml-2 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-bold text-amber-800">{l('Mark resolved', '标记为已解决')}</button> : null}
            </li>)}
          </ul>
          <p className="mt-2 text-xs text-amber-700">{l('Fill the fields below, then remove resolved markers by asking AI to re-check the RAM.', '请补齐下方字段，再请 AI 重新检查 RAM 并移除已解决的标记。')}</p>
        </div>
      ) : null}

      <fieldset disabled={!canEdit || busy} className="space-y-5 disabled:opacity-75">
        <div className="grid gap-4 md:grid-cols-2">
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`name-${lang}`} className="text-sm font-semibold text-slate-700">
              {l('Activity name', '活动名称')} ({lang})
              <input value={ram.activityName[lang]} onChange={(e) => updateText('activityName', lang, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
          ))}
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`description-${lang}`} className="text-sm font-semibold text-slate-700">
              {l('Activity description', '活动描述')} ({lang})
              <textarea value={ram.activityDescription[lang]} onChange={(e) => updateText('activityDescription', lang, e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
          ))}
          <label className="text-sm font-semibold text-slate-700">{l('Participant count', '参加人数')}
            <input type="number" min={1} value={ram.participantCount ?? ''} onChange={(e) => emit({ ...ram, participantCount: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">{l('Is this an outing?', '是否为外出活动？')}
            <select value={ram.isOuting === null ? '' : String(ram.isOuting)} onChange={(e) => emit({ ...ram, isOuting: e.target.value === '' ? null : e.target.value === 'true' })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
              {boolOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}
            </select>
          </label>
          {(['zh', 'en'] as const).map((lang) => (
            <label key={`age-${lang}`} className="text-sm font-semibold text-slate-700">{l('Participant age range', '参与者年龄范围')} ({lang})
              <input value={ram.participantAgeRange[lang]} onChange={(e) => updateText('participantAgeRange', lang, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-slate-900">{l('Hazard identification and controls', '危害识别与控制措施')}</h3>
            {canEdit ? <button type="button" onClick={() => emit({ ...ram, hazards: [...ram.hazards, emptyHazard()] })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800"><Plus className="h-3.5 w-3.5" />{l('Add hazard', '添加危害')}</button> : null}
          </div>
          <div className="mt-3 space-y-4">
            {ram.hazards.map((hazard, index) => (
              <div key={hazard.id || index} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><span className="text-sm font-black text-slate-700">{l('Hazard', '危害')} {index + 1}</span>{canEdit ? <button type="button" aria-label={l('Remove hazard', '删除危害')} onClick={() => emit({ ...ram, hazards: ram.hazards.filter((_, i) => i !== index) })} className="text-rose-600"><Trash2 className="h-4 w-4" /></button> : null}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(['zh', 'en'] as const).map((lang) => <label key={`hazard-${lang}`} className="text-xs font-bold text-slate-600">{l('Hazard', '危害')} ({lang})<input value={hazard.hazard[lang]} onChange={(e) => updateHazard(index, { hazard: { ...hazard.hazard, [lang]: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
                  <label className="text-xs font-bold text-slate-600">{l('Likelihood (1-5)', '可能性（1–5）')}<select value={hazard.likelihood ?? ''} onChange={(e) => updateHazard(index, { likelihood: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">—</option>{likelihoodOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>
                  <label className="text-xs font-bold text-slate-600">{l('Impact (1-5)', '影响（1–5）')}<select value={hazard.impact ?? ''} onChange={(e) => updateHazard(index, { impact: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="">—</option>{impactOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>
                  <div className="md:col-span-2"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${riskTone(hazard.riskScore)}`}>{l('Risk score', '风险分数')}: {hazard.riskScore ?? '—'}</span></div>
                  {(['zh', 'en'] as const).map((lang) => <label key={`control-${lang}`} className="text-xs font-bold text-slate-600">{l('Control measures', '控制措施')} ({lang})<textarea value={hazard.controlMeasures[lang]} onChange={(e) => updateHazard(index, { controlMeasures: { ...hazard.controlMeasures, [lang]: e.target.value } })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
                  <label className="text-xs font-bold text-slate-600 md:col-span-2">{l('Person responsible - exact confirmed name only', '负责人 - 仅填写已确认的准确姓名')}<input value={hazard.personResponsible} onChange={(e) => updateHazard(index, { personResponsible: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{l('Emergency contacts', '紧急联系人')}</h3>{canEdit ? <button type="button" onClick={() => emit({ ...ram, emergencyContacts: [...ram.emergencyContacts, { role: emptyText(), name: '', phone: '' }] })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800"><Plus className="h-3.5 w-3.5" />{l('Add contact', '添加联系人')}</button> : null}</div>
          <div className="mt-3 space-y-3">
            {ram.emergencyContacts.map((contact, index) => <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2">
              {(['zh', 'en'] as const).map((lang) => <label key={lang} className="text-xs font-bold text-slate-600">{l('Role', '角色')} ({lang})<input value={contact.role[lang]} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, role: { ...item.role, [lang]: e.target.value } } : item) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
              <label className="text-xs font-bold text-slate-600">{l('Name - do not guess', '姓名 - 不得猜测')}<input value={contact.name} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, name: e.target.value } : item) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
              <label className="text-xs font-bold text-slate-600">{l('Phone - do not guess', '电话 - 不得猜测')}<div className="flex gap-2"><input value={contact.phone} onChange={(e) => emit({ ...ram, emergencyContacts: ram.emergencyContacts.map((item, i) => i === index ? { ...item, phone: e.target.value } : item) })} className="mt-1 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /><button type="button" onClick={() => emit({ ...ram, emergencyContacts: ram.emergencyContacts.filter((_, i) => i !== index) })} className="text-rose-600"><Trash2 className="h-4 w-4" /></button></div></label>
            </div>)}
          </div>
        </div>

        {ram.isOuting ? <div><h3 className="font-black text-slate-900">{l('Outing safety checks', '外出活动安全核对')}</h3><div className="mt-3 grid gap-3 md:grid-cols-2">
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
          ] as Array<[keyof RamOutingSafety, string, string]>).map(([field, en, zh]) => <label key={field} className="text-xs font-bold text-slate-600">{l(en, zh)}<select value={ram.outingSafety[field] === null ? '' : String(ram.outingSafety[field])} onChange={(e) => updateSafety(field, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal">{boolOptions.map((option) => <option key={option.value} value={option.value}>{option[language]}</option>)}</select></label>)}
          <label className="text-xs font-bold text-slate-600 md:col-span-2">{l('Trained first aider - exact confirmed name only', '受训急救员 - 仅填写已确认的准确姓名')}<input value={ram.outingSafety.trainedFirstAiderName} onChange={(e) => emit({ ...ram, outingSafety: { ...ram.outingSafety, trainedFirstAiderName: e.target.value } })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
        </div></div> : null}

        {canEdit ? <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"><input type="checkbox" checked={ram.leaderConfirmed} onChange={(e) => onChange({ ...ram, leaderConfirmed: e.target.checked })} className="mt-0.5" /><span><strong>{l('Leader confirmation', '组长人工确认')}</strong><span className="mt-1 block text-xs leading-5">{l('I checked the RAM against the real activity details. Names, phones, qualifications, licences, Rego and WOF are confirmed facts, not AI assumptions.', '我已按真实活动资料核对 RAM；姓名、电话、资质、驾照、Rego 与 WOF 均为已确认事实，并非 AI 推断。')}</span></span></label> : null}
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && onSave ? <button type="button" disabled={busy} onClick={onSave} className="inline-flex items-center gap-2 rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-bold text-teal-800 disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />{l('Save RAM draft', '保存 RAM 草稿')}</button> : null}
        {canEdit && onSubmit && status === 'draft' ? <button type="button" disabled={busy || !canSubmit} onClick={onSubmit} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{l('Send for review', '提交审核')}</button> : null}
        {canAudit && onApprove && status === 'awaitingReview' ? <button type="button" disabled={busy} onClick={onApprove} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{l('Approve RAM', '批准 RAM')}</button> : null}
      </div>
    </section>
  )
}

export default EventRamEditor
