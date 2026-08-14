export const buildEventDetailPath = (groupId: string, eventId: string) =>
  `/groups/${encodeURIComponent(groupId.trim())}/events/${encodeURIComponent(eventId.trim())}`

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
