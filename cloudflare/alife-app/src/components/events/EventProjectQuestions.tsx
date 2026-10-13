import type { PlannedActivity } from '../../types/eventActivityPlan'
import { generalProjectQuestionCodes, type EventProjectQuestionDefinition, type ProjectAnswerValue } from '../../types/eventProjectQuestionnaire'
import { applicableProjectQuestions, confirmProjectPreset, projectNeedsConfirmation } from '../../utils/eventProjectQuestionnaire'
import { eventProjectQuestionnaireText as copy } from '../../i18n/eventProjectQuestionnaire'
import { displayRamText as text } from '../../types/ramGovernance'
import EventPolicyHelp from './EventPolicyHelp'
import AppActionButton from '../layout/AppActionButton'

export default function EventProjectQuestions({ activity, definitions, onChange, zh, disabled = false }: { activity: PlannedActivity; definitions: EventProjectQuestionDefinition[]; onChange: (activity: PlannedActivity) => void; zh: boolean; disabled?: boolean }) {
  const questions = applicableProjectQuestions(activity, definitions)
  const general = questions.filter(question => generalProjectQuestionCodes.some(code => code === question.code))
  const specialist = questions.filter(question => !general.includes(question))
  const known = questions.filter(question => activity.answers?.[question.code]?.value && activity.answers[question.code].value !== 'unknown').length
  const pending = projectNeedsConfirmation(activity, definitions)
  const answer = (code: string, value: ProjectAnswerValue) => onChange({ ...activity, answers: { ...activity.answers, [code]: { value, source: 'human', confirmed: true } } })
  return <section className="space-y-3" data-project-questions>
    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{text(copy.questions, zh)}</h3><span className="text-xs text-[#66766f]">{zh ? copy.knownAnswers.zh(known, questions.length) : copy.knownAnswers.en(known, questions.length)}</span></div>
    {!questions.length ? <p role="status" className="text-sm">{text(copy.awaitingDirectory, zh)}</p> : null}
    {general.length ? <fieldset className="space-y-2"><legend className="font-semibold text-sm">{text(copy.projectArrangements, zh)}</legend><div className="flex flex-wrap items-center gap-2 text-xs text-[#66766f]"><EventPolicyHelp zh={zh} label={text(copy.projectArrangements, zh)} text={text(copy.uncheckedMeansNo, zh)} /></div><div className="grid gap-2 sm:grid-cols-2">{general.map(question => <label key={question.code} data-project-question={question.code} className="flex min-h-11 items-center gap-2 rounded-lg border border-violet-100 px-3 py-2 text-sm"><input type="checkbox" disabled={disabled} checked={activity.answers?.[question.code]?.value === 'yes'} onChange={event => answer(question.code, event.target.checked ? 'yes' : 'no')} /><span>{text(question.question, zh)}</span></label>)}</div></fieldset> : null}
    {specialist.length ? <fieldset className="space-y-2"><legend className="font-semibold text-sm">{text(copy.attributeQuestions, zh)}</legend>{specialist.map(question => <label key={question.code} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 px-3 py-2 text-sm" data-project-question={question.code}>
      <span className="min-w-0 flex-1">{text(question.question, zh)}</span>
      {question.unavailableModules.length && activity.answers?.[question.code]?.value === 'yes' ? <EventPolicyHelp zh={zh} warning label={text(question.question, zh)} text={zh ? copy.unavailableDetails.zh(question.unavailableModules.map(code => text(copy.moduleNames[code], zh)).join(' · ')) : copy.unavailableDetails.en(question.unavailableModules.map(code => text(copy.moduleNames[code], zh)).join(' · '))} /> : null}
      <select disabled={disabled} className="min-h-11 max-w-full rounded-lg border border-violet-200 bg-white px-3" value={activity.answers?.[question.code]?.value ?? 'unknown'} onChange={event => answer(question.code, event.target.value as ProjectAnswerValue)}>
        {(['unknown', 'yes', 'no'] as const).map(value => <option key={value} value={value}>{text(copy[value], zh)}</option>)}
      </select>
    </label>)}</fieldset> : null}
    {activity.sourcePresetKey ? <div className="flex flex-wrap items-center gap-2 text-sm"><span data-project-confirmation-state className={pending ? 'text-amber-900' : 'text-[#176b5a]'}>{text(pending ? copy.templatePending : copy.reviewed, zh)}</span><EventPolicyHelp zh={zh} label={text(copy.confirmProject, zh)} text={text(copy.confirmHelp, zh)} />{pending ? <AppActionButton disabled={disabled || !definitions.length} onClick={() => onChange(confirmProjectPreset(activity, definitions))}>{text(copy.confirmProject, zh)}</AppActionButton> : null}</div> : null}
  </section>
}
