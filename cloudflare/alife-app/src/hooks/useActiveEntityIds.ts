import { useEffect, useState } from 'react'
import { ACTIVE_ENTITY_CHANGED_EVENT, activeEntityService, type ActiveEntityIds, type ActiveEntityUpdate } from '../services/activeEntityService'
import { normalizeRouteGroupId } from '../utils/groupRouteIds'

export const useActiveEntityIds = (routeIds: ActiveEntityUpdate = {}): ActiveEntityIds => {
  const routeGroupId = routeIds.groupId === undefined ? undefined : normalizeRouteGroupId(routeIds.groupId) || undefined
  const normalizedRouteIds = {
    ...routeIds,
    groupId: routeGroupId,
  }
  const [ids, setIds] = useState<ActiveEntityIds>(() => activeEntityService.resolve(normalizedRouteIds))

  useEffect(() => {
    activeEntityService.set({
      pageId: normalizedRouteIds.pageId,
      eventId: normalizedRouteIds.eventId,
      sermonId: normalizedRouteIds.sermonId,
    })
    setIds(activeEntityService.resolve(normalizedRouteIds))
  }, [routeIds.eventId, routeIds.groupId, routeIds.pageId, routeIds.sermonId])

  useEffect(() => {
    const handleChange = () => {
      setIds(activeEntityService.resolve(normalizedRouteIds))
    }

    window.addEventListener(ACTIVE_ENTITY_CHANGED_EVENT, handleChange)
    window.addEventListener('storage', handleChange)

    return () => {
      window.removeEventListener(ACTIVE_ENTITY_CHANGED_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [routeIds.eventId, routeIds.groupId, routeIds.pageId, routeIds.sermonId])

  return ids
}
