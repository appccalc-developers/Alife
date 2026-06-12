const RESERVED_GROUP_ROUTE_SEGMENTS = new Set(['join', 'manage'])

export const normalizeRouteGroupId = (value: string | null | undefined) => {
  const groupId = value?.trim() ?? ''
  return groupId && !RESERVED_GROUP_ROUTE_SEGMENTS.has(groupId) ? groupId : ''
}
