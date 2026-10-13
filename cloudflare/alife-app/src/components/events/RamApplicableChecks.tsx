import { ramActivityAttributesText as copy } from '../../i18n/ramActivityAttributes'
import { displayRamText as text, ramApplicableQuestions, ramActivityContentName, ramQuestionKey, type RamActivity, type RamQuestion } from '../../types/ramGovernance'
import EventPolicyHelp from './EventPolicyHelp'

export default function RamApplicableChecks({ activity, questions, zh }: { activity: Pick<RamActivity, 'attributes'>; questions?: RamQuestion[] | null; zh: boolean }) {
  const items = questions == null ? [] : ramApplicableQuestions(questions, activity)
  return <details data-applicable-checks className="rounded-xl border border-violet-200 px-3 text-sm">
    <summary className="min-h-11 cursor-pointer py-3 font-semibold">{text(copy.applicable, zh)}{questions != null ? ` · ${items.length}` : ''}</summary>
    <div className="space-y-3 pb-3">
      {questions == null ? <EventPolicyHelp zh={zh} label={text(copy.applicable, zh)} text={text(copy.noPolicy, zh)} /> : !items.length ? <p>{text(copy.noItems, zh)}</p> : items.map(q => <article key={ramQuestionKey(q)} data-applicable-check={ramQuestionKey(q)} className="border-l-2 border-violet-200 pl-3">
        <div className="flex items-start gap-2"><p>{text(q.text, zh)}</p><EventPolicyHelp zh={zh} label={text(copy.guidance, zh)} text={text(q.guidance, zh)} /></div>
        <p className="mt-1 text-xs text-[#66766f]">{text(ramActivityContentName(q.activityType), zh)}</p>
      </article>)}
    </div>
  </details>
}
