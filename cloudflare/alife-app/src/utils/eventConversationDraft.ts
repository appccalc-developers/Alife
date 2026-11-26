import type { CreationDraft } from './eventCreationDraft.ts'
import { invalidateArrangementConfirmation } from './eventCreationDraft.ts'
import { applyDetailsResult } from './eventDetailsAssistant.ts'
import { applyActivityPlanAssistantForm } from './eventFormAssistant.ts'
import { emptyActivityPlan } from '../types/eventActivityPlan.ts'
import type { DetailsResult } from '../../../shared/eventDetails.ts'
import type { FormAssistantResult } from '../../../shared/eventFormAssistant.ts'

// Adopt both validated responses atomically. A project suggestion can never
// inherit human acceptance of different attributes, content or conditions.
export function applyConversationDraft(draft: CreationDraft, details: DetailsResult, projects: FormAssistantResult, message: string): CreationDraft {
  const next = applyDetailsResult(draft, details, message)
  const previousPlan = draft.activityPlan ?? emptyActivityPlan()
  const plan = applyActivityPlanAssistantForm(previousPlan, projects.form, projects.adoptedFields)
  plan.activities = plan.activities.map(activity => {
    const previous = previousPlan.activities.find(item => item.id === activity.id)
    if (previous && JSON.stringify(previous) === JSON.stringify(activity)) return activity
    return { ...activity, presetConfirmed: false, answers: Object.fromEntries(Object.entries(activity.answers).map(([key, answer]) => [key, { ...answer, confirmed: false }])) }
  })
  return invalidateArrangementConfirmation({ ...next, activityPlan: plan })
}
