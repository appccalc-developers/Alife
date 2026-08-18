export const buildCurrentGroupEventPath = (eventId: string) =>
  `/events/${encodeURIComponent(eventId.trim())}`

export const buildEventDetailPath = (groupId: string, eventId: string) =>
  `/groups/${encodeURIComponent(groupId.trim())}/events/${encodeURIComponent(eventId.trim())}`

export const buildScopedEventDetailPath = (groupId: string, eventId: string, explicitGroup = false) =>
  explicitGroup ? buildEventDetailPath(groupId, eventId) : buildCurrentGroupEventPath(eventId)

export const resolveEventBoundActionUrl = (
  configuredUrl: string,
  groupId: string,
  eventId: string,
) => {
  const normalizedConfiguredUrl = configuredUrl.trim()
  return !normalizedConfiguredUrl || normalizedConfiguredUrl === '/events'
    ? buildEventDetailPath(groupId, eventId)
    : configuredUrl
}
