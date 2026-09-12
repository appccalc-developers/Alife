// Use a small allowlist, not recursive copying of arbitrary RAM, contacts, medical data or JSON strings.
const eventFields = ['id', 'title', 'description', 'purpose', 'locationName', 'startDate', 'endDate', 'timeZone', 'registrationDeadline', 'maxCapacity', 'capacityUnit', 'visibility', 'optionalActivities', 'currency']
export function publicEventAiFacts(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const value = input as Record<string, unknown>
  return Object.fromEntries(eventFields.filter(key => key in value).map(key => [key, value[key]]))
}
export function eventAiContext(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {}
  const c = input as Record<string, unknown>
  const context = c.eventContext && typeof c.eventContext === 'object' ? c.eventContext as Record<string, unknown> : {}
  return { language: c.language, eventId: c.eventId, groupId: c.groupId, eventData: publicEventAiFacts(c.eventData || context.eventData) }
}
