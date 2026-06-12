import { useEffect, useState } from 'react'
import { ACTIVE_ENTITY_CHANGED_EVENT, activeEntityService, type ActiveEntityIds, type ActiveEntityUpdate } from '../services/activeEntityService'

export const useActiveEntityIds = (routeIds: ActiveEntityUpdate = {}): ActiveEntityIds => {
  const [ids, setIds] = useState<ActiveEntityIds>(() => activeEntityService.resolve(routeIds))

  useEffect(() => {
    setIds(activeEntityService.set(routeIds))
  }, [routeIds.eventId, routeIds.groupId, routeIds.pageId, routeIds.sermonId])

  useEffect(() => {
    const handleChange = () => {
      setIds(activeEntityService.resolve(routeIds))
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
