import { activeEntityService } from '../services/activeEntityService'
import { normalizeRouteGroupId } from './groupRouteIds'

export const activateNotificationTarget = (target: string) => {
  const eventMatch = target.match(/^\/groups\/([^/]+)\/events\/([^/?#]+)/)
  if (eventMatch) {
    activeEntityService.setEvent(decodeURIComponent(eventMatch[2]))
    return target
  }

  const groupManageMatch = target.match(/^\/groups\/([^/]+)\/manage(?:\?(.+))?/)
  if (groupManageMatch) return target

  const groupMatch = target.match(/^\/groups\/([^/?#]+)/)
  if (groupMatch) {
    const groupId = normalizeRouteGroupId(decodeURIComponent(groupMatch[1]))
    if (!groupId) return target
    return target
  }

  const pageEditMatch = target.match(/^\/pages\/([^/]+)\/edit/)
  if (pageEditMatch) {
    activeEntityService.setPage(decodeURIComponent(pageEditMatch[1]))
    return '/pages/edit'
  }

  const pageMatch = target.match(/^\/pages\/([^/?#]+)/)
  if (pageMatch) {
    activeEntityService.setPage(decodeURIComponent(pageMatch[1]))
    return '/pages'
  }

  const sermonMatch = target.match(/^\/sermons\/([^/?#]+)/)
  if (sermonMatch && sermonMatch[1] !== 'watch') {
    activeEntityService.setSermon(decodeURIComponent(sermonMatch[1]))
    return '/sermons/watch'
  }

  return target
}
