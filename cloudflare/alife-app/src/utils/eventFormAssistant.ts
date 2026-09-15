import type { RegistrationRules } from '../services/eventRegistrationWorkService'
import { formAssistantFields, type AssistantForm } from '../../../shared/eventFormAssistant.ts'
import { localTimeToUtc } from '../../../shared/eventDetails.ts'

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
