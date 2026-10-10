import { ramRequiredQuestionsText } from '../../i18n/ramRequiredQuestions.ts'
import { useState } from 'react'
import type { RamDraft, RamPolicyData } from '../../types/ramGovernance'
import { displayRamText as text, ramQuestionKey, ramText } from '../../types/ramGovernance'
import { ramService } from '../../services/ramGovernanceService'
import { EventToolSection } from './ArrangementTileDeck'
import { RamTextField } from './RamFields'
import AppActionButton from '../layout/AppActionButton'

export default function RamRequiredQuestions({ draft, update, policy, editable, zh, eventId }: { draft: RamDraft; update: (change: Partial<RamDraft>) => void; policy?: RamPolicyData; editable: boolean; zh: boolean; eventId?: string }) {
  const [guidance, setGuidance] = useState<Record<string, { explanation: string; questions: string[] }>>({})
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const total = draft.activities.reduce((count, a) => count + (policy?.questions.filter(q => q.activityType === 'generic' || q.activityType === a.type).length ?? 0), 0)
  const completed = draft.activities.reduce((count, a) => count + (policy?.questions.filter(q => q.activityType === 'generic' || q.activityType === a.type).filter(q => { const value = draft.answers.find(x => x.activityId === a.id && x.questionCode === ramQuestionKey(q)); return value && text(value.notApplicable ? value.reason : value.answer, zh).trim() }).length ?? 0), 0)
  return <EventToolSection summary={policy ? (zh ? ramRequiredQuestionsText.questionsAnswered.zh(completed, total) : ramRequiredQuestionsText.questionsAnswered.en(completed, total)) : (zh ? ramRequiredQuestionsText.questionLibraryNotReady.zh : ramRequiredQuestionsText.questionLibraryNotReady.en)} title={zh ? ramRequiredQuestionsText.requiredQuestions.zh : ramRequiredQuestionsText.requiredQuestions.en}>
    {!policy ? <p>{zh ? ramRequiredQuestionsText.requiredQuestionsAppearAfterChurchPolicyPublicationDraftsCan.zh : ramRequiredQuestionsText.requiredQuestionsAppearAfterChurchPolicyPublicationDraftsCan.en}</p> : draft.activities.map(a => <section key={a.id} className="mb-6 space-y-3"><h3 className="font-bold">{text(a.name, zh)}</h3>{policy.questions.filter(q => q.activityType === 'generic' || q.activityType === a.type).map(q => {
      const key = ramQuestionKey(q), helpKey = `${a.id}:${key}:${zh}`
      const answer = draft.answers.find(r => r.activityId === a.id && r.questionCode === key) || { activityId: a.id, questionCode: key, answer: ramText(), notApplicable: false, reason: ramText() }
      const change = (fields: Partial<typeof answer>) => update({ answers: [...draft.answers.filter(r => !(r.activityId === a.id && r.questionCode === key)), { ...answer, ...fields }] })
      return <fieldset key={key} data-ram-field={`ram.answer.${a.id}.${key}`} disabled={!editable} className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-semibold">{text(q.text, zh)}</legend>
        <details><summary className="min-h-10 cursor-pointer py-2 text-sm text-[#176b5a]">{zh ? ramRequiredQuestionsText.explanationAndFollowUpPrompts.zh : ramRequiredQuestionsText.explanationAndFollowUpPrompts.en}</summary><p className="text-sm">{text(q.guidance, zh)}</p>
          {eventId ? <AppActionButton variant="secondary" disabled={!!busy} onClick={() => { setBusy(helpKey); setError(''); void ramService.guidance(eventId, a.type, q.categoryCode, zh ? 'zh' : 'en').then(result => setGuidance(g => ({ ...g, [helpKey]: result }))).catch(() => setError(helpKey)).finally(() => setBusy('')) }}>{busy === helpKey ? (zh ? ramRequiredQuestionsText.explaining.zh : ramRequiredQuestionsText.explaining.en) : (zh ? ramRequiredQuestionsText.askAiToExplainThisRiskCategory.zh : ramRequiredQuestionsText.askAiToExplainThisRiskCategory.en)}</AppActionButton> : null}
          {error === helpKey ? <p role="status">{zh ? ramRequiredQuestionsText.aiIsUnavailableUseTheGuidanceAboveAndContinue.zh : ramRequiredQuestionsText.aiIsUnavailableUseTheGuidanceAboveAndContinue.en}</p> : null}
          {guidance[helpKey] ? <aside className="rounded-xl bg-[#e3f0eb] p-3 text-sm"><p>{guidance[helpKey].explanation}</p><ul>{guidance[helpKey].questions.map((x, i) => <li key={i}>{x}</li>)}</ul></aside> : null}
        </details>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={answer.notApplicable} onChange={e => change({ notApplicable: e.target.checked })} />{zh ? ramRequiredQuestionsText.notApplicableReasonRequired.zh : ramRequiredQuestionsText.notApplicableReasonRequired.en}</label>
        <RamTextField label={answer.notApplicable ? (zh ? ramRequiredQuestionsText.reasonNotApplicable.zh : ramRequiredQuestionsText.reasonNotApplicable.en) : (zh ? ramRequiredQuestionsText.humanAnswer.zh : ramRequiredQuestionsText.humanAnswer.en)} value={answer.notApplicable ? answer.reason : answer.answer} onChange={t => change(answer.notApplicable ? { reason: t } : { answer: t })} />
      </fieldset>
    })}</section>)}
  </EventToolSection>
}
