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

export const isHomeLocation = (location: RouteLocation) =>
  location.pathname === '/' ||
  (location.pathname === '/home' && !hasPublicPageMenuName(location.search))

export const isAuthOptionalLocation = (location: RouteLocation) =>
  isHomeLocation(location) || isPublicPageLocation(location)
