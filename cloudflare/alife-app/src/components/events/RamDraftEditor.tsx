import { ramDraftEditorText } from '../../i18n/ramDraftEditor.ts'
import { useEffect, useRef, useState } from 'react'
import type { RamDraft, RamPolicyData, RamRisk } from '../../types/ramGovernance'
import { activityAttributes, displayRamText as text, ramText } from '../../types/ramGovernance'
import { ramService } from '../../services/ramGovernanceService'
import { normalizeApiError } from '../../services/http'
import { ramChanges, ramDraftFingerprint, ramSuggestionFields } from '../../utils/ramAuthoring'
import RamAssessmentFields from './RamAssessmentFields'
import RamRatingSummary from './RamRatingSummary'
import { previewRam } from '../../utils/ramRatings'
import { RamEditingLanguage, RamLevelBadge, ramInput } from './RamFields'
import { EventToolSection, revealArrangementControl } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'

type Context = Awaited<ReturnType<typeof ramService.authoringContext>>
type Check = Awaited<ReturnType<typeof ramService.check>>
type Suggestion = Awaited<ReturnType<typeof ramService.assist>>
const labels = { hazard: [ramDraftEditorText.hazard.en, ramDraftEditorText.hazard.zh], consequence: [ramDraftEditorText.consequence.en, ramDraftEditorText.consequence.zh], controlMeasures: [ramDraftEditorText.controls.en, ramDraftEditorText.controls.zh], additionalAction: [ramDraftEditorText.additionalAction.en, ramDraftEditorText.additionalAction.zh] }

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
  return <RamEditingLanguage.Provider value={zh}><div ref={root} className="space-y-4"><RamRatingSummary draft={previewRam(draft,effectivePolicy)} zh={zh} dirty={dirty} level={currentCheck?.residualLevel}/>{!eventId?<div className="space-y-2"><AppActionButton disabled>{zh?ramDraftEditorText.reassessRisksWithAi.zh:ramDraftEditorText.reassessRisksWithAi.en}</AppActionButton><p className="text-sm">{zh?ramDraftEditorText.createAndSaveTheEventFirstAiWillEvaluate.zh:ramDraftEditorText.createAndSaveTheEventFirstAiWillEvaluate.en}</p></div>:null}
    <EventToolSection defaultOpen title={zh ? ramDraftEditorText.draftAssistanceAndChecks.zh : ramDraftEditorText.draftAssistanceAndChecks.en} summary={error ? (zh ? ramDraftEditorText.actionFailedExpandForDetails.zh : ramDraftEditorText.actionFailedExpandForDetails.en) : busy ? (zh ? ramDraftEditorText.working.zh : ramDraftEditorText.working.en) : currentCheck ? (zh ? ramDraftEditorText.issuesToAddress.zh(currentCheck.issues.length) : ramDraftEditorText.issuesToAddress.en(currentCheck.issues.length)) : check ? (zh ? ramDraftEditorText.draftChangedCheckAgain.zh : ramDraftEditorText.draftChangedCheckAgain.en) : !context && (eventId || groupId) ? (zh ? ramDraftEditorText.loading.zh : ramDraftEditorText.loading.en) : (zh ? ramDraftEditorText.readyToCheckTheDraft.zh : ramDraftEditorText.readyToCheckTheDraft.en)}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><AppActionButton disabled={busy || !editable} onClick={() => void run(async () => { const signature = fingerprint; const result = await ramService.check(scope, draft, policyVersionId); if (currentFingerprint.current === signature) setCheck({ result, signature }) })}>{zh ? ramDraftEditorText.checkDraftAndRatings.zh : ramDraftEditorText.checkDraftAndRatings.en}</AppActionButton>
          <AppActionButton variant="secondary" disabled={busy || !editable || !dirty || !changes.length} onClick={() => void requestConfirmation({ title: zh ? ramDraftEditorText.discardUnsavedChanges.zh : ramDraftEditorText.discardUnsavedChanges.en, description: zh ? ramDraftEditorText.restoreTheLastSavedRamAndClearUnadoptedSuggestions.zh : ramDraftEditorText.restoreTheLastSavedRamAndClearUnadoptedSuggestions.en }).then(ok => { if (ok) { update(structuredClone(savedDraft || initial.current)); setSuggestion(null); setCheck(null) } })}>{zh ? ramDraftEditorText.discardUnsavedChanges.zh : ramDraftEditorText.discardUnsavedChanges.en}</AppActionButton>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm">{error}</p> : null}
        {currentCheck ? <div role="status" className="space-y-2"><p>{zh ? ramDraftEditorText.currentDraftRatingNotSaved.zh : ramDraftEditorText.currentDraftRatingNotSaved.en} <RamLevelBadge zh={zh} level={currentCheck.residualLevel} /></p>{currentCheck.issues.length ? <ul className="space-y-1">{currentCheck.issues.map(issue => <li key={issue.field}><button type="button" className="min-h-10 text-left text-sm text-[#176b5a] underline" onClick={() => jump(issue.field)}>{text(issue.message, zh)}</button></li>)}</ul> : <p>{zh ? ramDraftEditorText.completeExplicitSavingAndPersonalConfirmationAreStillRequired.zh : ramDraftEditorText.completeExplicitSavingAndPersonalConfirmationAreStillRequired.en}</p>}</div> : check ? <p className="text-sm">{zh ? ramDraftEditorText.contentChangedCheckTheDraftAgain.zh : ramDraftEditorText.contentChangedCheckTheDraftAgain.en}</p> : null}
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? ramDraftEditorText.aiDraftingRewriting.zh : ramDraftEditorText.aiDraftingRewriting.en}</summary><fieldset disabled={!editable || busy || assistanceDisabled} className="space-y-3">
          {assistanceDisabled ? <p>{zh ? ramDraftEditorText.saveEventChangesBeforeRequestingAiSuggestions.zh : ramDraftEditorText.saveEventChangesBeforeRequestingAiSuggestions.en}</p> : null}
          <label className="block text-sm">{zh ? ramDraftEditorText.workingOn.zh : ramDraftEditorText.workingOn.en}<select className={ramInput} value={selected} onChange={e => selectRisk(e.target.value)}><option value="">{zh ? ramDraftEditorText.draftANewRisk.zh : ramDraftEditorText.draftANewRisk.en}</option>{draft.hazards.map((risk, index) => <option key={risk.id} value={risk.id}>{index + 1}. {text(risk.hazard, zh) || (zh ? ramDraftEditorText.unnamedRisk.zh : ramDraftEditorText.unnamedRisk.en)}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? ramDraftEditorText.activity.zh : ramDraftEditorText.activity.en}<select className={ramInput} value={activity || draft.activities[0]?.id || ''} onChange={e => { setActivity(e.target.value); setPreviewed(false) }}>{draft.activities.map(a => <option value={a.id} key={a.id}>{text(a.name, zh) || (zh ? ramDraftEditorText.unnamedActivity.zh : ramDraftEditorText.unnamedActivity.en)}</option>)}</select></label><label className="text-sm">{zh ? ramDraftEditorText.riskCategory.zh : ramDraftEditorText.riskCategory.en}<select className={ramInput} value={category} onChange={e => { setCategory(e.target.value); setPreviewed(false) }}>{(effectivePolicy?.categories || [{ code: 'environment', name: { ...ramDraftEditorText.environmentName } }, { code: 'activity', name: { ...ramDraftEditorText.activityName } }, { code: 'participants', name: { ...ramDraftEditorText.participantsName } }, { code: 'transport', name: { ...ramDraftEditorText.transportName } }, { code: 'emergency', name: { ...ramDraftEditorText.emergencyName } }]).map(c => <option key={c.code} value={c.code}>{text(c.name, zh)}</option>)}</select></label></div>
          <label className="block text-sm">{zh ? ramDraftEditorText.nonSensitiveActivityBriefToSend.zh : ramDraftEditorText.nonSensitiveActivityBriefToSend.en}<textarea rows={3} maxLength={3000} className={ramInput} value={brief} onChange={e => { setBrief(e.target.value); setPreviewed(false) }} /></label>
          {selected ? ramSuggestionFields.map(field => <label key={field} className="block text-sm">{labels[field][zh ? 1 : 0]}<textarea rows={2} maxLength={2000} className={ramInput} value={snippet[field] || ''} onChange={e => { setSnippet(s => ({ ...s, [field]: e.target.value })); setPreviewed(false) }} /></label>) : null}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={previewed} onChange={e => setPreviewed(e.target.checked)} /><span>{zh ? ramDraftEditorText.thisIsTheSendingPreviewIRemovedNamesContacts.zh : ramDraftEditorText.thisIsTheSendingPreviewIRemovedNamesContacts.en}</span></label>
          <AppActionButton disabled={!context || !previewed || !brief.trim() || !draft.activities.length} onClick={() => void run(async () => {
            const signature = fingerprint, a = draft.activities.find(x => x.id === (activity || draft.activities[0]?.id))!
            const latest = await ramService.authoringContext(scope); setContext(latest)
            if (latest.sourceVersion !== context?.sourceVersion) throw new Error(zh ? ramDraftEditorText.theSavedEventOrRamChangedReloadBeforeGenerating.zh : ramDraftEditorText.theSavedEventOrRamChangedReloadBeforeGenerating.en)
            const result = await ramService.assist({ ...scope, language: zh ? 'zh' : 'en', mode: selected ? 'rewrite' : 'draft', activityType: activityAttributes(a)[0] ?? 'generic', attributes: activityAttributes(a), category, brief, selectedText: selected ? snippet : {}, sourceVersion: latest.sourceVersion })
            if (currentFingerprint.current === signature) setSuggestion({ result, signature, riskId: selected, activityId: a.id, category, language: zh ? 'zh' : 'en' })
          })}>{busy ? (zh ? ramDraftEditorText.drafting.zh : ramDraftEditorText.drafting.en) : (zh ? ramDraftEditorText.sendPreviewAndGenerateSuggestions.zh : ramDraftEditorText.sendPreviewAndGenerateSuggestions.en)}</AppActionButton>
        </fieldset></details>
        {suggestion ? <div className="space-y-3 rounded-xl bg-[#e3f0eb] p-4"><p className="font-semibold">{zh ? ramDraftEditorText.suggestionsRequiringHumanVerification.zh : ramDraftEditorText.suggestionsRequiringHumanVerification.en}</p>{suggestion.signature !== fingerprint ? <p role="status">{zh ? ramDraftEditorText.theSourceOrEventConditionsChangedGenerateNewSuggestions.zh : ramDraftEditorText.theSourceOrEventConditionsChangedGenerateNewSuggestions.en}</p> : null}{ramSuggestionFields.filter(key => suggestion.result.suggestions[key]).map(field => <section key={field}><h4 className="font-semibold">{labels[field][zh ? 1 : 0]}</h4><div className="grid gap-3 sm:grid-cols-2"><p className="whitespace-pre-wrap rounded bg-white/60 p-2 text-sm">{draft.hazards.find(r => r.id === suggestion.riskId)?.[field]?.[suggestion.language] || '—'}</p><p className="whitespace-pre-wrap rounded bg-white p-2 text-sm">{suggestion.result.suggestions[field]}</p></div><AppActionButton variant="secondary" disabled={!editable || busy || suggestion.signature !== fingerprint} onClick={() => adopt(field)}>{zh ? ramDraftEditorText.adoptThisSuggestionIntoDraft.zh : ramDraftEditorText.adoptThisSuggestionIntoDraft.en}</AppActionButton></section>)}<ul className="list-inside list-disc text-sm">{suggestion.result.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div> : null}
        <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? ramDraftEditorText.compareWithLastSavedDraft.zh(changes.length) : ramDraftEditorText.compareWithLastSavedDraft.en(changes.length)}</summary><RamChangeList changes={changes} zh={zh} /></details>
      </div>
    </EventToolSection>
    <RamAssessmentFields eventId={eventId} {...{ draft, update, editable, dirty, zh, focusRequest }} policy={effectivePolicy} evaluatedDraft={currentCheck?.draft} />

    {confirmationModal}
  </div></RamEditingLanguage.Provider>
}

export function RamChangeList({ changes, zh }: { changes: ReturnType<typeof ramChanges>; zh: boolean }) {
  const names: Record<string, [string, string]> = { attributes: [ramDraftEditorText.activityAttributes.en, ramDraftEditorText.activityAttributes.zh], categoryCode: [ramDraftEditorText.riskCategory.en, ramDraftEditorText.riskCategory.zh], activityId: [ramDraftEditorText.linkedActivity.en, ramDraftEditorText.linkedActivity.zh], riskScore: [ramDraftEditorText.initialScore.en, ramDraftEditorText.initialScore.zh], residualScore: [ramDraftEditorText.residualScore.en, ramDraftEditorText.residualScore.zh], initialLevel: [ramDraftEditorText.initialLevel.en, ramDraftEditorText.initialLevel.zh], residualLevel: [ramDraftEditorText.residualLevel.en, ramDraftEditorText.residualLevel.zh], participantCount: [ramDraftEditorText.participants.en, ramDraftEditorText.participants.zh], authorAttendsAndLeads: [ramDraftEditorText.authorAttendsAndLeads.en, ramDraftEditorText.authorAttendsAndLeads.zh], onsiteMemberId: [ramDraftEditorText.onSiteLeader.en, ramDraftEditorText.onSiteLeader.zh], weatherConfirmation: [ramDraftEditorText.weatherAndAlternatives.en, ramDraftEditorText.weatherAndAlternatives.zh], accommodation: [ramDraftEditorText.accommodation.en, ramDraftEditorText.accommodation.zh], transport: [ramDraftEditorText.transport.en, ramDraftEditorText.transport.zh], isOuting: [ramDraftEditorText.outdoorOffSite.en, ramDraftEditorText.outdoorOffSite.zh], isOvernight: [ramDraftEditorText.overnight.en, ramDraftEditorText.overnight.zh], isHighRisk: [ramDraftEditorText.highRiskActivity.en, ramDraftEditorText.highRiskActivity.zh], activities: [ramDraftEditorText.activityLabel.en, ramDraftEditorText.activityLabel.zh], hazards: [ramDraftEditorText.risk.en, ramDraftEditorText.risk.zh], answers: [ramDraftEditorText.answer.en, ramDraftEditorText.answer.zh], name: [ramDraftEditorText.name.en, ramDraftEditorText.name.zh], hazard: labels.hazard as [string, string], consequence: labels.consequence as [string, string], controlMeasures: labels.controlMeasures as [string, string], additionalAction: labels.additionalAction as [string, string], personResponsible: [ramDraftEditorText.responsiblePerson.en, ramDraftEditorText.responsiblePerson.zh], likelihood: [ramDraftEditorText.initialLikelihood.en, ramDraftEditorText.initialLikelihood.zh], impact: [ramDraftEditorText.initialImpact.en, ramDraftEditorText.initialImpact.zh], residualLikelihood: [ramDraftEditorText.residualLikelihood.en, ramDraftEditorText.residualLikelihood.zh], residualImpact: [ramDraftEditorText.residualImpact.en, ramDraftEditorText.residualImpact.zh], answer: [ramDraftEditorText.answer.en, ramDraftEditorText.answer.zh], notApplicable: [ramDraftEditorText.notApplicable.en, ramDraftEditorText.notApplicable.zh], reason: [ramDraftEditorText.reason.en, ramDraftEditorText.reason.zh] }
  const display = (value: unknown): string => {
    if (value == null || value === '') return '—'
    if (typeof value === 'boolean') return value ? (zh ? ramDraftEditorText.yes.zh : ramDraftEditorText.yes.en) : (zh ? ramDraftEditorText.no.zh : ramDraftEditorText.no.en)
    if (typeof value !== 'object') return String(value)
    const record = value as Record<string, unknown>
    if ('en' in record || 'zh' in record) return [record.zh, record.en].filter(Boolean).join('\n')
    return Object.entries(record).filter(([key]) => names[key]).map(([key, v]) => `${names[key][zh ? 1 : 0]}: ${display(v)}`).join('\n') || (zh ? ramDraftEditorText.contentChanged.zh : ramDraftEditorText.contentChanged.en)
  }
  return <div className="space-y-3">{!changes.length ? <p className="text-sm">{zh ? ramDraftEditorText.noContentChanges.zh : ramDraftEditorText.noContentChanges.en}</p> : changes.map((row, index) => <details className="rounded-xl border p-3" key={row.key}><summary className="min-h-10 cursor-pointer break-words text-sm">{index + 1}. {names[row.key.split(':')[0]]?.[zh ? 1 : 0] || (zh ? ramDraftEditorText.otherDetails.zh : ramDraftEditorText.otherDetails.en)}</summary><div className="grid min-w-0 gap-3 sm:grid-cols-2"><div><p className="text-xs font-semibold">{zh ? ramDraftEditorText.before.zh : ramDraftEditorText.before.en}</p><p className="whitespace-pre-wrap break-words rounded bg-red-50 p-2 text-sm">{display(row.before)}</p></div><div><p className="text-xs font-semibold">{zh ? ramDraftEditorText.current.zh : ramDraftEditorText.current.en}</p><p className="whitespace-pre-wrap break-words rounded bg-emerald-50 p-2 text-sm">{display(row.after)}</p></div></div></details>)}</div>
}
