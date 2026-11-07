import { assistantObject, readFormAssistantInput, type FormAssistantInput } from './eventFormAssistant.ts'

export type CreationProjectAssistantInput = Omit<FormAssistantInput, 'eventId' | 'scope'> & { groupId: string }

// Reuse the strict activity-plan schema while keeping the public creation route
// separate from saved Event identifiers and every other assistant scope.
export function readCreationProjectAssistantInput(value: unknown): FormAssistantInput {
  if (!assistantObject(value) || typeof value.groupId !== 'string' || Object.hasOwn(value, 'eventId') || Object.hasOwn(value, 'scope')) throw new Error('Invalid creation project assistance request.')
  const { groupId, ...fields } = value
  return readFormAssistantInput({ ...fields, eventId: groupId, scope: 'activityPlan' })
}
