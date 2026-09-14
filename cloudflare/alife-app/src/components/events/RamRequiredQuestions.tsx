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
  return <EventToolSection summary={`${completed}/${total}`} title={zh ? '适用必答题' : 'Required questions'}>
    {!policy ? <p>{zh ? '教会政策发布后显示必答题；现在可保存草稿。' : 'Required questions appear after church policy publication. Drafts can still be saved.'}</p> : draft.activities.map(a => <section key={a.id} className="mb-6 space-y-3"><h3 className="font-bold">{text(a.name, zh)}</h3>{policy.questions.filter(q => q.activityType === 'generic' || q.activityType === a.type).map(q => {
      const key = ramQuestionKey(q), helpKey = `${a.id}:${key}:${zh}`
      const answer = draft.answers.find(r => r.activityId === a.id && r.questionCode === key) || { activityId: a.id, questionCode: key, answer: ramText(), notApplicable: false, reason: ramText() }
      const change = (fields: Partial<typeof answer>) => update({ answers: [...draft.answers.filter(r => !(r.activityId === a.id && r.questionCode === key)), { ...answer, ...fields }] })
      return <fieldset key={key} data-ram-field={`ram.answer.${a.id}.${key}`} disabled={!editable} className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-semibold">{text(q.text, zh)}</legend>
        <details><summary className="min-h-10 cursor-pointer py-2 text-sm text-[#176b5a]">{zh ? '解释与追问提示' : 'Explanation and follow-up prompts'}</summary><p className="text-sm">{text(q.guidance, zh)}</p>
          {eventId ? <AppActionButton variant="secondary" disabled={!!busy} onClick={() => { setBusy(helpKey); setError(''); void ramService.guidance(eventId, a.type, q.categoryCode, zh ? 'zh' : 'en').then(result => setGuidance(g => ({ ...g, [helpKey]: result }))).catch(() => setError(helpKey)).finally(() => setBusy('')) }}>{busy === helpKey ? (zh ? '正在解释…' : 'Explaining…') : (zh ? '请 AI 解释此类风险' : 'Ask AI to explain this risk category')}</AppActionButton> : null}
          {error === helpKey ? <p role="status">{zh ? 'AI 暂不可用。仍可查看上述提示并继续人工作答。' : 'AI is unavailable. Use the guidance above and continue answering manually.'}</p> : null}
          {guidance[helpKey] ? <aside className="rounded-xl bg-[#e3f0eb] p-3 text-sm"><p>{guidance[helpKey].explanation}</p><ul>{guidance[helpKey].questions.map((x, i) => <li key={i}>{x}</li>)}</ul></aside> : null}
        </details>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={answer.notApplicable} onChange={e => change({ notApplicable: e.target.checked })} />{zh ? '不适用（须说明原因）' : 'Not applicable (reason required)'}</label>
        <RamTextField label={answer.notApplicable ? (zh ? '不适用原因' : 'Reason not applicable') : (zh ? '人工作答' : 'Human answer')} value={answer.notApplicable ? answer.reason : answer.answer} onChange={t => change(answer.notApplicable ? { reason: t } : { answer: t })} />
      </fieldset>
    })}</section>)}
  </EventToolSection>
}
