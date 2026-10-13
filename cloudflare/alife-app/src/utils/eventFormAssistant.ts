import { activityAttributes } from '../../../shared/activityAttributes.ts'
import type { RegistrationRules } from '../services/eventRegistrationWorkService'
import { formAssistantFields, type AssistantForm } from '../../../shared/eventFormAssistant.ts'
import { localTimeToUtc } from '../../../shared/eventDetails.ts'
import type { ActivityPlanData } from '../types/eventActivityPlan'
import { newProjectAnswers } from './eventProjectQuestionnaire.ts'

const local = (iso: string) => {
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
}
export function registrationAssistantForm(draft: RegistrationRules): AssistantForm {
  return Object.fromEntries(Object.keys(formAssistantFields.registration).map(key => [key,
    key === 'opensLocal' ? local(draft.opensUtc) : key === 'deadlineLocal' ? local(draft.deadlineUtc) : draft[key as keyof RegistrationRules],
  ]))
}
export function applyRegistrationAssistantForm(draft: RegistrationRules, form: AssistantForm, fields: string[], timeZone: string): RegistrationRules {
  const next = { ...draft }
  for (const key of fields) {
    if (!Object.hasOwn(formAssistantFields.registration, key)) continue
    if (key === 'opensLocal') next.opensUtc = localTimeToUtc(String(form[key]), timeZone)
    else if (key === 'deadlineLocal') next.deadlineUtc = localTimeToUtc(String(form[key]), timeZone)
    else if (key === 'materials') next.materials = (form.materials as RegistrationRules['materials']).map(m => ({ ...m, id: m.id || crypto.randomUUID() }))
    else Object.assign(next, { [key]: form[key] })
  }
  return next
}

export function activityPlanAssistantForm(draft: ActivityPlanData): AssistantForm {
  return {
    activities: draft.activities.map(activity => ({ id:activity.id, name:activity.name, conditions:activity.conditions, attributes:activityAttributes(activity), occurrenceId:activity.occurrenceId ?? null })),
    participantCount: draft.participantCount,
    isOuting: draft.isOuting,
    isOvernight: draft.isOvernight,
    isHighRisk: draft.isHighRisk,
  }
}

export function applyActivityPlanAssistantForm(draft: ActivityPlanData, form: AssistantForm, fields: string[]): ActivityPlanData {
  const current = draft
  const next = { ...current }
  for (const key of fields) {
    if (!Object.hasOwn(formAssistantFields.activityPlan, key)) continue
    if (key === 'activities') next.activities = (form.activities as ActivityPlanData['activities']).map(activity => {
      const previous=current.activities.find(item=>item.id===activity.id)
      return {...previous,...activity,id:activity.id||crypto.randomUUID(),answers:previous?.answers??newProjectAnswers(),sourcePresetKey:previous?.sourcePresetKey??null,sourceTemplateVersion:previous?.sourceTemplateVersion??null,presetConfirmed:previous?.sourcePresetKey&&JSON.stringify(previous.attributes)!==JSON.stringify(activity.attributes)?false:previous?.presetConfirmed??false,occurrenceId:activity.occurrenceId??null}
    })
    else if (key === 'participantCount') next.participantCount = form.participantCount as number | null
    else if (key === 'isOuting') next.isOuting = form.isOuting as boolean
    else if (key === 'isOvernight') next.isOvernight = form.isOvernight as boolean
    else if (key === 'isHighRisk') next.isHighRisk = form.isHighRisk as boolean
  }
  return next
}
