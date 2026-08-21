const isGroupWorkspaceSectionPath = (pathname: string) =>
  pathname === '/groups' ||
  pathname === '/groups/manage' ||
  /^\/groups\/(?!select$|join$|manage$)[^/]+(?:\/manage)?$/.test(pathname)

const isAdminGroupWorkspacePath = (pathname: string) =>
  /^\/admin\/groups\/[^/]+$/.test(pathname)

export const isForumFeedPath = (pathname: string) =>
  pathname === '/forum' ||
  pathname === '/church/forum' ||
  pathname === '/groups/forum' ||
  /^\/groups\/[^/]+\/forum$/.test(pathname)

const getChurchLifeTransitionKey = (pathname: string, search: string) => {
  if (pathname === '/church/albums') return pathname
  if (pathname !== '/church') return null

  const section = new URLSearchParams(search).get('section')?.trim()
  return section === 'events' || section === 'announcements'
    ? `${pathname}?section=${section}`
    : pathname
}

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
  const churchLifeTransitionKey = getChurchLifeTransitionKey(pathname, search)
  if (churchLifeTransitionKey) return churchLifeTransitionKey
  if (
    pathname === '/study' ||
    isGroupWorkspaceSectionPath(pathname) ||
    isAdminGroupWorkspacePath(pathname) ||
    isForumFeedPath(pathname)
  ) return pathname
  return pathname + search
}
