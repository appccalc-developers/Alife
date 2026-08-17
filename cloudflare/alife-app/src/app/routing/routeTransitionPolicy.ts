const isGroupWorkspaceSectionPath = (pathname: string) =>
  pathname === '/groups' ||
  pathname === '/groups/manage' ||
  /^\/groups\/(?!select$|join$|manage$)[^/]+(?:\/manage)?$/.test(pathname)

export const isForumFeedPath = (pathname: string) =>
  pathname === '/forum' ||
  pathname === '/church/forum' ||
  /^\/groups\/[^/]+\/forum$/.test(pathname)

export const getRouteTransitionKey = ({
  pathname,
  search,
  isManagedPublicPage,
}: {
  pathname: string
  search: string
  isManagedPublicPage: boolean
}) => {
  if (isManagedPublicPage) return 'managed-public-page'
  if (pathname === '/study' || isGroupWorkspaceSectionPath(pathname) || isForumFeedPath(pathname)) return pathname
  return pathname + search
}
