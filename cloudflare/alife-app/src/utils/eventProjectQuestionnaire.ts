import type { PlannedActivity } from '../types/eventActivityPlan.ts'
import type { EventActivityType } from '../types/eventComposition.ts'
import { generalProjectQuestionCodes, movedEventQuestionFacts, projectQuestionCodes, type EventProjectQuestionDefinition, type ProjectAnswer } from '../types/eventProjectQuestionnaire.ts'

const generalCodes = new Set<string>(generalProjectQuestionCodes)
const movedCodes = new Set<string>(Object.keys(movedEventQuestionFacts))
export const newProjectAnswers = (): Record<string, ProjectAnswer> => Object.fromEntries(generalProjectQuestionCodes.map(code => [code, { value: 'no', source: 'human', confirmed: true }]))
export const templateEventSuggestions = (activities: PlannedActivity[], template: EventActivityType) => (template.presetProjects ?? []).filter(preset => activities.some(activity => activity.sourcePresetKey === preset.presetKey))
export const applicableProjectQuestions = (activity: Pick<PlannedActivity, 'attributes'>, definitions: EventProjectQuestionDefinition[]) => definitions.filter(question => !movedCodes.has(question.code) && (generalCodes.has(question.code) || question.appliesToAttributes.some(attribute => activity.attributes.includes(attribute))))
export const projectNeedsConfirmation = (activity: PlannedActivity, definitions: EventProjectQuestionDefinition[]) => Boolean(activity.sourcePresetKey && (!activity.presetConfirmed || applicableProjectQuestions(activity, definitions).some(question => { const answer = activity.answers?.[question.code]; return answer?.source === 'template' && answer.value !== 'unknown' && !answer.confirmed })))
export const confirmProjectPreset = (activity: PlannedActivity, definitions: EventProjectQuestionDefinition[]): PlannedActivity => {
  const applicable = new Set(applicableProjectQuestions(activity, definitions).map(question => question.code))
  const answers = { ...newProjectAnswers(), ...activity.answers }
  return { ...activity, presetConfirmed: true, answers: Object.fromEntries(Object.entries(answers).map(([code, answer]) => [code, generalCodes.has(code) && answer.value !== 'yes'
    ? { value: 'no', source: 'human', confirmed: true }
    : applicable.has(code) && answer.value !== 'unknown' ? { ...answer, confirmed: true } : answer])) }
}
export const projectRequiresRegistration = (activity: PlannedActivity) => activity.answers?.projectSelection?.value === 'yes'
export const projectModuleRequirements = (activity: PlannedActivity, definitions: EventProjectQuestionDefinition[]) => [...new Set(applicableProjectQuestions(activity, definitions).filter(question => activity.answers?.[question.code]?.value === 'yes').flatMap(question => question.requiredModules))]
export function applyTemplateProjects(activities: PlannedActivity[], template: EventActivityType): PlannedActivity[] {
  return [...activities.filter(activity => !activity.sourcePresetKey), ...(template.presetProjects ?? []).map(preset => ({
    id: crypto.randomUUID(), name: { ...preset.name }, conditions: { ...preset.conditions }, attributes: [...preset.attributes],
    sourcePresetKey: preset.presetKey, sourceTemplateVersion: template.version, presetConfirmed: false, occurrenceId: null, startUtc: null, endUtc: null,
    repeatForEachOccurrence: preset.repeatForEachOccurrence,
    defaultConfiguration: preset.defaultConfiguration ? structuredClone(preset.defaultConfiguration) : undefined,
    answers: Object.fromEntries(projectQuestionCodes.filter(code => !movedCodes.has(code) || code in preset.defaultAnswers).map(code => [code, generalCodes.has(code) && preset.defaultAnswers[code] !== 'yes'
      ? { value: 'no' as const, source: 'human' as const, confirmed: true }
      : { value: preset.defaultAnswers[code] ?? 'unknown', source: 'template' as const, confirmed: false }])),
  }))]
}
