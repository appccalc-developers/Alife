export type RouteLocation = {
  pathname: string
  search: string
}

const hasPublicPageMenuName = (search: string) =>
  Boolean(new URLSearchParams(search).get('page')?.trim())

export const isPublicPagePath = (pathname: string) =>
  /^\/public\/pages\/[^/]+$/.test(pathname)

export const isPublicPageLocation = (location: RouteLocation) =>
  isPublicPagePath(location.pathname) ||
  (location.pathname === '/home' && hasPublicPageMenuName(location.search))

export const isPublicArticlePath = (pathname: string) =>
  pathname === '/articles' || /^\/articles\/[^/]+$/.test(pathname)

export const isHomeLocation = (location: RouteLocation) =>
  location.pathname === '/' ||
  (location.pathname === '/home' && !hasPublicPageMenuName(location.search))

export const usesPublicHomeLayout = (location: RouteLocation) =>
  isHomeLocation(location) || isPublicPageLocation(location)

export const isVirtualChurchSceneLocation = (location: RouteLocation) =>
  location.pathname === '/virtual-church'
  || location.pathname === '/virtual-church/study-room'
  || location.pathname === '/virtual-church/main-hall'

export const usesVirtualChurchSceneShell = (location: RouteLocation, guestVisitEnabled: boolean) =>
  guestVisitEnabled && isVirtualChurchSceneLocation(location)

export const isAuthOptionalLocation = (location: RouteLocation, guestVirtualChurchEnabled = false) =>
  isHomeLocation(location)
  || isPublicPageLocation(location)
  || isPublicArticlePath(location.pathname)
  || (guestVirtualChurchEnabled && isVirtualChurchSceneLocation(location))
