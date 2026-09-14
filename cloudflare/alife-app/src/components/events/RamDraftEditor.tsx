import { useEffect, useRef, useState } from 'react'
import type { RamDraft, RamPolicyData, RamRisk } from '../../types/ramGovernance'
import { displayRamText as text, ramText } from '../../types/ramGovernance'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { ramChanges, ramDraftFingerprint, ramSuggestionFields } from '../../utils/ramAuthoring'
import RamAssessmentFields from './RamAssessmentFields'
import RamRequiredQuestions from './RamRequiredQuestions'
import { RamEditingLanguage, RamLevelBadge, ramInput } from './RamFields'
import { EventToolSection, revealArrangementControl } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'

type Context = Awaited<ReturnType<typeof ramService.authoringContext>>
type Check = Awaited<ReturnType<typeof ramService.check>>
type Suggestion = Awaited<ReturnType<typeof ramService.assist>>
const labels = { hazard: ['Hazard', '危害'], consequence: ['Consequence', '后果'], controlMeasures: ['Controls', '控制措施'], additionalAction: ['Additional action', '额外行动'] }

export default function RamDraftEditor({ eventId, groupId, draft, update, editable, dirty, zh, policy, policyVersionId, conditionsKey = '', savedDraft, contextVersion = '', onBusy, assistanceDisabled = false }: {
  eventId?: string; groupId?: string; draft: RamDraft; update: (change: Partial<RamDraft>) => void; editable: boolean; dirty: boolean; zh: boolean; policy?: RamPolicyData; policyVersionId?: string | null; conditionsKey?: string; savedDraft?: RamDraft; contextVersion?: string; onBusy?: (busy: boolean) => void; assistanceDisabled?: boolean
}) {
  const scope = eventId ? { eventId } : { groupId }
  const [context, setContext] = useState<Context | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [check, setCheck] = useState<{ result: Check; signature: string } | null>(null)
  const [brief, setBrief] = useState(''), [selected, setSelected] = useState(''), [activity, setActivity] = useState('')
  const [category, setCategory] = useState('environment'), [previewed, setPreviewed] = useState(false)
  const [focusRequest, setFocusRequest] = useState<object>()
  const [suggestion, setSuggestion] = useState<{ result: Suggestion; signature: string; riskId: string; activityId: string; category: string; language: 'en' | 'zh' } | null>(null)
  const [snippet, setSnippet] = useState<Partial<Record<typeof ramSuggestionFields[number], string>>>({})
  const initial = useRef(structuredClone(draft)), root = useRef<HTMLDivElement>(null)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const fingerprint = ramDraftFingerprint(draft, `${conditionsKey}:${contextVersion}`)
  const currentFingerprint = useRef(fingerprint); currentFingerprint.current = fingerprint
  useEffect(() => { let live = true; setContext(null); setSuggestion(null); setError(''); if (eventId || groupId) void ramService.authoringContext(eventId ? { eventId } : { groupId }).then(value => { if (live) setContext(value) }).catch(e => { if (live) setError(normalizeApiError(e).message) }); return () => { live = false } }, [eventId, groupId, contextVersion])
  useEffect(() => { onBusy?.(busy); return () => onBusy?.(false) }, [busy, onBusy])
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work() } catch (e) { setError(normalizeApiError(e).message) } finally { setBusy(false) } }
  const currentCheck = check?.signature === fingerprint ? check.result : null
  const effectivePolicy = policy || context?.policy?.data
  const changes = ramChanges(savedDraft || initial.current, draft)
  const jump = (field: string) => {
    setFocusRequest({ field })
    requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = field.replace(/^ram\.yellow\./, 'ram.risk.').replace(/^ram\.activity\..+$/, 'ram.activities')
    const container = root.current?.closest('[data-ram-workspace]') || root.current
    const elements = Array.from(container?.querySelectorAll<HTMLElement>('[data-ram-field]') || [])
    const element = elements.find(el => target === el.dataset.ramField) || elements.find(el => target.startsWith(`${el.dataset.ramField}.`))
    if (!element) return
    element.querySelectorAll('details').forEach(details => { details.open = true })
    if (element instanceof HTMLDetailsElement) element.open = true
    revealArrangementControl(element.querySelector<HTMLElement>('input,textarea,select,button') || element)
    requestAnimationFrame(() => { element.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); element.querySelector<HTMLElement>('input,textarea,select,button')?.focus({ preventScroll: true }) })
    }))
  }
  const selectRisk = (id: string) => {
    setSelected(id); setSuggestion(null); setPreviewed(false)
    const risk = draft.hazards.find(r => r.id === id)
    setActivity(risk?.activityId || draft.activities[0]?.id || ''); setCategory(risk?.categoryCode || 'environment')
    setSnippet(risk ? Object.fromEntries(ramSuggestionFields.map(key => [key, risk[key]?.[zh ? 'zh' : 'en'] || ''])) : {})
  }
  const adopt = (field: typeof ramSuggestionFields[number]) => {
    if (!suggestion || suggestion.signature !== fingerprint) return
    const { riskId, activityId, category: categoryCode, language } = suggestion
    const id = riskId || crypto.randomUUID()
    const blank: RamRisk = { id, activityId, categoryCode, hazard: ramText(), consequence: ramText(), controlMeasures: ramText(), additionalAction: ramText(), personResponsible: '', likelihood: null, impact: null, residualLikelihood: null, residualImpact: null }
    const risk = draft.hazards.find(r => r.id === id) || blank
    const next = { ...risk, [field]: { ...risk[field], [language]: suggestion.result.suggestions[field] || '' } }
    const nextDraft = { ...draft, hazards: draft.hazards.some(r => r.id === id) ? draft.hazards.map(r => r.id === id ? next : r) : [...draft.hazards, next] }
    update({ hazards: nextDraft.hazards }); setSelected(id)
    const remaining = { ...suggestion.result.suggestions }; delete remaining[field]
    setSuggestion({ ...suggestion, riskId: id, signature: ramDraftFingerprint(nextDraft, `${conditionsKey}:${contextVersion}`), result: { ...suggestion.result, suggestions: remaining } })
  }
  return <RamEditingLanguage.Provider value={zh}><div ref={root} className="space-y-4">
    <EventToolSection title={zh ? '起草助手与检查' : 'Draft assistance and checks'} summary={error ? (zh ? '操作失败，请展开查看' : 'Action failed; expand for details') : busy ? (zh ? '正在处理…' : 'Working…') : currentCheck ? (zh ? `${currentCheck.issues.length} 项待处理问题` : `${currentCheck.issues.length} issues to address`) : check ? (zh ? '草稿已改变，请重新检查' : 'Draft changed; check again') : !context && (eventId || groupId) ? (zh ? '正在读取…' : 'Loading…') : (zh ? '可检查当前草稿' : 'Ready to check the draft')}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><AppActionButton disabled={busy || !editable} onClick={() => void run(async () => { const signature = fingerprint; const result = await ramService.check(scope, draft, policyVersionId); if (currentFingerprint.current === signature) setCheck({ result, signature }) })}>{zh ? '检查草稿及评分' : 'Check draft and ratings'}</AppActionButton>
          <AppActionButton variant="secondary" disabled={busy || !editable || !dirty || !changes.length} onClick={() => void requestConfirmation({ title: zh ? '撤销未保存修改' : 'Discard unsaved changes', description: zh ? '恢复到最近保存的 RAM；未采纳的 AI 建议也会清除。' : 'Restore the last saved RAM and clear unadopted suggestions.' }).then(ok => { if (ok) { update(structuredClone(savedDraft || initial.current)); setSuggestion(null); setCheck(null) } })}>{zh ? '撤销未保存修改' : 'Discard unsaved changes'}</AppActionButton>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm">{error}</p> : null}
        {currentCheck ? <div role="status" className="space-y-2"><p>{zh ? '当前草稿评分（未保存）' : 'Current draft rating (not saved)'} <RamLevelBadge zh={zh} level={currentCheck.residualLevel} /></p>{currentCheck.issues.length ? <ul className="space-y-1">{currentCheck.issues.map(issue => <li key={issue.field}><button type="button" className="min-h-10 text-left text-sm text-[#176b5a] underline" onClick={() => jump(issue.field)}>{text(issue.message, zh)}</button></li>)}</ul> : <p>{zh ? '已填写完整，仍需明确保存和本人确认。' : 'Complete. Explicit saving and personal confirmation are still required.'}</p>}</div> : check ? <p className="text-sm">{zh ? '内容已改变，请重新检查。' : 'Content changed; check the draft again.'}</p> : null}
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? 'AI 协助起草／改写' : 'AI drafting / rewriting'}</summary><fieldset disabled={!editable || busy || assistanceDisabled} className="space-y-3">
          {assistanceDisabled ? <p>{zh ? '请先保存活动资料修改，再请求 AI 建议。' : 'Save Event changes before requesting AI suggestions.'}</p> : null}
          <label className="block text-sm">{zh ? '处理内容' : 'Working on'}<select className={ramInput} value={selected} onChange={e => selectRisk(e.target.value)}><option value="">{zh ? '起草新风险' : 'Draft a new risk'}</option>{draft.hazards.map((risk, index) => <option key={risk.id} value={risk.id}>{index + 1}. {text(risk.hazard, zh) || (zh ? '未命名风险' : 'Unnamed risk')}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? '所属项目' : 'Activity'}<select className={ramInput} value={activity || draft.activities[0]?.id || ''} onChange={e => { setActivity(e.target.value); setPreviewed(false) }}>{draft.activities.map(a => <option value={a.id} key={a.id}>{text(a.name, zh) || (zh ? '未命名项目' : 'Unnamed activity')}</option>)}</select></label><label className="text-sm">{zh ? '风险类别' : 'Risk category'}<select className={ramInput} value={category} onChange={e => { setCategory(e.target.value); setPreviewed(false) }}>{(effectivePolicy?.categories || [{ code: 'environment', name: { en: 'Environment', zh: '环境' } }, { code: 'activity', name: { en: 'Activity', zh: '活动' } }, { code: 'participants', name: { en: 'Participants', zh: '参与者' } }, { code: 'transport', name: { en: 'Transport', zh: '交通' } }, { code: 'emergency', name: { en: 'Emergency', zh: '应急准备' } }]).map(c => <option key={c.code} value={c.code}>{text(c.name, zh)}</option>)}</select></label></div>
          <label className="block text-sm">{zh ? '将发送的非敏感活动概要' : 'Non-sensitive activity brief to send'}<textarea rows={3} maxLength={3000} className={ramInput} value={brief} onChange={e => { setBrief(e.target.value); setPreviewed(false) }} /></label>
          {selected ? ramSuggestionFields.map(field => <label key={field} className="block text-sm">{labels[field][zh ? 1 : 0]}<textarea rows={2} maxLength={2000} className={ramInput} value={snippet[field] || ''} onChange={e => { setSnippet(s => ({ ...s, [field]: e.target.value })); setPreviewed(false) }} /></label>) : null}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={previewed} onChange={e => setPreviewed(e.target.checked)} /><span>{zh ? '以上为发送预览。我已移除姓名、联系方式、健康和保密信息；不会发送整份 RAM。' : 'This is the sending preview. I removed names, contacts, health and confidential information. The full RAM is not sent.'}</span></label>
          <AppActionButton disabled={!context || !previewed || !brief.trim() || !draft.activities.length} onClick={() => void run(async () => {
            const signature = fingerprint, a = draft.activities.find(x => x.id === (activity || draft.activities[0]?.id))!
            const latest = await ramService.authoringContext(scope); setContext(latest)
            if (latest.sourceVersion !== context?.sourceVersion) throw new Error(zh ? '已保存的活动或 RAM 已改变，请重新载入后再生成建议。' : 'The saved event or RAM changed. Reload before generating suggestions.')
            const result = await ramService.assist({ ...scope, language: zh ? 'zh' : 'en', mode: selected ? 'rewrite' : 'draft', activityType: a.type, category, brief, selectedText: selected ? snippet : {}, sourceVersion: latest.sourceVersion })
            if (currentFingerprint.current === signature) setSuggestion({ result, signature, riskId: selected, activityId: a.id, category, language: zh ? 'zh' : 'en' })
          })}>{busy ? (zh ? '正在起草…' : 'Drafting…') : (zh ? '发送预览并生成建议' : 'Send preview and generate suggestions')}</AppActionButton>
        </fieldset></details>
        {suggestion ? <div className="space-y-3 rounded-xl bg-[#e3f0eb] p-4"><p className="font-semibold">{zh ? '待人工核实的建议' : 'Suggestions requiring human verification'}</p>{suggestion.signature !== fingerprint ? <p role="status">{zh ? '原文或活动条件已改变，请重新生成。' : 'The source or Event conditions changed. Generate new suggestions.'}</p> : null}{ramSuggestionFields.filter(key => suggestion.result.suggestions[key]).map(field => <section key={field}><h4 className="font-semibold">{labels[field][zh ? 1 : 0]}</h4><div className="grid gap-3 sm:grid-cols-2"><p className="whitespace-pre-wrap rounded bg-white/60 p-2 text-sm">{draft.hazards.find(r => r.id === suggestion.riskId)?.[field]?.[suggestion.language] || '—'}</p><p className="whitespace-pre-wrap rounded bg-white p-2 text-sm">{suggestion.result.suggestions[field]}</p></div><AppActionButton variant="secondary" disabled={!editable || busy || suggestion.signature !== fingerprint} onClick={() => adopt(field)}>{zh ? '采纳此项到草稿' : 'Adopt this suggestion into draft'}</AppActionButton></section>)}<ul className="list-inside list-disc text-sm">{suggestion.result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div> : null}
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? `与最近保存内容对照（${changes.length} 项）` : `Compare with last saved draft (${changes.length})`}</summary><RamChangeList changes={changes} zh={zh} /></details>
      </div>
    </EventToolSection>
    <RamAssessmentFields {...{ draft, update, editable, dirty, zh, focusRequest }} policy={effectivePolicy} evaluatedDraft={currentCheck?.draft} />
    <RamRequiredQuestions {...{ draft, update, editable, zh, eventId }} policy={effectivePolicy} />
    {confirmationModal}
  </div></RamEditingLanguage.Provider>
}

export function RamChangeList({ changes, zh }: { changes: ReturnType<typeof ramChanges>; zh: boolean }) {
  const names: Record<string, [string, string]> = { type: ['Activity type', '项目类型'], categoryCode: ['Risk category', '风险类别'], activityId: ['Linked activity', '所属项目'], riskScore: ['Initial score', '初始评分'], residualScore: ['Residual score', '剩余评分'], initialLevel: ['Initial level', '初始等级'], residualLevel: ['Residual level', '剩余等级'], participantCount: ['Participants', '参与人数'], authorAttendsAndLeads: ['Author attends and leads', '填表人出席并领导'], onsiteMemberId: ['On-site leader', '现场负责人'], weatherConfirmation: ['Weather and alternatives', '天气及替代安排'], accommodation: ['Accommodation', '住宿'], transport: ['Transport', '交通'], isOuting: ['Outdoor / off-site', '室外／场外'], isOvernight: ['Overnight', '过夜'], isHighRisk: ['High-risk activity', '高风险活动'], activities: ['Activity', '活动项目'], hazards: ['Risk', '风险'], answers: ['Answer', '答案'], name: ['Name', '名称'], hazard: labels.hazard as [string, string], consequence: labels.consequence as [string, string], controlMeasures: labels.controlMeasures as [string, string], additionalAction: labels.additionalAction as [string, string], personResponsible: ['Responsible person', '负责人'], likelihood: ['Initial likelihood', '初始可能性'], impact: ['Initial impact', '初始影响'], residualLikelihood: ['Residual likelihood', '剩余可能性'], residualImpact: ['Residual impact', '剩余影响'], answer: ['Answer', '答案'], notApplicable: ['Not applicable', '不适用'], reason: ['Reason', '原因'] }
  const display = (value: unknown): string => {
    if (value == null || value === '') return '—'
    if (typeof value === 'boolean') return value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')
    if (typeof value !== 'object') return String(value)
    const record = value as Record<string, unknown>
    if ('en' in record || 'zh' in record) return [record.zh, record.en].filter(Boolean).join('\n')
    return Object.entries(record).filter(([key]) => names[key]).map(([key, v]) => `${names[key][zh ? 1 : 0]}: ${display(v)}`).join('\n') || (zh ? '内容已改变' : 'Content changed')
  }
  return <div className="space-y-3">{!changes.length ? <p className="text-sm">{zh ? '没有内容变化。' : 'No content changes.'}</p> : changes.map((row, index) => <details className="rounded-xl border p-3" key={row.key}><summary className="min-h-10 cursor-pointer break-words text-sm">{index + 1}. {names[row.key.split(':')[0]]?.[zh ? 1 : 0] || (zh ? '其他资料' : 'Other details')}</summary><div className="grid min-w-0 gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold">{zh ? '之前' : 'Before'}</p><p className="whitespace-pre-wrap break-words rounded bg-red-50 p-2 text-sm">{display(row.before)}</p></div><div><p className="text-xs font-semibold">{zh ? '当前' : 'Current'}</p><p className="whitespace-pre-wrap break-words rounded bg-emerald-50 p-2 text-sm">{display(row.after)}</p></div></div></details>)}</div>
}
